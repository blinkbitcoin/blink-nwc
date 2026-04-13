import {
  checkedToApiKey,
  checkedToBolt11Invoice,
  checkedToConnectionId,
  checkedToDescription,
  checkedToDescriptionHash,
  checkedToMsatAmount,
  checkedToNip47ListTransactionsRequest,
  checkedToNip47LookupInvoiceRequest,
  checkedToNip47MakeInvoiceRequest,
  checkedToNip47PayInvoiceRequest,
  checkedToNonNegativeInteger,
  checkedToNwcAlias,
  checkedToNwcUpdates,
  checkedToPaymentDirection,
  checkedToPaymentHash,
  checkedToPermissions,
  checkedToSeconds,
  checkedToUnixTimestamp,
  checkedToUserId,
  checkedToWalletId,
} from "@/domain/validation"
import { ValidationError } from "@/domain/errors"
import { PaymentDirection as PD } from "@/domain/nostr/payment-direction"

describe("Validation Functions", () => {
  describe("checkedToUserId", () => {
    it("should accept valid UUID", () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000"
      const result = checkedToUserId(validUuid)
      expect(result).toBe(validUuid)
    })

    it("should reject invalid UUID", () => {
      const invalidUuid = "not-a-uuid"
      const result = checkedToUserId(invalidUuid)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject empty string", () => {
      const result = checkedToUserId("")
      expect(result).toBeInstanceOf(ValidationError)
    })
  })

  describe("checkedToWalletId", () => {
    it("should accept valid UUID", () => {
      const validUuid = "123e4567-e89b-12d3-a456-426614174000"
      const result = checkedToWalletId(validUuid)
      expect(result).toBe(validUuid)
    })

    it("should reject invalid UUID", () => {
      const invalidUuid = "invalid-wallet-id"
      const result = checkedToWalletId(invalidUuid)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject UUID with wrong format", () => {
      const wrongFormat = "123e4567e89b12d3a456426614174000" // missing dashes
      const result = checkedToWalletId(wrongFormat)
      expect(result).toBeInstanceOf(ValidationError)
    })
  })

  describe("checkedToApiKey", () => {
    it("should accept valid API key string", () => {
      const result = checkedToApiKey("blink_api_key_abc123")
      expect(result).toBe("blink_api_key_abc123")
    })

    it("should accept UUID-format API key", () => {
      const validUuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
      const result = checkedToApiKey(validUuid)
      expect(result).toBe(validUuid)
    })

    it("should reject empty string", () => {
      const result = checkedToApiKey("")
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject whitespace-only string", () => {
      const result = checkedToApiKey("   ")
      expect(result).toBeInstanceOf(ValidationError)
    })
  })

  describe("checkedToPermissions", () => {
    it("should accept valid permissions array", () => {
      const validPermissions = ["get_info", "get_balance", "make_invoice"]
      const result = checkedToPermissions(validPermissions)
      expect(result).toEqual(validPermissions)
    })

    it("should accept all valid methods", () => {
      const allMethods = [
        "get_info",
        "get_balance",
        "make_invoice",
        "pay_invoice",
        "lookup_invoice",
        "list_transactions",
      ]
      const result = checkedToPermissions(allMethods)
      expect(result).toEqual(allMethods)
    })

    it("should accept notification permissions", () => {
      const permissions = ["get_info", "notifications:payment_sent"]
      const result = checkedToPermissions(permissions)
      expect(result).toEqual(permissions)
    })

    it("should reject array with invalid permission", () => {
      const invalidPermissions = ["get_info", "invalid_method"]
      const result = checkedToPermissions(invalidPermissions)
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toContain("Invalid permission")
    })

    it("should reject non-array input", () => {
      const result = checkedToPermissions("not-an-array" as any)
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toContain("must be an array")
    })

    it("should accept empty array", () => {
      const result = checkedToPermissions([])
      expect(result).toEqual([])
    })
  })

  describe("checkedToConnectionId", () => {
    it("should accept valid UUID", () => {
      const validUuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479"
      const result = checkedToConnectionId(validUuid)
      expect(result).toBe(validUuid)
    })

    it("should reject invalid UUID", () => {
      const invalidUuid = "not-a-connection-id"
      const result = checkedToConnectionId(invalidUuid)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject non-string input", () => {
      const result = checkedToConnectionId(12345)
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toContain("must be a string")
    })

    it("should reject null", () => {
      const result = checkedToConnectionId(null)
      expect(result).toBeInstanceOf(ValidationError)
    })
  })

  describe("checkedToNwcAlias", () => {
    it("should accept valid alias", () => {
      const validAlias = "my-wallet_123"
      const result = checkedToNwcAlias(validAlias)
      expect(result).toBe(validAlias)
    })

    it("should return null for empty string", () => {
      const result = checkedToNwcAlias("")
      expect(result).toBeNull()
    })

    it("should return null for null", () => {
      const result = checkedToNwcAlias(null)
      expect(result).toBeNull()
    })

    it("should return null for undefined", () => {
      const result = checkedToNwcAlias(undefined)
      expect(result).toBeNull()
    })

    it("should reject non-string input", () => {
      const result = checkedToNwcAlias(12345)
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toContain("must be a string")
    })

    it("should reject alias longer than 32 characters", () => {
      const longAlias = "a".repeat(33)
      const result = checkedToNwcAlias(longAlias)
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toContain("under 32 characters")
    })

    it("should accept alias with exactly 32 characters", () => {
      const alias32 = "a".repeat(32)
      const result = checkedToNwcAlias(alias32)
      expect(result).toBe(alias32)
    })

    it("should reject alias with invalid characters", () => {
      const invalidAlias = "my wallet@123"
      const result = checkedToNwcAlias(invalidAlias)
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toContain("invalid characters")
    })

    it("should reject alias with spaces", () => {
      const result = checkedToNwcAlias("my wallet")
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject alias with special characters", () => {
      const result = checkedToNwcAlias("wallet$123")
      expect(result).toBeInstanceOf(ValidationError)
    })
  })

  describe("checkedToNwcUpdates", () => {
    it("should accept valid alias update", () => {
      const updates = { alias: "new-alias" }
      const result = checkedToNwcUpdates(updates)
      expect(result).toEqual({ alias: "new-alias" })
    })

    it("should accept null alias", () => {
      const updates = { alias: null }
      const result = checkedToNwcUpdates(updates)
      expect(result).toEqual({ alias: null })
    })

    it("should accept valid permissions update", () => {
      const updates = { permissions: ["get_info", "get_balance"] }
      const result = checkedToNwcUpdates(updates)
      expect(result).toEqual({ permissions: ["get_info", "get_balance"] })
    })

    it("should accept both alias and permissions", () => {
      const updates = { alias: "wallet", permissions: ["get_info"] }
      const result = checkedToNwcUpdates(updates)
      expect(result).toEqual({ alias: "wallet", permissions: ["get_info"] })
    })

    it("should reject invalid alias", () => {
      const updates = { alias: "invalid alias with spaces" }
      const result = checkedToNwcUpdates(updates)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject invalid permissions", () => {
      const updates = { permissions: ["invalid_method"] }
      const result = checkedToNwcUpdates(updates)
      expect(result).toBeInstanceOf(ValidationError)
    })
  })

  describe("checkedToBolt11Invoice", () => {
    it("should accept valid mainnet invoice", () => {
      const invoice = "lnbc1000n1..."
      const result = checkedToBolt11Invoice(invoice)
      expect(result).toBe(invoice)
    })

    it("should accept valid testnet invoice", () => {
      const invoice = "lntb1000n1..."
      const result = checkedToBolt11Invoice(invoice)
      expect(result).toBe(invoice)
    })

    it("should accept valid signet invoice", () => {
      const invoice = "lnsb1000n1..."
      const result = checkedToBolt11Invoice(invoice)
      expect(result).toBe(invoice)
    })

    it("should accept valid regtest invoice", () => {
      const invoice = "lnbcrt1000n1..."
      const result = checkedToBolt11Invoice(invoice)
      expect(result).toBe(invoice)
    })

    it("should normalize to lowercase", () => {
      const invoice = "LNBC1000N1..."
      const result = checkedToBolt11Invoice(invoice)
      expect(result).toBe(invoice.toLowerCase())
    })

    it("should reject non-string input", () => {
      const result = checkedToBolt11Invoice(12345)
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toContain("Invalid invoice type")
    })

    it("should reject empty string", () => {
      const result = checkedToBolt11Invoice("")
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toContain("cannot be empty")
    })

    it("should reject invalid prefix", () => {
      const invoice = "btc1000n1..."
      const result = checkedToBolt11Invoice(invoice)
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toContain(
        "Unknown lightning invoice prefix",
      )
    })
  })

  describe("checkedToMsatAmount", () => {
    it("should accept valid positive amount", () => {
      const amount = 1000
      const result = checkedToMsatAmount(amount)
      expect(result).toBe(amount)
    })

    it("should accept zero", () => {
      const result = checkedToMsatAmount(0)
      expect(result).toBe(0)
    })

    it("should reject negative number", () => {
      const result = checkedToMsatAmount(-100)
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toBe(
        "Amount must be a non-negative integer",
      )
    })

    it("should reject decimal number", () => {
      const result = checkedToMsatAmount(100.5)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject non-number input", () => {
      const result = checkedToMsatAmount("1000")
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject Infinity", () => {
      const result = checkedToMsatAmount(Infinity)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject NaN", () => {
      const result = checkedToMsatAmount(NaN)
      expect(result).toBeInstanceOf(ValidationError)
    })
  })

  describe("checkedToUnixTimestamp", () => {
    it("should accept valid timestamp", () => {
      const timestamp = 1700000000
      const result = checkedToUnixTimestamp(timestamp)
      expect(result).toBe(timestamp)
    })

    it("should reject negative timestamp", () => {
      const result = checkedToUnixTimestamp(-1000)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject decimal timestamp", () => {
      const result = checkedToUnixTimestamp(1700000000.5)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject non-number input", () => {
      const result = checkedToUnixTimestamp("1700000000")
      expect(result).toBeInstanceOf(ValidationError)
    })
  })

  describe("checkedToDescriptionHash", () => {
    it("should accept valid 64-char hex string", () => {
      const hash = "a".repeat(64)
      const result = checkedToDescriptionHash(hash)
      expect(result).toBe(hash)
    })

    it("should normalize to lowercase", () => {
      const hash = "A".repeat(64)
      const result = checkedToDescriptionHash(hash)
      expect(result).toBe(hash.toLowerCase())
    })

    it("should reject non-string input", () => {
      const result = checkedToDescriptionHash(12345)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject hash with wrong length", () => {
      const hash = "a".repeat(63)
      const result = checkedToDescriptionHash(hash)
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toContain("64-char hex")
    })

    it("should reject hash with invalid characters", () => {
      const hash = "z".repeat(64)
      const result = checkedToDescriptionHash(hash)
      expect(result).toBeInstanceOf(ValidationError)
    })
  })

  describe("checkedToDescription", () => {
    it("should accept valid string", () => {
      const description = "Payment for coffee"
      const result = checkedToDescription(description)
      expect(result).toBe(description)
    })

    it("should accept empty string", () => {
      const result = checkedToDescription("")
      expect(result).toBe("")
    })

    it("should reject non-string input", () => {
      const result = checkedToDescription(12345)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should accept string with special characters", () => {
      const description = "Payment for ☕ @shop #123"
      const result = checkedToDescription(description)
      expect(result).toBe(description)
    })
  })

  describe("checkedToSeconds", () => {
    it("should accept valid positive seconds", () => {
      const seconds = 3600
      const result = checkedToSeconds(seconds)
      expect(result).toBe(seconds)
    })

    it("should accept zero", () => {
      const result = checkedToSeconds(0)
      expect(result).toBe(0)
    })

    it("should reject negative seconds", () => {
      const result = checkedToSeconds(-100)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject decimal seconds", () => {
      const result = checkedToSeconds(60.5)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject non-number input", () => {
      const result = checkedToSeconds("3600")
      expect(result).toBeInstanceOf(ValidationError)
    })
  })

  describe("checkedToPaymentHash", () => {
    it("should accept valid 64-char hex string", () => {
      const hash = "0123456789abcdef".repeat(4)
      const result = checkedToPaymentHash(hash)
      expect(result).toBe(hash)
    })

    it("should normalize to lowercase", () => {
      const hash = "ABCDEF123456".padEnd(64, "0")
      const result = checkedToPaymentHash(hash)
      expect(result).toBe(hash.toLowerCase())
    })

    it("should reject invalid length", () => {
      const hash = "abc123"
      const result = checkedToPaymentHash(hash)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject non-hex characters", () => {
      const hash = "xyz".repeat(21) + "x"
      const result = checkedToPaymentHash(hash)
      expect(result).toBeInstanceOf(ValidationError)
    })
  })

  describe("checkedToNonNegativeInteger", () => {
    it("should accept valid positive integer", () => {
      const result = checkedToNonNegativeInteger("count", 10)
      expect(result).toBe(10)
    })

    it("should accept zero", () => {
      const result = checkedToNonNegativeInteger("count", 0)
      expect(result).toBe(0)
    })

    it("should reject negative integer", () => {
      const result = checkedToNonNegativeInteger("count", -5)
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toContain("count must be an integer")
    })

    it("should reject decimal number", () => {
      const result = checkedToNonNegativeInteger("count", 10.5)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject non-number input", () => {
      const result = checkedToNonNegativeInteger("count", "10")
      expect(result).toBeInstanceOf(ValidationError)
    })
  })

  describe("checkedToPaymentDirection", () => {
    it("should accept 'incoming'", () => {
      const result = checkedToPaymentDirection("incoming")
      expect(result).toBe(PD.Incoming)
    })

    it("should accept 'outgoing'", () => {
      const result = checkedToPaymentDirection("outgoing")
      expect(result).toBe(PD.Outgoing)
    })

    it("should accept undefined and return Both", () => {
      const result = checkedToPaymentDirection(undefined)
      expect(result).toBe(PD.Both)
    })

    it("should accept 'both' and return Both", () => {
      const result = checkedToPaymentDirection(PD.Both)
      expect(result).toBe(PD.Both)
    })

    it("should reject invalid string", () => {
      const result = checkedToPaymentDirection("invalid")
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject non-string input", () => {
      const result = checkedToPaymentDirection(123)
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toContain("must be a string")
    })
  })

  describe("checkedToNip47MakeInvoiceRequest", () => {
    it("should accept valid request with all fields", () => {
      const req = {
        amount: 1000,
        description: "Test invoice",
        description_hash: "a".repeat(64),
        expiry: 3600,
      }
      const result = checkedToNip47MakeInvoiceRequest(req)
      expect(result).toEqual(req)
    })

    it("should accept request with only amount", () => {
      const req = { amount: 1000 }
      const result = checkedToNip47MakeInvoiceRequest(req)
      expect(result).toEqual({
        amount: 1000,
        description: undefined,
        description_hash: undefined,
        expiry: undefined,
      })
    })

    it("should default amount to 0 if missing", () => {
      const req = {}
      const result = checkedToNip47MakeInvoiceRequest(req)
      expect(result).toMatchObject({ amount: 0 })
    })

    it("should reject invalid amount", () => {
      const req = { amount: -100 }
      const result = checkedToNip47MakeInvoiceRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject invalid description", () => {
      const req = { amount: 1000, description: 12345 }
      const result = checkedToNip47MakeInvoiceRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject invalid description_hash", () => {
      const req = { amount: 1000, description_hash: "invalid" }
      const result = checkedToNip47MakeInvoiceRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject invalid expiry", () => {
      const req = { amount: 1000, expiry: -60 }
      const result = checkedToNip47MakeInvoiceRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject description_hash for amountless invoices", () => {
      const req = { description_hash: "a".repeat(64) }
      const result = checkedToNip47MakeInvoiceRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toContain(
        "description_hash is not supported for amountless invoices",
      )
    })
  })

  describe("checkedToNip47PayInvoiceRequest", () => {
    it("should accept valid request", () => {
      const req = { invoice: "lnbc1000n1..." }
      const result = checkedToNip47PayInvoiceRequest(req)
      expect(result).toEqual({ invoice: req.invoice })
    })

    it("should accept valid request with amount", () => {
      const req = { invoice: "lnbc1000n1...", amount: 25000 }
      const result = checkedToNip47PayInvoiceRequest(req)
      expect(result).toEqual(req)
    })

    it("should reject missing invoice", () => {
      const req = {}
      const result = checkedToNip47PayInvoiceRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toContain("Invoice is required")
    })

    it("should reject invalid invoice", () => {
      const req = { invoice: "invalid-invoice" }
      const result = checkedToNip47PayInvoiceRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject non-string invoice", () => {
      const req = { invoice: 12345 }
      const result = checkedToNip47PayInvoiceRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject invalid amount", () => {
      const req = { invoice: "lnbc1000n1...", amount: -1 }
      const result = checkedToNip47PayInvoiceRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject zero amount", () => {
      const req = { invoice: "lnbc1000n1...", amount: 0 }
      const result = checkedToNip47PayInvoiceRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toContain("positive integer")
    })
  })

  describe("checkedToNip47LookupInvoiceRequest", () => {
    it("should accept request with payment_hash", () => {
      const hash = "a".repeat(64)
      const req = { payment_hash: hash }
      const result = checkedToNip47LookupInvoiceRequest(req)
      expect(result).toEqual({ payment_hash: hash, invoice: undefined })
    })

    it("should accept request with invoice", () => {
      const req = { invoice: "lnbc1000n1..." }
      const result = checkedToNip47LookupInvoiceRequest(req)
      expect(result).toEqual({ invoice: req.invoice, payment_hash: undefined })
    })

    it("should accept request with both fields", () => {
      const hash = "a".repeat(64)
      const req = { payment_hash: hash, invoice: "lnbc1000n1..." }
      const result = checkedToNip47LookupInvoiceRequest(req)
      expect(result).toEqual({ payment_hash: hash, invoice: req.invoice })
    })

    it("should reject request with neither field", () => {
      const req = {}
      const result = checkedToNip47LookupInvoiceRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toContain("must contain either")
    })

    it("should reject invalid payment_hash", () => {
      const req = { payment_hash: "invalid" }
      const result = checkedToNip47LookupInvoiceRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject invalid invoice", () => {
      const req = { invoice: "invalid" }
      const result = checkedToNip47LookupInvoiceRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
    })
  })

  describe("checkedToNip47ListTransactionsRequest", () => {
    it("should accept empty request", () => {
      const req = {}
      const result = checkedToNip47ListTransactionsRequest(req)
      expect(result).toMatchObject({
        from: undefined,
        until: undefined,
        limit: undefined,
        offset: undefined,
        unpaid: undefined,
        type: PD.Both,
      })
    })

    it("should accept request with all fields", () => {
      const req = {
        from: 1000000,
        until: 2000000,
        limit: 10,
        offset: 5,
        unpaid: true,
        type: "incoming",
      }
      const result = checkedToNip47ListTransactionsRequest(req)
      expect(result).toEqual({
        from: 1000000,
        until: 2000000,
        limit: 10,
        offset: 5,
        unpaid: true,
        type: "incoming",
      })
    })

    it("should set unpaid to undefined if false", () => {
      const req = { unpaid: false }
      const result = checkedToNip47ListTransactionsRequest(req)
      expect((result as any).unpaid).toBeUndefined()
    })

    it("should reject invalid from timestamp", () => {
      const req = { from: -1000 }
      const result = checkedToNip47ListTransactionsRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject invalid until timestamp", () => {
      const req = { until: -2000 }
      const result = checkedToNip47ListTransactionsRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject when from > until", () => {
      const req = { from: 2000000, until: 1000000 }
      const result = checkedToNip47ListTransactionsRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
      expect((result as ValidationError).message).toContain(
        "Until can't be smaller than from!",
      )
    })

    it("should accept when from < until", () => {
      const req = { from: 1000000, until: 2000000 }
      const result = checkedToNip47ListTransactionsRequest(req)
      expect(result).not.toBeInstanceOf(ValidationError)
    })

    it("should accept when from === until", () => {
      const req = { from: 1500000, until: 1500000 }
      const result = checkedToNip47ListTransactionsRequest(req)
      expect(result).not.toBeInstanceOf(ValidationError)
    })

    it("should reject invalid limit", () => {
      const req = { limit: -10 }
      const result = checkedToNip47ListTransactionsRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject decimal limit", () => {
      const req = { limit: 10.5 }
      const result = checkedToNip47ListTransactionsRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject invalid offset", () => {
      const req = { offset: -5 }
      const result = checkedToNip47ListTransactionsRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should reject invalid type", () => {
      const req = { type: "invalid" }
      const result = checkedToNip47ListTransactionsRequest(req)
      expect(result).toBeInstanceOf(ValidationError)
    })

    it("should accept 'incoming' type", () => {
      const req = { type: "incoming" }
      const result = checkedToNip47ListTransactionsRequest(req)
      expect((result as any).type).toBe(PD.Incoming)
    })

    it("should accept 'outgoing' type", () => {
      const req = { type: "outgoing" }
      const result = checkedToNip47ListTransactionsRequest(req)
      expect((result as any).type).toBe(PD.Outgoing)
    })
  })
})
