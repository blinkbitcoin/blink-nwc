import { isConnectionExpired, validateConnectionState } from "@/app/connection-validator"

describe("connection-validator", () => {
  const baseConnection = {
    revoked: false,
    expiresAt: null,
  } as const

  it("treats a null expiry as active", () => {
    expect(isConnectionExpired(baseConnection)).toBe(false)
  })

  it("treats an expiry equal to now as expired", () => {
    const now = new Date("2026-01-01T00:00:00.000Z")

    expect(isConnectionExpired({ ...baseConnection, expiresAt: now }, now)).toBe(true)
  })

  it("treats an expiry 1ms in the future as active", () => {
    const now = new Date("2026-01-01T00:00:00.000Z")
    const expiresAt = new Date("2026-01-01T00:00:00.001Z")

    expect(isConnectionExpired({ ...baseConnection, expiresAt }, now)).toBe(false)
  })

  it("treats an expiry 1ms in the past as expired", () => {
    const now = new Date("2026-01-01T00:00:00.001Z")
    const expiresAt = new Date("2026-01-01T00:00:00.000Z")

    expect(isConnectionExpired({ ...baseConnection, expiresAt }, now)).toBe(true)
  })

  it("returns unauthorized for revoked connections", () => {
    const error = validateConnectionState({ ...baseConnection, revoked: true })

    expect(error?.code).toBe("UNAUTHORIZED")
    expect(error?.message).toBe("Connection has been revoked")
  })

  it("returns unauthorized for expired connections", () => {
    const error = validateConnectionState(
      { ...baseConnection, expiresAt: new Date("2026-01-01T00:00:00.000Z") },
      new Date("2026-01-02T00:00:00.000Z"),
    )

    expect(error?.code).toBe("UNAUTHORIZED")
    expect(error?.message).toBe("Connection has expired")
  })

  it("prioritizes revoked over expired state", () => {
    const error = validateConnectionState(
      {
        ...baseConnection,
        revoked: true,
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      new Date("2026-01-02T00:00:00.000Z"),
    )

    expect(error?.code).toBe("UNAUTHORIZED")
    expect(error?.message).toBe("Connection has been revoked")
  })

  it("returns null for active connections", () => {
    expect(validateConnectionState(baseConnection)).toBeNull()
  })
})
