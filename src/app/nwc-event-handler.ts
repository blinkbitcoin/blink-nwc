import {
  InvoiceBolt11,
  Memo,
  Minutes,
  Nip47GetBalanceResult,
  Nip47GetInfoResult,
  Nip47ListTransactionsRequest,
  Nip47ListTransactionsResult,
  Nip47LookupInvoiceRequest,
  Nip47LookupInvoiceResult,
  Nip47MakeInvoiceRequest,
  Nip47MakeInvoiceResult,
  Nip47Method,
  Nip47PayInvoiceRequest,
  Nip47PayInvoiceResult,
  Nip47Result,
  Satoshis,
} from "@/domain/index.types"
import { DescriptionHash, PaymentHash } from "@/domain/core/index.types"
import { getServerKeypair, hasPermission, NwcConnection } from "@/domain/connection"

import { BlinkCoreService } from "@/services"
import { SUPPORTED_NWC_METHODS } from "@/config"
import { BlinkServiceError } from "@/services/core/errors"
import { mergeTxs } from "@/domain/utils"
import {
  Nip47Error,
  Nip47InsufficientBalanceError,
  Nip47InternalError,
  Nip47NotFoundError,
  Nip47NotImplementedError,
  Nip47OtherError,
  Nip47PaymentFailedError,
  Nip47QuotaExceededError,
  Nip47RateLimitedError,
  Nip47RestrictedError,
  Nip47UnauthorizedError,
} from "@/domain/nostr"
import { ensureUnixSeconds, toMilliSatoshis, toUnixSeconds } from "@/domain/units"
import { findFromIndex, findUntilIndex } from "@/domain"

const DEFAULT_INVOICE_EXPIRY_SECONDS = 24 * 60 * 60
const DEFAULT_BATCH_SIZE = 10

const NwcEventHandler = () => {
  const getInfo = async (): Promise<Nip47Error | Nip47GetInfoResult> => {
    const serverPubkey = getServerKeypair().pubkey

    const info = await BlinkCoreService().getNodeInfo()
    if (info instanceof Error) {
      return new Nip47InternalError(info.message)
    }

    return {
      alias: "Blink Wallet",
      color: "F2A900",
      pubkey: serverPubkey,
      methods: SUPPORTED_NWC_METHODS,
      // todo notifications
      network: info.network,
      block_height: info.blockHeight,
      block_hash: info.blockHash,
    }
  }

  const getBalance = async (
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47GetBalanceResult> => {
    const { apiKey, walletId } = connection
    const res = await BlinkCoreService().getBalance(apiKey, walletId)
    if (res instanceof Error) {
      return parseErrorForNip47Response(res)
    }
    return { balance: toMilliSatoshis(res.balance) }
  }

  const makeInvoice = async (
    req: Nip47MakeInvoiceRequest,
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47MakeInvoiceResult> => {
    const { apiKey, walletId } = connection
    const { amount, description, description_hash, expiry } = req
    const satoshis = Math.round(amount / 1000) as Satoshis
    const expiry_minutes = expiry ? ((expiry / 60) as Minutes) : undefined

    let invoice
    if (amount == 0) {
      invoice = await BlinkCoreService().createInvoiceAmountless(
        apiKey,
        walletId,
        description as Memo,
        expiry_minutes,
      )
    } else {
      invoice = await BlinkCoreService().createInvoice(
        apiKey,
        walletId,
        satoshis,
        description_hash as DescriptionHash,
        expiry_minutes,
      )
    }
    if (invoice instanceof Error) {
      return parseErrorForNip47Response(invoice)
    }
    const createdAt = ensureUnixSeconds(invoice.createdAt)
    const expiresInSeconds =
      typeof expiry_minutes === "number"
        ? Math.floor(expiry_minutes * 60)
        : DEFAULT_INVOICE_EXPIRY_SECONDS

    return {
      type: "incoming",
      amount: toMilliSatoshis(satoshis),
      created_at: createdAt,
      description: description,
      description_hash,
      expires_at: createdAt + expiresInSeconds,
      fees_paid: 0,
      invoice: invoice.paymentRequest,
      payment_hash: invoice.paymentHash,
    }
  }

  const payInvoice = async (
    req: Nip47PayInvoiceRequest,
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47PayInvoiceResult> => {
    const { invoice } = req
    const res = await BlinkCoreService().payInvoice(
      connection.apiKey,
      connection.walletId,
      invoice as InvoiceBolt11,
    )
    if (res instanceof Error) {
      return parseErrorForNip47Response(res)
    }
    return { preimage: res.preimage, fees_paid: toMilliSatoshis(res.feesPaid) }
  }

  const lookupInvoice = async (
    req: Nip47LookupInvoiceRequest,
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47LookupInvoiceResult> => {
    const { apiKey, walletId } = connection
    const { payment_hash, invoice } = req

    const res = await BlinkCoreService().lookupInvoice(
      apiKey,
      walletId,
      payment_hash as PaymentHash | undefined,
      invoice as InvoiceBolt11 | undefined,
    )

    if (res instanceof Error) {
      if (res.name === "InvalidResponseError" || res.name === "InvoiceNotFoundError") {
        return new Nip47NotFoundError("Invoice not found")
      }
      return parseErrorForNip47Response(res)
    }

    const createdAt = ensureUnixSeconds(res.createdAt)
    const settledAt = toUnixSeconds(res.settledAt)

    return {
      type: "incoming",
      payment_hash: res.paymentHash,
      invoice: res.paymentRequest,
      created_at: createdAt,
      settled_at: settledAt,
      expires_at: undefined,
      amount: toMilliSatoshis(res.satoshis),
      fees_paid: toMilliSatoshis(res.feesPaid),
      description: undefined,
      description_hash: undefined,
      preimage: res.preimage,
    }
  }

  const listTransactions = async (
    req: Nip47ListTransactionsRequest,
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47ListTransactionsResult> => {
    const { apiKey, walletId } = connection
    const { from, until, offset, unpaid, type } = req
    const limit = req.limit || DEFAULT_BATCH_SIZE

    const transactions = await BlinkCoreService().fetchTransactionsInRange(
      apiKey,
      walletId,
      from,
      until,
    )
    if (transactions instanceof Error) {
      return parseErrorForNip47Response(transactions)
    }

    let result: Nip47LookupInvoiceResult[]

    if (unpaid) {
      const invoices = await BlinkCoreService().fetchInvoicesInRange(
        apiKey,
        walletId,
        from,
      )
      if (invoices instanceof Error) {
        return parseErrorForNip47Response(invoices)
      }
      result = mergeTxs(invoices, transactions)
    } else {
      result = transactions
    }

    // data is sorted DESC (newest first)
    // use binary search to find the time range boundaries
    let startIdx = 0
    let endIdx = result.length

    if (until !== undefined) {
      // find first index where created_at <= until
      startIdx = findUntilIndex(result, until)
    }
    if (from !== undefined) {
      // find last index where created_at >= from
      endIdx = findFromIndex(result, from)
    }

    result = result.slice(startIdx, endIdx)

    // apply type filter
    if (type) {
      result = result.filter((tx) => tx.type === type)
    }

    // Apply offset and limit
    if (offset !== undefined && offset > 0) {
      result = result.slice(offset)
    }
    if (limit !== undefined && limit > 0) {
      result = result.slice(0, limit)
    }

    return { transactions: result }
  }

  const parseErrorForNip47Response = (err: BlinkServiceError): Nip47Error => {
    const message = err.message || "An error occurred"

    switch (err.name) {
      case "InvoiceNotFoundError":
        return new Nip47NotFoundError(message)

      case "InsufficientBalanceError":
        return new Nip47InsufficientBalanceError(message)

      case "RateLimitError":
        return new Nip47RateLimitedError(message)

      case "CouldNotAuthorizeError":
        return new Nip47UnauthorizedError(message)

      case "TransactionRestrictedError":
        return new Nip47QuotaExceededError(message)

      case "PaymentFailedError":
      case "PaymentPendingError":
      case "RouteNotFoundError":
      case "PaymentRejectedError":
      case "PaymentTimedOutError":
        return new Nip47PaymentFailedError(message)

      case "InvoiceExpiredError":
      case "InvoiceAlreadyPaidError":
        return new Nip47PaymentFailedError(message)
      case "InvoiceDecodeError":
      case "InvalidInvoiceAmountError":
        return new Nip47OtherError(message)

      case "SelfPaymentError":
        return new Nip47RestrictedError(message)

      case "ValidationError":
      case "InvalidWalletIdError":
        return new Nip47OtherError(message)

      case "ServiceUnavailableError":
      case "PriceServiceOfflineError":
      case "DealerOfflineError":
      case "CouldNotFetchNodeInfoError":
      case "CouldNotGetBalanceError":
      case "CouldNotCreateInvoiceError":
      case "CouldNotPayInvoiceError":
        return new Nip47InternalError(message)

      case "UnknownBlinkServiceError":
      case "UnknownError":
      case "InvalidResponseError":
        return new Nip47InternalError(
          `Unknown error occurred. Please try again later or contact support if it persists. ${message ? `Details: ${message}` : ""}`,
        )

      default:
        return new Nip47OtherError(
          `Unexpected error occurred. Please try again later or contact support if it persists. Code: ${err.name || "unknown"}`,
        )
    }
  }

  const handle = async (
    request: { method: Nip47Method; params?: unknown },
    connection: NwcConnection,
  ): Promise<Nip47Result> => {
    if (!hasPermission(request.method, connection)) {
      return new Nip47RestrictedError(
        `Connection does not have permission for requested operation: ${request.method}`,
      )
    }
    switch (request.method) {
      case "get_info":
        return getInfo()
      case "get_balance":
        return getBalance(connection)
      case "make_invoice":
        return makeInvoice(request.params as Nip47MakeInvoiceRequest, connection)
      case "pay_invoice":
        return payInvoice(request.params as Nip47PayInvoiceRequest, connection)
      case "lookup_invoice":
        return lookupInvoice(request.params as Nip47LookupInvoiceRequest, connection)
      case "list_transactions":
        return listTransactions(
          request.params as Nip47ListTransactionsRequest,
          connection,
        )
      default:
        return new Nip47NotImplementedError(`Unsupported method: ${request.method}`)
    }
  }

  return { handle }
}

export default NwcEventHandler
