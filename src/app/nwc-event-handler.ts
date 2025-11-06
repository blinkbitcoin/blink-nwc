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
  Nip47Transaction,
} from "@/domain/index.types"
import { getServerKeypair, hasPermission, NwcConnection } from "@/domain/nwc-connection"
import {
  Nip47Error,
  Nip47InternalError,
  Nip47NotImplementedError,
  Nip47OtherError,
  Nip47RestrictedError,
} from "@/domain/nwc-errors"
import { NETWORK, SUPPORTED_NWC_METHODS } from "@/config"

const NwcEventHandler = () => {
  const getInfo = async (): Promise<Nip47Error | Nip47GetInfoResult> => {
    const serverPubkey = getServerKeypair().pubkey

    // without onchain data we can still return some info. without nostr pubkey nwc wouldn't work anyway
    // const lndConnect = getActiveOnchainLnd()
    // if (lndConnect instanceof Error) {
    return {
      alias: "Blink Wallet",
      color: "F2A900",
      pubkey: serverPubkey,
      methods: SUPPORTED_NWC_METHODS,
      // notifications  //not implemented yet,
      network: NETWORK,
      block_height: 0,
      block_hash: "unknown",
    }
    // }
    // const info = await getWalletInfo({ lnd: lndConnect.lnd })
    // return {
    //     alias: "Blink Wallet",
    //     color: "F2A900",
    //     pubkey: serverPubkey,
    //     methods: SUPPORTED_NWC_METHODS,
    //     notifications,
    // network: NETWORK,
    // block_height: info.current_block_height,
    // block_hash: info.current_block_hash,
    // }
  }

  const getBalance = async (
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47GetBalanceResult> => {
    throw new Error("Not imlemented")
  }

  const makeInvoice = async (
    req: Nip47MakeInvoiceRequest,
    connection: NwcConnection,
  ): Promise<Nip47Error | Nip47MakeInvoiceResult> => {
    throw new Error("Not imlemented")
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

  // there will be some problems with intraledger txs - there's no way to make them nip47Compliant.
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
