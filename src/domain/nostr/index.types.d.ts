import {
  BlockHash,
  BlockHeight,
  Description,
  DescriptionHash,
  InvoiceBolt11,
  MilliSatoshis,
  Network,
  NwcServerAlias,
  NwcServerColor,
  PaymentHash,
  PaymentStatus,
  Preimage,
  Seconds,
  ServerNostrPubkey,
  UnixTimestamp,
} from "@/domain/index.types"
import { Nip47Error } from "@/domain/nostr/errors"

export type PaymentDirection =
  (typeof import("./payment-direction").PaymentDirection)[keyof typeof import("./payment-direction").PaymentDirection]
export type Nip47MethodType =
  (typeof import("./nip47-method").Nip47Method)[keyof typeof import("./nip47-method").Nip47Method]

export type Nip47MakeInvoiceRequest = {
  amount: MilliSatoshis
  description?: Description
  description_hash?: DescriptionHash
  expiry?: Seconds
}

export type Nip47PayInvoiceRequest = {
  invoice: InvoiceBolt11
}

export type Nip47LookupInvoiceRequest = {
  payment_hash?: PaymentHash
  invoice?: InvoiceBolt11
}

export type Nip47ListTransactionsRequest = {
  from?: UnixTimestamp // starting timestamp in seconds since epoch (inclusive), optional
  until?: UnixTimestamp // ending timestamp in seconds since epoch (inclusive), optional
  limit?: number // maximum number of invoices to return, optional
  offset?: number // offset of the first invoice to return, optional
  unpaid?: true // include unpaid invoices, optional, default false
  type: PaymentDirection // "incoming" for invoices, "outgoing" for payments, undefined for both
}

export type Nip47Transaction = {
  type: PaymentDirection
  invoice?: InvoiceBolt11
  description?: Description
  description_hash?: DescriptionHash
  preimage?: Preimage
  payment_hash: PaymentHash
  amount: MilliSatoshis
  fees_paid: MilliSatoshis
  created_at: UnixTimestamp
  metadata?: object
}

export type Nip47GetInfoResult = {
  alias: NwcServerAlias
  color: NwcServerColor
  pubkey: ServerNostrPubkey
  network: Network
  block_height: BlockHeight
  block_hash: BlockHash
  methods: Nip47MethodType[]
}

export type Nip47GetBalanceResult = {
  balance: MilliSatoshis
}

export type Nip47MakeInvoiceResult = Nip47Transaction & {
  type: "incoming"
  expires_at: UnixTimestamp
}

export type Nip47LookupInvoiceResult = Nip47Transaction & {
  expires_at?: UnixTimestamp
  settled_at?: UnixTimestamp
}

export type Nip47PayInvoiceResult = {
  preimage: Preimage
  fees_paid: MilliSatoshis
}

export type Nip47ListTransactionsResult = {
  transactions: Nip47LookupInvoiceResult[]
}

export type Nip47Result =
  | Nip47GetInfoResult
  | Nip47GetBalanceResult
  | Nip47MakeInvoiceResult
  | Nip47PayInvoiceResult
  | Nip47LookupInvoiceResult
  | Nip47ListTransactionsResult
  | Nip47Error

export type Nip47Response =
  | { result: Nip47Result }
  | { error: { code: string; message: string } }

export type Nip47PaymentReceivedNotification = {
  notification_type: "payment_received"
  notification: {
    type: "incoming"
    state?: PaymentStatus // optional
    invoice: InvoiceBolt11 // encoded invoice
    description?: Description // invoice's description, optional
    description_hash?: DescriptionHash // invoice's description hash, optional
    preimage?: Preimage // payment's preimage
    payment_hash: PaymentHash // Payment hash for the payment
    amount: MilliSatoshis // value in msats
    fees_paid: MilliSatoshis // value in msats
    created_at: UnixTimestamp // invoice/payment creation time
    expires_at?: UnixTimestamp // invoice expiration time, optional if not applicable
    settled_at: UnixTimestamp // invoice/payment settlement time
  }
}

export type Nip47PaymentSentNotification = {
  notification_type: "payment_sent"
  notification: {
    type: "outgoing"
    state?: PaymentStatus // optional
    invoice: InvoiceBolt11 // encoded invoice
    description?: Description // invoice's description, optional
    description_hash?: DescriptionHash // invoice's description hash, optional
    preimage: Preimage // payment's preimage
    payment_hash: PaymentHash // Payment hash for the payment
    amount: MilliSatoshis // value in msats
    fees_paid: MilliSatoshis // value in msats
    created_at: UnixTimestamp // invoice/payment creation time
    expires_at: UnixTimestamp // invoice expiration time, optional if not applicable
    settled_at: UnixTimestamp // invoice/payment settlement time
  }
}

export type Nip47Notification =
  | Nip47PaymentReceivedNotification
  | Nip47PaymentSentNotification

export type Nip47EncryptionType = "nip04" | "nip44_v2"
