import { ApolloClient, gql } from "@apollo/client"

import {
  LnInvoiceCreateOnBehalfOfRecipient,
  LnInvoiceCreateOnBehalfOfRecipientMutation,
  LnInvoiceCreateOnBehalfOfRecipientMutationVariables,
} from "@/graphql/internal-client/generated"
import { DescriptionHash, Satoshis, WalletId } from "@/domain/core/index.types"
import { ApiKey, Memo } from "@/domain/index.types"
import { Minutes } from "@/domain/units"

gql`
  mutation LnInvoiceCreateOnBehalfOfRecipient(
    $input: LnInvoiceCreateOnBehalfOfRecipientInput!
  ) {
    lnInvoiceCreateOnBehalfOfRecipient(input: $input) {
      errors {
        code
        message
        path
      }
      invoice {
        createdAt
        externalId
        paymentHash
        paymentRequest
        paymentSecret
        paymentStatus
        satoshis
      }
    }
  }
`

export async function createInvoice(
  client: ApolloClient,
  apiKey: ApiKey,
  walletId: WalletId,
  amount: Satoshis,
  descriptionHash?: DescriptionHash,
  expiry?: Minutes,
  memo?: Memo,
) {
  const expiresIn = expiry?.toString()

  const { data } = await client.mutate<
    LnInvoiceCreateOnBehalfOfRecipientMutation,
    LnInvoiceCreateOnBehalfOfRecipientMutationVariables
  >({
    mutation: LnInvoiceCreateOnBehalfOfRecipient,
    variables: {
      input: {
        amount,
        recipientWalletId: walletId,
        descriptionHash,
        expiresIn,
        memo,
      },
    },
    context: { apiKey },
    fetchPolicy: "no-cache",
  })
  return data
}
