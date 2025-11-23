import { gql } from "graphql-tag"
import { ApolloClient } from "@apollo/client"

import {ApiKey, Cursor} from "@/domain/index.types"
import { WalletId } from "@/domain/core/index.types"
import {
  InvoicesForWalletId,
  InvoicesForWalletIdQuery,
  InvoicesForWalletIdQueryVariables,
} from "@/graphql/internal-client/generated"

gql`
  query InvoicesForWalletId(
    $walletId: WalletId!
    $first: Int
    $before: String
    $after: String
  ) {
    me {
      defaultAccount {
        walletById(walletId: $walletId) {
          invoices(first: $first, before: $before, after: $after) {
            edges {
              cursor
              node {
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
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
          }
        }
      }
    }
  }
`

export async function invoicesForWalletId(
  client: ApolloClient,
  apiKey: ApiKey,
  walletId: WalletId,
  options?: {
    first?: number
    after?: Cursor
    before?: Cursor
  },
) {
  const { data } = await client.query<
    InvoicesForWalletIdQuery,
    InvoicesForWalletIdQueryVariables
  >({
    query: InvoicesForWalletId,
    variables: {
      walletId,
      first: options?.first,
      after: options?.after,
      before: options?.before,
    },
    context: { apiKey },
    fetchPolicy: "no-cache",
  })
  return data
}
