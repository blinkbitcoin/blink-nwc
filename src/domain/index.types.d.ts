import { WalletId } from "@/domain/core/index.types"

export type * from "@/domain/core/index.types"
export type * from "@/domain/nostr/index.types"
export type * from "@/domain/units/index.types"

export type ErrorLevel =
  (typeof import("./errors").ErrorLevel)[keyof typeof import("./errors").ErrorLevel]
export type Nip47Method =
  (typeof import("./nostr/methods").Nip47Method)[keyof typeof import("./nostr/methods").Nip47Method]

export type Network = string & { readonly brand: unique symbol }
export type BlockHeight = number & { readonly brand: unique symbol }
export type BlockHash = string & { readonly brand: unique symbol }

export type ApiKey = string & { readonly brand: unique symbol }

export type InvoiceBolt11 = string & { readonly brand: unique symbol }
export type Preimage = string & { readonly brand: unique symbol }
export type Memo = string & { readonly brand: unique symbol }

export type ServerNostrPubkey = string & { readonly brand: unique symbol }
export type ServerNostrPrivkey = string & { readonly brand: unique symbol }
export type NwcRelay = string & { readonly brand: unique symbol }

export type NwcConnectionId = string & { readonly brand: unique symbol }
export type NwcConnectionAlias = string & { readonly brand: unique symbol }
export type NwcAppPubkey = string & { readonly brand: unique symbol }
export type NwcSecret = string & { readonly brand: unique symbol }
export type NwcUri = string & { readonly brand: unique symbol }



export type Cursor = string & { readonly brand: unique symbol }

export type WebhookId = string & { readonly brand: unique symbol }

export type ServerNostrKeypair = {
  privkey: ServerNostrPrivkey
  pubkey: ServerNostrPubkey
}
export type WebhookConnection = {
  walletId: WalletId
  webhookId: WebhookId
}
