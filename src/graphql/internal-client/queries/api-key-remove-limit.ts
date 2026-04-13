import { ApolloClient, gql } from "@apollo/client"

import { ApiKeyId } from "@/domain/index.types"
import {
  ApiKeyRemoveLimitForNwc,
  ApiKeyRemoveLimitForNwcMutation,
  ApiKeyRemoveLimitForNwcMutationVariables,
  LimitTimeWindow,
} from "@/graphql/internal-client/generated"
import { ApiKeyLimitsSnapshot } from "@/graphql/internal-client/queries/api-key-create"

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
gql`
  mutation ApiKeyRemoveLimitForNwc($input: ApiKeyRemoveLimitInput!) {
    apiKeyRemoveLimit(input: $input) {
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

export const removeApiKeyLimitForNwc = async (
  client: ApolloClient,
  authorization: string,
  {
    id,
    limitTimeWindow,
  }: {
    id: ApiKeyId
    limitTimeWindow: LimitTimeWindow
  },
): Promise<ApiKeyLimitsSnapshot> => {
  const { data } = await client.mutate<
    ApiKeyRemoveLimitForNwcMutation,
    ApiKeyRemoveLimitForNwcMutationVariables
  >({
    mutation: ApiKeyRemoveLimitForNwc,
    variables: {
      input: {
        id,
        limitTimeWindow,
      },
    },
    context: { authorization },
  })

  const limits = data?.apiKeyRemoveLimit.apiKey.limits
  if (!limits) {
    throw new Error("apiKeyRemoveLimit returned no data")
  }

  return limits
}
