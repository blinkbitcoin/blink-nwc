import { ApolloClient, gql } from "@apollo/client"

import { PUBLIC_GRAPHQL_URL } from "@/config"
import { GetBlockInfo, GetBlockInfoQuery } from "@/graphql/internal-client/generated"

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
gql`
  query GetBlockInfo {
    globals {
      network
      blockInfo {
        blockHash
        blockHeight
      }
    }
  }
`

export async function getNodeInfo(client: ApolloClient) {
  const { data } = await client.query<GetBlockInfoQuery>({
    query: GetBlockInfo,
    context: { uri: PUBLIC_GRAPHQL_URL },
    fetchPolicy: "no-cache",
  })
  return data?.globals
}
