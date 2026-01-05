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
import { stripApiKey } from "@/domain/utils"

export const resolvers: Resolvers = {
  Query: {
    hello: {
      resolve: async () => {
        const result = await Example.hello()
        if (result instanceof Error) throw mapError(result)
        return result
      },
    },
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
      return result.map((r) => stripApiKey(r))
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
        connection: stripApiKey(result.connectionObj),
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
        connection: stripApiKey(connection),
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
