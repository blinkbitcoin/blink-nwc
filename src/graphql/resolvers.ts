import { Resolvers } from "./__generated__/resolvers-types"
import { mapError } from "./error-map"

import { Example } from "@/app"

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
      // TODO: Replace with actual user lookup from your data source
      // This resolver is called when another subgraph needs to resolve a User by ID
      return {
        id: user.id,
        exampleField: "Example data for user " + user.id,
      }
    },
  },
}
