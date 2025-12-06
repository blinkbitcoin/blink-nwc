import { queryBuilder } from "@/services/db/query-builder"
import type { NwcConnectionRecord } from "@/services/db/index.types"
import type {
  ApiKey,
  Nip47Method,
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

const TABLE_NAME = "nwc_connections"

export const ConnectionsRepository = (): IConnectionsRepository => ({
  async findByPubkey(pubkey: NwcAppPubkey): Promise<NwcConnection | RepositoryError> {
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
  },

  async findById(id: NwcConnectionId): Promise<NwcConnection | RepositoryError> {
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
  },

  async create(
    data: Omit<NwcConnection, "id" | "createdAt" | "updatedAt" | "revoked">,
  ): Promise<NwcConnection | RepositoryError> {
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
  },

  async update(
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
  ): Promise<NwcConnection | RepositoryError> {
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
  },

  async delete(id: NwcConnectionId): Promise<boolean | RepositoryError> {
    try {
      const deletedCount = await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
        .where({ id })
        .delete()

      return deletedCount > 0
    } catch (err) {
      return parseRepositoryError(err)
    }
  },

  async softDelete(id: NwcConnectionId): Promise<boolean | RepositoryError> {
    try {
      const affectedRows = await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
        .where({ id })
        .update({ revoked: true })
      return !!affectedRows
    } catch (err) {
      return parseRepositoryError(err)
    }
  },

  async findByWalletId(walletId: WalletId): Promise<NwcConnection[] | RepositoryError> {
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
  },

  async countActiveByWalletId(walletId: WalletId): Promise<number | RepositoryError> {
    try {
      const result = await queryBuilder("transactions")
        .where({ revoked: false })
        .where({ wallet_id: walletId })
        .count<{ count: string }>("id as count")
        .first()

      // Knex zwraca count jako string, więc konwersja:
      return Number(result?.count ?? 0)
    } catch (err) {
      return parseRepositoryError(err)
    }
  },

  async findByUserId(userId: UserId): Promise<NwcConnection[] | RepositoryError> {
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
  },

  async deleteByWalletId(walletId: WalletId): Promise<number | RepositoryError> {
    try {
      return await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
        .where({ wallet_id: walletId })
        .delete()
    } catch (err) {
      return parseRepositoryError(err)
    }
  },

  async updatePermissions(
    id: NwcConnectionId,
    permissions: Nip47Method[],
  ): Promise<NwcConnection | RepositoryError> {
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
  },
})

const translateConnection = (doc: NwcConnectionRecord): NwcConnection => {
  return {
    id: doc.id as NwcConnectionId,
    userId: doc.user_id as UserId,
    accountId: doc.account_id as AccountId,
    alias: (doc.alias as NwcConnectionAlias) ?? null,
    walletId: doc.wallet_id as WalletId,
    appPubkey: doc.app_pubkey as NwcAppPubkey,
    permissions: doc.permissions as Nip47Method[],
    apiKey: doc.api_key as ApiKey,
    notificationsEnabled: doc.notifications,
    revoked: doc.revoked,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}
