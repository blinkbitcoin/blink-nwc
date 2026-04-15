import { ApolloClient, gql } from "@apollo/client"

import { ApiKeyId } from "@/domain/index.types"
import {
  ApiKeyRevokeForNwc,
  ApiKeyRevokeForNwcMutation,
  ApiKeyRevokeForNwcMutationVariables,
} from "@/graphql/internal-client/generated"

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
gql`
  mutation ApiKeyRevokeForNwc($input: ApiKeyRevokeInput!) {
    apiKeyRevoke(input: $input) {
      apiKey {
        id
      }
    }
  }
`

export const revokeApiKeyForNwc = async (
  client: ApolloClient,
  authorization: string,
  id: ApiKeyId,
): Promise<void> => {
  await client.mutate<ApiKeyRevokeForNwcMutation, ApiKeyRevokeForNwcMutationVariables>({
    mutation: ApiKeyRevokeForNwc,
    variables: { input: { id } },
    context: { authorization },
  })
}
