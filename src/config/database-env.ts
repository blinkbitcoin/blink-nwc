import { ZodError, z } from "zod"

const onValidationError = (error: ZodError) => {
  console.error("❌ Invalid environment variables:", error.flatten().fieldErrors)
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(error.flatten().fieldErrors)}`,
  )
}

const optionalNumberWithDefault = (defaultValue: number, numberSchema: z.ZodNumber) =>
  z.preprocess(
    (value) => (value === undefined ? defaultValue : value),
    z.coerce.number().pipe(numberSchema),
  )

const optionalBooleanStringWithDefault = (defaultValue: "true" | "false") =>
  z.preprocess(
    (value) => (value === undefined ? defaultValue : value),
    z.enum(["true", "false"]).transform((currentValue) => currentValue === "true"),
  )

export const databaseServerSchema = {
  DB_HOST: z.string().default("localhost"),
  DB_PORT: optionalNumberWithDefault(5435, z.number().int().positive()),
  DB_USER: z.string().min(1),
  DB_PWD: z.string().min(1),
  DB_DB: z.string().default("blink-nwc"),
  DB_POOL_MIN: optionalNumberWithDefault(1, z.number().int().nonnegative()),
  DB_POOL_MAX: optionalNumberWithDefault(5, z.number().int().positive()),
  DB_DEBUG: optionalBooleanStringWithDefault("false"),
} as const

export const databaseRuntimeEnv = {
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  DB_PWD: process.env.DB_PWD,
  DB_DB: process.env.DB_DB,
  DB_POOL_MIN: process.env.DB_POOL_MIN,
  DB_POOL_MAX: process.env.DB_POOL_MAX,
  DB_DEBUG: process.env.DB_DEBUG,
}

export const databaseEnv = (() => {
  try {
    return z.object(databaseServerSchema).parse(databaseRuntimeEnv)
  } catch (error) {
    if (error instanceof ZodError) {
      onValidationError(error)
    }

    throw error
  }
})()
