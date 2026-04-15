import { gql, ApolloClient } from "@apollo/client"

import {
  LnInvoicePaymentStatusByHash,
  LnInvoicePaymentStatusByHashQuery,
  LnInvoicePaymentStatusByHashQueryVariables,
} from "@/graphql/internal-client/generated"
import { ApiKey, PaymentHash } from "@/domain/index.types"

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
gql`
  query lnInvoicePaymentStatusByHash($input: LnInvoicePaymentStatusByHashInput!) {
    lnInvoicePaymentStatusByHash(input: $input) {
      paymentHash
      paymentPreimage
      paymentRequest
      status
    }
  }
`
export async function invoiceStatusByPaymentHash(
  client: ApolloClient,
  apiKey: ApiKey,
  paymentHash: PaymentHash,
) {
  const { data } = await client.query<
    LnInvoicePaymentStatusByHashQuery,
    LnInvoicePaymentStatusByHashQueryVariables
  >({
    query: LnInvoicePaymentStatusByHash,
    variables: { input: { paymentHash } },
    context: { apiKey },
    fetchPolicy: "no-cache",
  })
  return data
}
