import { ApolloClient, gql } from "@apollo/client"

import {
  LnInvoicePaymentSend,
  LnInvoicePaymentSendMutation,
  LnInvoicePaymentSendMutationVariables,
} from "@/graphql/internal-client/generated"
import { ApiKey, Description, InvoiceBolt11 } from "@/domain/index.types"
import { WalletId } from "@/domain/core/index.types"

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
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

export async function payInvoice(
  client: ApolloClient,
  apiKey: ApiKey,
  bolt11: InvoiceBolt11,
  walletId: WalletId,
  memo?: Description,
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
