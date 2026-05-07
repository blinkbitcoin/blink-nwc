import type { Knex } from "knex"

import { queryBuilder } from "@/services/db/query-builder"
import type { NwcConnectionRecord } from "@/services/db/index.types"
import type {
  ApiKey,
  ApiKeyId,
  ConnectionSecret,
  WalletCurrency,
  NwcAppPubkey,
  NwcConnectionAlias,
  NwcConnectionId,
  NwcPermissionType,
} from "@/domain/index.types"
import { AccountId, UserId, WalletId } from "@/domain/core/index.types"
import {
  CouldNotFindNwcConnectionFromAppPubkeyError,
  CouldNotFindNwcConnectionFromIdError,
  RepositoryError,
} from "@/domain/errors"
import { parseRepositoryError } from "@/services/db/index"
import { IConnectionsRepository, NwcConnection } from "@/domain/connection"
import { hasNotificationPermission } from "@/domain/nwc-permission"
import { wrapAsyncFunctionsToRunInSpan } from "@/services/tracing"
import { decryptSecret, encryptSecret } from "@/services/secret-encryption"

const TABLE_NAME = "nwc_connections"

const currentTimestamp = <TDate extends Date | null = Date>(): Knex.Raw<TDate> =>
  queryBuilder.raw("CURRENT_TIMESTAMP") as Knex.Raw<TDate>

type ConnectionRecordUpdate = Omit<
  Partial<NwcConnectionRecord>,
  "updated_at" | "revoked_at" | "last_used_at"
> & {
  updated_at?: Knex.Raw<Date>
  revoked_at?: Knex.Raw<Date | null>
  last_used_at?: Knex.Raw<Date | null>
}

const applyActiveConnectionFilter = <TRecord extends object, TResult>(
  query: Knex.QueryBuilder<TRecord, TResult>,
) =>
  query
    .where({ revoked: false })
    .andWhere((builder) =>
      builder.whereNull("expires_at").orWhere("expires_at", ">", currentTimestamp()),
    )

export const ConnectionsRepository = (): IConnectionsRepository => {
  const findByPubkey = async (
    pubkey: NwcAppPubkey,
  ): Promise<NwcConnection | RepositoryError> => {
    try {
      const doc = await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
        .where({ app_pubkey: pubkey })
        .first()

      if (!doc) {
        return new CouldNotFindNwcConnectionFromAppPubkeyError()
      }
      return translateConnection(doc)
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const findById = async (
    id: NwcConnectionId,
  ): Promise<NwcConnection | RepositoryError> => {
    try {
      const doc = await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
        .where({ id })
        .first()

      if (!doc) {
        return new CouldNotFindNwcConnectionFromIdError()
      }
      return translateConnection(doc)
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const create = async (
    data: Omit<
      NwcConnection,
      "id" | "createdAt" | "updatedAt" | "revoked" | "revokedAt" | "lastUsedAt"
    >,
  ): Promise<NwcConnection | RepositoryError> => {
    try {
      const insertData = {
        alias: data.alias,
        user_id: data.userId,
        account_id: data.accountId,
        wallet_id: data.walletId,
        wallet_currency: data.walletCurrency,
        api_key_encrypted: encryptSecret(data.apiKey),
        api_key_id: data.apiKeyId,
        connection_secret_encrypted: encryptSecret(data.connectionSecret),
        app_pubkey: data.appPubkey,
        permissions: data.permissions,
        notifications_enabled: hasNotificationPermission(data.permissions),
        expires_at: data.expiresAt,
      }

      const [doc] = await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
        .insert(insertData)
        .returning("*")

      return translateConnection(doc)
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const update = async (
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
  ): Promise<NwcConnection | RepositoryError> => {
    try {
      const updateData: ConnectionRecordUpdate = {}

      if (updates.alias !== undefined) {
        updateData.alias = updates.alias
      }
      if (updates.permissions !== undefined) {
        updateData.permissions = updates.permissions
        updateData.notifications_enabled = hasNotificationPermission(updates.permissions)
      }

      updateData.updated_at = currentTimestamp()

      const [doc] = await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
        .where({ id })
        .update(updateData)
        .returning("*")

      if (!doc) {
        return new RepositoryError(`Couldn't update connection with id: ${id}`)
      }

      return translateConnection(doc)
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const deleteById = async (id: NwcConnectionId): Promise<boolean | RepositoryError> => {
    try {
      const deletedCount = await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
        .where({ id })
        .delete()

      return deletedCount > 0
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const softDelete = async (id: NwcConnectionId): Promise<boolean | RepositoryError> => {
    try {
      const affectedRows = await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
        .where({ id })
        .update({
          revoked: true,
          revoked_at: currentTimestamp<Date | null>(),
          updated_at: currentTimestamp(),
        })
      return !!affectedRows
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const findByWalletId = async (
    walletId: WalletId,
  ): Promise<NwcConnection[] | RepositoryError> => {
    try {
      const docs = await queryBuilder<NwcConnectionRecord>(TABLE_NAME).where({
        wallet_id: walletId,
      })

      if (!docs || !docs.length) {
        return []
      }

      return docs.map(translateConnection)
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const findByWalletIdWithNotificationPerm = async (
    walletId: WalletId,
    notificationType: string,
  ): Promise<NwcConnection[] | RepositoryError> => {
    try {
      const docs = await applyActiveConnectionFilter(
        queryBuilder<NwcConnectionRecord>(TABLE_NAME).where({ wallet_id: walletId }),
      ).whereRaw("? = ANY(permissions)", [notificationType])

      if (!docs || !docs.length) {
        return []
      }

      return docs.map(translateConnection)
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const countActiveByWalletId = async (
    walletId: WalletId,
  ): Promise<number | RepositoryError> => {
    try {
      const result = await applyActiveConnectionFilter(
        queryBuilder(TABLE_NAME).where({ wallet_id: walletId }),
      )
        .count<{ count: string }>("id as count")
        .first()

      return Number(result?.count ?? 0)
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const findByUserId = async (
    userId: UserId,
  ): Promise<NwcConnection[] | RepositoryError> => {
    try {
      const docs = await queryBuilder<NwcConnectionRecord>(TABLE_NAME).where({
        user_id: userId,
      })

      if (!docs || !docs.length) {
        return []
      }

      return docs.map(translateConnection)
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const revokeAllByUserId = async (userId: UserId): Promise<number | RepositoryError> => {
    try {
      return await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
        .where({ user_id: userId, revoked: false })
        .update<number>({
          revoked: true,
          revoked_at: currentTimestamp<Date | null>(),
          updated_at: currentTimestamp(),
        })
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const deleteByWalletId = async (
    walletId: WalletId,
  ): Promise<number | RepositoryError> => {
    try {
      return await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
        .where({ wallet_id: walletId })
        .delete()
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const updatePermissions = async (
    id: NwcConnectionId,
    permissions: NwcPermissionType[],
  ): Promise<NwcConnection | RepositoryError> => {
    try {
      const [doc] = await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
        .where({ id })
        .update({
          permissions,
          notifications_enabled: hasNotificationPermission(permissions),
          updated_at: currentTimestamp(),
        })
        .returning("*")

      if (!doc) {
        return new RepositoryError(
          `Couldn't update permissions for connection with id ${id}`,
        )
      }

      return translateConnection(doc)
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const updateLastUsed = async (id: NwcConnectionId): Promise<void | RepositoryError> => {
    try {
      await queryBuilder<NwcConnectionRecord>(TABLE_NAME).where({ id }).update({
        last_used_at: currentTimestamp<Date | null>(),
        updated_at: currentTimestamp(),
      })
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  return wrapAsyncFunctionsToRunInSpan({
    namespace: "services.db.connections",
    fns: {
      findByPubkey,
      findById,
      create,
      update,
      delete: deleteById,
      softDelete,
      findByWalletId,
      findByWalletIdWithNotificationPerm,
      countActiveByWalletId,
      findByUserId,
      revokeAllByUserId,
      deleteByWalletId,
      updatePermissions,
      updateLastUsed,
    },
  })
}

const translateConnection = (doc: NwcConnectionRecord): NwcConnection => {
  return {
    id: doc.id as NwcConnectionId,
    userId: doc.user_id as UserId,
    accountId: doc.account_id as AccountId,
    alias: (doc.alias as NwcConnectionAlias) ?? null,
    walletId: doc.wallet_id as WalletId,
    walletCurrency: doc.wallet_currency as WalletCurrency,
    appPubkey: doc.app_pubkey as NwcAppPubkey,
    permissions: doc.permissions as NwcPermissionType[],
    apiKey: decryptSecret(doc.api_key_encrypted) as ApiKey,
    apiKeyId: (doc.api_key_id as ApiKeyId) ?? null,
    connectionSecret: decryptSecret(doc.connection_secret_encrypted) as ConnectionSecret,
    notificationsEnabled: doc.notifications_enabled,
    revoked: doc.revoked,
    expiresAt: doc.expires_at,
    revokedAt: doc.revoked_at,
    lastUsedAt: doc.last_used_at,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}
