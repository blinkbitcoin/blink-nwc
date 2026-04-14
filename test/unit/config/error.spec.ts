import { ConfigError, UnknownConfigError } from "@/config/error"

describe("config errors", () => {
  it("stores the provided message and data", () => {
    const error = new ConfigError("invalid config", { key: "DB_HOST" })

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("ConfigError")
    expect(error.message).toBe("invalid config")
    expect(error.data).toEqual({ key: "DB_HOST" })
  })

  it("preserves inheritance for unknown config errors", () => {
    const error = new UnknownConfigError("unknown config")

    expect(error).toBeInstanceOf(ConfigError)
    expect(error.name).toBe("UnknownConfigError")
    expect(error.message).toBe("unknown config")
  })
})
