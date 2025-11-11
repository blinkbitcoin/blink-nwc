import {
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
import { getServerKeypair, hasPermission, NwcConnection } from "@/domain/nwc-connection"
import {
  Nip47Error,
  Nip47InternalError,
  Nip47NotImplementedError,
  Nip47OtherError,
  Nip47RestrictedError,
} from "@/domain/nwc-errors"
import { BlinkCoreService } from "@/services"
import { NETWORK, SUPPORTED_NWC_METHODS } from "@/config"
import { DescriptionHash, Satoshis } from "@/domain/core/index.types"
import { Minutes } from "@/domain/units"

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
      block_height: info.block_height,
      block_hash: info.block_hash,
    }
  }

  const getBalance = async (
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47GetBalanceResult> => {
    const { apiKey, walletId } = connection
    const satoshis = await BlinkCoreService().getBalance(apiKey, walletId)
    if (satoshis instanceof Error) {
      throw new Error() //todo handle
    }
    return { balance: satoshis * 1000 }
  }

  const makeInvoice = async (
    req: Nip47MakeInvoiceRequest,
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47MakeInvoiceResult> => {
    const { apiKey, walletId } = connection
    const { amount, description_hash, expiry } = req
    const satoshis = Math.round(amount / 1000) as Satoshis
    const expiry_minutes = expiry ? ((expiry / 60) as Minutes) : undefined
    const res = await BlinkCoreService().createInvoice(
      apiKey,
      walletId,
      satoshis,
      description_hash as DescriptionHash,
      expiry_minutes,
    )
    if (res instanceof Error) {
      return new Nip47InternalError("todo") //todo handle
    }
    if (!res) {
      // it won't be here since BlinkCore service will be better typed
      return new Nip47OtherError("")
    }
    return {
      type: "incoming",
      amount: satoshis * 1000,
      created_at: res.createdAt,
      description_hash: description_hash,
      expires_at: res.createdAt / 1000 + (expiry_minutes ? expiry_minutes * 60 : 10 * 60),
      fees_paid: 0,
      invoice: res.paymentRequest,
      payment_hash: res.paymentHash,
      preimage: res.paymentSecret,
    }
  }

  const payInvoice = async (
    req: Nip47PayInvoiceRequest,
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47PayInvoiceResult> => {
    throw new Error("Not imlemented")
  }

  const lookupInvoice = async (
    req: Nip47LookupInvoiceRequest,
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47LookupInvoiceResult> => {
    throw new Error("Not imlemented")
  }

  const listInvoices = async (
    req: Nip47ListTransactionsRequest,
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47ListTransactionsResult> => {
    throw new Error("Not imlemented")
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
