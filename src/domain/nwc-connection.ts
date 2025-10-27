import { getPublicKey } from "nostr-tools"

import {
  NwcAppPubkey,
  NwcConnectionAlias,
  NwcConnectionId,
  NwcRelay,
  NwcSecret,
  NwcUri,
  ServerNostrKeypair,
  ServerNostrPubkey,
  NwcBudget,
  Nip47Method,
  ApiKey,
} from "./index.types"

import { NOSTR_PRIVATE_KEY } from "@/config"
import {AccountId, UserId, WalletId} from "@/domain/core/index.types";

export interface NwcConnection {
  id: NwcConnectionId

  userId: UserId
  accountId: AccountId
  walletId: WalletId

  apiKey: ApiKey

  alias: NwcConnectionAlias | null
  appPubkey: NwcAppPubkey
  permissions: Nip47Method[]
  budget: NwcBudget | null

  revoked: boolean

  createdAt: Date
  updatedAt: Date
}

export interface NwcUriParams {
  pubkey: ServerNostrPubkey
  relay: NwcRelay
  secret: NwcSecret
}

/**
 * We assume that pubkey is stored in hex format in env variable
 */
export const getServerKeypair: () => ServerNostrKeypair = () => {
  const priv = NOSTR_PRIVATE_KEY
  const bytes = Buffer.from(priv, "hex")
  return {
    pubkey: Buffer.from(getPublicKey(bytes)).toString("hex") as ServerNostrPubkey,
    privkey: priv,
  }
}

export const stringifyNwcUri = ({ pubkey, relay, secret }: NwcUriParams): NwcUri => {
  const params = new URLSearchParams({
    relay: relay,
    secret: secret,
  })
  return `nostr+walletconnect://${pubkey}?${params.toString()}` as NwcUri
}

export const hasPermission = (method: Nip47Method, connection: NwcConnection) => {
  return connection.permissions.includes(method)
}
