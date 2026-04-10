const mockPublish = jest.fn()
const mockConnect = jest.fn()
const mockSubscribe = jest.fn()
const mockVerifyEvent = jest.fn()
const mockFinalizeEvent = jest.fn()
const mockFindByPubkey = jest.fn()
const mockUpdateLastUsed = jest.fn()
const mockDecrypt = jest.fn()
const mockEncrypt = jest.fn()
const mockParseNip47Response = jest.fn()
const mockHandle = jest.fn()
const mockSleep = jest.fn()
const mockConnectionsRepository = jest.fn()

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

jest.mock("nostr-tools", () => ({
  Relay: jest.fn(() => {
    relayInstance = new MockRelay()
    return relayInstance
  }),
  finalizeEvent: (...args: unknown[]) => mockFinalizeEvent(...args),
  verifyEvent: (...args: unknown[]) => mockVerifyEvent(...args),
}))

jest.mock("@/services/db", () => ({
  ConnectionsRepository: () =>
    mockConnectionsRepository({
      findByPubkey: mockFindByPubkey,
      updateLastUsed: mockUpdateLastUsed,
    }),
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
}))

jest.mock("@/domain/connection", () => ({
  getServerKeypair: () => ({
    pubkey: "a".repeat(64),
    privkey: "b".repeat(64),
  }),
  hasPermission: (method: string, connection: { permissions?: string[] }) =>
    connection.permissions?.includes(method) ?? false,
}))

jest.mock("@/domain/nostr", () => ({
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
  encrypt: (...args: unknown[]) => mockEncrypt(...args),
  EventKind: {
    Request: 23194,
    Response: 23195,
    InfoEvent: 13194,
  },
  hexToBytes: jest.fn().mockReturnValue(new Uint8Array(32)),
  Nip47UnauthorizedError: class Nip47UnauthorizedError extends Error {
    code = "UNAUTHORIZED"
  },
  Nip47InternalError: class Nip47InternalError extends Error {
    code = "INTERNAL"
  },
  Nip47RestrictedError: class Nip47RestrictedError extends Error {
    code = "RESTRICTED"
  },
  parseNip47Response: (...args: unknown[]) => mockParseNip47Response(...args),
}))

jest.mock("@/domain/utils", () => ({
  sleep: (...args: unknown[]) => mockSleep(...args),
}))

import { NwcSubscriber } from "@/services/nwc-subscriber"

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
    mockConnectionsRepository.mockImplementation((repository) => repository)
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
    mockDecrypt.mockResolvedValue(
      JSON.stringify({
        method: "get_balance",
        params: {},
      }),
    )
    mockEncrypt.mockResolvedValue("encrypted-response")
    mockSleep.mockResolvedValue(undefined)
    mockParseNip47Response.mockImplementation((result: unknown) => {
      if (
        result instanceof Error &&
        "code" in result &&
        typeof result.code === "string"
      ) {
        return {
          error: {
            code: result.code,
            message: result.message,
          },
        }
      }

      return { result }
    })
  })

  it("awaits nip04 encryption before publishing the response event", async () => {
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
        kind: 23195,
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

    expect(mockConnectionsRepository).toHaveBeenCalledTimes(1)
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
          "kinds": [23194],
          "#p": ["a".repeat(64)],
          "since": 1710000000,
        },
      ],
      {},
    )

    nowSpy.mockRestore()
    await stop()
  })

  it("retries relay publish failures that escape event processing", async () => {
    let publishAttempts = 0
    mockPublish.mockImplementation(async (event: { kind?: number }) => {
      if (event.kind === 23195) {
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
    mockDecrypt.mockResolvedValue(
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
})
