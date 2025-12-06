import { WalletId } from "@/domain/core/index.types"
import { ApiKey, WebhookId } from "@/domain/index.types"

export interface IWebhookService {
  maybeCreate(walletId: WalletId, apiKey: ApiKey): Promise<ApplicationError | WebhookId>
  maybeDelete(
    apiKey: ApiKey,
    walletId: WalletId,
    webhookId: WebhookId,
  ): Promise<ApplicationError | boolean>
}
