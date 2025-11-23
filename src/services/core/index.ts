import { CombinedGraphQLErrors, ServerError } from "@apollo/client"
import { GraphQLError } from "graphql"

import client from "@/graphql/internal-client"
import {
  ApiKey,
  BlockHash,
  BlockHeight,
  InvoiceBolt11,
  Memo,
  Network,
  Satoshis,
  Preimage,
} from "@/domain/index.types"
import { createInvoice } from "@/graphql/internal-client/mutations/create-invoice"
import { DescriptionHash, PaymentHash, WalletId } from "@/domain/core/index.types"
import { Minutes } from "@/domain/units"
import { payInvoice } from "@/graphql/internal-client/mutations/pay-invoice"
import { IError } from "@/graphql/index.types"
import { getBalance } from "@/graphql/internal-client/queries/get-balance"
import {
  BlinkServiceError,
  CouldNotAuthorizeError,
  CouldNotFetchNodeInfoError,
  InvalidResponseError,
  InvoiceNotFoundError,
  UnknownBlinkServiceError,
  InvoiceAlreadyPaidError,
  PaymentFailedError,
  PaymentPendingError,
  ServiceUnavailableError,
  parseBlinkError,
} from "@/services/core/errors"
import { invoiceByPaymentHash } from "@/graphql/internal-client/queries/invoice-by-payment-hash"
import { invoiceStatusByPaymentRequest } from "@/graphql/internal-client/queries/invoice-status-by-payment-request"
import { transactionsByPaymentHash } from "@/graphql/internal-client/queries/transactions-by-payment-hash"
import { transactionsForWalletId } from "@/graphql/internal-client/queries/transactions-for-wallet-id"
import { createInvoiceAmountless } from "@/graphql/internal-client/mutations/create-invoice-amountless"
import { getNodeInfo } from "@/graphql/internal-client/queries/get-node-info"

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
        createdAt?: number
        settledAt?: number
      }
    | BlinkServiceError
  >
  listTransactions(
    apiKey: ApiKey,
    walletId: WalletId,
    options?: {
      from?: number
      until?: number
      limit?: number
      offset?: number
      unpaid?: boolean
      type?: "incoming" | "outgoing"
    },
  ): Promise<
    | Array<{
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
    | BlinkServiceError
  >
}

export const BlinkCoreService = (): IBlinkCoreService => ({
  async getNodeInfo() {
    try {
      const nodeInfo = await getNodeInfo(client)
      if (!nodeInfo?.network || !nodeInfo.blockInfo) {
        return new CouldNotFetchNodeInfoError()
      }
      return {
        network: nodeInfo.network as Network,
        blockHeight: nodeInfo.blockInfo.blockHeight as BlockHeight,
        blockHash: nodeInfo.blockInfo.blockHash as BlockHash,
      }
    } catch {
      return new CouldNotFetchNodeInfoError()
    }
  },

  async getBalance(apiKey: ApiKey, walletId: WalletId) {
    try {
      const balance = await getBalance(client, apiKey, walletId)
      if (balance === null || balance === undefined) {
        return new InvalidResponseError()
      }
      return { balance }
    } catch (err) {
      return parseThrownError(err)
    }
  },

  async createInvoice(
    apiKey: ApiKey,
    walletId: WalletId,
    amount: Satoshis,
    descriptionHash: DescriptionHash,
    expiry?: Minutes,
  ) {
    try {
      const res = await createInvoice(
        client,
        apiKey,
        walletId,
        amount,
        descriptionHash,
        expiry,
      )
      if (!res) {
        return new InvalidResponseError()
      }
      const mutationErrors = res.lnInvoiceCreateOnBehalfOfRecipient.errors || []
      if (mutationErrors.length > 0) {
        return parseBlinkError(mutationErrors[0])
      }
      if (!res.lnInvoiceCreateOnBehalfOfRecipient.invoice) {
        return new InvalidResponseError()
      }
      const { createdAt, paymentHash, paymentRequest, satoshis } =
        res.lnInvoiceCreateOnBehalfOfRecipient.invoice
      return {
        createdAt,
        paymentHash: paymentHash as PaymentHash,
        paymentRequest: paymentRequest as InvoiceBolt11,
        satoshis: satoshis as Satoshis,
      }
    } catch (err) {
      return parseThrownError(err)
    }
  },

  async createInvoiceAmountless(
    apiKey: ApiKey,
    walletId: WalletId,
    memo: Memo,
    expiry: Minutes,
  ) {
    try {
      const res = await createInvoiceAmountless(client, apiKey, walletId, expiry, memo)
      if (!res) {
        return new InvalidResponseError()
      }
      const mutationErrors = res.lnNoAmountInvoiceCreateOnBehalfOfRecipient.errors || []
      if (mutationErrors.length > 0) {
        return parseBlinkError(mutationErrors[0])
      }
      if (!res.lnNoAmountInvoiceCreateOnBehalfOfRecipient.invoice) {
        return new InvalidResponseError()
      }
      const { createdAt, paymentHash, paymentRequest } =
        res.lnNoAmountInvoiceCreateOnBehalfOfRecipient.invoice

      return {
        createdAt,
        paymentHash: paymentHash as PaymentHash,
        paymentRequest: paymentRequest as InvoiceBolt11,
        satoshis: 0 as Satoshis,
      }
    } catch (e) {
      return parseThrownError(e)
    }
  },

  async payInvoice(
    apiKey: ApiKey,
    walletId: WalletId,
    invoice: InvoiceBolt11,
    memo?: Memo,
  ) {
    try {
      const res = await payInvoice(client, apiKey, invoice, walletId, memo)
      const payload = res?.lnInvoicePaymentSend
      if (!payload) {
        return new InvalidResponseError()
      }

      const mutationErrors = payload.errors || []
      if (mutationErrors.length > 0) {
        return parseBlinkError(mutationErrors[0])
      }

      switch (payload.status) {
        case undefined:
        case null:
        case "SUCCESS":
          break
        case "ALREADY_PAID":
          return new InvoiceAlreadyPaidError()
        case "PENDING":
          return new PaymentPendingError()
        case "FAILURE":
          return new PaymentFailedError()
        default:
          return new InvalidResponseError()
      }

      const transaction = payload.transaction
      if (!transaction) {
        return new InvalidResponseError()
      }

      const settlementVia = transaction.settlementVia as
        | { preImage?: string | null }
        | undefined

      const preimage =
        settlementVia && typeof settlementVia.preImage === "string"
          ? (settlementVia.preImage as Preimage)
          : undefined

      if (preimage) {
        const fee = (transaction.settlementFee ?? 0) as Satoshis
        return { preimage, feesPaid: fee }
      }

      return new InvalidResponseError()
    } catch (err) {
      return parseThrownError(err)
    }
  },

  async lookupInvoice(
    apiKey: ApiKey,
    walletId: WalletId,
    paymentHash?: PaymentHash,
    invoice?: InvoiceBolt11,
  ) {
    try {
      if (paymentHash) {
        try {
          const invoiceRes = await invoiceByPaymentHash(
            client,
            apiKey,
            walletId,
            paymentHash,
          )
          if (invoiceRes?.me?.defaultAccount?.walletById?.invoiceByPaymentHash) {
            const inv = invoiceRes.me.defaultAccount.walletById.invoiceByPaymentHash
            const createdAt = Math.floor(new Date(inv.createdAt).getTime() / 1000)
            const isPaid = inv.paymentStatus === "PAID"
            return {
              paymentHash: inv.paymentHash as PaymentHash,
              paymentRequest: inv.paymentRequest as InvoiceBolt11,
              paymentStatus: inv.paymentStatus,
              createdAt,
              settledAt: isPaid ? createdAt : undefined,
            }
          }
        } catch {}

        // if not found, try transactionsByPaymentHash (might be outgoing payment)
        try {
          const txnRes = await transactionsByPaymentHash(
            client,
            apiKey,
            walletId,
            paymentHash,
          )
          const transactions =
            txnRes?.me?.defaultAccount?.walletById?.transactionsByPaymentHash

          if (transactions && transactions.length > 0) {
            // filter out non-relevant transactions (fees, etc.)
            const relevant = transactions.filter(
              (tx) => tx.direction === "SEND" || tx.direction === "RECEIVE",
            )
            if (relevant.length > 0) {
              const tx = relevant[0]
              const isOutgoing = tx.direction === "SEND"
              const paymentRequest =
                tx.initiationVia && "paymentRequest" in tx.initiationVia
                  ? (tx.initiationVia.paymentRequest as InvoiceBolt11)
                  : undefined
              const preimage =
                tx.settlementVia &&
                ("preImage" in tx.settlementVia || "preImage" in tx.settlementVia)
                  ? ((tx.settlementVia as any).preImage as Preimage)
                  : undefined

              return {
                paymentHash: paymentHash,
                paymentRequest: paymentRequest,
                paymentStatus: tx.status === "SUCCESS" ? "PAID" : "PENDING",
                createdAt: Math.floor(new Date(tx.createdAt).getTime() / 1000),
                settledAt:
                  tx.status === "SUCCESS"
                    ? Math.floor(new Date(tx.createdAt).getTime() / 1000)
                    : undefined,
                // for outgoing payments, we don't have invoice data
              }
            }
          }
          return new InvoiceNotFoundError()
        } catch (err) {
          return parseThrownError(err)
        }
      }

      // try by invoice (bolt11)
      if (invoice) {
        const statusRes = await invoiceStatusByPaymentRequest(client, apiKey, invoice)
        if (statusRes?.lnInvoicePaymentStatusByPaymentRequest) {
          const status = statusRes.lnInvoicePaymentStatusByPaymentRequest
          return {
            paymentHash: status.paymentHash as PaymentHash,
            paymentRequest: status.paymentRequest as InvoiceBolt11,
            paymentStatus: status.status || "UNKNOWN",
          }
        }
        return new InvalidResponseError()
      }

      // neither paymentHash nor invoice provided
      return new InvalidResponseError()
    } catch (err) {
      return parseThrownError(err)
    }
  },

  // todo - handle also unpaid invoices, fetch from me-query.
  async listTransactions(
    apiKey: ApiKey,
    walletId: WalletId,
    options?: {
      from?: number
      until?: number
      limit?: number
      offset?: number
      unpaid?: boolean
      type?: "incoming" | "outgoing"
    },
  ) {
    try {
      const after = options?.from ? objectIdFromTimestamp(options.from) : undefined
      const before = options?.until
        ? objectIdFromTimestamp(options.until, true)
        : undefined
      const limit = options?.limit ? Math.min(options.limit, 100) : 100
      const res = await transactionsForWalletId(client, apiKey, walletId, {
        first: limit + (options?.offset || 0),
        after,
        before,
      })

      if (!res?.me?.defaultAccount?.walletById?.transactions?.edges) {
        return new InvalidResponseError()
      }

      const edges = res.me.defaultAccount.walletById.transactions.edges
      let transactions = edges.map((edge) => {
        const node = edge.node
        const direction = node.direction.toLowerCase() as "incoming" | "outgoing"
        const paymentHash =
          node.initiationVia &&
          "paymentHash" in node.initiationVia &&
          node.initiationVia.paymentHash
            ? (node.initiationVia.paymentHash as PaymentHash)
            : undefined

        const paymentRequest =
          node.initiationVia &&
          "paymentRequest" in node.initiationVia &&
          node.initiationVia.paymentRequest
            ? (node.initiationVia.paymentRequest as InvoiceBolt11)
            : undefined

        const preimage =
          node.settlementVia &&
          ("preImage" in node.settlementVia || "preImage" in node.settlementVia)
            ? (node.settlementVia as any).preImage
            : undefined

        // convert satoshis to msats
        //todo propably should be moved to nwc handler, as adapter property
        const amount = Number(node.settlementAmount) * 1000
        const feesPaid = Number((node as any).settlementFee || 0) * 1000
        const createdAt = Math.floor(new Date(node.createdAt).getTime() / 1000)

        // extract description from memo if available
        const description = node.memo || undefined

        return {
          type: direction,
          invoice: paymentRequest,
          description: description,
          payment_hash: paymentHash || "",
          preimage: preimage,
          amount: amount,
          fees_paid: feesPaid,
          created_at: createdAt,
          settled_at: node.status === "SUCCESS" ? createdAt : undefined,
        }
      })

      if (options?.from) {
        transactions = transactions.filter((tx) => tx.created_at >= options.from!)
      }
      if (options?.until) {
        transactions = transactions.filter((tx) => tx.created_at <= options.until!)
      }
      if (options?.type) {
        transactions = transactions.filter((tx) => tx.type === options.type)
      }
      if (options?.unpaid !== undefined) {
        transactions = transactions.filter(
          (tx) => (tx.settled_at === undefined) === options.unpaid,
        )
      }

      return transactions
    } catch (err) {
      return parseThrownError(err)
    }
  },
})

//todo find a better place for this helper
// quick "hack" allowing pagination by timestamp
// first 4 bytes of objectid are timestamp, rest is just filler bytes

// nvm, it doesn't work (propably because of medici)
const objectIdFromTimestamp = (timestamp: number, end?: boolean) => {
  const bytes = Buffer.alloc(12)
  if (end) {
    bytes.fill(0xff)
  }
  bytes.writeUInt32BE(Math.floor(timestamp), 0)
  return bytes.toString("hex")
}

const parseThrownError = (err: unknown): BlinkServiceError => {
  if (err instanceof ServerError) {
    if (err.statusCode === 401) {
      return new CouldNotAuthorizeError() // shouldn't happen because nwc connection should be revoked with api key
    }
    if (err.statusCode === 403) {
      return new CouldNotAuthorizeError()
    }
    return new ServiceUnavailableError()
  }

  if (err instanceof CombinedGraphQLErrors) {
    if (err.errors && err.errors.length > 0) {
      const firstError = err.errors[0]
      if (firstError.extensions?.code) {
        return parseBlinkError({
          code: firstError.extensions.code as string,
          message: firstError.message,
        } as IError)
      }
    }
    return new UnknownBlinkServiceError()
  }

  if (
    err &&
    typeof err === "object" &&
    ("graphQLErrors" in err || "networkError" in err)
  ) {
    const apolloErr = err as {
      graphQLErrors?: readonly GraphQLError[]
      networkError?: Error | null
    }

    if (apolloErr.graphQLErrors && apolloErr.graphQLErrors.length > 0) {
      const firstError = apolloErr.graphQLErrors[0]
      if (firstError.extensions?.code) {
        return parseBlinkError({
          code: firstError.extensions.code as string,
          message: firstError.message,
        } as IError)
      }
    }

    if (apolloErr.networkError) {
      return new ServiceUnavailableError()
    }

    return new UnknownBlinkServiceError()
  }

  return new UnknownBlinkServiceError()
}
