import { ApolloClient, gql } from "@apollo/client"

import { ApiKey } from "@/domain/index.types"
import {
  CallbackEndpointAdd,
  CallbackEndpointAddMutation,
  CallbackEndpointAddMutationVariables,
} from "@/graphql/internal-client/generated"
gql`
  mutation CallbackEndpointAdd($input: CallbackEndpointAddInput!) {
    callbackEndpointAdd(input: $input) {
      id
      errors {
        code
        message
        path
      }
    }
  }
`

async function callbackEndpointAdd(client: ApolloClient, apiKey: ApiKey, url: string) {
  const { data } = await client.mutate<
    CallbackEndpointAddMutation,
    CallbackEndpointAddMutationVariables
  >({
    mutation: CallbackEndpointAdd,
    variables: {
      input: {
        url,
      },
    },
    context: { apiKey },
    fetchPolicy: "no-cache",
  })
  return data
}
export default callbackEndpointAdd
