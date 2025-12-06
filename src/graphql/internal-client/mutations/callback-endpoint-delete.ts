import { ApolloClient, gql } from "@apollo/client"

import { ApiKey } from "@/domain/index.types"

import {
  CallbackEndpointDelete,
  CallbackEndpointDeleteMutation,
  CallbackEndpointDeleteMutationVariables,
} from "@/graphql/internal-client/generated"

gql`
  mutation CallbackEndpointDelete($input: CallbackEndpointDeleteInput!) {
    callbackEndpointDelete(input: $input) {
      success
      errors {
        code
        message
        path
      }
    }
  }
`

async function callbackEndpointDelete(
  client: ApolloClient,
  apiKey: ApiKey,
  webhookId: string,
) {
  const { data } = await client.mutate<
    CallbackEndpointDeleteMutation,
    CallbackEndpointDeleteMutationVariables
  >({
    mutation: CallbackEndpointDelete,
    variables: {
      input: {
        id: webhookId,
      },
    },
    context: { apiKey },
    fetchPolicy: "no-cache",
  })
  return data
}
export default callbackEndpointDelete
