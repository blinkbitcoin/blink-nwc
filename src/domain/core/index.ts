import {
  ApiKey,
  BlockHash,
  BlockHeight,
  Cursor,
  DescriptionHash,
  InvoiceBolt11,
  Memo,
  Minutes,
  Network,
  PaymentHash,
  Preimage,
  Satoshis,
  WalletId,
  WebhookId,
} from "@/domain/index.types"
import { BlinkServiceError } from "@/services/core/errors"

export interface IBlinkCoreService {
  getNodeInfo(): Promise<
    | { blockHeight: BlockHeight; blockHash: BlockHash; network: Network }
    | BlinkServiceError
  >
  getBalance(
    apiKey: ApiKey,
    walletId: WalletId,
  ): Promise<{ balance: Satoshis } | BlinkServiceError>
  createInvoice(
    apiKey: ApiKey,
    walletId: WalletId,
    amount: Satoshis,
    descriptionHash: DescriptionHash,
    expiry?: Minutes,
  ): Promise<
    | {
        createdAt: number
        paymentHash: PaymentHash
        paymentRequest: InvoiceBolt11
        satoshis: Satoshis
      }
    | BlinkServiceError
  >
  createInvoiceAmountless(
    apiKey: ApiKey,
    walletId: WalletId,
    memo?: Memo,
    expiry?: Minutes,
  ): Promise<
    | {
        createdAt: number
        paymentHash: PaymentHash
        paymentRequest: InvoiceBolt11
        satoshis: Satoshis
      }
    | BlinkServiceError
  >
  payInvoice(
    apiKey: ApiKey,
    walletId: WalletId,
    invoice: InvoiceBolt11,
    memo?: Memo,
  ): Promise<{ preimage: Preimage; feesPaid: Satoshis } | BlinkServiceError>
  lookupInvoice(
    apiKey: ApiKey,
    walletId: WalletId,
    paymentHash?: PaymentHash,
    invoice?: InvoiceBolt11,
  ): Promise<
    | {
        paymentHash: PaymentHash
        paymentRequest?: InvoiceBolt11
        paymentStatus: string
        satoshis?: Satoshis
        feesPaid?: Satoshis
        preimage?: Preimage
        createdAt?: number
        settledAt?: number
      }
    | BlinkServiceError
  >
  listTransactions(
    apiKey: ApiKey,
    walletId: WalletId,
    options?: {
      after?: Cursor
      first?: number
    },
  ): Promise<
    | {
        transactions: Array<{
          type: "incoming" | "outgoing"
          invoice?: string
          description?: string
          description_hash?: string
          preimage?: string
          payment_hash: string
          amount: number
          fees_paid: number
          created_at: number
          settled_at?: number
          expires_at?: number
        }>
        pageInfo: {
          hasNextPage: boolean
          endCursor?: string
        }
      }
    | BlinkServiceError
  >
  listInvoices(
    apiKey: ApiKey,
    walletId: WalletId,
    options?: {
      after?: Cursor
      first?: number
    },
  ): Promise<
    | {
        invoices: Array<{
          type: "incoming" | "outgoing"
          invoice?: string
          description?: string
          description_hash?: string
          preimage?: string
          payment_hash: string
          amount: number
          fees_paid: number
          created_at: number
          settled_at?: number
          expires_at?: number
        }>
        pageInfo: {
          hasNextPage: boolean
          endCursor?: string
        }
      }
    | BlinkServiceError
  >
  fetchTransactionsInRange(
    apiKey: ApiKey,
    walletId: WalletId,
    from?: number,
    until?: number,
    batchSize?: number,
  ): Promise<any>

  fetchInvoicesInRange(
    apiKey: ApiKey,
    walletId: WalletId,
    batchSize?: number,
    from?: number,
  ): Promise<any>

  createWebhook(apiKey: ApiKey): Promise<BlinkServiceError | WebhookId>
  deleteWebhook(
    apiKey: ApiKey,
    webhookId: WebhookId,
  ): Promise<BlinkServiceError | boolean>
}
