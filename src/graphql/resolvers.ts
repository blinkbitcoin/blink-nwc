import { AuthenticationError } from "apollo-server-express"

import { Resolvers } from "./__generated__/resolvers-types"
import { mapAndParseErrorForGqlResponse, mapError } from "./error-map"

import { Example } from "@/app"
import {
  createNwcConnection,
  getNwcConnectionByIdForUser,
  nwcConnectionsByUserId,
  revokeNwcConnection,
  revokeAllNwcConnections,
  softDeleteNwcConnection,
  updateNwcConnection,
} from "@/app/manage-connections"
import { GraphQLPublicContextAuth, UserId } from "@/domain/core/index.types"
import client from "@/graphql/internal-client"
import { getApiKeysForNwc } from "@/graphql/internal-client/queries/api-keys"
import { stripSensitiveFields } from "@/domain/utils"
import {
  SUPPORTED_NWC_METHODS,
  SUPPORTED_NWC_NOTIFICATIONS,
  NOSTR_RELAY_PUBLIC_URL,
} from "@/config"
import { getServerKeypair, NwcConnection } from "@/domain/connection"
import { toNwcBudgetFromApiKeyLimits } from "@/domain/nwc-budget"
import { GraphqlNwcPermission } from "@/domain/nwc-permission"
import { Nip47Method } from "@/domain/nostr/nip47-method"
import { NwcNotificationType } from "@/domain/nostr/notification-type"

const toEnumResolver = <T extends Record<string, string>>(obj: T) =>
  Object.fromEntries(Object.values(obj).map((v) => [v.toUpperCase(), v]))

const requireUserId = (userId: string | undefined): UserId => {
  if (!userId) {
    throw new AuthenticationError("Authentication required")
  }

  return userId as UserId
}

const requireAuthorization = (authorization: string | undefined): string => {
  if (!authorization) {
    throw new AuthenticationError("Authentication required")
  }

  return authorization
}

const toGraphqlConnection = (
  connection: NwcConnection,
  budget?: ReturnType<typeof toNwcBudgetFromApiKeyLimits>,
) => {
  const sanitized = stripSensitiveFields(connection)

  return {
    ...sanitized,
    permissions: sanitized.permissions,
    budget: budget ?? null,
  }
}

const budgetsByApiKeyId = async (
  authorization: string | undefined,
): Promise<Map<string, ReturnType<typeof toNwcBudgetFromApiKeyLimits>>> => {
  if (!authorization) {
    return new Map()
  }

  const apiKeys = await getApiKeysForNwc(client, authorization)
  return new Map(
    apiKeys.map((apiKey) => [apiKey.id, toNwcBudgetFromApiKeyLimits(apiKey.limits)]),
  )
}

export const resolvers: Resolvers = {
  Error: {
    __resolveType: () => "GraphQLApplicationError",
  },
  Nip47Method: toEnumResolver(Nip47Method),
  NwcPermission: GraphqlNwcPermission,
  NwcNotificationType: toEnumResolver(NwcNotificationType),
  Query: {
    hello: {
      resolve: async () => {
        const result = await Example.hello()
        if (result instanceof Error) throw mapError(result)
        return result
      },
    },
    nwcConnection: async (
      _,
      { id }: { id: string },
      { user, authorization }: GraphQLPublicContextAuth,
    ) => {
      const userId = requireUserId(user?.id)
      const result = await getNwcConnectionByIdForUser(userId, id)
      if (result instanceof Error) {
        return null
      }

      const budgetMap = await budgetsByApiKeyId(authorization)
      return toGraphqlConnection(
        result,
        result.apiKeyId ? budgetMap.get(result.apiKeyId) : null,
      )
    },
    nwcConnections: async (
      _,
      { includeRevoked }: { includeRevoked?: boolean | null },
      { user, authorization }: GraphQLPublicContextAuth,
    ) => {
      const userId = requireUserId(user?.id)
      const result = await nwcConnectionsByUserId(userId, includeRevoked ?? false)
      if (result instanceof Error) {
        throw mapError(result)
      }

      const budgetMap = await budgetsByApiKeyId(authorization)
      return result.map((connection) =>
        toGraphqlConnection(
          connection,
          connection.apiKeyId ? budgetMap.get(connection.apiKeyId) : null,
        ),
      )
    },
    nwcServiceInfo: () => ({
      serverPubkey: getServerKeypair().pubkey,
      supportedMethods: SUPPORTED_NWC_METHODS,
      supportedNotifications: SUPPORTED_NWC_NOTIFICATIONS,
      relayUrl: NOSTR_RELAY_PUBLIC_URL,
    }),
  },
  User: {
    __resolveReference: async (user: { id: string }) => {
      return { id: user.id }
    },
    nwcConnection: async (
      user: { id: string },
      { id }: { id: string },
      context?: Partial<GraphQLPublicContextAuth>,
    ) => {
      const authorization = context?.authorization
      const result = await getNwcConnectionByIdForUser(user.id, id)
      if (result instanceof Error) return null
      const budgetMap = await budgetsByApiKeyId(authorization)
      return toGraphqlConnection(
        result,
        result.apiKeyId ? budgetMap.get(result.apiKeyId) : null,
      )
    },
    nwcConnections: async (
      user: { id: string },
      { includeRevoked }: { includeRevoked?: boolean | null },
      context?: Partial<GraphQLPublicContextAuth>,
    ) => {
      const authorization = context?.authorization
      const result = await nwcConnectionsByUserId(user.id, includeRevoked ?? false)
      if (result instanceof Error) {
        throw mapError(result)
      }
      const budgetMap = await budgetsByApiKeyId(authorization)
      return result.map((connection) =>
        toGraphqlConnection(
          connection,
          connection.apiKeyId ? budgetMap.get(connection.apiKeyId) : null,
        ),
      )
    },
  },
  Mutation: {
    nwcConnectionCreate: async (
      _,
      args,
      { user, authorization }: GraphQLPublicContextAuth,
    ) => {
      const userId = requireUserId(user?.id)
      const authHeader = requireAuthorization(authorization)
      const result = await createNwcConnection(userId, authHeader, {
        nwcUri: args.input.nwcUri,
        walletId: args.input.walletId ?? undefined,
        permissions: args.input.permissions,
        alias: args.input.alias ?? undefined,
        budget: args.input.budget ?? undefined,
        expiresAt: args.input.expiresAt ? new Date(args.input.expiresAt) : undefined,
      })

      if (result instanceof Error) {
        return { errors: [mapAndParseErrorForGqlResponse(result)] }
      }

      return {
        errors: [],
        connection: toGraphqlConnection(result.connectionObj, result.budget),
        connectionUri: result.connectionUri,
      }
    },
    nwcConnectionUpdate: async (
      _,
      args,
      { user, authorization }: GraphQLPublicContextAuth,
    ) => {
      const userId = requireUserId(user?.id)
      const authHeader = requireAuthorization(authorization)
      const { connectionId, alias, budget } = args.input
      const connection = await updateNwcConnection(userId, authHeader, connectionId, {
        alias,
        budget,
      })

      if (connection instanceof Error) {
        return { errors: [mapAndParseErrorForGqlResponse(connection)] }
      }

      const budgetMap = await budgetsByApiKeyId(authHeader)

      return {
        errors: [],
        connection: toGraphqlConnection(
          connection,
          connection.apiKeyId ? budgetMap.get(connection.apiKeyId) : null,
        ),
      }
    },
    nwcConnectionDelete: async (_, args, { user }: GraphQLPublicContextAuth) => {
      const userId = requireUserId(user?.id)
      const { connectionId } = args.input

      const result = await softDeleteNwcConnection(userId, connectionId)

      if (result instanceof Error) {
        return { errors: [mapAndParseErrorForGqlResponse(result)], success: false }
      }

      return {
        errors: [],
        success: result,
      }
    },
    nwcConnectionRevoke: async (
      _: unknown,
      args: { input: { connectionId: string } },
      { user }: GraphQLPublicContextAuth,
    ) => {
      const userId = requireUserId(user?.id)
      const connection = await revokeNwcConnection(userId, args.input.connectionId)
      if (connection instanceof Error) {
        return { errors: [mapAndParseErrorForGqlResponse(connection)], success: false }
      }

      return {
        errors: [],
        success: true,
        connection: toGraphqlConnection(connection),
      }
    },
    nwcConnectionsRevokeAll: async (
      _: unknown,
      __: unknown,
      { user }: GraphQLPublicContextAuth,
    ) => {
      const userId = requireUserId(user?.id)
      const result = await revokeAllNwcConnections(userId)

      if (result instanceof Error) {
        return { errors: [mapAndParseErrorForGqlResponse(result)], revokedCount: 0 }
      }

      return {
        errors: [],
        revokedCount: result,
      }
    },
    nwcConnectionRevokeAll: async (
      _: unknown,
      __: unknown,
      { user }: GraphQLPublicContextAuth,
    ) => {
      const userId = requireUserId(user?.id)
      const result = await revokeAllNwcConnections(userId)

      if (result instanceof Error) {
        return { errors: [mapAndParseErrorForGqlResponse(result)], revokedCount: 0 }
      }

      return {
        errors: [],
        revokedCount: result,
      }
    },
  },
}
