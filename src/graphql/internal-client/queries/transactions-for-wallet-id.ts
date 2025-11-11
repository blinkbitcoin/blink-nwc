import { ApolloClient, gql } from "@apollo/client"

import { WalletId } from "@/domain/core/index.types"
import {
  TransactionsForWalletId,
  TransactionsForWalletIdQuery,
  TransactionsForWalletIdQueryVariables,
} from "@/graphql/internal-client/generated"
import { ApiKey } from "@/domain/index.types"

gql`
  query TransactionsForWalletId($walletId: WalletId!) {
    me {
      defaultAccount {
        walletById(walletId: $walletId) {
          transactions {
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
              __typename
            }
            __typename
          }
        }
      }
    }
  }
`

async function transactionsForWalletId(
  client: ApolloClient,
  apiKey: ApiKey,
  walletId: WalletId,
) {
  const { data } = await client.query<
    TransactionsForWalletIdQuery,
    TransactionsForWalletIdQueryVariables
  >({
    query: TransactionsForWalletId,
    variables: { walletId },
    context: { apiKey },
    fetchPolicy: "no-cache",
  })
  return data
}
