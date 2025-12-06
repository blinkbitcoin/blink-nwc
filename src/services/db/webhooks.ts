import { WalletId } from "@/domain/core/index.types"
import { parseRepositoryError, queryBuilder } from "@/services/db/index"
import type { WebhookRecord } from "@/services/db/index.types"
import { CouldNotFindWebhookConnectionError, RepositoryError } from "@/domain/errors"
import { WebhookConnection, WebhookId } from "@/domain/index.types"

const TABLE_NAME = "webhooks"

export const WebhooksRepository = () => ({
  async create(
    walletId: WalletId,
    webhookId: WebhookId,
  ): Promise<RepositoryError | WebhookConnection> {
    try {
      const [doc] = await queryBuilder<WebhookRecord>(TABLE_NAME)
        .insert({ wallet_id: walletId, webhook_id: webhookId })
        .returning("*")
      return translateWebhookConnection(doc)
    } catch (err) {
      return parseRepositoryError(err)
    }
  },

  async findByWalletId(walletId: WalletId): Promise<RepositoryError | WebhookConnection> {
    try {
      const [doc] = await queryBuilder<WebhookRecord>(TABLE_NAME).where({
        wallet_id: walletId,
      })
      if (!doc) {
        return new CouldNotFindWebhookConnectionError()
      }
      return translateWebhookConnection(doc)
    } catch (err) {
      return parseRepositoryError(err)
    }
  },
  async delete(webhookId: WebhookId): Promise<RepositoryError | boolean> {
    try {
      await queryBuilder<WebhookRecord>(TABLE_NAME)
        .where({ webhook_id: webhookId })
        .delete()
      return true
    } catch (err) {
      return parseRepositoryError(err)
    }
  },
})

const translateWebhookConnection = async (record: WebhookRecord) => {
  const { wallet_id, webhook_id } = record
  return {
    walletId: wallet_id,
    webhookId: webhook_id,
  } as WebhookConnection
}
