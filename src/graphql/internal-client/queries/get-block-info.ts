import { ApolloClient, gql } from "@apollo/client"

import { GetBlockInfo, GetBlockInfoQuery } from "@/graphql/internal-client/generated"

gql`
  query GetBlockInfo {
    globals {
      blockInfo {
        blockHash
        blockHeight
      }
    }
  }
`

export async function getBlockInfo(client: ApolloClient) {
  const { data } = await client.query<GetBlockInfoQuery>({ query: GetBlockInfo })
  return data?.globals?.blockInfo
}
