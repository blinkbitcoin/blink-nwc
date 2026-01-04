import {
  ApiKey,
  BlockHash,
  BlockHeight,
  CoreServiceTx,
  Cursor,
  Description,
  DescriptionHash,
  InvoiceBolt11,
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
    memo?: Description,
    descriptionHash?: DescriptionHash,
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
    memo?: Description,
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
    memo?: Description,
  ): Promise<{ preimage: Preimage; feesPaid: Satoshis } | BlinkServiceError>
  lookupInvoice(
    apiKey: ApiKey,
    walletId: WalletId,
    paymentHash?: PaymentHash,
    invoice?: InvoiceBolt11,
  ): Promise<CoreServiceTx | BlinkServiceError>
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
