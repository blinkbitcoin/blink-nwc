import { ApolloClient, gql } from "@apollo/client"

import {
  LnInvoicePaymentSend,
  LnInvoicePaymentSendMutation,
  LnInvoicePaymentSendMutationVariables,
} from "@/graphql/internal-client/generated"
import { ApiKey, InvoiceBolt11, Memo } from "@/domain/index.types"
import { WalletId } from "@/domain/core/index.types"

gql`
  mutation LnInvoicePaymentSend($input: LnInvoicePaymentInput!) {
    lnInvoicePaymentSend(input: $input) {
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
      errors {
        message
      }
      status
    }
  }
`

export async function payInvoice(
  client: ApolloClient,
  apiKey: ApiKey,
  bolt11: InvoiceBolt11,
  walletId: WalletId,
  memo?: Memo,
) {
  const { data } = await client.mutate<
    LnInvoicePaymentSendMutation,
    LnInvoicePaymentSendMutationVariables
  >({
    mutation: LnInvoicePaymentSend,
    variables: {
      input: {
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
