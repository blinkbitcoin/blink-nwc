import { ApolloClient, gql } from "@apollo/client"

import { ApiKeyId } from "@/domain/index.types"
import {
  ApiKeySetLimitForNwc,
  ApiKeySetLimitForNwcMutation,
  ApiKeySetLimitForNwcMutationVariables,
  LimitTimeWindow,
} from "@/graphql/internal-client/generated"
import { ApiKeyLimitsSnapshot } from "@/graphql/internal-client/queries/api-key-create"

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
gql`
  mutation ApiKeySetLimitForNwc($input: ApiKeySetLimitInput!) {
    apiKeySetLimit(input: $input) {
      apiKey {
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

export const setApiKeyLimitForNwc = async (
  client: ApolloClient,
  authorization: string,
  {
    id,
    limitSats,
    limitTimeWindow,
  }: {
    id: ApiKeyId
    limitSats: number
    limitTimeWindow: LimitTimeWindow
  },
): Promise<ApiKeyLimitsSnapshot> => {
  const { data } = await client.mutate<
    ApiKeySetLimitForNwcMutation,
    ApiKeySetLimitForNwcMutationVariables
  >({
    mutation: ApiKeySetLimitForNwc,
    variables: {
      input: {
        id,
        limitSats,
        limitTimeWindow,
      },
    },
    context: { authorization },
  })

  const limits = data?.apiKeySetLimit.apiKey.limits
  if (!limits) {
    throw new Error("apiKeySetLimit returned no data")
  }

  return limits
}
