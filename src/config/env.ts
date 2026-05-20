import { createEnv } from "@t3-oss/env-core"
import { ZodError, z } from "zod"

import { databaseRuntimeEnv, databaseServerSchema } from "@/config/database-env"

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
    OATHKEEPER_DECISION_ENDPOINT: z.string().url().default("http://localhost:4456"),
    ROUTER_URL: z.string().url().default("http://localhost:4004/graphql"),
    PUBLIC_GRAPHQL_URL: z.string().url().default("http://localhost:4455/graphql"),
    BLINK_CORE_GRPC_HOST: z.string().default("localhost"),
    BLINK_CORE_GRPC_PORT: z
      .number()
      .or(z.string())
      .pipe(z.coerce.number())
      .default(50053),
    NWC_NOSTR_MONITORING_PORT: z
      .number()
      .or(z.string())
      .pipe(z.coerce.number())
      .default(4011),
    NOSTR_RELAY_URL: z.string().url().default("ws://localhost:7777"),
    NOSTR_RELAY_PUBLIC_URL: z.string().url().default("ws://relay:7777"), // todo change on prod
    ...databaseServerSchema,
  },

  runtimeEnvStrict: {
    COMMITHASH: process.env.COMMITHASH,
    LOGLEVEL: process.env.LOGLEVEL,
    DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY,
    NOSTR_PRIVATE_KEY: process.env.NOSTR_PRIVATE_KEY,
    OATHKEEPER_DECISION_ENDPOINT: process.env.OATHKEEPER_DECISION_ENDPOINT,
    ROUTER_URL: process.env.ROUTER_URL,
    PUBLIC_GRAPHQL_URL: process.env.PUBLIC_GRAPHQL_URL,
    BLINK_CORE_GRPC_HOST: process.env.BLINK_CORE_GRPC_HOST,
    BLINK_CORE_GRPC_PORT: process.env.BLINK_CORE_GRPC_PORT,
    NWC_NOSTR_MONITORING_PORT: process.env.NWC_NOSTR_MONITORING_PORT,
    NOSTR_RELAY_URL: process.env.NOSTR_RELAY_URL,
    NOSTR_RELAY_PUBLIC_URL: process.env.NOSTR_RELAY_PUBLIC_URL,
    ...databaseRuntimeEnv,
  },
})
