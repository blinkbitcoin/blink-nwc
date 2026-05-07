import { decode as decodeBolt11 } from "bolt11"

import NwcEventHandler from "@/app/nwc-event-handler"
import { getServerKeypair, NwcConnection } from "@/domain/connection"
import {
  Nip47Error,
  Nip47InternalError,
  Nip47Method,
  Nip47NotFoundError,
  Nip47OtherError,
  Nip47PaymentFailedError,
  Nip47QuotaExceededError,
  Nip47RestrictedError,
} from "@/domain/nostr"
import * as BlinkService from "@/services/core"
import {
  InvoiceBolt11,
  Nip47ListTransactionsResult,
  PaymentHash,
  Satoshis,
  UnixTimestamp,
} from "@/domain/index.types"
import { UserId, WalletId } from "@/domain/core/index.types"
import { SUPPORTED_NWC_NOTIFICATIONS, WALLET_ALIAS, WALLET_COLOR } from "@/config"
import {
  NwcNotificationType,
  toNotificationPermission,
} from "@/domain/nostr/notification-type"
import {
  InvoiceNotFoundError,
  PaymentTimedOutError,
  QuotaExceededError,
} from "@/services/core/errors"
import { PaymentState } from "@/domain/core/payment-state"

jest.mock("@/services/core", () => ({
  BlinkCoreService: jest.fn(),
}))

jest.mock("bolt11", () => ({
  decode: jest.fn(),
}))

jest.mock("@/services/logger", () => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(),
  }
  logger.child.mockReturnValue(logger)

  return {
    baseLogger: logger,
  }
})

jest.mock("@/services/tracing", () => ({
  wrapAsyncToRunInSpan: jest.fn((config) => config.fn),
  wrapAsyncFunctionsToRunInSpan: jest.fn((config) => config.fns),
  addAttributesToCurrentSpan: jest.fn(),
  recordExceptionInCurrentSpan: jest.fn(),
}))

const mockLogger = jest.requireMock("@/services/logger").baseLogger as {
  info: jest.Mock
  warn: jest.Mock
  error: jest.Mock
  child: jest.Mock
}

const mockTracing = jest.requireMock("@/services/tracing") as {
  addAttributesToCurrentSpan: jest.Mock
}

// These tests verify handler orchestration with a mocked BlinkCoreService.
// TODO: add end-to-end integration coverage against the real Blink Core boundary
// once that integration path is available in this repo.

describe("NwcEventHandler", () => {
  const methodPermissions = [
    Nip47Method.GetInfo,
    Nip47Method.GetBalance,
    Nip47Method.MakeInvoice,
    Nip47Method.PayInvoice,
    Nip47Method.LookupInvoice,
    Nip47Method.ListTransactions,
  ]
  const notificationPermissions = [
    toNotificationPermission(NwcNotificationType.PaymentSent),
    toNotificationPermission(NwcNotificationType.PaymentReceived),
  ] as const

  const mockConnection: NwcConnection = {
    id: "conn-123" as any,
    userId: "user-123" as UserId,
    accountId: "account-123" as any,
    walletId: "wallet-123" as WalletId,
    walletCurrency: "BTC",
    apiKey: "api-key-123" as any,
    apiKeyId: null,
    connectionSecret: "test-secret" as any,
    appPubkey: ("0".repeat(63) + "1") as any,
    alias: "Test Connection" as any,
    permissions: [...methodPermissions, ...notificationPermissions],
    notificationsEnabled: true,
    revoked: false,
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  let mockBlinkCoreService: jest.Mocked<ReturnType<typeof BlinkService.BlinkCoreService>>

  beforeEach(() => {
    jest.clearAllMocks()
    ;(decodeBolt11 as jest.Mock).mockReturnValue({
      millisatoshis: "500000",
      satoshis: 500,
    })

    mockBlinkCoreService = {
      getUsername: jest.fn().mockResolvedValue(null),
      getNodeInfo: jest.fn(),
      getBalance: jest.fn(),
      createInvoice: jest.fn(),
      createInvoiceAmountless: jest.fn(),
      payInvoice: jest.fn(),
      lookupInvoice: jest.fn(),
      listTransactions: jest.fn(),
      listInvoices: jest.fn(),
      fetchTransactionsInRange: jest.fn(),
      fetchInvoicesInRange: jest.fn(),
      fetchMergedTransactionsInRange: jest.fn(),
    } as any
    ;(BlinkService.BlinkCoreService as jest.Mock).mockReturnValue(mockBlinkCoreService)
  })

  describe("handle - Permission Checks", () => {
    it("should reject request when method not in permissions", async () => {
      const handler = NwcEventHandler()
      const restrictedConnection = {
        ...mockConnection,
        permissions: [Nip47Method.GetInfo],
      }

      const result = await handler.handle(
        { method: Nip47Method.PayInvoice, params: {} },
        restrictedConnection,
      )
      expect(result).toBeInstanceOf(Nip47Error)
      if (!(result instanceof Nip47Error)) {
        return
      }
      expect(result).toBeInstanceOf(Nip47RestrictedError)
      expect(result.code).toContain("RESTRICTED")
      expect(result.message).toContain("does not have permission")
    })

    it("should allow request when method is in permissions", async () => {
      const handler = NwcEventHandler()
      mockBlinkCoreService.getNodeInfo.mockResolvedValue({
        network: "mainnet" as any,
        blockHeight: 800000 as any,
        blockHash: "0".repeat(64) as any,
      })

      const result = await handler.handle(
        { method: Nip47Method.GetInfo, params: {} },
        mockConnection,
      )

      expect(result).not.toBeInstanceOf(Nip47Error)
      const serverKeypair = getServerKeypair()

      expect(result).toHaveProperty("alias", WALLET_ALIAS)
      expect(result).toHaveProperty("color", WALLET_COLOR)
      expect(result).toHaveProperty("pubkey", serverKeypair.pubkey)
      expect(result).toHaveProperty("network", "mainnet")
      expect(result).toHaveProperty("block_height", 800000)
      expect(result).toHaveProperty(
        "block_hash",
        "0000000000000000000000000000000000000000000000000000000000000000",
      )
      expect(result).toHaveProperty("methods", methodPermissions)
      expect(result).toHaveProperty("notifications", SUPPORTED_NWC_NOTIFICATIONS)
    })

    it("should reject any request with empty permissions array", async () => {
      const handler = NwcEventHandler()
      const noPermConnection = {
        ...mockConnection,
        permissions: [],
      }

      const result = await handler.handle(
        { method: Nip47Method.GetInfo, params: {} },
        noPermConnection,
      )
      expect(result).toBeInstanceOf(Nip47Error)
      if (!(result instanceof Nip47Error)) {
        return
      }
      expect(result).toBeInstanceOf(Nip47RestrictedError)
      expect(result.code).toContain("RESTRICTED")
      expect(result.message).toContain("does not have permission")
    })

    it("should reject expired connections even when called directly", async () => {
      const handler = NwcEventHandler()
      const expiredConnection = {
        ...mockConnection,
        expiresAt: new Date("2026-04-14T00:00:00.000Z"),
      }

      const result = await handler.handle(
        { method: Nip47Method.GetInfo, params: {} },
        expiredConnection,
      )

      expect(result).toBeInstanceOf(Nip47Error)
      if (!(result instanceof Nip47Error)) {
        return
      }
      expect(result.code).toContain("UNAUTHORIZED")
      expect(result.message).toBe("Connection has expired")
    })

    it("should reject revoked connections even when called directly", async () => {
      const handler = NwcEventHandler()
      const revokedConnection = {
        ...mockConnection,
        revoked: true,
      }

      const result = await handler.handle(
        { method: Nip47Method.GetInfo, params: {} },
        revokedConnection,
      )

      expect(result).toBeInstanceOf(Nip47Error)
      if (!(result instanceof Nip47Error)) {
        return
      }
      expect(result.code).toContain("UNAUTHORIZED")
      expect(result.message).toBe("Connection has been revoked")
    })
  })

  describe("getInfo", () => {
    it("should prefer Blink username when available", async () => {
      const handler = NwcEventHandler()
      mockBlinkCoreService.getUsername.mockResolvedValue("alice")
      mockBlinkCoreService.getNodeInfo.mockResolvedValue({
        network: "mainnet" as any,
        blockHeight: 800000 as any,
        blockHash: "0".repeat(64) as any,
      })

      const result = await handler.handle(
        { method: Nip47Method.GetInfo, params: {} },
        mockConnection,
      )

      expect(result).toMatchObject({
        alias: "alice",
      })
    })

    it("should return node info with supported methods", async () => {
      const handler = NwcEventHandler()
      mockBlinkCoreService.getNodeInfo.mockResolvedValue({
        network: "mainnet" as any,
        blockHeight: 800000 as any,
        blockHash: "0".repeat(64) as any,
      })

      const result = await handler.handle(
        { method: Nip47Method.GetInfo, params: {} },
        mockConnection,
      )

      expect(result).toMatchObject({
        alias: expect.any(String),
        color: expect.any(String),
        pubkey: expect.any(String),
        network: "mainnet",
        block_height: 800000,
        block_hash: "0".repeat(64),
        methods: methodPermissions,
        notifications: SUPPORTED_NWC_NOTIFICATIONS,
      })
    })

    it("should return only the granted notification permissions", async () => {
      const handler = NwcEventHandler()
      mockBlinkCoreService.getNodeInfo.mockResolvedValue({
        network: "mainnet" as any,
        blockHeight: 800000 as any,
        blockHash: "0".repeat(64) as any,
      })

      const result = await handler.handle(
        { method: Nip47Method.GetInfo, params: {} },
        {
          ...mockConnection,
          permissions: [
            ...methodPermissions,
            toNotificationPermission(NwcNotificationType.PaymentSent),
          ],
          notificationsEnabled: false,
        },
      )

      expect(result).toMatchObject({
        methods: methodPermissions,
        notifications: [NwcNotificationType.PaymentSent],
      })
    })

    it("should only return granted notifications", async () => {
      const handler = NwcEventHandler()
      mockBlinkCoreService.getNodeInfo.mockResolvedValue({
        network: "mainnet" as any,
        blockHeight: 800000 as any,
        blockHash: "0".repeat(64) as any,
      })

      const result = await handler.handle(
        { method: Nip47Method.GetInfo, params: {} },
        {
          ...mockConnection,
          permissions: [...methodPermissions, "notifications:payment_received"],
        },
      )

      expect(result).toMatchObject({
        methods: methodPermissions,
        notifications: ["payment_received"],
      })
    })

    it("should return error when node info fetch fails", async () => {
      const handler = NwcEventHandler()
      mockBlinkCoreService.getNodeInfo.mockResolvedValue(
        new Error("Failed to fetch node info"),
      )

      const result = await handler.handle(
        { method: Nip47Method.GetInfo, params: {} },
        mockConnection,
      )

      expect(result).toBeInstanceOf(Nip47Error)
      if (!(result instanceof Nip47Error)) {
        return
      }
      expect(result).toBeInstanceOf(Nip47InternalError)
      expect(result.code).toContain("INTERNAL")
      expect(result.message).toContain("Failed to fetch node info")
    })
  })

  describe("getBalance", () => {
    it("should return balance in millisatoshis", async () => {
      const handler = NwcEventHandler()
      mockBlinkCoreService.getBalance.mockResolvedValue({
        balance: 1000 as Satoshis,
      })

      const result = await handler.handle(
        { method: Nip47Method.GetBalance, params: {} },
        mockConnection,
      )

      expect(result).toEqual({
        balance: 1000000,
      })
    })

    it("should return 0 for empty balance", async () => {
      const handler = NwcEventHandler()
      mockBlinkCoreService.getBalance.mockResolvedValue({
        balance: 0 as Satoshis,
      })

      const result = await handler.handle(
        { method: Nip47Method.GetBalance, params: {} },
        mockConnection,
      )

      expect(result).toEqual({
        balance: 0,
      })
    })

    it("should handle balance fetch error", async () => {
      const handler = NwcEventHandler()
      mockBlinkCoreService.getBalance.mockResolvedValue(
        new Error("Balance unavailable") as any,
      )

      const result = await handler.handle(
        { method: Nip47Method.GetBalance, params: {} },
        mockConnection,
      )

      expect(result).toBeInstanceOf(Nip47Error)
      if (!(result instanceof Nip47Error)) {
        return
      }
      expect(result).toBeInstanceOf(Nip47OtherError)
      expect(result.code).toContain("OTHER")
      expect(result.message).toContain("Unexpected error occurred")
    })

    it("should convert large balance correctly", async () => {
      const handler = NwcEventHandler()
      mockBlinkCoreService.getBalance.mockResolvedValue({
        balance: 21000000 as Satoshis,
      })

      const result = await handler.handle(
        { method: Nip47Method.GetBalance, params: {} },
        mockConnection,
      )

      expect(result).toEqual({
        balance: 21000000000,
      })
    })
  })

  describe("makeInvoice", () => {
    it("should create invoice with amount", async () => {
      const handler = NwcEventHandler()
      const now = Math.floor(Date.now() / 1000)
      const testDescription = "Test invoice"
      mockBlinkCoreService.createInvoice.mockResolvedValue({
        paymentRequest: "lnbc1..." as any,
        paymentHash: "hash123" as any,
        createdAt: now as any,
        satoshis: 10 as Satoshis,
      })

      const result = await handler.handle(
        {
          method: Nip47Method.MakeInvoice,
          params: {
            amount: 10000,
            description: testDescription,
          },
        },
        mockConnection,
      )

      expect(result).toMatchObject({
        type: "incoming",
        state: PaymentState.PENDING,
        invoice: "lnbc1...",
        payment_hash: "hash123",
        amount: 10000,
        created_at: now,
        expires_at: now + 86400,
      })

      expect(mockBlinkCoreService.createInvoice).toHaveBeenCalledWith(
        mockConnection.apiKey,
        mockConnection.walletId,
        10, // amount sat
        testDescription,
        undefined, // description_hash
        undefined, // expiry
      )
    })

    it("should create amountless invoice", async () => {
      const handler = NwcEventHandler()
      const now = Math.floor(Date.now() / 1000)
      const testDescription = "Amountless invoice"
      mockBlinkCoreService.createInvoiceAmountless.mockResolvedValue({
        paymentRequest: "lnbc1..." as any,
        paymentHash: "hash456" as any,
        createdAt: now as any,
        satoshis: 0 as Satoshis,
      })

      const result = await handler.handle(
        {
          method: Nip47Method.MakeInvoice,
          params: {
            description: testDescription,
          },
        },
        mockConnection,
      )

      expect(result).toMatchObject({
        type: "incoming",
        state: PaymentState.PENDING,
        invoice: "lnbc1...",
        payment_hash: "hash456",
      })

      expect(mockBlinkCoreService.createInvoiceAmountless).toHaveBeenCalledWith(
        mockConnection.apiKey,
        mockConnection.walletId,
        testDescription,
        undefined, // expiry
      )
    })

    it("should handle validation error", async () => {
      const handler = NwcEventHandler()

      const result = await handler.handle(
        {
          method: Nip47Method.MakeInvoice,
          params: {
            amount: -100, // invalid negative amount
          },
        },
        mockConnection,
      )

      expect(result).toBeInstanceOf(Nip47Error)
      if (!(result instanceof Nip47Error)) {
        return
      }
      expect(result).toBeInstanceOf(Nip47OtherError)
      expect(result.code).toContain("OTHER")
      expect(result.message).toContain("Amount must be a non-negative integer")
    })

    it("should include description_hash if provided", async () => {
      const handler = NwcEventHandler()
      const now = Math.floor(Date.now() / 1000)

      mockBlinkCoreService.createInvoice.mockResolvedValue({
        paymentRequest: "lnbc1..." as any,
        paymentHash: "hash789" as any,
        createdAt: now as any,
        satoshis: 1 as Satoshis,
      })

      const result = await handler.handle(
        {
          method: Nip47Method.MakeInvoice,
          params: {
            amount: 1000,
            description_hash: "a".repeat(64),
          },
        },
        mockConnection,
      )

      expect(mockBlinkCoreService.createInvoice).toHaveBeenCalledWith(
        "api-key-123",
        "wallet-123",
        1, // amount, satoshis
        undefined, // memo
        expect.stringMatching(/^[a-f0-9]{64}$/), //desc hash
        undefined, // expiry
      )

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Nip47Error) {
        return
      }
      expect(result).toMatchObject({
        type: "incoming",
        state: PaymentState.PENDING,
        invoice: "lnbc1..." as InvoiceBolt11,
        description: undefined,
        description_hash: "a".repeat(64),
        payment_hash: "hash789" as PaymentHash,
        amount: 1000,
        fees_paid: 0,
        created_at: now,
        // default expiry
        expires_at: now + 24 * 60 * 60,
      })
    })

    it("should reject non-whole-satoshi msat amounts", async () => {
      const handler = NwcEventHandler()

      const result = await handler.handle(
        {
          method: Nip47Method.MakeInvoice,
          params: {
            amount: 1500,
          },
        },
        mockConnection,
      )

      expect(result).toBeInstanceOf(Nip47Error)
      if (!(result instanceof Nip47Error)) {
        return
      }

      expect(result).toBeInstanceOf(Nip47OtherError)
      expect(result.message).toContain("multiple of 1000")
      expect(mockBlinkCoreService.createInvoice).not.toHaveBeenCalled()
    })

    it("should use the invoice-derived expiry for 30-second expiries", async () => {
      const handler = NwcEventHandler()
      const now = Math.floor(Date.now() / 1000)

      mockBlinkCoreService.createInvoice.mockResolvedValue({
        paymentRequest: "lnbc1..." as any,
        paymentHash: "hash-30" as any,
        createdAt: now as any,
        expiresAt: (now + 30) as UnixTimestamp,
        satoshis: 10 as Satoshis,
      })

      const result = await handler.handle(
        {
          method: Nip47Method.MakeInvoice,
          params: {
            amount: 10000,
            expiry: 30,
          },
        },
        mockConnection,
      )

      expect(mockBlinkCoreService.createInvoice).toHaveBeenCalledWith(
        mockConnection.apiKey,
        mockConnection.walletId,
        10,
        undefined,
        undefined,
        0.5,
      )
      expect(result).toMatchObject({
        payment_hash: "hash-30",
        expires_at: now + 30,
      })
    })

    it("should use the invoice-derived expiry for 90-second expiries", async () => {
      const handler = NwcEventHandler()
      const now = Math.floor(Date.now() / 1000)

      mockBlinkCoreService.createInvoice.mockResolvedValue({
        paymentRequest: "lnbc1..." as any,
        paymentHash: "hash-90" as any,
        createdAt: now as any,
        expiresAt: (now + 90) as UnixTimestamp,
        satoshis: 10 as Satoshis,
      })

      const result = await handler.handle(
        {
          method: Nip47Method.MakeInvoice,
          params: {
            amount: 10000,
            expiry: 90,
          },
        },
        mockConnection,
      )

      expect(mockBlinkCoreService.createInvoice).toHaveBeenCalledWith(
        mockConnection.apiKey,
        mockConnection.walletId,
        10,
        undefined,
        undefined,
        1.5,
      )
      expect(result).toMatchObject({
        payment_hash: "hash-90",
        expires_at: now + 90,
      })
    })
  })

  describe("payInvoice", () => {
    it("should pay invoice successfully", async () => {
      const handler = NwcEventHandler()

      mockBlinkCoreService.payInvoice.mockResolvedValue({
        preimage: "paid-hash" as any,
        feesPaid: 5 as Satoshis,
      })

      const result = await handler.handle(
        {
          method: Nip47Method.PayInvoice,
          params: {
            invoice: "lnbc500n1...",
          },
        },
        mockConnection,
      )

      expect(result).toMatchObject({
        preimage: "paid-hash",
        fees_paid: 5000, // 5 sats = 5000 msats
      })

      expect(mockTracing.addAttributesToCurrentSpan).not.toHaveBeenCalledWith(
        expect.objectContaining({
          "payment.preimage": "paid-hash",
        }),
      )
    })

    it("should handle payment failed error", async () => {
      const handler = NwcEventHandler()

      mockBlinkCoreService.payInvoice.mockResolvedValue(
        new Error("Payment failed") as any,
      )

      const result = await handler.handle(
        {
          method: Nip47Method.PayInvoice,
          params: {
            invoice: "lnbc500n1...",
          },
        },
        mockConnection,
      )

      expect(result).toBeInstanceOf(Nip47Error)
    })

    it("should validate invoice format", async () => {
      const handler = NwcEventHandler()

      const result = await handler.handle(
        {
          method: Nip47Method.PayInvoice,
          params: {
            invoice: "invalid-invoice",
          },
        },
        mockConnection,
      )

      expect(result).toBeInstanceOf(Nip47Error)
    })

    it("should reject invoice when BOLT11 decode fails", async () => {
      const handler = NwcEventHandler()
      ;(decodeBolt11 as jest.Mock).mockImplementation(() => {
        throw new Error("decode failed")
      })

      const result = await handler.handle(
        {
          method: Nip47Method.PayInvoice,
          params: {
            invoice: "lnbc1invalid" as InvoiceBolt11,
          },
        },
        mockConnection,
      )

      expect(result).toBeInstanceOf(Nip47Error)
      if (!(result instanceof Nip47Error)) {
        return
      }

      expect(result).toBeInstanceOf(Nip47OtherError)
      expect(result.message).toBe("Invalid invoice")
      expect(mockBlinkCoreService.payInvoice).not.toHaveBeenCalled()
    })

    it("should convert fees to millisatoshis", async () => {
      const handler = NwcEventHandler()

      mockBlinkCoreService.payInvoice.mockResolvedValue({
        preimage: "hash" as any,
        feesPaid: 10 as Satoshis,
      })

      const result = await handler.handle(
        {
          method: Nip47Method.PayInvoice,
          params: {
            invoice: "lnbc1000n1...",
          },
        },
        mockConnection,
      )

      expect(result).toMatchObject({
        fees_paid: 10000, // 10 sats = 10,000 msats
      })
    })

    it("should pay amountless invoice when amount is provided", async () => {
      const handler = NwcEventHandler()
      ;(decodeBolt11 as jest.Mock).mockReturnValue({})

      mockBlinkCoreService.payInvoice.mockResolvedValue({
        preimage: "hash" as any,
        feesPaid: 0 as Satoshis,
      })

      const result = await handler.handle(
        {
          method: Nip47Method.PayInvoice,
          params: {
            invoice: "lnbc1amountless...",
            amount: 25000,
          },
        },
        mockConnection,
      )

      expect(mockBlinkCoreService.payInvoice).toHaveBeenCalledWith(
        mockConnection.apiKey,
        mockConnection.walletId,
        "lnbc1amountless...",
        25,
      )
      expect(result).toMatchObject({
        preimage: "hash",
        fees_paid: 0,
      })
    })

    it("should reject amount overrides that are not whole satoshis", async () => {
      const handler = NwcEventHandler()
      ;(decodeBolt11 as jest.Mock).mockReturnValue({})

      const result = await handler.handle(
        {
          method: Nip47Method.PayInvoice,
          params: {
            invoice: "lnbc1amountless...",
            amount: 1500,
          },
        },
        mockConnection,
      )

      expect(result).toBeInstanceOf(Nip47Error)
      if (!(result instanceof Nip47Error)) {
        return
      }

      expect(result).toBeInstanceOf(Nip47OtherError)
      expect(result.message).toContain("multiple of 1000")
      expect(mockBlinkCoreService.payInvoice).not.toHaveBeenCalled()
    })

    it("should reject amountless invoice when amount is missing", async () => {
      const handler = NwcEventHandler()
      ;(decodeBolt11 as jest.Mock).mockReturnValue({})

      const result = await handler.handle(
        {
          method: Nip47Method.PayInvoice,
          params: {
            invoice: "lnbc1amountless...",
          },
        },
        mockConnection,
      )

      expect(result).toBeInstanceOf(Nip47Error)
      if (!(result instanceof Nip47Error)) {
        return
      }

      expect(result).toBeInstanceOf(Nip47OtherError)
      expect(result.message).toBe("Amount is required for amountless invoices")
      expect(mockBlinkCoreService.payInvoice).not.toHaveBeenCalled()
    })

    it("should map budget rejections to QUOTA_EXCEEDED", async () => {
      const handler = NwcEventHandler()

      mockBlinkCoreService.payInvoice.mockResolvedValue(
        new QuotaExceededError("daily budget exceeded") as any,
      )

      const result = await handler.handle(
        {
          method: Nip47Method.PayInvoice,
          params: {
            invoice: "lnbc1000n1...",
          },
        },
        mockConnection,
      )

      expect(result).toBeInstanceOf(Nip47Error)
      if (!(result instanceof Nip47Error)) {
        return
      }

      expect(result).toBeInstanceOf(Nip47QuotaExceededError)
      expect(result.code).toBe("QUOTA_EXCEEDED")
      expect(result.message).toBe("daily budget exceeded")
    })

    it("should map payment timeouts to PAYMENT_FAILED", async () => {
      const handler = NwcEventHandler()

      mockBlinkCoreService.payInvoice.mockResolvedValue(
        new PaymentTimedOutError("payment attempt timed out") as any,
      )

      const result = await handler.handle(
        {
          method: Nip47Method.PayInvoice,
          params: {
            invoice: "lnbc1000n1...",
          },
        },
        mockConnection,
      )

      expect(result).toBeInstanceOf(Nip47Error)
      if (!(result instanceof Nip47Error)) {
        return
      }

      expect(result).toBeInstanceOf(Nip47PaymentFailedError)
      expect(result.code).toBe("PAYMENT_FAILED")
      expect(result.message).toBe("payment attempt timed out")
    })
  })

  describe("lookupInvoice", () => {
    it("should lookup invoice by payment_hash", async () => {
      const handler = NwcEventHandler()
      const now = Math.floor(Date.now() / 1000)
      const paymentHash = "0".repeat(64)
      mockBlinkCoreService.lookupInvoice.mockResolvedValue({
        type: "incoming" as any,
        invoice: "lnbc1..." as any,
        state: PaymentState.PAID,
        description: "Test payment" as any,
        paymentHash: paymentHash as any,
        amount: 100 as Satoshis,
        feesPaid: 0 as Satoshis,
        createdAt: now as any,
        settledAt: (now + 100) as any,
      })

      const result = await handler.handle(
        {
          method: Nip47Method.LookupInvoice,
          params: {
            payment_hash: paymentHash as any,
          },
        },
        mockConnection,
      )

      expect(result).toMatchObject({
        type: "incoming",
        invoice: "lnbc1...",
        state: PaymentState.PAID,
        payment_hash: paymentHash,
        description: "Test payment",
        amount: 100000, // 100 sats = 100,000 msats
        created_at: now,
        settled_at: now + 100,
      })
    })

    it("should lookup invoice by invoice bolt11", async () => {
      const handler = NwcEventHandler()
      const now = Math.floor(Date.now() / 1000) as UnixTimestamp
      const paymentHash = ("0".repeat(63) + 1) as PaymentHash
      mockBlinkCoreService.lookupInvoice.mockResolvedValue({
        type: "incoming",
        invoice: "lnbc50n1..." as any,
        description: "Test payment" as any,
        state: PaymentState.PENDING,
        paymentHash: paymentHash as any,
        amount: 10 as Satoshis,
        feesPaid: 0 as any,
        createdAt: now as any,
      })

      const result = await handler.handle(
        {
          method: Nip47Method.LookupInvoice,
          params: {
            invoice: "lnbc50n1...",
          },
        },
        mockConnection,
      )

      expect(mockBlinkCoreService.lookupInvoice).toHaveBeenCalledWith(
        "api-key-123",
        "wallet-123",
        undefined, // payment hash
        "lnbc50n1...",
      )

      expect(result).toMatchObject({
        type: "incoming",
        invoice: "lnbc50n1...",
        state: PaymentState.PENDING,
        payment_hash: paymentHash,
        description: "Test payment",
        amount: 10000,
        fees_paid: 0,
        created_at: now,
      })
    })

    it("should handle not found error", async () => {
      const handler = NwcEventHandler()

      mockBlinkCoreService.lookupInvoice.mockResolvedValue(
        new InvoiceNotFoundError("Not found") as any,
      )
      const nonExistentPaymentHash = "0".repeat(64)
      const result = await handler.handle(
        {
          method: Nip47Method.LookupInvoice,
          params: {
            payment_hash: nonExistentPaymentHash as any,
          },
        },
        mockConnection,
      )
      expect(result).toBeInstanceOf(Nip47Error)
      if (!(result instanceof Nip47Error)) {
        return
      }
      expect(result).toBeInstanceOf(Nip47NotFoundError)
      expect(result.code).toBe("NOT_FOUND")
      expect(result.message).toBe("Invoice not found")
    })
  })

  describe("listTransactions", () => {
    it("should list transactions without filters", async () => {
      const handler = NwcEventHandler()
      const now = Math.floor(Date.now() / 1000)

      mockBlinkCoreService.fetchTransactionsInRange.mockResolvedValue([
        {
          type: "incoming",
          paymentHash: "tx1" as any,
          amount: 100 as Satoshis,
          feesPaid: 0 as Satoshis,
          createdAt: (now - 100) as any,
        },
        {
          type: "outgoing",
          paymentHash: "tx2" as any,
          amount: 50 as Satoshis,
          feesPaid: 1 as Satoshis,
          createdAt: (now - 200) as any,
        },
      ])

      const result = await handler.handle(
        {
          method: Nip47Method.ListTransactions,
          params: {},
        },
        mockConnection,
      )

      expect(result).toMatchObject({
        transactions: [
          {
            type: "incoming",
            payment_hash: "tx1",
            amount: 100000,
            fees_paid: 0,
          },
          {
            type: "outgoing",
            payment_hash: "tx2",
            amount: 50000,
            fees_paid: 1000,
          },
        ],
      })
    })

    it("should accept requests without a params object", async () => {
      const handler = NwcEventHandler()

      mockBlinkCoreService.fetchTransactionsInRange.mockResolvedValue([])

      const result = await handler.handle(
        {
          method: Nip47Method.ListTransactions,
        },
        mockConnection,
      )

      expect(result).toMatchObject({ transactions: [] })
      expect(mockBlinkCoreService.fetchTransactionsInRange).toHaveBeenCalledWith(
        mockConnection.apiKey,
        mockConnection.walletId,
        0,
        expect.any(String),
        0,
        10,
        undefined,
      )
    })

    it("should filter by from/until timestamps", async () => {
      const handler = NwcEventHandler()

      mockBlinkCoreService.fetchTransactionsInRange.mockResolvedValue([])

      await handler.handle(
        {
          method: Nip47Method.ListTransactions,
          params: {
            from: 1000000,
            until: 2000000,
          },
        },
        mockConnection,
      )

      expect(mockBlinkCoreService.fetchTransactionsInRange).toHaveBeenCalledWith(
        mockConnection.apiKey,
        mockConnection.walletId,
        1000000,
        expect.any(String),
        0,
        10,
        undefined,
      )
    })

    it("should apply limit and offset", async () => {
      const handler = NwcEventHandler()
      const now = Math.floor(Date.now() / 1000)

      mockBlinkCoreService.fetchTransactionsInRange.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          type: "incoming",
          paymentHash: `tx${i}` as any,
          amount: 100 as Satoshis,
          feesPaid: 0 as Satoshis,
          createdAt: (now - i * 100) as any,
        })),
      )

      const result = await handler.handle(
        {
          method: Nip47Method.ListTransactions,
          params: {
            limit: 5,
            offset: 0,
          },
        },
        mockConnection,
      )

      expect((result as any).transactions).toHaveLength(5)
    })

    it("should cap limit at 100", async () => {
      const handler = NwcEventHandler()

      mockBlinkCoreService.fetchTransactionsInRange.mockResolvedValue([])

      await handler.handle(
        {
          method: Nip47Method.ListTransactions,
          params: {
            limit: 500,
          },
        },
        mockConnection,
      )

      expect(mockBlinkCoreService.fetchTransactionsInRange).toHaveBeenCalledWith(
        mockConnection.apiKey,
        mockConnection.walletId,
        0,
        expect.any(String),
        0,
        100,
        undefined,
      )
    })

    it("should filter by type (incoming/outgoing)", async () => {
      const handler = NwcEventHandler()

      mockBlinkCoreService.fetchTransactionsInRange.mockResolvedValue([])

      await handler.handle(
        {
          method: Nip47Method.ListTransactions,
          params: {
            type: "incoming",
          },
        },
        mockConnection,
      )

      expect(mockBlinkCoreService.fetchTransactionsInRange).toHaveBeenCalledWith(
        mockConnection.apiKey,
        mockConnection.walletId,
        0,
        expect.any(String),
        0,
        10,
        "incoming",
      )
    })

    it("should apply pagination after merging paid and unpaid results", async () => {
      const handler = NwcEventHandler()

      mockBlinkCoreService.fetchMergedTransactionsInRange.mockResolvedValue([
        {
          type: "incoming",
          paymentHash: "inv-middle-1" as any,
          amount: 25 as Satoshis,
          feesPaid: 0 as Satoshis,
          createdAt: 300 as any,
        },
        {
          type: "incoming",
          paymentHash: "inv-middle-2" as any,
          amount: 10 as Satoshis,
          feesPaid: 0 as Satoshis,
          createdAt: 200 as any,
        },
      ])

      const result = await handler.handle(
        {
          method: Nip47Method.ListTransactions,
          params: {
            unpaid: true,
            offset: 1,
            limit: 2,
          },
        },
        mockConnection,
      )

      expect(result).toMatchObject({
        transactions: [
          { payment_hash: "inv-middle-1" },
          { payment_hash: "inv-middle-2" },
        ],
      })
      expect((result as Nip47ListTransactionsResult).transactions).toHaveLength(2)
      expect(mockBlinkCoreService.fetchMergedTransactionsInRange).toHaveBeenCalledWith(
        mockConnection.apiKey,
        mockConnection.walletId,
        0,
        expect.any(String),
        1,
        2,
        undefined,
      )
    })

    it("should skip invoice fetches for unpaid outgoing queries", async () => {
      const handler = NwcEventHandler()

      mockBlinkCoreService.fetchTransactionsInRange.mockResolvedValue([])

      const result = await handler.handle(
        {
          method: Nip47Method.ListTransactions,
          params: {
            unpaid: true,
            type: "outgoing",
          },
        },
        mockConnection,
      )

      expect(result).toMatchObject({ transactions: [] })
      expect(mockBlinkCoreService.fetchTransactionsInRange).toHaveBeenCalledWith(
        mockConnection.apiKey,
        mockConnection.walletId,
        0,
        expect.any(String),
        0,
        10,
        "outgoing",
      )
      expect(mockBlinkCoreService.fetchInvoicesInRange).not.toHaveBeenCalled()
    })
  })

  describe("Unsupported Methods", () => {
    it("should return NOT_IMPLEMENTED for unknown methods", async () => {
      const handler = NwcEventHandler()
      const method = "unknown_method" as any
      const result = await handler.handle({ method, params: {} }, mockConnection)
      expect(result).toBeInstanceOf(Nip47Error)
      if (!(result instanceof Nip47Error)) {
        return
      }
      expect(result.code).toBe("NOT_IMPLEMENTED")
      expect(result.message).toBe(`Unsupported method: ${method}`)
    })
  })

  describe("logging", () => {
    it("should log request and response metadata", async () => {
      const handler = NwcEventHandler()
      mockBlinkCoreService.getNodeInfo.mockResolvedValue({
        network: "mainnet" as any,
        blockHeight: 800000 as any,
        blockHash: "0".repeat(64) as any,
      })

      await handler.handle({ method: Nip47Method.GetInfo, params: {} }, mockConnection)

      expect(mockLogger.info).toHaveBeenCalledWith({ params: {} }, "received NWC request")
      expect(mockLogger.info).toHaveBeenCalledWith(
        { response: { result_type: Nip47Method.GetInfo } },
        "completed NWC request",
      )
    })

    it("should redact invoice values from request logs", async () => {
      const handler = NwcEventHandler()

      mockBlinkCoreService.payInvoice.mockResolvedValue({
        preimage: "hash" as any,
        feesPaid: 1 as Satoshis,
      })

      await handler.handle(
        {
          method: Nip47Method.PayInvoice,
          params: {
            invoice: "lnbc1000n1...",
          },
        },
        mockConnection,
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        { params: { amount: undefined, has_invoice: true } },
        "received NWC request",
      )
    })

    it("should log allowlisted make_invoice params instead of raw descriptions", async () => {
      const handler = NwcEventHandler()
      const now = Math.floor(Date.now() / 1000)

      mockBlinkCoreService.createInvoice.mockResolvedValue({
        paymentRequest: "lnbc1..." as any,
        paymentHash: "hash-log" as any,
        createdAt: now as any,
        satoshis: 10 as Satoshis,
      })

      await handler.handle(
        {
          method: Nip47Method.MakeInvoice,
          params: {
            amount: 10000,
            description: "sensitive memo",
            expiry: 60,
          },
        },
        mockConnection,
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          params: {
            amount: 10000,
            expiry: 60,
            has_description: true,
            has_description_hash: false,
          },
        },
        "received NWC request",
      )
    })
  })
})
