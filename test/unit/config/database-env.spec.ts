import { z } from "zod"

describe("database env", () => {
  const originalEnv = {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PWD: process.env.DB_PWD,
    DB_DB: process.env.DB_DB,
    DB_POOL_MIN: process.env.DB_POOL_MIN,
    DB_POOL_MAX: process.env.DB_POOL_MAX,
    DB_DEBUG: process.env.DB_DEBUG,
  }

  const restoreEnvVar = (key: keyof typeof originalEnv) => {
    const value = originalEnv[key]
    if (value === undefined) {
      delete process.env[key]
      return
    }

    process.env[key] = value
  }

  afterEach(() => {
    jest.resetModules()

    restoreEnvVar("DB_HOST")
    restoreEnvVar("DB_PORT")
    restoreEnvVar("DB_USER")
    restoreEnvVar("DB_PWD")
    restoreEnvVar("DB_DB")
    restoreEnvVar("DB_POOL_MIN")
    restoreEnvVar("DB_POOL_MAX")
    restoreEnvVar("DB_DEBUG")
  })

  it("applies schema defaults and coercion", async () => {
    const { databaseServerSchema } = await import("@/config/database-env")
    const parsed = z.object(databaseServerSchema).parse({
      DB_USER: "blink-user",
      DB_PWD: "blink-password",
    })

    expect(parsed).toEqual({
      DB_HOST: "localhost",
      DB_PORT: 5435,
      DB_USER: "blink-user",
      DB_PWD: "blink-password",
      DB_DB: "blink-nwc",
      DB_POOL_MIN: 1,
      DB_POOL_MAX: 5,
      DB_DEBUG: false,
    })
  })

  it("captures the raw runtime environment snapshot", async () => {
    process.env.DB_HOST = "db.internal"
    process.env.DB_PORT = "6543"
    process.env.DB_USER = "blink-user"
    process.env.DB_PWD = "blink-password"
    process.env.DB_DB = "blink-nwc-test"
    process.env.DB_POOL_MIN = "2"
    process.env.DB_POOL_MAX = "7"
    process.env.DB_DEBUG = "true"
    jest.resetModules()

    const { databaseRuntimeEnv } = await import("@/config/database-env")

    expect(databaseRuntimeEnv).toEqual({
      DB_HOST: "db.internal",
      DB_PORT: "6543",
      DB_USER: "blink-user",
      DB_PWD: "blink-password",
      DB_DB: "blink-nwc-test",
      DB_POOL_MIN: "2",
      DB_POOL_MAX: "7",
      DB_DEBUG: "true",
    })
  })

  it("parses the runtime environment into validated config", async () => {
    process.env.DB_USER = "blink-user"
    process.env.DB_PWD = "blink-password"
    delete process.env.DB_HOST
    delete process.env.DB_PORT
    delete process.env.DB_DB
    delete process.env.DB_POOL_MIN
    delete process.env.DB_POOL_MAX
    delete process.env.DB_DEBUG
    jest.resetModules()

    const { databaseEnv } = await import("@/config/database-env")

    expect(databaseEnv).toEqual({
      DB_HOST: "localhost",
      DB_PORT: 5435,
      DB_USER: "blink-user",
      DB_PWD: "blink-password",
      DB_DB: "blink-nwc",
      DB_POOL_MIN: 1,
      DB_POOL_MAX: 5,
      DB_DEBUG: false,
    })
  })

  it("throws a helpful validation error for invalid runtime values", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined)

    process.env.DB_USER = "blink-user"
    process.env.DB_PWD = "blink-password"
    process.env.DB_PORT = "0"
    jest.resetModules()

    await expect(import("@/config/database-env")).rejects.toThrow(/DB_PORT/)
    expect(consoleError).toHaveBeenCalled()

    consoleError.mockRestore()
  })
})
