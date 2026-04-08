import { Resolvers } from "./__generated__/resolvers-types"
import { mapAndParseErrorForGqlResponse, mapError } from "./error-map"

import { Example } from "@/app"
import {
  createNwcConnection,
  nwcConnectionsByUserId,
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
    nwcConnections: async (user: { id: string }) => {
      const result = await nwcConnectionsByUserId(user.id)
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
      const { walletId, alias, permissions, apiKey } = args.input
      const result = await createNwcConnection(
        domainAccount,
        walletId,
        apiKey,
        permissions,
        alias ?? undefined,
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
  },
}
