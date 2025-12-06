import { CombinedGraphQLErrors, ServerError } from "@apollo/client"
import { GraphQLError } from "graphql"

import client from "@/graphql/internal-client"
import {
  ApiKey,
  BlockHash,
  BlockHeight,
  Cursor,
  InvoiceBolt11,
  Memo,
  Minutes,
  Network,
  Preimage,
  Satoshis,
  WebhookId,
} from "@/domain/index.types"
import { createInvoice } from "@/graphql/internal-client/mutations/create-invoice"
import { DescriptionHash, PaymentHash, WalletId } from "@/domain/core/index.types"
import { payInvoice } from "@/graphql/internal-client/mutations/pay-invoice"
import { IError } from "@/graphql/index.types"
import { getBalance } from "@/graphql/internal-client/queries/get-balance"
import {
  BlinkServiceError,
  CouldNotAuthorizeError,
  CouldNotFetchNodeInfoError,
  InvalidResponseError,
  InvoiceAlreadyPaidError,
  InvoiceNotFoundError,
  parseBlinkError,
  PaymentFailedError,
  PaymentPendingError,
  ServiceUnavailableError,
  UnknownBlinkServiceError,
} from "@/services/core/errors"
import { invoiceByPaymentHash } from "@/graphql/internal-client/queries/invoice-by-payment-hash"
import { invoiceStatusByPaymentRequest } from "@/graphql/internal-client/queries/invoice-status-by-payment-request"
import { transactionsByPaymentHash } from "@/graphql/internal-client/queries/transactions-by-payment-hash"
import { transactionsForWalletId } from "@/graphql/internal-client/queries/transactions-for-wallet-id"
import { createInvoiceAmountless } from "@/graphql/internal-client/mutations/create-invoice-amountless"
import { getNodeInfo } from "@/graphql/internal-client/queries/get-node-info"
import { invoicesForWalletId } from "@/graphql/internal-client/queries/invoices-for-wallet-id"
import callbackEndpointAdd from "@/graphql/internal-client/mutations/callback-endpoint-add"
import callbackEndpointDelete from "@/graphql/internal-client/mutations/callback-endpoint-delete"
import { IBlinkCoreService } from "@/domain/core"

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
            // Blink returns createdAt as Unix timestamp in seconds (Timestamp scalar)
            const createdAt = inv.createdAt
            const isPaid = inv.paymentStatus === "PAID"
            const satoshis = "satoshis" in inv ? inv.satoshis : 0
            return {
              paymentHash: inv.paymentHash as PaymentHash,
              paymentRequest: inv.paymentRequest as InvoiceBolt11,
              paymentStatus: inv.paymentStatus,
              satoshis: satoshis as Satoshis,
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
              const paymentRequest =
                tx.initiationVia && "paymentRequest" in tx.initiationVia
                  ? (tx.initiationVia.paymentRequest as InvoiceBolt11)
                  : undefined
              const preimage =
                tx.settlementVia && "preImage" in tx.settlementVia
                  ? ((tx.settlementVia as { preImage?: string | null }).preImage as
                      | Preimage
                      | undefined)
                  : undefined
              // Blink returns createdAt as Unix timestamp in seconds
              const createdAt = tx.createdAt
              const isSettled = tx.status === "SUCCESS"

              return {
                paymentHash,
                paymentRequest,
                paymentStatus: isSettled ? "PAID" : "PENDING",
                satoshis: Math.abs(tx.settlementAmount) as Satoshis,
                feesPaid: 0 as Satoshis,
                preimage,
                createdAt,
                settledAt: isSettled ? createdAt : undefined,
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

  async listTransactions(
    apiKey: ApiKey,
    walletId: WalletId,
    options?: {
      after?: Cursor
      first?: number
    },
  ) {
    try {
      const res = await transactionsForWalletId(client, apiKey, walletId, {
        first: options?.first,
        after: options?.after,
      })

      const edges = res?.me?.defaultAccount?.walletById?.transactions?.edges
      if (!edges) {
        return new InvalidResponseError()
      }

      const txData = res.me.defaultAccount.walletById.transactions
      const transactions = edges.map((edge) => {
        const node = edge.node
        // Blink returns direction as SEND/RECEIVE, NIP-47 uses incoming/outgoing
        const type = node.direction === "RECEIVE" ? "incoming" : "outgoing"
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
          node.settlementVia && "preImage" in node.settlementVia
            ? ((node.settlementVia as { preImage?: string | null }).preImage ?? undefined)
            : undefined

        // Blink returns createdAt as Unix timestamp in seconds (Timestamp scalar)
        const createdAt = node.createdAt
        // NIP-47 uses millisatoshis, Blink uses satoshis
        const amount = Math.abs(node.settlementAmount) * 1000
        const feesPaid = (node.settlementFee ?? 0) * 1000

        return {
          type: type as "incoming" | "outgoing",
          invoice: paymentRequest,
          description: node.memo ?? undefined,
          payment_hash: paymentHash ?? "",
          preimage,
          amount,
          fees_paid: feesPaid,
          created_at: createdAt,
          settled_at: node.status === "SUCCESS" ? createdAt : undefined,
        }
      })

      return {
        transactions,
        pageInfo: {
          hasNextPage: txData.pageInfo.hasNextPage,
          endCursor: txData.pageInfo.endCursor ?? undefined,
        },
      }
    } catch (err) {
      return parseThrownError(err)
    }
  },

  async listInvoices(
    apiKey: ApiKey,
    walletId: WalletId,
    options?: {
      first?: number
      after?: Cursor
    },
  ) {
    try {
      const res = await invoicesForWalletId(client, apiKey, walletId, {
        first: options?.first,
        after: options?.after,
      })

      const edges = res?.me?.defaultAccount?.walletById?.invoices?.edges
      if (!edges) {
        return new InvalidResponseError()
      }

      const invData = res.me.defaultAccount.walletById.invoices
      const invoices = edges.map((edge) => {
        const node = edge.node
        const satoshis = node.__typename === "LnInvoice" ? node.satoshis : 0
        const isPaid = node.paymentStatus === "PAID"
        // Blink returns createdAt as Unix timestamp in seconds
        const createdAt = node.createdAt

        return {
          type: "incoming" as const,
          invoice: node.paymentRequest,
          description: undefined,
          payment_hash: node.paymentHash,
          preimage: undefined,
          // NIP-47 uses millisatoshis
          amount: satoshis * 1000,
          fees_paid: 0,
          created_at: createdAt,
          settled_at: isPaid ? createdAt : undefined,
        }
      })

      return {
        invoices,
        pageInfo: {
          hasNextPage: invData.pageInfo.hasNextPage,
          endCursor: invData.pageInfo.endCursor ?? undefined,
        },
      }
    } catch (err) {
      return parseThrownError(err)
    }
  },

  async fetchTransactionsInRange(
    apiKey: ApiKey,
    walletId: WalletId,
    from?: number,
    until?: number,
    batchSize?: number,
  ) {
    const allTxs = []
    let cursor: Cursor | undefined

    while (true) {
      const res = await BlinkCoreService().listTransactions(apiKey, walletId, {
        first: batchSize,
        after: cursor,
      })
      if (res instanceof Error) return res

      const { transactions, pageInfo } = res
      if (transactions.length === 0) break

      allTxs.push(...transactions)

      const oldestInBatch = transactions[transactions.length - 1].created_at
      if (from !== undefined && oldestInBatch < from) {
        break
      }

      if (!pageInfo.hasNextPage || !pageInfo.endCursor) break
      cursor = pageInfo.endCursor as Cursor
    }

    return allTxs
  },

  async fetchInvoicesInRange(
    apiKey: ApiKey,
    walletId: WalletId,
    batchSize?: number,
    from?: number,
  ) {
    const allInvoices = []
    let cursor: Cursor | undefined

    while (true) {
      const res = await BlinkCoreService().listInvoices(apiKey, walletId, {
        first: batchSize,
        after: cursor,
      })
      if (res instanceof Error) return res

      const { invoices, pageInfo } = res
      if (invoices.length === 0) break

      allInvoices.push(...invoices)

      const oldestInBatch = invoices[invoices.length - 1].created_at
      if (from !== undefined && oldestInBatch < from) {
        break
      }

      if (!pageInfo.hasNextPage || !pageInfo.endCursor) break
      cursor = pageInfo.endCursor as Cursor
    }

    return allInvoices
  },

  //TODO: there will be single global webhook
  async createWebhook(apiKey: ApiKey): Promise<BlinkServiceError | WebhookId> {
    try {
      //todo add url of current microservice
      const url = ""
      const res = await callbackEndpointAdd(client, apiKey, url)
      if (!res?.callbackEndpointAdd) {
        return new InvalidResponseError()
      }
      if (res.callbackEndpointAdd.errors) {
        return parseBlinkError(res.callbackEndpointAdd.errors[0])
      }
      return res.callbackEndpointAdd.id as WebhookId
    } catch (err) {
      return parseThrownError(err)
    }
  },
  async deleteWebhook(
    apiKey: ApiKey,
    webhookId: WebhookId,
  ): Promise<BlinkServiceError | boolean> {
    try {
      const res = await callbackEndpointDelete(client, apiKey, webhookId)
      if (!res?.callbackEndpointDelete) {
        return new InvalidResponseError()
      }
      if (res.callbackEndpointDelete.errors) {
        return parseBlinkError(res.callbackEndpointDelete.errors[0])
      }
      return res.callbackEndpointDelete.success || false
    } catch (err) {
      return parseThrownError(err)
    }
  },
})

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
