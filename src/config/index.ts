import { env } from "@/config/env"
import database from "@/config/db"
export * from "@/config/error"

import {
  Nip47MethodType as Nip47MethodType,
  NwcRelay,
  NwcServerAlias,
  NwcServerColor,
  ServerNostrPrivkey,
} from "@/domain/index.types"
import { Nip47Method } from "@/domain/nostr"
import {
  NwcNotificationType,
  NwcNotificationTypeValue,
} from "@/domain/nostr/notification-type"

export const SUBGRAPH_PORT = process.env.SUBGRAPH_PORT
  ? parseInt(process.env.SUBGRAPH_PORT)
  : 4010
export const NODE_ENV = process.env.NODE_ENV || "development"
export const APOLLO_PLAYGROUND_ENABLED = process.env.APOLLO_PLAYGROUND_ENABLED
  ? process.env.APOLLO_PLAYGROUND_ENABLED === "true"
  : true

export const COMMITHASH = env.COMMITHASH
export const LOGLEVEL = env.LOGLEVEL

export const OATHKEEPER_DECISION_ENDPOINT = env.OATHKEEPER_DECISION_ENDPOINT
export const ROUTER_URL = env.ROUTER_URL
export const PUBLIC_GRAPHQL_URL = env.PUBLIC_GRAPHQL_URL

export const databaseClientConfig = database

export const NOSTR_PRIVATE_KEY = env.NOSTR_PRIVATE_KEY as ServerNostrPrivkey
export const NOSTR_RELAY_URL = env.NOSTR_RELAY_URL as NwcRelay
export const NOSTR_RELAY_PUBLIC_URL = env.NOSTR_RELAY_PUBLIC_URL as NwcRelay

export const WALLET_ALIAS = "Blink" as NwcServerAlias
export const WALLET_COLOR = "F2A900" as NwcServerColor
export const SUPPORTED_NWC_METHODS: Nip47MethodType[] = [
  Nip47Method.GetInfo,
  Nip47Method.GetBalance,
  Nip47Method.MakeInvoice,
  Nip47Method.PayInvoice,
  Nip47Method.LookupInvoice,
  Nip47Method.ListTransactions,
]

export const SUPPORTED_NWC_NOTIFICATIONS: NwcNotificationTypeValue[] = [
  NwcNotificationType.PaymentSent,
  NwcNotificationType.PaymentReceived,
]
