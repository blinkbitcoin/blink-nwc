import { ApolloClient, gql } from "@apollo/client"

import { WalletId } from "@/domain/core/index.types"
import {
  TransactionsForWalletId,
  TransactionsForWalletIdQuery,
  TransactionsForWalletIdQueryVariables,
} from "@/graphql/internal-client/generated"
import { ApiKey, Cursor } from "@/domain/index.types"

gql`
  query TransactionsForWalletId(
    $walletId: WalletId!
    $first: Int
    $before: String
    $after: String
  ) {
    me {
      defaultAccount {
        walletById(walletId: $walletId) {
          transactions(first: $first, before: $before, after: $after) {
            edges {
              node {
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
                settlementFee
                settlementDisplayFee
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
              cursor
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

export async function transactionsForWalletId(
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
    TransactionsForWalletIdQuery,
    TransactionsForWalletIdQueryVariables
  >({
    query: TransactionsForWalletId,
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
