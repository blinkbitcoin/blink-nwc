import { Resolvers } from "./__generated__/resolvers-types"
import { mapAndParseErrorForGqlResponse, mapError } from "./error-map"

import { Example } from "@/app"
import {
  createNwcConnection,
  getNwcConnectionById,
  getNwcConnectionByIdForUser,
  nwcConnectionsByUserId,
  revokeAllNwcConnections,
  softDeleteNwcConnection,
  updateNwcConnection,
} from "@/app/manage-connections"
import { Account } from "@/domain/core/index.types"
import { stripSensitiveFields } from "@/domain/utils"
import {
  SUPPORTED_NWC_METHODS,
  SUPPORTED_NWC_NOTIFICATIONS,
  NOSTR_RELAY_PUBLIC_URL,
} from "@/config"
import { Nip47Method } from "@/domain/nostr/nip47-method"
import { NwcNotificationType } from "@/domain/nostr/notification-type"

const toEnumResolver = <T extends Record<string, string>>(obj: T) =>
  Object.fromEntries(Object.values(obj).map((v) => [v.toUpperCase(), v]))

export const resolvers: Resolvers = {
  Nip47Method: toEnumResolver(Nip47Method),
  NwcNotificationType: toEnumResolver(NwcNotificationType),
  Query: {
    hello: {
      resolve: async () => {
        const result = await Example.hello()
        if (result instanceof Error) throw mapError(result)
        return result
      },
    },
    nwcServiceInfo: () => ({
      supportedMethods: SUPPORTED_NWC_METHODS,
      supportedNotifications: SUPPORTED_NWC_NOTIFICATIONS,
      relayUrl: NOSTR_RELAY_PUBLIC_URL,
    }),
  },
  User: {
    __resolveReference: async (user: { id: string }) => {
      return { id: user.id }
    },
    nwcConnection: async (user: { id: string }, { id }: { id: string }) => {
      const result = await getNwcConnectionByIdForUser(user.id, id)
      if (result instanceof Error) return null
      return stripSensitiveFields(result)
    },
    nwcConnections: async (
      user: { id: string },
      { includeRevoked }: { includeRevoked?: boolean | null },
    ) => {
      const result = await nwcConnectionsByUserId(user.id, includeRevoked ?? false)
      if (result instanceof Error) {
        throw mapError(result)
      }
      return result.map((r) => stripSensitiveFields(r))
    },
  },
  Mutation: {
    nwcConnectionCreate: async (
      _,
      args,
      { domainAccount }: { domainAccount: Account },
    ) => {
      const {
        walletId,
        alias,
        permissions,
        apiKey,
        apiKeyId,
        walletCurrency,
        expiresAt,
        notificationsEnabled,
      } = args.input
      const result = await createNwcConnection(
        domainAccount,
        walletId,
        apiKey,
        permissions,
        alias ?? undefined,
        walletCurrency ?? undefined,
        expiresAt ? new Date(expiresAt) : undefined,
        notificationsEnabled ?? undefined,
        apiKeyId ?? undefined,
      )

      if (result instanceof Error) {
        return { errors: [mapAndParseErrorForGqlResponse(result)] }
      }

      return {
        errors: [],
        connection: stripSensitiveFields(result.connectionObj),
        connectionUri: result.connectionUri,
      }
    },
    nwcConnectionUpdate: async (
      _,
      args,
      { domainAccount }: { domainAccount: Account },
    ) => {
      const { id: connectionId, alias, permissions } = args.input
      const connection = await updateNwcConnection(domainAccount, connectionId, {
        alias,
        permissions: permissions === null ? [] : permissions,
      })

      if (connection instanceof Error) {
        return { errors: [mapAndParseErrorForGqlResponse(connection)] }
      }

      return {
        errors: [],
        connection: stripSensitiveFields(connection),
      }
    },
    nwcConnectionDelete: async (
      _,
      args,
      { domainAccount }: { domainAccount: Account },
    ) => {
      const { id: connectionId } = args.input

      const result = await softDeleteNwcConnection(domainAccount, connectionId)

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
      args: { input: { id: string } },
      { domainAccount }: { domainAccount: Account },
    ) => {
      const result = await softDeleteNwcConnection(domainAccount, args.input.id)

      if (result instanceof Error) {
        return { errors: [mapAndParseErrorForGqlResponse(result)] }
      }

      const connection = await getNwcConnectionById(args.input.id)
      if (connection instanceof Error) {
        return { errors: [mapAndParseErrorForGqlResponse(connection)] }
      }

      return {
        errors: [],
        connection: stripSensitiveFields(connection),
      }
    },
    nwcConnectionRevokeAll: async (
      _: unknown,
      __: unknown,
      { domainAccount }: { domainAccount: Account },
    ) => {
      const result = await revokeAllNwcConnections(domainAccount)

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
