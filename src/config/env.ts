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

    NOSTR_PRIVATE_KEY: z
      .string()
      .regex(/^[a-f0-9]{64}$/i)
      .default("e96597ef1f21a03eaf62549ad66ac66fe7194732e1a68df61cb31bf15e661025"), //todo: absolutely remove after development
    NOSTR_RELAY_URL: z.string().url().default("ws://relay:7777"), // todo create a separate public relay env for nip47 connection strings
    ROUTER_URL: z.string().url().default("http://galoy:4012/graphql"), //todo: ensure if same on prod
  },

  runtimeEnvStrict: {
    COMMITHASH: process.env.COMMITHASH,
    LOGLEVEL: process.env.LOGLEVEL,
    NOSTR_PRIVATE_KEY: process.env.NOSTR_PRIVATE_KEY,
    NOSTR_RELAY_URL: process.env.NOSTR_RELAY_URL,
    ROUTER_URL: process.env.ROUTER_URL,
  },
})
