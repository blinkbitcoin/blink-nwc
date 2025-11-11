import { ApolloClient, gql } from "@apollo/client"

import { Satoshis, WalletId } from "@/domain/core/index.types"

import {
  GetWallet,
  GetWalletQuery,
  GetWalletQueryVariables,
} from "@/graphql/internal-client/generated"
import { ApiKey } from "@/domain/index.types"

gql`
  query GetWallet($walletId: WalletId!) {
    me {
      defaultAccount {
        walletById(walletId: $walletId) {
          id
          balance
          walletCurrency
        }
      }
    }
  }
`

export async function getBalance(
  client: ApolloClient,
  apiKey: ApiKey,
  walletId: WalletId,
) {
  const { data } = await client.query<GetWalletQuery, GetWalletQueryVariables>({
    query: GetWallet,
    variables: { walletId },
    context: { apiKey },
    fetchPolicy: "no-cache",
  })
  return (data?.me?.defaultAccount.walletById.balance as Satoshis) ?? (0 as Satoshis)
}
