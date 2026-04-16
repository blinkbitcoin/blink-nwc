import {
  isConnectionExpired,
  validateConnectionForRequest,
} from "@/app/connection-validator"
import { Nip47Method } from "@/domain/nostr"

describe("connection-validator", () => {
  const baseConnection = {
    revoked: false,
    expiresAt: null,
    permissions: [Nip47Method.GetInfo],
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
    const error = validateConnectionForRequest(
      { ...baseConnection, revoked: true },
      Nip47Method.GetInfo,
    )

    expect(error?.code).toBe("UNAUTHORIZED")
    expect(error?.message).toBe("Connection has been revoked")
  })

  it("returns unauthorized for expired connections", () => {
    const error = validateConnectionForRequest(
      { ...baseConnection, expiresAt: new Date("2026-01-01T00:00:00.000Z") },
      Nip47Method.GetInfo,
      new Date("2026-01-02T00:00:00.000Z"),
    )

    expect(error?.code).toBe("UNAUTHORIZED")
    expect(error?.message).toBe("Connection has expired")
  })

  it("prioritizes revoked over expired and restricted states", () => {
    const error = validateConnectionForRequest(
      {
        ...baseConnection,
        revoked: true,
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
        permissions: [],
      },
      Nip47Method.PayInvoice,
      new Date("2026-01-02T00:00:00.000Z"),
    )

    expect(error?.code).toBe("UNAUTHORIZED")
    expect(error?.message).toBe("Connection has been revoked")
  })

  it("prioritizes expired over restricted states", () => {
    const error = validateConnectionForRequest(
      {
        ...baseConnection,
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
        permissions: [],
      },
      Nip47Method.PayInvoice,
      new Date("2026-01-02T00:00:00.000Z"),
    )

    expect(error?.code).toBe("UNAUTHORIZED")
    expect(error?.message).toBe("Connection has expired")
  })

  it("returns restricted when the method is not allowed", () => {
    const error = validateConnectionForRequest(baseConnection, Nip47Method.PayInvoice)

    expect(error?.code).toBe("RESTRICTED")
    expect(error?.message).toContain(Nip47Method.PayInvoice)
  })

  it("returns null for active authorized connections", () => {
    expect(validateConnectionForRequest(baseConnection, Nip47Method.GetInfo)).toBeNull()
  })
})
