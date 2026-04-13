import { ApolloClient, gql } from "@apollo/client"

import { ApiKeyId } from "@/domain/index.types"
import { NwcApiKeys, NwcApiKeysQuery } from "@/graphql/internal-client/generated"
import { ApiKeyLimitsSnapshot } from "@/graphql/internal-client/queries/api-key-create"

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
gql`
  query NwcApiKeys {
    me {
      apiKeys {
        id
        limits {
          dailyLimitSats
          dailySpentSats
          weeklyLimitSats
          weeklySpentSats
          monthlyLimitSats
          monthlySpentSats
          annualLimitSats
          annualSpentSats
        }
      }
    }
  }
`

export const getApiKeysForNwc = async (
  client: ApolloClient,
  authorization: string,
): Promise<Array<{ id: ApiKeyId; limits: ApiKeyLimitsSnapshot }>> => {
  const { data } = await client.query<NwcApiKeysQuery>({
    query: NwcApiKeys,
    context: { authorization },
    fetchPolicy: "no-cache",
  })

  return (data?.me?.apiKeys ?? []).map((apiKey) => ({
    id: apiKey.id as ApiKeyId,
    limits: apiKey.limits,
  }))
}
