import {Nip47Error} from "@/domain/nwc-errors";
import {Nip47Method} from "@/domain/index.types";

export type Nip47MakeInvoiceRequest = {
    amount: number // value in msats
    description?: string // invoice's description, optional
    description_hash?: string // invoice's description hash, optional
    expiry?: number // expiry in seconds from time invoice is created, optional
}

export type Nip47PayInvoiceRequest = {
    invoice: string // bolt11 invoice
}

export type Nip47LookupInvoiceRequest = {
    payment_hash?: string
    invoice?: string
}

export type Nip47ListTransactionsRequest = {
    from?: number // starting timestamp in seconds since epoch (inclusive), optional
    until?: number // ending timestamp in seconds since epoch (inclusive), optional
    limit?: number // maximum number of invoices to return, optional
    offset?: number // offset of the first invoice to return, optional
    unpaid?: true // include unpaid invoices, optional, default false
    type?: "incoming" | "outgoing" // "incoming" for invoices, "outgoing" for payments, undefined for both
}

export type Nip47Transaction = {
    type: "incoming" | "outgoing"
    invoice?: string
    description?: string
    description_hash?: string
    preimage?: string
    payment_hash: string
    amount: number // msats
    fees_paid: number // msats
    created_at: number // unix timestamp
    metadata?: object
}

export type Nip47GetInfoResult = {
    alias: string
    color: string
    pubkey: string
    network: string
    block_height: number
    block_hash: string
    methods: Nip47Method[]
}

export type Nip47GetBalanceResult = {
    balance: number
}

export type Nip47MakeInvoiceResult = Nip47Transaction & {
    type: "incoming"
    expires_at: number
}

export type Nip47LookupInvoiceResult = Nip47Transaction & {
    expires_at?: number
    settled_at?: number
}

export type Nip47PayInvoiceResult = { preimage: string }

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
