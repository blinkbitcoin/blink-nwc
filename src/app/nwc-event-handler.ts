import { decode as decodeBolt11 } from "bolt11"

import {
  SUPPORTED_NWC_METHODS,
  SUPPORTED_NWC_NOTIFICATIONS,
  WALLET_ALIAS,
  WALLET_COLOR,
} from "@/config"
import { parseErrorForNip47Response } from "@/app/nwc-event-handler.error"
import { getServerKeypair } from "@/domain/connection"
import { NwcConnection, hasPermission } from "@/domain/connection"
import { ErrorLevel } from "@/domain/errors"
import {
  CoreServiceTx,
  MilliSatoshis,
  Nip47MethodType,
  Nip47Result,
  NwcServerAlias,
  Seconds,
  UnixTimestamp,
} from "@/domain/index.types"
import {
  Nip47Error,
  Nip47InternalError,
  Nip47NotFoundError,
  Nip47NotImplementedError,
  Nip47OtherError,
  Nip47RestrictedError,
} from "@/domain/nostr"
import { BlinkCoreService } from "@/services"
import { baseLogger } from "@/services/logger"
import {
  addAttributesToCurrentSpan,
  recordExceptionInCurrentSpan,
  wrapAsyncToRunInSpan,
} from "@/services/tracing"
import { mergeTxs, toNwcTx } from "@/domain/utils"
import {
  ensureUnixSeconds,
  toCursor,
  toMilliSatoshis,
  toMinutes,
  toSatoshis,
} from "@/domain/units"
import {
  checkedToNip47ListTransactionsRequest,
  checkedToNip47LookupInvoiceRequest,
  checkedToNip47MakeInvoiceRequest,
  checkedToNip47PayInvoiceRequest,
} from "@/domain/validation"

const DEFAULT_INVOICE_EXPIRY_SECONDS = 24 * 60 * 60
const DEFAULT_BATCH_SIZE = 10
const MAX_BATCH_SIZE = 100

const NwcEventHandler = () => {
  const logger = baseLogger.child({ module: "nwc-event-handler" })
  const blinkCoreService = BlinkCoreService()

  const enabledNotifications = (connection: NwcConnection) => {
    return connection.notificationsEnabled ? SUPPORTED_NWC_NOTIFICATIONS : []
  }

  const allowedMethods = (connection: NwcConnection): Nip47MethodType[] => {
    return connection.permissions.filter((method): method is Nip47MethodType =>
      SUPPORTED_NWC_METHODS.includes(method as Nip47MethodType),
    )
  }

  const serializeParamsForLog = (params: unknown): unknown => {
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      return params
    }

    const cloned = { ...(params as Record<string, unknown>) }
    if ("invoice" in cloned) {
      cloned.invoice = "[redacted]"
    }

    return cloned
  }

  const handle = async (
    request: { method: Nip47MethodType; params?: unknown },
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
      { params: serializeParamsForLog(request.params) },
      "received NWC request",
    )

    addAttributesToCurrentSpan({
      "nwc.method": request.method,
      "nwc.connectionId": connection.id,
      "nwc.userId": connection.userId,
      "nwc.walletId": connection.walletId,
      "nwc.appPubkey": connection.appPubkey,
    })

    let response: Nip47Result

    if (!SUPPORTED_NWC_METHODS.includes(request.method)) {
      response = new Nip47NotImplementedError(`Unsupported method: ${request.method}`)
    } else if (!hasPermission(request.method, connection)) {
      const error = new Nip47RestrictedError(
        `Connection does not have permission for requested operation: ${request.method}`,
      )
      recordExceptionInCurrentSpan({ error, level: ErrorLevel.Warn })
      response = error
    } else if (request.method === "get_info") {
      const serverPubkey = getServerKeypair().pubkey
      const username = await blinkCoreService.getUsername(connection.apiKey)
      const info = await blinkCoreService.getNodeInfo()

      if (info instanceof Error) {
        response = new Nip47InternalError(info.message)
      } else {
        const alias =
          typeof username === "string" && username.length > 0
            ? (username as NwcServerAlias)
            : WALLET_ALIAS

        response = {
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
    } else if (request.method === "get_balance") {
      addAttributesToCurrentSpan({
        walletId: connection.walletId,
        userId: connection.userId,
        connectionId: connection.id,
      })

      const result = await blinkCoreService.getBalance(
        connection.apiKey,
        connection.walletId,
      )
      response =
        result instanceof Error
          ? parseErrorForNip47Response(result)
          : { balance: toMilliSatoshis(result.balance) }
    } else if (request.method === "make_invoice") {
      const parsed = checkedToNip47MakeInvoiceRequest(request.params)
      if (parsed instanceof Error) {
        recordExceptionInCurrentSpan({ error: parsed, level: ErrorLevel.Warn })
        response = new Nip47OtherError(parsed.message)
      } else {
        const { amount, description, description_hash, expiry } = parsed
        addAttributesToCurrentSpan({
          walletId: connection.walletId,
          userId: connection.userId,
          connectionId: connection.id,
          "invoice.amount": amount,
          "invoice.hasDescription": !!description,
          "invoice.hasDescriptionHash": !!description_hash,
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
          response = parseErrorForNip47Response(invoice)
        } else {
          const createdAt = ensureUnixSeconds(invoice.createdAt)
          const expiresIn = (
            typeof expiryMinutes === "number"
              ? Math.floor(expiryMinutes * 60)
              : DEFAULT_INVOICE_EXPIRY_SECONDS
          ) as Seconds

          response = {
            type: "incoming",
            amount: toMilliSatoshis(satoshis),
            state: "pending",
            created_at: createdAt,
            description,
            description_hash,
            expires_at: (createdAt + expiresIn) as UnixTimestamp,
            fees_paid: 0 as MilliSatoshis,
            invoice: invoice.paymentRequest,
            payment_hash: invoice.paymentHash,
          }
        }
      }
    } else if (request.method === "pay_invoice") {
      const parsed = checkedToNip47PayInvoiceRequest(request.params)
      if (parsed instanceof Error) {
        recordExceptionInCurrentSpan({ error: parsed, level: ErrorLevel.Warn })
        response = new Nip47OtherError(parsed.message)
      } else {
        addAttributesToCurrentSpan({
          walletId: connection.walletId,
          userId: connection.userId,
          connectionId: connection.id,
          "payment.invoice_present": true,
        })

        try {
          const decodedInvoice = decodeBolt11(parsed.invoice)
          const decodedInvoiceAmountMsats =
            typeof decodedInvoice.millisatoshis === "string"
              ? Number(decodedInvoice.millisatoshis)
              : undefined

          addAttributesToCurrentSpan({
            "payment.amountOverrideMsats": parsed.amount,
            "payment.amountMsats": decodedInvoice.millisatoshis || undefined,
            "payment.amountSats": decodedInvoice.satoshis || undefined,
          })

          if (decodedInvoiceAmountMsats === undefined && parsed.amount === undefined) {
            response = new Nip47OtherError("Amount is required for amountless invoices")
          } else {
            const result = await blinkCoreService.payInvoice(
              connection.apiKey,
              connection.walletId,
              parsed.invoice,
              parsed.amount !== undefined ? toSatoshis(parsed.amount) : undefined,
            )
            response =
              result instanceof Error
                ? parseErrorForNip47Response(result)
                : {
                    preimage: result.preimage,
                    fees_paid: toMilliSatoshis(result.feesPaid),
                  }
          }
        } catch (error) {
          recordExceptionInCurrentSpan({
            error: error instanceof Error ? error : new Error("Invoice decode failed"),
            level: ErrorLevel.Warn,
          })
          response =
            error instanceof Nip47Error
              ? error
              : new Nip47OtherError("Invalid invoice")
        }
      }
    } else if (request.method === "lookup_invoice") {
      const parsed = checkedToNip47LookupInvoiceRequest(request.params)
      if (parsed instanceof Error) {
        response = new Nip47OtherError(parsed.message)
      } else {
        const result = await blinkCoreService.lookupInvoice(
          connection.apiKey,
          connection.walletId,
          parsed.payment_hash,
          parsed.invoice,
        )

        response =
          result instanceof Error
            ? result.name === "InvalidResponseError" ||
              result.name === "InvoiceNotFoundError"
              ? new Nip47NotFoundError("Invoice not found")
              : parseErrorForNip47Response(result)
            : {
                ...toNwcTx(result),
                expires_at: result.expiresAt,
                settled_at: result.settledAt,
              }
      }
    } else if (request.method === "list_transactions") {
      const parsed = checkedToNip47ListTransactionsRequest(request.params)
      if (parsed instanceof Error) {
        response = new Nip47OtherError(parsed.message)
      } else {
        const { unpaid, type } = parsed
        const limit = Math.min(
          Math.max(parsed.limit ?? DEFAULT_BATCH_SIZE, 1),
          MAX_BATCH_SIZE,
        )
        const offset = parsed.offset || 0
        const mergedLimit = offset + limit
        const from = parsed.from || (0 as UnixTimestamp)
        const until = parsed.until || (Math.round(Date.now() / 1000) as UnixTimestamp)

        const transactions = await blinkCoreService.fetchTransactionsInRange(
          connection.apiKey,
          connection.walletId,
          from,
          toCursor(until)!,
          unpaid ? 0 : offset,
          unpaid ? mergedLimit : limit,
          type,
        )
        if (transactions instanceof Error) {
          response = parseErrorForNip47Response(transactions)
        } else {
          let result: CoreServiceTx[]

          if (unpaid) {
            const invoices = await blinkCoreService.fetchInvoicesInRange(
              connection.apiKey,
              connection.walletId,
              from,
              toCursor(until)!,
              0,
              mergedLimit,
              type,
            )
            if (invoices instanceof Error) {
              response = parseErrorForNip47Response(invoices)
            } else {
              result = mergeTxs(invoices, transactions).slice(offset, mergedLimit)
              response = { transactions: result.map((tx) => toNwcTx(tx)) }
            }
          } else {
            result = transactions
            response = { transactions: result.map((tx) => toNwcTx(tx)) }
          }
        }
      }
    } else {
      response = new Nip47NotImplementedError(
        `Method not implemented yet: ${request.method}`,
      )
    }

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
import { decode as decodeBolt11 } from "bolt11"
