import { env } from "./env"

export * from "./error"

export const SUBGRAPH_PORT = process.env.SUBGRAPH_PORT
  ? parseInt(process.env.SUBGRAPH_PORT)
  : 4010
export const NODE_ENV = process.env.NODE_ENV || "development"
export const APOLLO_PLAYGROUND_ENABLED = process.env.APOLLO_PLAYGROUND_ENABLED
  ? process.env.APOLLO_PLAYGROUND_ENABLED === "true"
  : true

export const COMMITHASH = env.COMMITHASH
export const LOGLEVEL = env.LOGLEVEL
