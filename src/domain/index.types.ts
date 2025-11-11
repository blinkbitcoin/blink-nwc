export type * from "./nwc-payloads"

export type ErrorLevel =
  (typeof import("./errors").ErrorLevel)[keyof typeof import("./errors").ErrorLevel]
export type Nip47Method =
  (typeof import("./methods").Nip47Method)[keyof typeof import("./methods").Nip47Method]

export type BitcoinNetwork = string & { readonly brand: unique symbol }

export type ApiKey = string & { readonly brand: unique symbol }

export type InvoiceBolt11 = string & { readonly brand: unique symbol }
export type Memo = string & { readonly brand: unique symbol }

export type ServerNostrPubkey = string & { readonly brand: unique symbol }
export type ServerNostrPrivkey = string & { readonly brand: unique symbol }
export type NwcRelay = string & { readonly brand: unique symbol }

export type NwcConnectionId = string & { readonly brand: unique symbol }
export type NwcConnectionAlias = string & { readonly brand: unique symbol }
export type NwcAppPubkey = string & { readonly brand: unique symbol }
export type NwcSecret = string & { readonly brand: unique symbol }
export type NwcUri = string & { readonly brand: unique symbol }

export type Nip47EncryptionType = "nip04" | "nip44_v2"

export type ServerNostrKeypair = {
  privkey: ServerNostrPrivkey
  pubkey: ServerNostrPubkey
}
