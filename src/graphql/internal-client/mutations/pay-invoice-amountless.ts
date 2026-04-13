import { ApolloClient, gql } from "@apollo/client"

import { Description, InvoiceBolt11, Satoshis } from "@/domain/index.types"
import {
  LnNoAmountInvoicePaymentSendOnBehalfOfRecipient,
  LnNoAmountInvoicePaymentSendOnBehalfOfRecipientMutation,
  LnNoAmountInvoicePaymentSendOnBehalfOfRecipientMutationVariables,
} from "@/graphql/internal-client/generated"
import { WalletId } from "@/domain/core/index.types"

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
gql`
  mutation LnNoAmountInvoicePaymentSendOnBehalfOfRecipient(
    $input: LnNoAmountInvoicePaymentInput!
  ) {
    lnNoAmountInvoicePaymentSend(input: $input) {
      status
      errors {
        message
        path
        code
      }
      transaction {
        settlementVia {
          ... on SettlementViaLn {
            preImage
          }
        }
        settlementFee
      }
    }
  }
`

export async function payInvoiceAmountless(
  client: ApolloClient,
  apiKey: string,
  paymentRequest: InvoiceBolt11,
  walletId: WalletId,
  amount: Satoshis,
  memo?: Description,
) {
  const { data } = await client.mutate<
    LnNoAmountInvoicePaymentSendOnBehalfOfRecipientMutation,
    LnNoAmountInvoicePaymentSendOnBehalfOfRecipientMutationVariables
  >({
    mutation: LnNoAmountInvoicePaymentSendOnBehalfOfRecipient,
    variables: {
      input: {
        paymentRequest,
        walletId,
        amount,
        memo: memo ?? undefined,
      },
    },
    context: { apiKey },
  })
  return data
}
