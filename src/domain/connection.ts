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
  ApiKey,
  ApiKeyId,
  ConnectionSecret,
  WalletCurrency,
  Nip47MethodType,
} from "./index.types"

import { NOSTR_PRIVATE_KEY } from "@/config"
import { AccountId, UserId, WalletId } from "@/domain/core/index.types"
import { RepositoryError } from "@/domain/errors"

export interface IConnectionsRepository {
  create(
    data: Omit<
      NwcConnection,
      "id" | "createdAt" | "updatedAt" | "revoked" | "revokedAt" | "lastUsedAt"
    >,
  ): Promise<NwcConnection | RepositoryError>
  update(
    id: NwcConnectionId,
    updates: Partial<
      Omit<
        NwcConnection,
        | "id"
        | "accountId"
        | "userId"
        | "walletId"
        | "apiKey"
        | "apiKeyId"
        | "appPubkey"
        | "connectionSecret"
        | "createdAt"
        | "updatedAt"
        | "revoked"
        | "revokedAt"
      >
    >,
  ): Promise<NwcConnection | RepositoryError>

  findByPubkey(pubkey: NwcAppPubkey): Promise<NwcConnection | RepositoryError>
  findById(id: NwcConnectionId): Promise<NwcConnection | RepositoryError>
  findByWalletId(walletId: WalletId): Promise<NwcConnection[] | RepositoryError>
  findByUserId(userId: UserId): Promise<NwcConnection[] | RepositoryError>
  findByWalletIdWithNotificationPerm(
    walletId: WalletId,
    notificationType: string,
  ): Promise<NwcConnection[] | RepositoryError>
  revokeAllByUserId(userId: UserId): Promise<number | RepositoryError>
  deleteByWalletId(walletId: WalletId): Promise<number | RepositoryError>

  updatePermissions(
    id: NwcConnectionId,
    permissions: Nip47MethodType[],
  ): Promise<NwcConnection | RepositoryError>

  updateLastUsed(id: NwcConnectionId): Promise<void | RepositoryError>

  softDelete(id: NwcConnectionId): Promise<boolean | RepositoryError>
  delete(id: NwcConnectionId): Promise<boolean | RepositoryError>

  countActiveByWalletId(walletId: WalletId): Promise<number | RepositoryError>
}

export interface NwcConnection {
  id: NwcConnectionId

  userId: UserId
  accountId: AccountId
  walletId: WalletId
  walletCurrency: WalletCurrency

  apiKey: ApiKey
  apiKeyId: ApiKeyId | null
  connectionSecret: ConnectionSecret

  alias: NwcConnectionAlias | null
  appPubkey: NwcAppPubkey
  permissions: Nip47MethodType[]
  notificationsEnabled: boolean

  revoked: boolean
  expiresAt: Date | null
  revokedAt: Date | null
  lastUsedAt: Date | null

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
    pubkey: getPublicKey(bytes) as ServerNostrPubkey,
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

export const hasPermission = (method: Nip47MethodType, connection: NwcConnection) => {
  return connection.permissions.includes(method)
}
