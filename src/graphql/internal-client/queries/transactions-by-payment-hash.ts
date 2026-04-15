import { ApolloClient, gql } from "@apollo/client"

import {
  TransactionsByPaymentHash,
  TransactionsByPaymentHashQuery,
  TransactionsByPaymentHashQueryVariables,
} from "@/graphql/internal-client/generated"
import { PaymentHash, WalletId } from "@/domain/core/index.types"
import { ApiKey } from "@/domain/index.types"

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
gql`
  query TransactionsByPaymentHash($paymentHash: PaymentHash!, $walletId: WalletId!) {
    me {
      defaultAccount {
        walletById(walletId: $walletId) {
          transactionsByPaymentHash(paymentHash: $paymentHash) {
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
    }
  }
`

export async function transactionsByPaymentHash(
  client: ApolloClient,
  apiKey: ApiKey,
  walletId: WalletId,
  paymentHash: PaymentHash,
) {
  const { data } = await client.query<
    TransactionsByPaymentHashQuery,
    TransactionsByPaymentHashQueryVariables
  >({
    query: TransactionsByPaymentHash,
    variables: { paymentHash, walletId },
    context: { apiKey },
    fetchPolicy: "no-cache",
  })

  return data
}
