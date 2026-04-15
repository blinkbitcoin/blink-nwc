import { ApolloClient, gql } from "@apollo/client"

import { ApiKey, ApiKeyId } from "@/domain/index.types"
import {
  ApiKeyCreateForNwc,
  ApiKeyCreateForNwcMutation,
  ApiKeyCreateForNwcMutationVariables,
  Scope,
} from "@/graphql/internal-client/generated"

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
gql`
  mutation ApiKeyCreateForNwc($input: ApiKeyCreateInput!) {
    apiKeyCreate(input: $input) {
      apiKeySecret
      apiKey {
        id
      }
    }
  }
`

export type ApiKeyLimitsSnapshot = {
  dailyLimitSats?: number | null
  dailySpentSats: number
  weeklyLimitSats?: number | null
  weeklySpentSats: number
  monthlyLimitSats?: number | null
  monthlySpentSats: number
  annualLimitSats?: number | null
  annualSpentSats: number
}

export const createApiKeyForNwc = async (
  client: ApolloClient,
  authorization: string,
  {
    name,
    scopes,
  }: {
    name: string
    scopes: Scope[]
  },
): Promise<{ id: ApiKeyId; secret: ApiKey }> => {
  const { data } = await client.mutate<
    ApiKeyCreateForNwcMutation,
    ApiKeyCreateForNwcMutationVariables
  >({
    mutation: ApiKeyCreateForNwc,
    variables: { input: { name, scopes } },
    context: { authorization },
  })

  const apiKeyCreate = data?.apiKeyCreate
  if (!apiKeyCreate) {
    throw new Error("apiKeyCreate returned no data")
  }

  return {
    id: apiKeyCreate.apiKey.id as ApiKeyId,
    secret: apiKeyCreate.apiKeySecret as ApiKey,
  }
}
