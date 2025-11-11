import { ApolloClient, gql } from "@apollo/client"

import { Satoshis, WalletId } from "@/domain/core/index.types"
import {
  LnNoAmountInvoicePaymentSend,
  LnNoAmountInvoicePaymentSendMutation,
  LnNoAmountInvoicePaymentSendMutationVariables,
} from "@/graphql/internal-client/generated"
import { ApiKey, InvoiceBolt11 } from "@/domain/index.types"

gql`
  mutation lnNoAmountInvoicePaymentSend($input: LnNoAmountInvoicePaymentInput!) {
    lnNoAmountInvoicePaymentSend(input: $input) {
      errors {
        message
        code
      }
      status
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
    }
  }
`

export async function payInvoiceAmountless(
  client: ApolloClient,
  apiKey: ApiKey,
  walletId: WalletId,
  bolt11: InvoiceBolt11,
  amount: Satoshis,
) {
  const { data } = await client.mutate<
    LnNoAmountInvoicePaymentSendMutation,
    LnNoAmountInvoicePaymentSendMutationVariables
  >({
    mutation: LnNoAmountInvoicePaymentSend,
    variables: {
      input: {
        walletId,
        paymentRequest: bolt11,
        amount,
      },
    },
    context: { apiKey },
    fetchPolicy: "no-cache",
  })
  return data
}
