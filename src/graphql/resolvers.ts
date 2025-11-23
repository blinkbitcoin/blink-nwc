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
      return result
    },
  },
  Mutation: {
    //todo - instead of separate mutation, extend the apiKeyCreate mutation payload type, and create connection
    // as side-effect (__resolveReference)
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
        connection: result.connectionObj,
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
        connection,
      }
    },
    // todo - same as with creation - delete nwc connection on api key revoke
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
