export type * from "./nwc-payloads"

export type ErrorLevel =
  (typeof import("./errors").ErrorLevel)[keyof typeof import("./errors").ErrorLevel]

export type BitcoinNetwork = string & { readonly brand: unique symbol }


export type ApiKey = string & { readonly brand: unique symbol }

export type ServerNostrPubkey = string & { readonly brand: unique symbol }
export type ServerNostrPrivkey = string & { readonly brand: unique symbol }
export type NwcRelay = string & { readonly brand: unique symbol }

export type NwcBudgetAmount = number & { readonly brand: unique symbol }
export type NwcConnectionId = string & { readonly brand: unique symbol }
export type NwcConnectionAlias = string & { readonly brand: unique symbol }
export type NwcAppPubkey = string & { readonly brand: unique symbol }
export type NwcSecret = string & { readonly brand: unique symbol }
export type NwcUri = string & { readonly brand: unique symbol }

export type NwcBudgetResetInterval = "daily" | "weekly" | "monthly" | "yearly" | "never"
export type Nip47Method =
    | "get_info"
    | "get_balance"
    | "get_budget"
    | "make_invoice"
    | "pay_invoice"
    | "pay_keysend"
    | "lookup_invoice"
    | "list_transactions"
    | "sign_message"
    | "create_connection"
    | "make_hold_invoice"
    | "settle_hold_invoice"
    | "cancel_hold_invoice"

export type Nip47EncryptionType = "nip04" | "nip44_v2"

export type NwcBudget = {
    total: NwcBudgetAmount
    spent: NwcBudgetAmount
    resetInterval: NwcBudgetResetInterval
    lastReset: Date
}

export type ServerNostrKeypair = {
    privkey: ServerNostrPrivkey
    pubkey: ServerNostrPubkey
}
