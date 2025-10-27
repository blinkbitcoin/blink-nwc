import { Resolvers } from "./__generated__/resolvers-types"
import { mapError } from "./error-map"

import { Example } from "@/app"
import { nwcConnectionsByUserId, } from "@/app/manage-connections"
import nwcConnectionCreateMutation from "@/graphql/mutations/nwc-connection-create";
import nwcConnectionUpdateMutation from "@/graphql/mutations/nwc-connection-update";
import nwcConnectionDeleteMutation from "@/graphql/mutations/nwc-connection-delete";

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
    nwcConnections: async (parent: { id: string }) => {
      const result = await nwcConnectionsByUserId(parent.id)
      if (result instanceof Error) {
        throw mapError(result)
      }
      return result
    },
  },
  Mutation: {
    nwcConnectionCreate: nwcConnectionCreateMutation,
    nwcConnectionUpdate: nwcConnectionUpdateMutation,
    nwcConnectionDelete: nwcConnectionDeleteMutation,
  }
}
