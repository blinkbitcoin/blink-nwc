import {
  InvoiceBolt11,
  Memo,
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
} from "@/domain/index.types"
import { getServerKeypair, hasPermission, NwcConnection } from "@/domain/connection"
import {
  Nip47Error,
  Nip47InternalError,
  Nip47NotFoundError,
  Nip47NotImplementedError,
  Nip47OtherError,
  Nip47RestrictedError,
} from "@/domain/nip47-errors"
import { BlinkCoreService } from "@/services"
import { NETWORK, SUPPORTED_NWC_METHODS } from "@/config"
import { DescriptionHash, Satoshis, PaymentHash } from "@/domain/core/index.types"
import { Minutes } from "@/domain/units"
import { BlinkServiceError } from "@/services/core/errors"

const NwcEventHandler = () => {
  /*
  Key differences:
  NWC uses millisatoshis, blink uses satoshis,
  NWC uses seconds for expiry, blink uses minutes,
  */
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
      network: NETWORK,
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
    return { balance: res.balance * 1000 }
  }

  const makeInvoice = async (
    req: Nip47MakeInvoiceRequest,
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47MakeInvoiceResult> => {
    const { apiKey, walletId } = connection
    const { amount, description, description_hash, expiry } = req
    const satoshis = Math.round(amount / 1000) as Satoshis
    const expiry_minutes = expiry ? ((expiry / 60) as Minutes) : undefined

    //todo if amount == 0, create amountless invoice
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
    return {
      type: "incoming",
      amount: satoshis * 1000,
      created_at: invoice.createdAt,
      description_hash: description_hash,
      expires_at:
        invoice.createdAt / 1000 + (expiry_minutes ? expiry_minutes * 60 : 24 * 60),
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
    return { preimage: res.preimage, fees_paid: res.feesPaid }
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
      // If invoice not found, return appropriate NIP-47 error
      if (res.name === "InvalidResponseError") {
        return new Nip47OtherError("Invoice not found")
      }
      return parseErrorForNip47Response(res)
    }

    // Convert to NIP-47 format
    // Note: invoiceByPaymentHash returns full invoice data, but invoiceStatusByPaymentHash only returns status
    // We prioritize full invoice data when available
    const paymentStatus = res.paymentStatus.toLowerCase()
    const isPaid = paymentStatus === "paid" || paymentStatus === "settled"

    return {
      payment_hash: res.paymentHash,
      invoice: res.paymentRequest,
      // payment_status: paymentStatus, //todo
      created_at: res.createdAt || Math.floor(Date.now() / 1000),
      settled_at: res.settledAt || (isPaid ? res.createdAt : undefined),
      expires_at: undefined, //todo
      amount: res.satoshis || 0,
      fees_paid: res.feesPaid || 0,
      description: undefined, // todo
      description_hash: undefined, // todo
      preimage: undefined, // todo
      type: "incoming", // todo
    }
  }

  const listInvoices = async (
    req: Nip47ListTransactionsRequest,
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47ListTransactionsResult> => {
    const { apiKey, walletId } = connection
    const { from, until, limit, offset, unpaid, type } = req

    const res = await BlinkCoreService().listTransactions(apiKey, walletId, {
      from,
      until,
      limit,
      offset,
      unpaid,
      type,
    })

    if (res instanceof Error) {
      return parseErrorForNip47Response(res)
    }

    return {
      transactions: res.map((tx) => ({
        type: tx.type,
        invoice: tx.invoice,
        description: tx.description,
        description_hash: tx.description_hash,
        preimage: tx.preimage,
        payment_hash: tx.payment_hash,
        amount: tx.amount,
        fees_paid: tx.fees_paid,
        created_at: tx.created_at,
        settled_at: tx.settled_at,
        expires_at: tx.expires_at,
      })),
    }
  }

  const parseErrorForNip47Response = (err: BlinkServiceError): Nip47Error => {
    switch (err.name) {
      case "InvoiceNotFoundError":
        return new Nip47NotFoundError(err.message)
      default:
        return new Nip47OtherError(
          `Unkown error occured. Please try again later or contact support if it persists. Code: ${err.message ?? ""}`,
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
        return listInvoices(request.params as Nip47ListTransactionsRequest, connection)
      default:
        return new Nip47NotImplementedError(`Unsupported method: ${request.method}`)
    }
  }
  return { handle }
}

export default NwcEventHandler
