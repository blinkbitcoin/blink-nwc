import { ApolloClient, gql } from "@apollo/client"

import { ApiKey, Description } from "@/domain/index.types"
import { WalletId } from "@/domain/core/index.types"
import {
  LnNoAmountInvoiceCreateOnBehalfOfRecipient,
  LnNoAmountInvoiceCreateOnBehalfOfRecipientMutation,
  LnNoAmountInvoiceCreateOnBehalfOfRecipientMutationVariables,
} from "@/graphql/internal-client/generated"
import { Minutes } from "@/domain/units/index.types"

gql`
  mutation lnNoAmountInvoiceCreateOnBehalfOfRecipient(
    $input: LnNoAmountInvoiceCreateOnBehalfOfRecipientInput!
  ) {
    lnNoAmountInvoiceCreateOnBehalfOfRecipient(input: $input) {
      invoice {
        createdAt
        paymentRequest
        paymentHash
      }
      errors {
        code
        message
        path
      }
    }
  }
`

export async function createInvoiceAmountless(
  client: ApolloClient,
  apiKey: ApiKey,
  walletId: WalletId,
  memo?: Description,
  expiry?: Minutes,
) {
  const expiresIn = expiry?.toString()
  const { data } = await client.mutate<
    LnNoAmountInvoiceCreateOnBehalfOfRecipientMutation,
    LnNoAmountInvoiceCreateOnBehalfOfRecipientMutationVariables
  >({
    mutation: LnNoAmountInvoiceCreateOnBehalfOfRecipient,
    variables: {
      input: {
        recipientWalletId: walletId,
        expiresIn,
        memo,
      },
    },
    context: { apiKey },
    fetchPolicy: "no-cache",
  })
  return data
}
