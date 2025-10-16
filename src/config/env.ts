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
  },

  runtimeEnvStrict: {
    COMMITHASH: process.env.COMMITHASH,
    LOGLEVEL: process.env.LOGLEVEL,
  },
})
