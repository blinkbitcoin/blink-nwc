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
    DATA_ENCRYPTION_KEY:
      process.env.NODE_ENV === "test"
        ? z
            .string()
            .regex(/^[a-f0-9]{64}$/i)
            .default("0".repeat(64))
        : z.string().regex(/^[a-f0-9]{64}$/i),

    NOSTR_PRIVATE_KEY: z.string().regex(/^[a-f0-9]{64}$/i),
    ROUTER_URL: z.string().url().default("http://galoy:4012/graphql"), //todo: ensure if same on prod
    NOSTR_RELAY_URL: z.string().url().default("ws://localhost:7777"),
    NOSTR_RELAY_PUBLIC_URL: z.string().url().default("ws://relay:7777"), // todo change on prod
  },

  runtimeEnvStrict: {
    COMMITHASH: process.env.COMMITHASH,
    LOGLEVEL: process.env.LOGLEVEL,
    DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY,
    NOSTR_PRIVATE_KEY: process.env.NOSTR_PRIVATE_KEY,
    ROUTER_URL: process.env.ROUTER_URL,
    NOSTR_RELAY_URL: process.env.NOSTR_RELAY_URL,
    NOSTR_RELAY_PUBLIC_URL: process.env.NOSTR_RELAY_PUBLIC_URL,
  },
})
