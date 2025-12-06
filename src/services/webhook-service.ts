import { WalletId } from "@/domain/core/index.types"
import { ApiKey, WebhookId } from "@/domain/index.types"
import { WebhooksRepository } from "@/services/db/webhooks"
import { CouldNotFindWebhookConnectionError } from "@/domain/errors"
import { BlinkCoreService } from "@/services/core"
import { ConnectionsRepository } from "@/services/db"

//todo handle case when user manually revokes his connection, this may be painful
const WebhookService = () => ({
  async maybeCreate(
    walletId: WalletId,
    apiKey: ApiKey,
  ): Promise<ApplicationError | WebhookId> {
    const existingWebhook = await WebhooksRepository().findByWalletId(walletId)
    if (existingWebhook instanceof CouldNotFindWebhookConnectionError) {
      return BlinkCoreService().createWebhook(apiKey)
    }
    if (existingWebhook instanceof Error) {
      return existingWebhook
    }
    return existingWebhook.webhookId
  },
  async maybeDelete(
    apiKey: ApiKey,
    walletId: WalletId,
    webhookId: WebhookId,
  ): Promise<ApplicationError | boolean> {
    const usersConnections = await ConnectionsRepository().countActiveByWalletId(walletId)
    if (usersConnections instanceof Error) {
      return usersConnections
    }
    // it has to be called before the api key removal.
    if (usersConnections > 1) {
      return false
    }
    return BlinkCoreService().deleteWebhook(apiKey, webhookId)
  },
})
