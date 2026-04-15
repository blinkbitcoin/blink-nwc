describe("db config", () => {
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

  it("uses validated database env values", async () => {
    process.env.DB_HOST = "db.internal"
    process.env.DB_PORT = "6543"
    process.env.DB_USER = "blink-user"
    process.env.DB_PWD = "blink-password"
    process.env.DB_DB = "blink-nwc-test"
    process.env.DB_POOL_MIN = "2"
    process.env.DB_POOL_MAX = "7"
    process.env.DB_DEBUG = "true"

    jest.resetModules()

    const { default: config } = await import("@/config/db")

    expect(config.connection).toMatchObject({
      host: "db.internal",
      port: 6543,
      user: "blink-user",
      password: "blink-password",
      database: "blink-nwc-test",
    })
    expect(config.pool).toEqual({ min: 2, max: 7 })
    expect(config.debug).toBe(true)
  })

  it("fails startup validation when DB_PWD is missing", async () => {
    process.env.DB_USER = "blink-user"
    delete process.env.DB_PWD
    jest.resetModules()

    await expect(import("@/config/db")).rejects.toThrow(/DB_PWD/)
  })
})
