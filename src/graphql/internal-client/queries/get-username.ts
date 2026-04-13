import { ApolloClient, gql } from "@apollo/client"

import { ApiKey } from "@/domain/index.types"

const GET_USERNAME = gql`
  query GetUsername {
    me {
      username
    }
  }
`

export const getUsername = async (
  client: ApolloClient,
  apiKey: ApiKey,
): Promise<string | null> => {
  const { data } = await client.query<{
    me?: {
      username?: string | null
    } | null
  }>({
    query: GET_USERNAME,
    context: { apiKey },
    fetchPolicy: "no-cache",
  })

  return data?.me?.username ?? null
}
