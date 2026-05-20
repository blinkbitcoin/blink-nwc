const mockHandle = jest.fn()
const mockPublishTransactionEvent = jest.fn()
const mockStopNwc = jest.fn().mockResolvedValue(undefined)
const mockStopTransactionSubscriber = jest.fn().mockResolvedValue(undefined)
const mockStopNotificationPublisher = jest.fn().mockResolvedValue(undefined)
const mockStopMonitoringServer = jest.fn().mockResolvedValue(undefined)
const mockNwcSubscribe = jest.fn(() => mockStopNwc)
const mockTransactionSubscribe = jest
  .fn()
  .mockResolvedValue(mockStopTransactionSubscriber)
const mockStartNostrMonitoringServer = jest
  .fn()
  .mockResolvedValue(mockStopMonitoringServer)
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(),
}

jest.mock("@/app/nwc-event-handler", () =>
  jest.fn(() => ({
    handle: mockHandle,
  })),
)

jest.mock("@/services", () => ({
  NwcSubscriber: jest.fn(() => ({
    subscribe: mockNwcSubscribe,
  })),
  NwcNotificationPublisher: jest.fn(() => ({
    publishTransactionEvent: mockPublishTransactionEvent,
    stop: mockStopNotificationPublisher,
  })),
  TransactionSubscriber: jest.fn(() => ({
    subscribe: mockTransactionSubscribe,
  })),
}))

jest.mock("@/services/nwc-monitoring", () => ({
  NwcMonitoringService: jest.fn(() => ({ id: "monitoring" })),
}))

jest.mock("@/server/nostr-monitoring-server", () => ({
  startNostrMonitoringServer: mockStartNostrMonitoringServer,
}))

jest.mock("@/services/logger", () => {
  mockLogger.child.mockReturnValue(mockLogger)
  return {
    baseLogger: mockLogger,
  }
})

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe("nostr server startup", () => {
  const originalExit = process.exit
  const originalOn = process.on

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  afterEach(() => {
    process.exit = originalExit
    process.on = originalOn
  })

  it("starts both subscribers and stops them on shutdown signals", async () => {
    const handlers: Record<string, () => Promise<void>> = {}

    process.exit = jest.fn() as never
    process.on = jest.fn((signal: string, handler: () => Promise<void>) => {
      handlers[signal] = handler
      return process
    }) as never

    await jest.isolateModulesAsync(async () => {
      await import("@/server/nostr")
      await flushPromises()
    })

    expect(mockNwcSubscribe).toHaveBeenCalledWith(mockHandle)
    expect(mockTransactionSubscribe).toHaveBeenCalledWith(mockPublishTransactionEvent)
    expect(mockStartNostrMonitoringServer).toHaveBeenCalledTimes(1)
    expect(handlers.SIGINT).toBeDefined()
    expect(handlers.SIGTERM).toBeDefined()

    await handlers.SIGINT()

    expect(mockStopNwc).toHaveBeenCalledTimes(1)
    expect(mockStopTransactionSubscriber).toHaveBeenCalledTimes(1)
    expect(mockStopNotificationPublisher).toHaveBeenCalledTimes(1)
    expect(mockStopMonitoringServer).toHaveBeenCalledTimes(1)
    expect(process.exit).toHaveBeenCalledWith(0)
  })

  it("exits with status 1 when startup fails", async () => {
    process.exit = jest.fn() as never
    process.on = jest.fn(() => process) as never
    mockTransactionSubscribe.mockRejectedValueOnce(new Error("boom"))

    await jest.isolateModulesAsync(async () => {
      await import("@/server/nostr")
      await flushPromises()
    })

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
      }),
      "failed to start Nostr services",
    )
    expect(mockStopMonitoringServer).toHaveBeenCalledTimes(1)
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})
