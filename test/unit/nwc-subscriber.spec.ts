const mockPublish = jest.fn()
const mockConnect = jest.fn()
const mockSubscribe = jest.fn()
const mockVerifyEvent = jest.fn()
const mockFinalizeEvent = jest.fn()
const mockFindByPubkey = jest.fn()
const mockUpdateLastUsed = jest.fn()
const mockDecrypt = jest.fn()
const mockEncrypt = jest.fn()
const mockHandle = jest.fn()
const mockSleep = jest.fn()
const mockConnectionsRepositoryFactory = jest.fn()
const mockProcessedNwcRequestsRepositoryFactory = jest.fn()
const mockIsProcessed = jest.fn()
const mockMarkProcessed = jest.fn()
const mockPruneExpired = jest.fn()

const mockConnectionsRepository = {
  findByPubkey: mockFindByPubkey,
  updateLastUsed: mockUpdateLastUsed,
}

const mockProcessedNwcRequestsRepository = {
  isProcessed: mockIsProcessed,
  markProcessed: mockMarkProcessed,
  pruneExpired: mockPruneExpired,
}

let relayInstance: MockRelay | undefined
let currentSubscription:
  | { onevent?: (event: unknown) => void; close: jest.Mock }
  | undefined

class MockRelay {
  connected = true
  onclose: null | (() => void) = null
  publish = mockPublish
  connect = mockConnect
  subscribe = mockSubscribe
  close = jest.fn(() => {
    this.onclose?.()
  })
}

jest.mock("ws", () => ({}))

jest.mock("nostr-tools", () => {
  const actual = jest.requireActual<typeof import("nostr-tools")>("nostr-tools")

  return {
    ...actual,
    Relay: jest.fn(() => {
      relayInstance = new MockRelay()
      return relayInstance
    }),
    finalizeEvent: (...args: unknown[]) => mockFinalizeEvent(...args),
    verifyEvent: (...args: unknown[]) => mockVerifyEvent(...args),
  }
})

jest.mock("@/services/db", () => ({
  ConnectionsRepository: () => mockConnectionsRepositoryFactory(),
  ProcessedNwcRequestsRepository: () => mockProcessedNwcRequestsRepositoryFactory(),
}))

jest.mock("@/config", () => ({
  NOSTR_RELAY_URL: "wss://relay.test",
  SUPPORTED_NWC_METHODS: [
    "get_info",
    "get_balance",
    "make_invoice",
    "pay_invoice",
    "lookup_invoice",
    "list_transactions",
  ],
  SUPPORTED_NWC_NOTIFICATIONS: ["payment_sent", "payment_received"],
}))

jest.mock("@/domain/connection", () => {
  const actual =
    jest.requireActual<typeof import("@/domain/connection")>("@/domain/connection")

  return {
    ...actual,
    getServerKeypair: () => ({
      pubkey: "a".repeat(64),
      privkey: "b".repeat(64),
    }),
  }
})

jest.mock("@/domain/nostr", () => {
  const actual = jest.requireActual<typeof import("@/domain/nostr")>("@/domain/nostr")

  return {
    ...actual,
    decrypt: (...args: unknown[]) => mockDecrypt(...args),
    encrypt: (...args: unknown[]) => mockEncrypt(...args),
  }
})

jest.mock("@/domain/utils", () => ({
  sleep: (...args: unknown[]) => mockSleep(...args),
}))

import { NwcSubscriber } from "@/services/nwc-subscriber"
import { EventKind } from "@/domain/nostr"

const flushMicrotasks = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("NwcSubscriber", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    relayInstance = undefined
    currentSubscription = {
      close: jest.fn(),
    }
    mockSubscribe.mockImplementation(() => currentSubscription)
    mockConnectionsRepositoryFactory.mockReturnValue(mockConnectionsRepository)
    mockProcessedNwcRequestsRepositoryFactory.mockReturnValue(
      mockProcessedNwcRequestsRepository,
    )
    mockVerifyEvent.mockReturnValue(true)
    mockFinalizeEvent.mockImplementation((template: unknown) => template)
    mockFindByPubkey.mockResolvedValue({
      id: "connection-id",
      appPubkey: "c".repeat(64),
      permissions: ["get_balance"],
      revoked: false,
      expiresAt: null,
    })
    mockUpdateLastUsed.mockResolvedValue(undefined)
    mockHandle.mockResolvedValue({ balance: 1000 })
    mockDecrypt.mockReturnValue(
      JSON.stringify({
        method: "get_balance",
        params: {},
      }),
    )
    mockEncrypt.mockReturnValue("encrypted-response")
    mockSleep.mockResolvedValue(undefined)
    mockIsProcessed.mockResolvedValue(false)
    mockMarkProcessed.mockResolvedValue(undefined)
    mockPruneExpired.mockResolvedValue(0)
  })

  it("publishes the synchronously encrypted response event", async () => {
    const subscriber = NwcSubscriber()
    const stop = subscriber.subscribe(mockHandle)

    await flushMicrotasks()

    currentSubscription?.onevent?.({
      id: "request-id",
      pubkey: "c".repeat(64),
      content: "ciphertext",
      tags: [["encryption", "nip04"]],
    })

    await flushMicrotasks()

    expect(mockEncrypt).toHaveBeenCalledWith(
      expect.objectContaining({ pubkey: "a".repeat(64) }),
      "c".repeat(64),
      JSON.stringify({
        result_type: "get_balance",
        result: { balance: 1000 },
      }),
      "nip04",
    )
    expect(mockHandle).toHaveBeenCalledTimes(1)
    expect(mockPublish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: EventKind.Response,
        content: "encrypted-response",
      }),
    )

    await stop()
  })

  it("reuses a single repository instance across subscriber event handling", async () => {
    const subscriber = NwcSubscriber()
    const stop = subscriber.subscribe(mockHandle)

    await flushMicrotasks()

    currentSubscription?.onevent?.({
      id: "request-id",
      pubkey: "c".repeat(64),
      content: "ciphertext",
      tags: [["encryption", "nip04"]],
    })

    await flushMicrotasks()

    expect(mockConnectionsRepositoryFactory).toHaveBeenCalledTimes(1)
    expect(mockProcessedNwcRequestsRepositoryFactory).toHaveBeenCalledTimes(1)
    expect(mockFindByPubkey).toHaveBeenCalledTimes(1)
    expect(mockUpdateLastUsed).toHaveBeenCalledTimes(1)

    await stop()
  })

  it("subscribes with a since filter to avoid replaying historical events", async () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1710000000000)
    const subscriber = NwcSubscriber()
    const stop = subscriber.subscribe(mockHandle)

    await flushMicrotasks()

    expect(mockSubscribe).toHaveBeenCalledWith(
      [
        {
          "kinds": [EventKind.Request],
          "#p": ["a".repeat(64)],
          "since": 1710000000,
        },
      ],
      {},
    )

    nowSpy.mockRestore()
    await stop()
  })

  it("publishes a spec-compliant info event on startup", async () => {
    const subscriber = NwcSubscriber()
    const stop = subscriber.subscribe(mockHandle)

    await flushMicrotasks()

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: EventKind.InfoEvent,
        content:
          "get_info get_balance make_invoice pay_invoice lookup_invoice list_transactions notifications",
        tags: expect.arrayContaining([
          ["encryption", "nip44_v2 nip04"],
          ["notifications", "payment_sent payment_received"],
        ]),
      }),
    )

    await stop()
  })

  it("retries relay publish failures that escape event processing", async () => {
    let publishAttempts = 0
    mockPublish.mockImplementation(async (event: { kind?: number }) => {
      if (event.kind === EventKind.Response) {
        publishAttempts += 1
        if (publishAttempts === 1) {
          throw new Error("relay publish failed")
        }
      }
    })

    const subscriber = NwcSubscriber()
    const stop = subscriber.subscribe(mockHandle)

    await flushMicrotasks()

    currentSubscription?.onevent?.({
      id: "request-id",
      pubkey: "c".repeat(64),
      content: "ciphertext",
      tags: [["encryption", "nip04"]],
    })

    await flushMicrotasks()

    expect(mockSleep).toHaveBeenCalledWith(1000)
    expect(mockHandle).toHaveBeenCalledTimes(2)
    expect(publishAttempts).toBe(2)

    await stop()
  })

  it("does not retry non-retryable handler failures", async () => {
    const subscriber = NwcSubscriber()
    const stop = subscriber.subscribe(mockHandle)
    mockHandle.mockRejectedValue(new Error("handler failed"))

    await flushMicrotasks()

    currentSubscription?.onevent?.({
      id: "request-id",
      pubkey: "c".repeat(64),
      content: "ciphertext",
      tags: [["encryption", "nip04"]],
    })

    await flushMicrotasks()

    expect(mockSleep).not.toHaveBeenCalled()
    expect(mockHandle).toHaveBeenCalledTimes(1)
    expect(mockPublish).toHaveBeenCalledTimes(1)

    await stop()
  })

  it("rejects requests for methods outside the connection allowlist", async () => {
    const subscriber = NwcSubscriber()
    const stop = subscriber.subscribe(mockHandle)
    mockDecrypt.mockReturnValue(
      JSON.stringify({
        method: "pay_invoice",
        params: {},
      }),
    )

    await flushMicrotasks()

    currentSubscription?.onevent?.({
      id: "request-id",
      pubkey: "c".repeat(64),
      content: "ciphertext",
      tags: [["encryption", "nip04"]],
    })

    await flushMicrotasks()

    expect(mockHandle).not.toHaveBeenCalled()
    expect(mockEncrypt).toHaveBeenCalledWith(
      expect.objectContaining({ pubkey: "a".repeat(64) }),
      "c".repeat(64),
      JSON.stringify({
        result_type: "pay_invoice",
        error: {
          code: "RESTRICTED",
          message: "Connection does not have permission for this method",
        },
      }),
      "nip04",
    )

    await stop()
  })

  it("ignores expired requests", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1710000000000)
    const subscriber = NwcSubscriber()
    const stop = subscriber.subscribe(mockHandle)

    await flushMicrotasks()

    currentSubscription?.onevent?.({
      id: "request-id",
      pubkey: "c".repeat(64),
      content: "ciphertext",
      tags: [
        ["encryption", "nip04"],
        ["expiration", "1709999999"],
      ],
    })

    await flushMicrotasks()

    expect(mockHandle).not.toHaveBeenCalled()
    expect(mockEncrypt).not.toHaveBeenCalled()

    jest.restoreAllMocks()
    await stop()
  })

  it("returns UNSUPPORTED_ENCRYPTION for unknown encryption tags", async () => {
    const subscriber = NwcSubscriber()
    const stop = subscriber.subscribe(mockHandle)

    await flushMicrotasks()

    currentSubscription?.onevent?.({
      id: "request-id",
      pubkey: "c".repeat(64),
      content: "ciphertext",
      tags: [["encryption", "nip99"]],
    })

    await flushMicrotasks()

    expect(mockHandle).not.toHaveBeenCalled()
    expect(mockEncrypt).toHaveBeenCalledWith(
      expect.objectContaining({ pubkey: "a".repeat(64) }),
      "c".repeat(64),
      JSON.stringify({
        error: {
          code: "UNSUPPORTED_ENCRYPTION",
          message: "Unsupported encryption type: nip99",
        },
      }),
      "nip04",
    )

    await stop()
  })

  it("ignores duplicate request ids while a request is already tracked", async () => {
    const subscriber = NwcSubscriber()
    const stop = subscriber.subscribe(mockHandle)

    await flushMicrotasks()

    const event = {
      id: "request-id",
      pubkey: "c".repeat(64),
      content: "ciphertext",
      tags: [["encryption", "nip04"]],
    }

    currentSubscription?.onevent?.(event)
    await flushMicrotasks()
    currentSubscription?.onevent?.(event)
    await flushMicrotasks()

    expect(mockHandle).toHaveBeenCalledTimes(1)

    await stop()
  })

  it("ignores request ids that were already persisted by an earlier subscriber instance", async () => {
    const persistedEventIds = new Set<string>()
    mockIsProcessed.mockImplementation(async (eventId: string) => {
      return persistedEventIds.has(eventId)
    })
    mockMarkProcessed.mockImplementation(async (eventId: string) => {
      persistedEventIds.add(eventId)
    })

    const event = {
      id: "request-id",
      pubkey: "c".repeat(64),
      content: "ciphertext",
      tags: [["encryption", "nip04"]],
    }

    const firstSubscriber = NwcSubscriber()
    const firstStop = firstSubscriber.subscribe(mockHandle)

    await flushMicrotasks()
    currentSubscription?.onevent?.(event)
    await flushMicrotasks()
    await firstStop()

    const secondSubscriber = NwcSubscriber()
    const secondStop = secondSubscriber.subscribe(mockHandle)

    await flushMicrotasks()
    currentSubscription?.onevent?.(event)
    await flushMicrotasks()

    expect(mockHandle).toHaveBeenCalledTimes(1)

    await secondStop()
  })
})
