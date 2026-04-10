import { CombinedGraphQLErrors, ServerError } from "@apollo/client"
import { GraphQLError } from "graphql"

import client from "@/graphql/internal-client"
import {
  ApiKey,
  BlockHash,
  BlockHeight,
  CoreServiceTx,
  Cursor,
  Description,
  InvoiceBolt11,
  Minutes,
  Network,
  PaymentDirection,
  Preimage,
  Satoshis,
  UnixTimestamp,
} from "@/domain/index.types"
import { createInvoice as createInv } from "@/graphql/internal-client/mutations/create-invoice"
import { DescriptionHash, PaymentHash, WalletId } from "@/domain/core/index.types"
import { payInvoice as payInvoiceGql } from "@/graphql/internal-client/mutations/pay-invoice"
import { IError } from "@/graphql/index.types"
import { getBalance as getBalanceGql } from "@/graphql/internal-client/queries/get-balance"
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
import { getNodeInfo as fetchNodeInfo } from "@/graphql/internal-client/queries/get-node-info"
import { invoicesForWalletId } from "@/graphql/internal-client/queries/invoices-for-wallet-id"
import { IBlinkCoreService } from "@/domain/core"
import { createInvoiceAmountless as createInvoiceAmountlessGql } from "@/graphql/internal-client/mutations/create-invoice-amountless"
import { PaymentDirection as PD } from "@/domain/nostr/payment-direction"
import { wrapAsyncFunctionsToRunInSpan } from "@/services/tracing"
import { mergeTxs, translateStatus } from "@/domain/utils"

export const BlinkCoreService = (): IBlinkCoreService => {
  const getNodeInfo = async () => {
    try {
      const nodeInfo = await fetchNodeInfo(client)
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
  }

  const getBalance = async (apiKey: ApiKey, walletId: WalletId) => {
    try {
      const balance = await getBalanceGql(client, apiKey, walletId)
      if (balance === null || balance === undefined) {
        return new InvalidResponseError()
      }
      return { balance }
    } catch (err) {
      return parseThrownError(err)
    }
  }

  const createInvoice = async (
    apiKey: ApiKey,
    walletId: WalletId,
    amount: Satoshis,
    memo: Description,
    descriptionHash: DescriptionHash,
    expiry?: Minutes,
  ) => {
    try {
      const res = await createInv(
        client,
        apiKey,
        walletId,
        amount,
        memo,
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
        createdAt: createdAt as UnixTimestamp,
        paymentHash: paymentHash as PaymentHash,
        paymentRequest: paymentRequest as InvoiceBolt11,
        satoshis: satoshis as Satoshis,
      }
    } catch (err) {
      return parseThrownError(err)
    }
  }

  const createInvoiceAmountless = async (
    apiKey: ApiKey,
    walletId: WalletId,
    memo: Description,
    expiry: Minutes,
  ) => {
    try {
      const res = await createInvoiceAmountlessGql(client, apiKey, walletId, memo, expiry)
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
        createdAt: createdAt as UnixTimestamp,
        paymentHash: paymentHash as PaymentHash,
        paymentRequest: paymentRequest as InvoiceBolt11,
        satoshis: 0 as Satoshis,
      }
    } catch (e) {
      return parseThrownError(e)
    }
  }

  const payInvoice = async (
    apiKey: ApiKey,
    walletId: WalletId,
    invoice: InvoiceBolt11,
    memo?: Description,
  ) => {
    try {
      const res = await payInvoiceGql(client, apiKey, invoice, walletId, memo)
      const payload = res?.lnInvoicePaymentSend
      if (!payload) {
        return new InvalidResponseError()
      }

      const mutationErrors = payload.errors || []
      if (mutationErrors.length > 0) {
        return parseBlinkError(mutationErrors[0])
      }

      switch (payload.status) {
        case null: // we don't know the payment state but it may be paid
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
  }

  const lookupInvoice = async (
    apiKey: ApiKey,
    walletId: WalletId,
    paymentHash?: PaymentHash,
    invoice?: InvoiceBolt11,
  ) => {
    try {
      if (paymentHash) {
        // fetch both invoice and transaction, then merge
        let invoiceTx: CoreServiceTx | null = null
        let transactionTx: CoreServiceTx | null = null

        // try to get invoice data (has real created_at)
        try {
          const invoiceRes = await invoiceByPaymentHash(
            client,
            apiKey,
            walletId,
            paymentHash,
          )
          if (invoiceRes?.me?.defaultAccount?.walletById?.invoiceByPaymentHash) {
            const inv = invoiceRes.me.defaultAccount.walletById.invoiceByPaymentHash
            const satoshis = "satoshis" in inv ? inv.satoshis : 0
            invoiceTx = {
              type: "incoming",
              state: translateStatus(inv.paymentStatus),
              paymentHash: inv.paymentHash as PaymentHash,
              invoice: inv.paymentRequest as InvoiceBolt11,
              description: undefined,
              descriptionHash: undefined,
              preimage: undefined,
              amount: satoshis as Satoshis,
              feesPaid: 0 as Satoshis,
              createdAt: inv.createdAt as UnixTimestamp, // real invoice creation time
              expiresAt: undefined,
              settledAt: undefined, // invoice doesn't know settlement time
            }
          }
        } catch {
          // invoice not found - might be outgoing payment
        }

        // try to get transaction data
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
            const relevant = transactions.filter(
              (tx) => tx.direction === "SEND" || tx.direction === "RECEIVE",
            )
            if (relevant.length > 0) {
              const tx = relevant[0]
              const type = tx.direction === "RECEIVE" ? "incoming" : "outgoing"
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
              const txCreatedAt = tx.createdAt as UnixTimestamp
              const isSettled = tx.status === "SUCCESS"

              transactionTx = {
                type,
                paymentHash: paymentHash,
                state: translateStatus(tx.status),
                invoice: paymentRequest,
                description: (tx.memo as Description) ?? undefined,
                descriptionHash: undefined,
                preimage,
                amount: Math.abs(tx.settlementAmount) as Satoshis,
                feesPaid: 0 as Satoshis,
                createdAt: txCreatedAt,
                expiresAt: undefined,
                settledAt: isSettled ? txCreatedAt : undefined,
              }
            }
          }
        } catch {}

        // merge invoice and transaction
        if (invoiceTx || transactionTx) {
          const invoiceArr = invoiceTx ? [invoiceTx] : []
          const txArr = transactionTx ? [transactionTx] : []
          const merged = mergeTxs(invoiceArr, txArr)

          if (merged.length > 0) {
            return merged[0]
          }
        }

        return new InvoiceNotFoundError()
      }

      // try by invoice (bolt11) - get paymentHash first, then recurse
      if (invoice) {
        const statusRes = await invoiceStatusByPaymentRequest(client, apiKey, invoice)
        if (statusRes?.lnInvoicePaymentStatusByPaymentRequest) {
          const status = statusRes.lnInvoicePaymentStatusByPaymentRequest
          if (status.paymentHash) {
            return lookupInvoice(apiKey, walletId, status.paymentHash as PaymentHash)
          }
          return new InvalidResponseError("Tx doesn't contain payment hash!")
        }
        return new InvoiceNotFoundError("Invoice not found!")
      }

      // todo better error = neither paymentHash nor invoice provided
      return new InvoiceNotFoundError()
    } catch (err) {
      return parseThrownError(err)
    }
  }

  const listTransactions = async (
    apiKey: ApiKey,
    walletId: WalletId,
    options?: {
      after?: Cursor
      first?: number
    },
  ) => {
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
            ? ((node.settlementVia as { preImage?: Preimage | null }).preImage ??
              undefined)
            : undefined

        const createdAt = node.createdAt

        const amount = Math.abs(node.settlementAmount) as Satoshis
        const feesPaid = (node.settlementFee ?? 0) as Satoshis
        const state = translateStatus(node.status)

        return {
          type: type as "incoming" | "outgoing",
          state,
          invoice: paymentRequest,
          description: (node.memo as Description) ?? undefined,
          paymentHash: paymentHash ?? ("" as PaymentHash),
          preimage,
          amount,
          feesPaid,
          createdAt: createdAt as UnixTimestamp,
          // tx entry in db is created after settlement
          settledAt: node.status === "SUCCESS" ? (createdAt as UnixTimestamp) : undefined,
        }
      })

      return {
        transactions,
        pageInfo: {
          hasNextPage: txData.pageInfo.hasNextPage,
          endCursor: (txData.pageInfo.endCursor as Cursor) ?? undefined,
        },
      }
    } catch (err) {
      return parseThrownError(err)
    }
  }

  const listInvoices = async (
    apiKey: ApiKey,
    walletId: WalletId,
    options?: {
      first?: number
      after?: Cursor
    },
  ) => {
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
        const createdAt = node.createdAt as UnixTimestamp
        const state = translateStatus(node.paymentStatus)
        return {
          type: "incoming" as const,
          invoice: node.paymentRequest as InvoiceBolt11,
          state,
          description: undefined,
          descriptionHash: undefined,
          paymentHash: node.paymentHash as PaymentHash,
          preimage: undefined,
          amount: satoshis as Satoshis,
          feesPaid: 0 as Satoshis,
          createdAt,
          settledAt: undefined, // invoice itself doesn't contain settled_at
          expiresAt: undefined,
        }
      })

      return {
        invoices,
        pageInfo: {
          hasNextPage: invData.pageInfo.hasNextPage,
          endCursor: (invData.pageInfo.endCursor as Cursor) ?? undefined,
        },
      }
    } catch (err) {
      return parseThrownError(err)
    }
  }

  /*
    ==================
    Blink:
    *after* means younger invoices than X cursor, in backwards pagination.
    ==================

    ==================
    NWC:
    *Until* means upper bound of these txs, so before x moment in time. Defaults to Math.Round(Date.now()/1000)
    *From* means lower bound of these txs, so before x moment in time. Defaults to 0
    ==================
     */

  const fetchTransactionsInRange = async (
    apiKey: ApiKey,
    walletId: WalletId,
    from: UnixTimestamp,
    until: Cursor,
    offset: number,
    limit: number,
    type: PaymentDirection,
  ) => {
    const allTxs: CoreServiceTx[] = []
    let cursor: Cursor = until
    const totalLimit = offset + limit

    while (allTxs.length < totalLimit) {
      const remaining = totalLimit - allTxs.length
      const batchSize = Math.min(remaining, 100)
      const fetchSize = allTxs.length < offset ? 100 : batchSize

      /*
       * fetch txs older than "after", so in this case in first iteration - until,
       * on next iterations, it's oldest tx cursor
       */
      const res = await BlinkCoreService().listTransactions(apiKey, walletId, {
        first: fetchSize,
        after: cursor,
      })
      if (res instanceof Error) {
        return res
      }

      const { transactions, pageInfo } = res
      if (transactions.length === 0) {
        break
      }

      /*
       * Before any conditions, check PaymentDirection
       */
      let txsToPush: CoreServiceTx[] = [...transactions]
      if (type !== PD.Both) {
        txsToPush = transactions.filter((tx) => tx.type === type)
      }
      allTxs.push(...txsToPush)

      /*
       * if oldest tx in batch is older than "from" - return
       */
      const oldestTxTimestamp = transactions[transactions.length - 1].createdAt
      if (from !== undefined && oldestTxTimestamp < from) {
        break
      }

      if (!pageInfo.hasNextPage || !pageInfo.endCursor) break
      cursor = pageInfo.endCursor as Cursor

      /*
       * if we have already more than offset + limit - we can safely slice it and return.
       */
      if (allTxs.length >= totalLimit) {
        return allTxs.slice(offset, totalLimit)
      }
    }
    /*
     * filter out txs older than "from" and apply offset
     */
    return allTxs.filter((tx) => tx.createdAt > from).slice(offset, totalLimit)
  }

  const fetchInvoicesInRange = async (
    apiKey: ApiKey,
    walletId: WalletId,
    from: UnixTimestamp,
    until: Cursor,
    offset: number,
    limit: number,
    type: PaymentDirection,
  ) => {
    const allInvoices: CoreServiceTx[] = []
    let cursor: Cursor = until
    const totalLimit = offset + limit

    while (allInvoices.length < totalLimit) {
      const remaining = totalLimit - allInvoices.length
      const batchSize = Math.min(remaining, 100)
      const fetchSize = allInvoices.length < offset ? 100 : batchSize

      const res = await BlinkCoreService().listInvoices(apiKey, walletId, {
        first: fetchSize,
        after: cursor,
      })
      if (res instanceof Error) {
        return res
      }

      const { invoices, pageInfo } = res
      if (invoices.length === 0) {
        break
      }
      if (type !== PD.Both) {
        allInvoices.push(...invoices.filter((inv) => inv.type === type))
      } else {
        allInvoices.push(...invoices)
      }

      const oldestInvTimestamp = invoices[invoices.length - 1].createdAt
      if (from !== undefined && oldestInvTimestamp <= from) {
        break
      }

      if (!pageInfo.hasNextPage || !pageInfo.endCursor) {
        break
      }
      cursor = pageInfo.endCursor as Cursor

      if (allInvoices.length >= totalLimit) {
        return allInvoices.slice(offset, totalLimit)
      }
    }

    return allInvoices.filter((inv) => inv.createdAt > from).slice(offset, totalLimit)
  }

  return wrapAsyncFunctionsToRunInSpan({
    namespace: "services.blinkCore",
    fns: {
      getNodeInfo,
      getBalance,
      createInvoice,
      createInvoiceAmountless,
      payInvoice,
      lookupInvoice,
      listTransactions,
      listInvoices,
      fetchTransactionsInRange,
      fetchInvoicesInRange,
    },
  })
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
