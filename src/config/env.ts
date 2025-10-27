import { createEnv } from "@t3-oss/env-core"
import { ZodError, z } from "zod"

export const env = createEnv({
  onValidationError: (error: ZodError) => {
    console.error("❌ Invalid environment variables:", error.flatten().fieldErrors)
    throw new Error(
        `Invalid environment variables: ${JSON.stringify(error.flatten().fieldErrors)}`,
    )
  },

  server: {
    COMMITHASH: z.string().default("dev"),
    LOGLEVEL: z
        .enum(["fatal", "error", "warn", "info", "debug", "trace"])
        .default("info"),
    NETWORK: z.enum(["mainnet", "testnet", "signet", "regtest"]),

    NOSTR_PRIVATE_KEY: z
        .string()
        .regex(/^[a-f0-9]{64}$/i)
        .default("e96597ef1f21a03eaf62549ad66ac66fe7194732e1a68df61cb31bf15e661025"), //todo: absolutely remove after development
    NOSTR_RELAY_URL: z.string().url().default("wss://relay.getalby.com/v1"), //todo: we should get dedicated relay
    JWKS_URL: z.string().url(),
  },

  runtimeEnvStrict: {
    COMMITHASH: process.env.COMMITHASH,
    LOGLEVEL: process.env.LOGLEVEL,
    NETWORK: process.env.NETWORK,
    NOSTR_PRIVATE_KEY: process.env.NOSTR_PRIVATE_KEY,
    NOSTR_RELAY_URL: process.env.NOSTR_RELAY_URL,
    JWKS_URL: process.env.JWKS_URL,
  },
})
