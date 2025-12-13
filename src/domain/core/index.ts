import {
  ApiKey,
  BlockHash,
  BlockHeight,
  CoreServiceTx,
  Cursor,
  DescriptionHash,
  InvoiceBolt11,
  Memo,
  Minutes,
  Network,
  PaymentDirection,
  PaymentHash,
  Preimage,
  Satoshis,
  UnixTimestamp,
  WalletId,
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
        createdAt: UnixTimestamp
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
        createdAt: UnixTimestamp
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
        createdAt?: UnixTimestamp
        settledAt?: UnixTimestamp
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
        transactions: Array<CoreServiceTx>
        pageInfo: {
          hasNextPage: boolean
          endCursor?: Cursor
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
        invoices: Array<CoreServiceTx>
        pageInfo: {
          hasNextPage: boolean
          endCursor?: Cursor
        }
      }
    | BlinkServiceError
  >
  fetchTransactionsInRange(
    apiKey: ApiKey,
    walletId: WalletId,
    from: UnixTimestamp,
    until: Cursor,
    offset: number,
    limit: number,
    type: PaymentDirection,
  ): Promise<Array<CoreServiceTx> | BlinkServiceError>

  fetchInvoicesInRange(
    apiKey: ApiKey,
    walletId: WalletId,
    from: UnixTimestamp,
    until: Cursor,
    offset: number,
    limit: number,
    type: PaymentDirection,
  ): Promise<Array<CoreServiceTx> | BlinkServiceError>
}
