import { SUPPORTED_NWC_METHODS, WALLET_ALIAS, WALLET_COLOR } from "@/config"
import {
  allowedMethods,
  enabledNotifications,
  ensureMethodPermission,
} from "@/app/permission-checker"
import { parseErrorForNip47Response } from "@/app/nwc-event-handler.error"
import { getServerKeypair, isConnectionExpired, NwcConnection } from "@/domain/connection"
import { IBlinkCoreService } from "@/domain/core"
import { ErrorLevel } from "@/domain/errors"
import {
  MilliSatoshis,
  Nip47MethodType,
  Nip47Result,
  NwcServerAlias,
  UnixTimestamp,
} from "@/domain/index.types"
import {
  Nip47Error,
  Nip47InternalError,
  Nip47NotFoundError,
  Nip47NotImplementedError,
  Nip47OtherError,
  Nip47UnauthorizedError,
} from "@/domain/nostr"
import { PaymentDirection as PD } from "@/domain/nostr/payment-direction"
import { BlinkCoreService } from "@/services"
import { InvalidResponseError, InvoiceNotFoundError } from "@/services/core/errors"
import { baseLogger } from "@/services/logger"
import {
  addAttributesToCurrentSpan,
  recordExceptionInCurrentSpan,
  wrapAsyncToRunInSpan,
} from "@/services/tracing"
import {
  ensureUnixSeconds,
  toCursor,
  toMilliSatoshis,
  toMinutes,
  toSatoshis,
} from "@/domain/units"
import { toNwcTx } from "@/domain/utils"
import {
  checkedToDecodedBolt11Invoice,
  checkedToNip47ListTransactionsRequest,
  checkedToNip47LookupInvoiceRequest,
  checkedToNip47MakeInvoiceRequest,
  checkedToNip47PayInvoiceRequest,
} from "@/domain/validation"

const DEFAULT_INVOICE_EXPIRY_SECONDS = 24 * 60 * 60
const DEFAULT_BATCH_SIZE = 10
const MAX_BATCH_SIZE = 100

type NwcRequest = { method: Nip47MethodType; params?: unknown }
type MethodHandler = (
  request: NwcRequest,
  connection: NwcConnection,
) => Promise<Nip47Result>
type NwcEventHandlerDeps = {
  blinkCoreService?: IBlinkCoreService
}

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined
  }

  return value as Record<string, unknown>
}

const NwcEventHandler = ({
  blinkCoreService = BlinkCoreService(),
}: NwcEventHandlerDeps = {}) => {
  const logger = baseLogger.child({ module: "nwc-event-handler" })

  const serializeParamsForLog = (
    method: Nip47MethodType,
    params: unknown,
  ): Record<string, unknown> | unknown => {
    const input = asRecord(params)
    if (!input) {
      return params
    }

    switch (method) {
      case "get_info":
      case "get_balance":
        return {}
      case "make_invoice":
        return {
          amount: input.amount,
          expiry: input.expiry,
          has_description: input.description !== undefined,
          has_description_hash: input.description_hash !== undefined,
        }
      case "pay_invoice":
        return {
          amount: input.amount,
          has_invoice: input.invoice !== undefined,
        }
      case "lookup_invoice":
        return {
          has_invoice: input.invoice !== undefined,
          has_payment_hash: input.payment_hash !== undefined,
        }
      case "list_transactions":
        return {
          from: input.from,
          until: input.until,
          limit: input.limit,
          offset: input.offset,
          unpaid: input.unpaid,
          type: input.type,
        }
    }
  }

  const getInfo: MethodHandler = async (_request, connection) => {
    const serverPubkey = getServerKeypair().pubkey
    const username = await blinkCoreService.getUsername(connection.apiKey)
    const info = await blinkCoreService.getNodeInfo()

    if (info instanceof Error) {
      return new Nip47InternalError(info.message)
    }

    const alias =
      typeof username === "string" && username.length > 0
        ? (username as NwcServerAlias)
        : WALLET_ALIAS

    return {
      alias,
      color: WALLET_COLOR,
      pubkey: serverPubkey,
      methods: allowedMethods(connection),
      notifications: enabledNotifications(connection),
      network: info.network,
      block_height: info.blockHeight,
      block_hash: info.blockHash,
    }
  }

  const getBalance: MethodHandler = async (_request, connection) => {
    const result = await blinkCoreService.getBalance(
      connection.apiKey,
      connection.walletId,
    )
    return result instanceof Error
      ? parseErrorForNip47Response(result)
      : { balance: toMilliSatoshis(result.balance) }
  }

  const makeInvoice: MethodHandler = async (request, connection) => {
    const parsed = checkedToNip47MakeInvoiceRequest(request.params)
    if (parsed instanceof Error) {
      recordExceptionInCurrentSpan({ error: parsed, level: ErrorLevel.Warn })
      return new Nip47OtherError(parsed.message)
    }

    const { amount, description, description_hash, expiry } = parsed
    addAttributesToCurrentSpan({
      "nwc.invoice.amountMsats": amount,
      "nwc.invoice.hasDescription": !!description,
      "nwc.invoice.hasDescriptionHash": !!description_hash,
    })

    const satoshis = toSatoshis(amount)
    const expiryMinutes = toMinutes(expiry)
    const invoice =
      amount === 0
        ? await blinkCoreService.createInvoiceAmountless(
            connection.apiKey,
            connection.walletId,
            description,
            expiryMinutes,
          )
        : await blinkCoreService.createInvoice(
            connection.apiKey,
            connection.walletId,
            satoshis,
            description,
            description_hash,
            expiryMinutes,
          )

    if (invoice instanceof Error) {
      return parseErrorForNip47Response(invoice)
    }

    const createdAt = ensureUnixSeconds(invoice.createdAt)

    return {
      type: "incoming",
      amount: toMilliSatoshis(invoice.satoshis),
      state: "pending",
      created_at: createdAt,
      description,
      description_hash,
      expires_at:
        invoice.expiresAt ??
        ((createdAt + DEFAULT_INVOICE_EXPIRY_SECONDS) as UnixTimestamp),
      fees_paid: 0 as MilliSatoshis,
      invoice: invoice.paymentRequest,
      payment_hash: invoice.paymentHash,
    }
  }

  const payInvoice: MethodHandler = async (request, connection) => {
    const parsed = checkedToNip47PayInvoiceRequest(request.params)
    if (parsed instanceof Error) {
      recordExceptionInCurrentSpan({ error: parsed, level: ErrorLevel.Warn })
      return new Nip47OtherError(parsed.message)
    }

    addAttributesToCurrentSpan({
      "nwc.payment.hasInvoice": true,
    })

    const decodedInvoice = checkedToDecodedBolt11Invoice(parsed.invoice)
    if (decodedInvoice instanceof Error) {
      recordExceptionInCurrentSpan({
        error: decodedInvoice,
        level: ErrorLevel.Warn,
      })
      return new Nip47OtherError(decodedInvoice.message)
    }

    const decodedInvoiceAmountMsats =
      typeof decodedInvoice.millisatoshis === "string"
        ? Number(decodedInvoice.millisatoshis)
        : undefined

    addAttributesToCurrentSpan({
      "nwc.payment.amountOverrideMsats": parsed.amount,
      "nwc.payment.amountMsats": decodedInvoice.millisatoshis ?? undefined,
      "nwc.payment.amountSats": decodedInvoice.satoshis ?? undefined,
    })

    if (decodedInvoiceAmountMsats === undefined && parsed.amount === undefined) {
      return new Nip47OtherError("Amount is required for amountless invoices")
    }

    const result = await blinkCoreService.payInvoice(
      connection.apiKey,
      connection.walletId,
      parsed.invoice,
      parsed.amount !== undefined ? toSatoshis(parsed.amount) : undefined,
    )

    return result instanceof Error
      ? parseErrorForNip47Response(result)
      : {
          preimage: result.preimage,
          fees_paid: toMilliSatoshis(result.feesPaid),
        }
  }

  const lookupInvoice: MethodHandler = async (request, connection) => {
    const parsed = checkedToNip47LookupInvoiceRequest(request.params)
    if (parsed instanceof Error) {
      return new Nip47OtherError(parsed.message)
    }

    const result = await blinkCoreService.lookupInvoice(
      connection.apiKey,
      connection.walletId,
      parsed.payment_hash,
      parsed.invoice,
    )

    return result instanceof Error
      ? result instanceof InvalidResponseError || result instanceof InvoiceNotFoundError
        ? new Nip47NotFoundError("Invoice not found")
        : parseErrorForNip47Response(result)
      : {
          ...toNwcTx(result),
          expires_at: result.expiresAt,
          settled_at: result.settledAt,
        }
  }

  const listTransactions: MethodHandler = async (request, connection) => {
    const parsed = checkedToNip47ListTransactionsRequest(request.params)
    if (parsed instanceof Error) {
      return new Nip47OtherError(parsed.message)
    }

    const { unpaid, type } = parsed
    const limit = Math.min(
      Math.max(parsed.limit ?? DEFAULT_BATCH_SIZE, 1),
      MAX_BATCH_SIZE,
    )
    const offset = parsed.offset ?? 0
    const from = parsed.from ?? ensureUnixSeconds(0)
    const until = parsed.until ?? ensureUnixSeconds(Date.now() / 1000)
    const untilCursor = toCursor(until)

    if (!untilCursor) {
      return new Nip47OtherError("Invalid until cursor")
    }

    const includeUnpaidInvoices = unpaid === true && type !== PD.Outgoing
    if (!includeUnpaidInvoices) {
      const transactions = await blinkCoreService.fetchTransactionsInRange(
        connection.apiKey,
        connection.walletId,
        from,
        untilCursor,
        offset,
        limit,
        type,
      )

      return transactions instanceof Error
        ? parseErrorForNip47Response(transactions)
        : { transactions: transactions.map((tx) => toNwcTx(tx)) }
    }

    const transactions = await blinkCoreService.fetchMergedTransactionsInRange(
      connection.apiKey,
      connection.walletId,
      from,
      untilCursor,
      offset,
      limit,
      type,
    )

    return transactions instanceof Error
      ? parseErrorForNip47Response(transactions)
      : { transactions: transactions.map((tx) => toNwcTx(tx)) }
  }

  const handlers: Record<Nip47MethodType, MethodHandler> = {
    get_info: getInfo,
    get_balance: getBalance,
    make_invoice: makeInvoice,
    pay_invoice: payInvoice,
    lookup_invoice: lookupInvoice,
    list_transactions: listTransactions,
  }

  const handle = async (
    request: NwcRequest,
    connection: NwcConnection,
  ): Promise<Nip47Result> => {
    const requestLogger = logger.child({
      connectionId: connection.id,
      userId: connection.userId,
      walletId: connection.walletId,
      appPubkey: connection.appPubkey,
      method: request.method,
    })

    requestLogger.info(
      { params: serializeParamsForLog(request.method, request.params) },
      "received NWC request",
    )

    addAttributesToCurrentSpan({
      "nwc.method": request.method,
      "nwc.connectionId": connection.id,
      "nwc.userId": connection.userId,
      "nwc.walletId": connection.walletId,
      "nwc.appPubkey": connection.appPubkey,
    })

    if (!SUPPORTED_NWC_METHODS.includes(request.method)) {
      const response = new Nip47NotImplementedError(
        `Unsupported method: ${request.method}`,
      )
      requestLogger.info(
        {
          response: {
            error: {
              code: response.code,
              message: response.message,
            },
          },
        },
        "completed NWC request",
      )
      return response
    }

    if (isConnectionExpired(connection)) {
      const error = new Nip47UnauthorizedError("Connection has expired")
      recordExceptionInCurrentSpan({ error, level: ErrorLevel.Warn })
      requestLogger.info(
        {
          response: {
            error: {
              code: error.code,
              message: error.message,
            },
          },
        },
        "completed NWC request",
      )
      return error
    }

    const permissionError = ensureMethodPermission(connection, request.method)
    if (permissionError) {
      requestLogger.warn({ requestedMethod: request.method }, permissionError.message)
      recordExceptionInCurrentSpan({ error: permissionError, level: ErrorLevel.Warn })
      requestLogger.info(
        {
          response: {
            error: {
              code: permissionError.code,
              message: permissionError.message,
            },
          },
        },
        "completed NWC request",
      )
      return permissionError
    }

    const response = await handlers[request.method](request, connection)

    requestLogger.info(
      response instanceof Nip47Error
        ? {
            response: {
              error: {
                code: response.code,
                message: response.message,
              },
            },
          }
        : { response: { result_type: request.method } },
      "completed NWC request",
    )

    return response
  }

  return {
    handle: wrapAsyncToRunInSpan({
      namespace: "app.nwc",
      fn: handle,
    }),
  }
}

export default NwcEventHandler
