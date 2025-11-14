import { ApolloClient, gql } from "@apollo/client"

import { ApiKey } from "@/domain/index.types"
import { PaymentHash, WalletId } from "@/domain/core/index.types"
import {
  InvoiceByPaymentHash,
  InvoiceByPaymentHashQuery,
  InvoiceByPaymentHashQueryVariables
} from "@/graphql/internal-client/generated"

gql`
  query InvoiceByPaymentHash($paymentHash: PaymentHash!, $walletId: WalletId!) {
    me {
      defaultAccount {
        walletById(walletId: $walletId) {
          invoiceByPaymentHash(paymentHash: $paymentHash) {
            createdAt
            paymentHash
            paymentRequest
            paymentSecret
            paymentStatus
            ... on LnInvoice {
              satoshis
            }
          }
        }
      }
    }
  }
`

export async function invoiceByPaymentHash(
  client: ApolloClient,
  apiKey: ApiKey,
  walletId: WalletId,
  paymentHash: PaymentHash,
) {
  const { data } = await client.query<
    InvoiceByPaymentHashQuery,
    InvoiceByPaymentHashQueryVariables
  >({
    query: InvoiceByPaymentHash,
    variables: { paymentHash, walletId },
    context: { apiKey },
    fetchPolicy: "no-cache",
  })
  return data
}
