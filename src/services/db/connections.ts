import { queryBuilder } from "@/services/db/query-builder"
import type { NwcConnectionRecord } from "@/services/db/index.types"
import type {
  ApiKey,
  Nip47MethodType,
  NwcAppPubkey,
  NwcConnectionAlias,
  NwcConnectionId,
} from "@/domain/index.types"
import { AccountId, UserId, WalletId } from "@/domain/core/index.types"
import {
  CouldNotFindNwcConnectionFromAppPubkeyError,
  CouldNotFindNwcConnectionFromIdError,
  CouldNotFindNwcConnectionFromUserIdError,
  CouldNotFindNwcConnectionFromWalletIdError,
  RepositoryError,
} from "@/domain/errors"
import { parseRepositoryError } from "@/services/db/index"
import { IConnectionsRepository, NwcConnection } from "@/domain/connection"
import { wrapAsyncFunctionsToRunInSpan } from "@/services/tracing"

const TABLE_NAME = "nwc_connections"

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
    data: Omit<NwcConnection, "id" | "createdAt" | "updatedAt" | "revoked">,
  ): Promise<NwcConnection | RepositoryError> => {
    try {
      const insertData = {
        alias: data.alias,
        userId: data.userId,
        accountId: data.accountId,
        wallet_id: data.walletId,
        api_key: data.apiKey,
        app_pubkey: data.appPubkey,
        permissions: data.permissions,
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
        | "appPubkey"
        | "createdAt"
        | "updatedAt"
        | "revoked"
      >
    >,
  ): Promise<NwcConnection | RepositoryError> => {
    try {
      const updateData: Partial<NwcConnectionRecord> = {}

      if (updates.alias !== undefined) updateData.alias = updates.alias
      if (updates.permissions !== undefined) updateData.permissions = updates.permissions

      updateData.updated_at = queryBuilder.fn.now() as any

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
        .update({ revoked: true })
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
        return new CouldNotFindNwcConnectionFromWalletIdError()
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
      const result = await queryBuilder("transactions")
        .where({ revoked: false })
        .where({ wallet_id: walletId })
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
        return new CouldNotFindNwcConnectionFromUserIdError()
      }

      return docs.map(translateConnection)
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
    permissions: Nip47MethodType[],
  ): Promise<NwcConnection | RepositoryError> => {
    try {
      const [doc] = await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
        .where({ id })
        .update({
          permissions,
          updated_at: queryBuilder.fn.now() as any,
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
      countActiveByWalletId,
      findByUserId,
      deleteByWalletId,
      updatePermissions,
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
    appPubkey: doc.app_pubkey as NwcAppPubkey,
    permissions: doc.permissions as Nip47MethodType[],
    apiKey: doc.api_key as ApiKey,
    notificationsEnabled: doc.notifications,
    revoked: doc.revoked,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}
