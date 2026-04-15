import { ApolloClient, gql } from "@apollo/client"

import {
  LnNoAmountInvoicePaymentSend,
  LnNoAmountInvoicePaymentSendMutation,
  LnNoAmountInvoicePaymentSendMutationVariables,
} from "@/graphql/internal-client/generated"
import { ApiKey, Description, InvoiceBolt11, Satoshis } from "@/domain/index.types"
import { WalletId } from "@/domain/core/index.types"

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
gql`
  mutation LnNoAmountInvoicePaymentSend($input: LnNoAmountInvoicePaymentInput!) {
    lnNoAmountInvoicePaymentSend(input: $input) {
      transaction {
        createdAt
        direction
        id
        initiationVia {
          ... on InitiationViaLn {
            paymentHash
            paymentRequest
          }
        }
        memo
        settlementFee
        settlementAmount
        settlementCurrency
        settlementVia {
          ... on SettlementViaLn {
            preImage
          }
          ... on SettlementViaIntraLedger {
            preImage
          }
        }
        status
      }
      errors {
        code
        message
        path
      }
      status
    }
  }
`

export async function payInvoiceAmountless(
  client: ApolloClient,
  apiKey: ApiKey,
  bolt11: InvoiceBolt11,
  walletId: WalletId,
  amount: Satoshis,
  memo?: Description,
) {
  const { data } = await client.mutate<
    LnNoAmountInvoicePaymentSendMutation,
    LnNoAmountInvoicePaymentSendMutationVariables
  >({
    mutation: LnNoAmountInvoicePaymentSend,
    variables: {
      input: {
        amount,
        paymentRequest: bolt11,
        memo,
        walletId,
      },
    },
    context: { apiKey },
    fetchPolicy: "no-cache",
  })
  return data
}
