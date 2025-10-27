import { env } from "@/config/env"
import database from "@/config/db"
export * from "@/config/error"

import {BitcoinNetwork, Nip47Method, NwcRelay, ServerNostrPrivkey} from "@/domain/index.types";


export const SUBGRAPH_PORT = process.env.SUBGRAPH_PORT
  ? parseInt(process.env.SUBGRAPH_PORT)
  : 4010
export const NODE_ENV = process.env.NODE_ENV || "development"
export const APOLLO_PLAYGROUND_ENABLED = process.env.APOLLO_PLAYGROUND_ENABLED
  ? process.env.APOLLO_PLAYGROUND_ENABLED === "true"
  : true

export const COMMITHASH = env.COMMITHASH
export const LOGLEVEL = env.LOGLEVEL

export const databaseConfig = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "", 10) || 5432,
    user: process.env.DB_USER || "blink-nwc-usr",
    password: process.env.DB_PWD || "blink-nwc-pwd",
    database: process.env.DB_DB || "blink-nwc",
    poolMin: parseInt(process.env.DB_POOL_MIN || "", 10) || 1,
    poolMax: parseInt(process.env.DB_POOL_MAX || "", 10) || 5,
    debug: process.env.DB_DEBUG === "true",
}

export const databaseClientConfig = database

export const NOSTR_PRIVATE_KEY = env.NOSTR_PRIVATE_KEY as ServerNostrPrivkey
export const NOSTR_RELAY_URL = env.NOSTR_RELAY_URL as NwcRelay
export const NETWORK = env.NETWORK as BitcoinNetwork

export const WALLET_ALIAS = "Blink"
export const WALLET_COLOR = "Orange"
export const SUPPORTED_NWC_METHODS: Nip47Method[] = [
    "get_info",
    "get_balance",
    "make_invoice",
    "pay_invoice",
    "lookup_invoice",
    "list_transactions",
]
