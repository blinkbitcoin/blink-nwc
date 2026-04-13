import { ApolloClient, gql } from "@apollo/client"

import { AccountId, WalletId } from "@/domain/core/index.types"
import { WalletCurrency } from "@/domain/index.types"
import {
  GetAuthenticatedWallets,
  GetAuthenticatedWalletsQuery,
} from "@/graphql/internal-client/generated"

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
gql`
  query GetAuthenticatedWallets {
    me {
      defaultAccount {
        id
        wallets {
          id
          walletCurrency
        }
      }
    }
  }
`

export type AuthenticatedWallet = {
  accountId: AccountId
  id: WalletId
  walletCurrency: WalletCurrency
}

export const getAuthenticatedWallet = async (
  client: ApolloClient,
  authorization: string,
  walletId?: string | null,
): Promise<AuthenticatedWallet | null> => {
  const { data } = await client.query<GetAuthenticatedWalletsQuery>({
    query: GetAuthenticatedWallets,
    context: { authorization },
    fetchPolicy: "no-cache",
  })

  const account = data?.me?.defaultAccount
  const wallets = account?.wallets ?? []

  if (!account?.id) {
    return null
  }

  if (walletId) {
    const selectedWallet = wallets.find((wallet) => wallet.id === walletId)
    if (!selectedWallet) {
      return null
    }

    return {
      accountId: account.id as AccountId,
      id: selectedWallet.id as WalletId,
      walletCurrency: selectedWallet.walletCurrency as WalletCurrency,
    }
  }

  const defaultBtcWallet = wallets.find((wallet) => wallet.walletCurrency === "BTC")
  if (!defaultBtcWallet) {
    return null
  }

  return {
    accountId: account.id as AccountId,
    id: defaultBtcWallet.id as WalletId,
    walletCurrency: defaultBtcWallet.walletCurrency as WalletCurrency,
  }
}
