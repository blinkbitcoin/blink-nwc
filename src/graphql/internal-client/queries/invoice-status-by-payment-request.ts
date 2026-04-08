import { ApolloClient, gql } from "@apollo/client"

import {
  LnInvoicePaymentStatusByPaymentRequest,
  LnInvoicePaymentStatusByPaymentRequestQuery,
  LnInvoicePaymentStatusByPaymentRequestQueryVariables,
} from "@/graphql/internal-client/generated"
import { ApiKey, InvoiceBolt11 } from "@/domain/index.types"

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
gql`
  query lnInvoicePaymentStatusByPaymentRequest(
    $input: LnInvoicePaymentStatusByPaymentRequestInput!
  ) {
    lnInvoicePaymentStatusByPaymentRequest(input: $input) {
      paymentHash
      paymentPreimage
      paymentRequest
      status
    }
  }
`

export async function invoiceStatusByPaymentRequest(
  client: ApolloClient,
  apiKey: ApiKey,
  bolt11: InvoiceBolt11,
) {
  const { data } = await client.query<
    LnInvoicePaymentStatusByPaymentRequestQuery,
    LnInvoicePaymentStatusByPaymentRequestQueryVariables
  >({
    query: LnInvoicePaymentStatusByPaymentRequest,
    variables: { input: { paymentRequest: bolt11 } },
    context: { apiKey },
    fetchPolicy: "no-cache",
  })
  return data
}
