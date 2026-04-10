import { finalizeEvent } from "nostr-tools"

import { encrypt } from "@/domain/nostr"
import { NwcAppPubkey, Nip47Notification } from "@/domain/index.types"
import { NotificationService } from "@/services/nwc-notifications"

jest.mock("@/domain/connection", () => ({
  getServerKeypair: () => ({
    pubkey: "a".repeat(64),
    privkey: "b".repeat(64),
  }),
}))

jest.mock("@/domain/nostr", () => ({
  encrypt: jest.fn().mockResolvedValue("encrypted_content"),
  hexToBytes: jest.fn().mockReturnValue(new Uint8Array(32)),
}))

jest.mock("@/services/tracing", () => ({
  recordExceptionInCurrentSpan: jest.fn(),
}))

jest.mock("@/domain/errors", () => ({
  parseErrorFromUnknown: jest.fn((e: unknown) => e),
}))

const mockPublish = jest.fn()

jest.mock("nostr-tools", () => ({
  finalizeEvent: jest.fn().mockReturnValue({
    id: "event-id",
    kind: 23197,
    content: "encrypted_content",
    tags: [["p", "c".repeat(64)]],
    created_at: 1000,
    pubkey: "a".repeat(64),
    sig: "sig",
  }),
}))

const mockedFinalizeEvent = jest.mocked(finalizeEvent)
const mockedEncrypt = jest.mocked(encrypt)

describe("NotificationService", () => {
  const mockRelay = { publish: mockPublish } as any
  const appPubkey = "c".repeat(64) as NwcAppPubkey

  const mockNotification: Nip47Notification = {
    notification_type: "payment_received",
    notification: {
      type: "incoming",
      invoice: "lnbc100..." as any,
      payment_hash: "d".repeat(64) as any,
      amount: 100000 as any,
      fees_paid: 0 as any,
      created_at: 1000 as any,
      settled_at: 1001 as any,
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockPublish.mockResolvedValue(undefined)
  })

  it("should publish notification event to relay", async () => {
    const service = NotificationService(mockRelay)
    const result = await service.sendNotification(mockNotification, appPubkey)

    expect(result).toBe(true)
    expect(mockPublish).toHaveBeenCalledTimes(1)
  })

  it("should create event with kind 23197", async () => {
    const service = NotificationService(mockRelay)
    await service.sendNotification(mockNotification, appPubkey)

    const templateArg = mockedFinalizeEvent.mock.calls[0][0]
    expect(templateArg.kind).toBe(23197)
  })

  it("should tag event with recipient pubkey", async () => {
    const service = NotificationService(mockRelay)
    await service.sendNotification(mockNotification, appPubkey)

    const templateArg = mockedFinalizeEvent.mock.calls[0][0]
    expect(templateArg.tags).toEqual([["p", appPubkey]])
  })

  it("should encrypt content with NIP-44", async () => {
    const service = NotificationService(mockRelay)
    await service.sendNotification(mockNotification, appPubkey)

    expect(mockedEncrypt).toHaveBeenCalledWith(
      expect.objectContaining({ pubkey: "a".repeat(64) }),
      appPubkey,
      JSON.stringify(mockNotification),
      "nip44_v2",
    )
  })

  it("should return false on publish error", async () => {
    mockPublish.mockRejectedValue(new Error("relay error"))
    const service = NotificationService(mockRelay)
    const result = await service.sendNotification(mockNotification, appPubkey)

    expect(result).toBe(false)
  })

  it("should set created_at to current unix timestamp", async () => {
    const now = Math.floor(Date.now() / 1000)
    const service = NotificationService(mockRelay)
    await service.sendNotification(mockNotification, appPubkey)

    const templateArg = mockedFinalizeEvent.mock.calls[0][0]
    expect(templateArg.created_at).toBeGreaterThanOrEqual(now - 1)
    expect(templateArg.created_at).toBeLessThanOrEqual(now + 1)
  })
})
