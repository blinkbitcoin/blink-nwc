import {
  Nip47Error,
  Nip47RateLimitedError,
  Nip47NotImplementedError,
  Nip47InsufficientBalanceError,
  Nip47QuotaExceededError,
  Nip47RestrictedError,
  Nip47UnauthorizedError,
  Nip47InternalError,
  Nip47OtherError,
  Nip47PaymentFailedError,
  Nip47NotFoundError,
  parseNip47Response,
  EventKind,
} from "@/domain/nostr"

describe("NIP-47 error codes", () => {
  it.each([
    [Nip47RateLimitedError, "RATE_LIMITED"],
    [Nip47NotImplementedError, "NOT_IMPLEMENTED"],
    [Nip47InsufficientBalanceError, "INSUFFICIENT_BALANCE"],
    [Nip47QuotaExceededError, "QUOTA_EXCEEDED"],
    [Nip47RestrictedError, "RESTRICTED"],
    [Nip47UnauthorizedError, "UNAUTHORIZED"],
    [Nip47InternalError, "INTERNAL"],
    [Nip47OtherError, "OTHER"],
    [Nip47PaymentFailedError, "PAYMENT_FAILED"],
    [Nip47NotFoundError, "NOT_FOUND"],
  ])("%p should have code %s", (ErrorClass, expectedCode) => {
    const error = new ErrorClass("test message")
    expect(error.code).toBe(expectedCode)
    expect(error.message).toBe("test message")
    expect(error).toBeInstanceOf(Nip47Error)
  })
})

describe("parseNip47Response", () => {
  it("should wrap Nip47Error into error response", () => {
    const error = new Nip47UnauthorizedError("not allowed")
    const response = parseNip47Response(error)

    expect(response).toEqual({
      error: { code: "UNAUTHORIZED", message: "not allowed" },
    })
  })

  it("should wrap success result into result response", () => {
    const result = { balance: 1000 }
    const response = parseNip47Response(result as any)

    expect(response).toEqual({ result: { balance: 1000 } })
  })

  it("should handle different error types correctly", () => {
    const errors = [
      new Nip47PaymentFailedError("payment failed"),
      new Nip47NotFoundError("not found"),
      new Nip47InternalError("internal error"),
    ]

    for (const error of errors) {
      const response = parseNip47Response(error)
      expect(response).toHaveProperty("error")
      expect((response as any).error.code).toBe(error.code)
      expect((response as any).error.message).toBe(error.message)
    }
  })
})

describe("EventKind constants", () => {
  it("should have correct NIP-47 event kinds", () => {
    expect(EventKind.InfoEvent).toBe(13194)
    expect(EventKind.Request).toBe(23194)
    expect(EventKind.Response).toBe(23195)
    expect(EventKind.Notification).toBe(23197)
    expect(EventKind.NotificationLegacy).toBe(23196)
  })

  it("should be readonly", () => {
    const kinds = Object.values(EventKind)
    expect(kinds).toHaveLength(5)
    expect(kinds).toContain(13194)
    expect(kinds).toContain(23194)
    expect(kinds).toContain(23195)
    expect(kinds).toContain(23196)
    expect(kinds).toContain(23197)
  })
})
