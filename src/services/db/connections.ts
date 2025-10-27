import { queryBuilder } from "@/services/db/query-builder"
import type { NwcConnectionRecord } from "@/services/db/index.types"
import type {NwcConnection} from "@/domain/nwc-connection";
import type {
    NwcBudget,
    NwcAppPubkey,
    NwcConnectionId,
    NwcConnectionAlias,
    NwcBudgetAmount,
    Nip47Method,
    ApiKey,
} from "@/domain/index.types"
import {AccountId, UserId, WalletId} from "@/domain/core/index.types";
import {
    CouldNotFindNwcConnectionFromAppPubkeyError,
    CouldNotFindNwcConnectionFromIdError, CouldNotFindNwcConnectionFromUserIdError,
    CouldNotFindNwcConnectionFromWalletIdError,
    RepositoryError,
} from "@/domain/errors"

const TABLE_NAME = "nwc_connections"

export const ConnectionsRepository = () => ({
    async findByPubkey(pubkey: string): Promise<NwcConnection | RepositoryError> {
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
                budget: data.budget
                    ? {
                        total: data.budget.total,
                        spent: data.budget.spent,
                        resetInterval: data.budget.resetInterval,
                        lastReset: data.budget.lastReset,
                    }
                    : null,
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
        updates: Partial<Omit<NwcConnection, "id" | "accountId" | "userId" | "walletId" | "apiKey" | "appPubkey" | "createdAt" | "updatedAt" | "revoked">>,
    ): Promise<NwcConnection | RepositoryError> {
        try {
            const updateData: Partial<NwcConnectionRecord> = {}

            if (updates.alias !== undefined) updateData.alias = updates.alias
            if (updates.permissions !== undefined) updateData.permissions = updates.permissions
            if (updates.budget !== undefined) {
                updateData.budget = updates.budget
                    ? {
                        total: updates.budget.total,
                        spent: updates.budget.spent,
                        resetInterval: updates.budget.resetInterval,
                        lastReset: updates.budget.lastReset,
                    }
                    : null
            }

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
        try{
            const affectedRows = await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
                .where({ id })
                .update({revoked: true});
            return !!affectedRows
        } catch(err){
            return parseRepositoryError(err)
        }
    },

    async findByWalletId(walletId: string): Promise<NwcConnection[] | RepositoryError> {
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

    async findByUserId(userId: string): Promise<NwcConnection[] | RepositoryError> {
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

    async deleteByWalletId(walletId: string): Promise<number | RepositoryError> {
        try {
            const deletedCount = await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
                .where({ wallet_id: walletId })
                .delete()

            return deletedCount
        } catch (err) {
            return parseRepositoryError(err)
        }
    },

    async updateBudget(
        id: NwcConnectionId,
        budget: NwcBudget,
    ): Promise<NwcConnection | RepositoryError> {
        try {
            const [doc] = await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
                .where({ id })
                .update({
                    budget: {
                        total: budget.total,
                        spent: budget.spent,
                        resetInterval: budget.resetInterval,
                        lastReset: budget.lastReset,
                    },
                    updated_at: queryBuilder.fn.now() as any,
                })
                .returning("*")

            if (!doc) {
                return new RepositoryError(`Couldn't update budget for connection with id ${id}`)
            }

            return translateConnection(doc)
        } catch (err) {
            return parseRepositoryError(err)
        }
    },

    async updateBudgetSpent(
        id: NwcConnectionId,
        spent: number,
    ): Promise<NwcConnection | RepositoryError> {
        try {
            const [doc] = await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
                .where({ id })
                .update({
                    budget: queryBuilder.raw(`jsonb_set(budget, '{spent}', ?)`, [spent]),
                    updated_at: queryBuilder.fn.now() as any,
                })
                .returning("*")

            if (!doc) {
                return new RepositoryError(`Couldn't update budget for connection with id ${id}`)
            }

            return translateConnection(doc)
        } catch (err) {
            return parseRepositoryError(err)
        }
    },

    async updateBudgetAndLastReset(
        id: NwcConnectionId,
        spent: number,
        lastReset: Date,
    ): Promise<NwcConnection | RepositoryError> {
        try {
            const [doc] = await queryBuilder<NwcConnectionRecord>(TABLE_NAME)
                .where({ id })
                .update({
                    budget: queryBuilder.raw(
                        `jsonb_set(jsonb_set(budget, '{spent}', ?), '{lastReset}', ?)`,
                        [spent, JSON.stringify(lastReset)],
                    ),
                    updated_at: queryBuilder.fn.now() as any,
                })
                .returning("*")

            if (!doc) {
                return new RepositoryError(
                    `Couldn't update budget and last reset for connection with id ${id}`,
                )
            }

            return translateConnection(doc)
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
        budget: doc.budget
            ? ({
                total: doc.budget.total as NwcBudgetAmount,
                spent: doc.budget.spent as NwcBudgetAmount,
                resetInterval: doc.budget.resetInterval,
                lastReset: new Date(doc.budget.lastReset),
            } as NwcBudget)
            : null,
        revoked: doc.revoked,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
    }
}

const parseRepositoryError = (err: unknown): RepositoryError => {
    if (err instanceof Error) {
        return new RepositoryError(err.message)
    }
    return new RepositoryError("Unknown repository error")
}
