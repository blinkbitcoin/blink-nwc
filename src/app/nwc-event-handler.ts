import {
  InvoiceBolt11,
  Memo,
  MilliSatoshis,
  Nip47GetBalanceResult,
  Nip47GetInfoResult,
  Nip47ListTransactionsResult,
  Nip47LookupInvoiceResult,
  Nip47MakeInvoiceResult,
  Nip47Method,
  Nip47PayInvoiceResult,
  Nip47Result,
  NwcConnectionAlias,
  Seconds,
  UnixTimestamp,
} from "@/domain/index.types"
import { CoreServiceTx, DescriptionHash } from "@/domain/core/index.types"
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
import {
  ensureUnixSeconds,
  toCursor,
  toMilliSatoshis,
  toMinutes,
  toSatoshis,
  toUnixSeconds,
} from "@/domain/units"
import {
  checkedToNip47ListTransactionsRequest,
  checkedToNip47LookupInvoiceRequest,
  checkedToNip47MakeInvoiceRequest,
  checkedToNip47PayInvoiceRequest,
} from "@/domain/validation"

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
      alias: "Blink Wallet" as NwcConnectionAlias,
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
    req: unknown,
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47MakeInvoiceResult> => {
    const { apiKey, walletId } = connection

    const request = checkedToNip47MakeInvoiceRequest(req)
    if (request instanceof Error) {
      return new Nip47OtherError(request.message)
    }
    const { amount, description, description_hash, expiry } = request

    const satoshis = toSatoshis(amount)
    const expiry_minutes = toMinutes(expiry)

    let invoice
    if (amount == 0) {
      invoice = await BlinkCoreService().createInvoiceAmountless(
        apiKey,
        walletId,
        description as Memo | undefined,
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

    const expiresIn = (
      typeof expiry_minutes === "number"
        ? Math.floor(expiry_minutes * 60)
        : DEFAULT_INVOICE_EXPIRY_SECONDS
    ) as Seconds

    const expires_at = (createdAt + expiresIn) as UnixTimestamp

    return {
      type: "incoming",
      amount: toMilliSatoshis(satoshis),
      created_at: createdAt,
      description: description,
      description_hash,
      expires_at,
      fees_paid: 0 as MilliSatoshis,
      invoice: invoice.paymentRequest,
      payment_hash: invoice.paymentHash,
    }
  }

  const payInvoice = async (
    req: unknown,
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47PayInvoiceResult> => {
    const request = checkedToNip47PayInvoiceRequest(req)
    if (request instanceof Error) {
      return new Nip47OtherError(request.message)
    }

    const res = await BlinkCoreService().payInvoice(
      connection.apiKey,
      connection.walletId,
      request.invoice as InvoiceBolt11,
    )
    if (res instanceof Error) {
      return parseErrorForNip47Response(res)
    }
    return { preimage: res.preimage, fees_paid: toMilliSatoshis(res.feesPaid) }
  }

  const lookupInvoice = async (
    req: unknown,
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47LookupInvoiceResult> => {
    const { apiKey, walletId } = connection
    const request = checkedToNip47LookupInvoiceRequest(req)
    if (request instanceof Error) {
      return new Nip47OtherError(request.message)
    }
    const { payment_hash, invoice } = request

    const res = await BlinkCoreService().lookupInvoice(
      apiKey,
      walletId,
      payment_hash,
      invoice,
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
    req: unknown,
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47ListTransactionsResult> => {
    const { apiKey, walletId } = connection
    const request = checkedToNip47ListTransactionsRequest(req)
    if (request instanceof Error) {
      return new Nip47OtherError(request.message)
    }

    const { unpaid, type } = request
    const limit = request.limit || DEFAULT_BATCH_SIZE
    const offset = request.offset || 0
    const from = request.from || (0 as UnixTimestamp)
    const until = request.until || (Math.round(Date.now() / 1000) as UnixTimestamp)

    const transactions = await BlinkCoreService().fetchTransactionsInRange(
      apiKey,
      walletId,
      from,
      toCursor(until)!,
      offset,
      limit,
      type,
    )
    if (transactions instanceof Error) {
      return parseErrorForNip47Response(transactions)
    }

    let result: CoreServiceTx[]

    if (unpaid) {
      const invoices = await BlinkCoreService().fetchInvoicesInRange(
        apiKey,
        walletId,
        from,
        toCursor(until)!,
        offset,
        limit,
        type,
      )
      if (invoices instanceof Error) {
        return parseErrorForNip47Response(invoices)
      }
      result = mergeTxs(invoices, transactions)
    } else {
      result = transactions
    }

    const convertedTransactions = result.map((tx) => ({
      ...tx,
      amount: toMilliSatoshis(tx.amount),
      fees_paid: toMilliSatoshis(tx.fees_paid),
    }))

    return { transactions: convertedTransactions }
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
        return makeInvoice(request.params, connection)
      case "pay_invoice":
        return payInvoice(request.params, connection)
      case "lookup_invoice":
        return lookupInvoice(request.params, connection)
      case "list_transactions":
        return listTransactions(request.params, connection)
      default:
        return new Nip47NotImplementedError(`Unsupported method: ${request.method}`)
    }
  }

  return { handle }
}

export default NwcEventHandler
