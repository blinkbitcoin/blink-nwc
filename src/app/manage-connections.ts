import { getPublicKey, generateSecretKey } from "nostr-tools"

import {
  NwcUri,
  NwcSecret,
  NwcAppPubkey,
  NwcConnectionId,
  ConnectionSecret,
  WalletCurrency,
} from "@/domain/index.types"
import {
  checkedToUserId,
  checkedToWalletId,
  checkedToPermissions,
  checkedToNwcAlias,
  checkedToConnectionId,
  checkedToNwcUpdates,
  checkedToApiKey,
  checkedToApiKeyId,
} from "@/domain/validation"
import { getServerKeypair, NwcConnection, stringifyNwcUri } from "@/domain/connection"
import { ConnectionsRepository } from "@/services/db/connections"
import { NOSTR_RELAY_PUBLIC_URL } from "@/config"
import { Account } from "@/domain/core/index.types"
import { CouldNotFindNwcConnectionFromIdError } from "@/domain/errors"

export const createNwcConnection = async (
  account: Account,
  walletId: string,
  apiKey: string,
  permissions: string[],
  alias?: string,
  walletCurrency?: WalletCurrency,
  expiresAt?: Date | null,
  notificationsEnabled?: boolean,
  apiKeyId?: string,
): Promise<
  { connectionObj: NwcConnection; connectionUri: NwcUri } | ApplicationError
> => {
  const checkedWalletId = checkedToWalletId(walletId)
  if (checkedWalletId instanceof Error) {
    return checkedWalletId
  }

  const checkedPermissions = checkedToPermissions(permissions)
  if (checkedPermissions instanceof Error) {
    return checkedPermissions
  }

  const checkedAlias = checkedToNwcAlias(alias)
  if (checkedAlias instanceof Error) {
    return checkedAlias
  }

  const checkedApiKey = checkedToApiKey(apiKey)
  if (checkedApiKey instanceof Error) {
    return checkedApiKey
  }

  const checkedApiKeyId = apiKeyId ? checkedToApiKeyId(apiKeyId) : null
  if (checkedApiKeyId instanceof Error) {
    return checkedApiKeyId
  }

  const bytes = generateSecretKey()
  const secret = Buffer.from(bytes).toString("hex") as NwcSecret
  const appPubkey = getPublicKey(bytes) as NwcAppPubkey
  const connectionSecret = secret as unknown as ConnectionSecret

  const connection: Omit<
    NwcConnection,
    "id" | "createdAt" | "updatedAt" | "revoked" | "revokedAt" | "lastUsedAt"
  > = {
    userId: account.kratosUserId,
    accountId: account.id,
    walletId: checkedWalletId,
    walletCurrency: walletCurrency || "BTC",
    apiKey: checkedApiKey,
    apiKeyId: checkedApiKeyId,
    connectionSecret,
    alias: checkedAlias,
    appPubkey,
    permissions: checkedPermissions,
    notificationsEnabled: notificationsEnabled ?? false,
    expiresAt: expiresAt ?? null,
  }
  const connectionObj = await ConnectionsRepository().create(connection)
  if (connectionObj instanceof Error) {
    return connectionObj
  }

  const serverPubkey = getServerKeypair().pubkey
  const connectionUri = stringifyNwcUri({
    pubkey: serverPubkey,
    secret,
    relay: NOSTR_RELAY_PUBLIC_URL,
  })

  return {
    connectionObj,
    connectionUri,
  }
}

export const updateNwcConnection = async (
  account: Account,
  connectionId: string,
  updates: {
    alias?: string | null
    permissions?: string[]
    // notificationsEnabled?: boolean
  },
): Promise<NwcConnection | ApplicationError> => {
  const checkedConnectionId = checkedToConnectionId(connectionId)
  if (checkedConnectionId instanceof Error) {
    return checkedConnectionId
  }

  const checkedUpdates = checkedToNwcUpdates(updates)
  if (checkedUpdates instanceof Error) {
    return checkedUpdates
  }

  const existingConnection = await ConnectionsRepository().findById(checkedConnectionId)
  if (existingConnection instanceof Error) {
    return existingConnection
  }

  if (existingConnection.accountId !== account.id) {
    return new CouldNotFindNwcConnectionFromIdError()
  }

  return ConnectionsRepository().update(checkedConnectionId, checkedUpdates)
}

export const softDeleteNwcConnection = async (
  account: Account,
  connectionId: string,
): Promise<boolean | ApplicationError> => {
  const checkedConnectionId = checkedToConnectionId(connectionId)
  if (checkedConnectionId instanceof Error) {
    return checkedConnectionId
  }

  const existingConnection = await ConnectionsRepository().findById(checkedConnectionId)
  if (existingConnection instanceof Error) {
    return existingConnection
  }
  if (existingConnection.accountId !== account.id) {
    return new CouldNotFindNwcConnectionFromIdError()
  }

  return ConnectionsRepository().softDelete(existingConnection.id)
}

export const revokeAllNwcConnections = async (
  account: Account,
): Promise<number | ApplicationError> => {
  const userId = checkedToUserId(account.kratosUserId)
  if (userId instanceof Error) return userId

  return ConnectionsRepository().revokeAllByUserId(userId)
}

export const deleteNwcConnection = async (
  connectionId: NwcConnectionId,
): Promise<boolean | ApplicationError> => {
  const checkedConnectionId = checkedToConnectionId(connectionId)
  if (checkedConnectionId instanceof Error) {
    return checkedConnectionId
  }

  const existingConnection = await ConnectionsRepository().findById(checkedConnectionId)
  if (existingConnection instanceof Error) {
    return existingConnection
  }

  return ConnectionsRepository().delete(existingConnection.id)
}

export const getNwcConnectionById = async (
  connectionId: string,
): Promise<NwcConnection | ApplicationError> => {
  const checkedConnectionId = checkedToConnectionId(connectionId)
  if (checkedConnectionId instanceof Error) {
    return checkedConnectionId
  }
  const connection = await ConnectionsRepository().findById(checkedConnectionId)
  if (connection instanceof Error) {
    return connection
  }
  if (connection.revoked) {
    return new CouldNotFindNwcConnectionFromIdError()
  }
  return connection
}

export const getNwcConnectionByIdForUser = async (
  userId: string,
  connectionId: string,
): Promise<NwcConnection | ApplicationError> => {
  const checkedUserId = checkedToUserId(userId)
  if (checkedUserId instanceof Error) {
    return checkedUserId
  }

  const connection = await getNwcConnectionById(connectionId)
  if (connection instanceof Error) {
    return connection
  }

  if (connection.userId !== checkedUserId) {
    return new CouldNotFindNwcConnectionFromIdError()
  }

  return connection
}

export const nwcConnectionsByUserId = async (
  userId: string,
  includeRevoked = false,
): Promise<NwcConnection[] | ApplicationError> => {
  const checkedUserId = checkedToUserId(userId)
  if (checkedUserId instanceof Error) {
    return checkedUserId
  }
  const connections = await ConnectionsRepository().findByUserId(checkedUserId)
  if (connections instanceof Error) {
    return connections
  }
  return includeRevoked ? connections : connections.filter((c) => !c.revoked)
}

export const nwcConnectionsByWalletId = async (
  walletId: string,
): Promise<NwcConnection[] | ApplicationError> => {
  const checkedWalletId = checkedToWalletId(walletId)
  if (checkedWalletId instanceof Error) {
    return checkedWalletId
  }
  const connections = await ConnectionsRepository().findByWalletId(checkedWalletId)
  if (connections instanceof Error) {
    return connections
  }
  return connections.filter((c) => !c.revoked)
}
