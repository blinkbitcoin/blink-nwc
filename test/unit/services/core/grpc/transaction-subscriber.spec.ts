import { EventEmitter } from "events"

import { status } from "@grpc/grpc-js"

import { RepositoryError } from "@/domain/errors"
import { TransactionSubscriber } from "@/services/core/grpc"
import {
  SubscribeTransactionsRequest,
  TransactionEvent,
  TransactionType,
} from "@/services/core/grpc/proto/transactions_pb"

class FakeReadableStream extends EventEmitter {
  pause = jest.fn()
  resume = jest.fn()
  cancel = jest.fn()
}

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const createLogger = () =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as any

const createMonitoring = () => ({
  markTransactionStreamConnected: jest.fn(),
  markTransactionStreamDisconnected: jest.fn(),
  recordTransactionStreamReconnect: jest.fn(),
  recordTransactionStreamReplayLag: jest.fn(),
  recordTransactionStreamReplayLagFromTimestamp: jest.fn(),
  recordNotificationPublished: jest.fn(),
  recordNotificationPublishDuration: jest.fn(),
  recordNotificationPublishError: jest.fn(),
  renderMetrics: jest.fn(),
  getHealthSnapshot: jest.fn(),
})

const createTransactionEvent = (ledgerTransactionId: string) => {
  const event = new TransactionEvent()
  event.setLedgerTransactionId(ledgerTransactionId)
  event.setWalletId("wallet-1")
  event.setPaymentHash("payment-hash-1")
  event.setCurrency("BTC")
  event.setType(TransactionType.RECEIVED)
  event.setTimestamp(1710000000)
  return event
}

describe("TransactionSubscriber", () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it("throws when the initial cursor lookup fails", async () => {
    const client = {
      subscribeTransactions: jest.fn(),
      close: jest.fn(),
      waitForReady: jest.fn().mockResolvedValue(undefined),
    }
    const cursorsRepository = {
      get: jest.fn().mockResolvedValue(new RepositoryError("db unavailable")),
      set: jest.fn(),
    }

    const subscriber = TransactionSubscriber({
      client: client as any,
      cursorsRepository: cursorsRepository as any,
      logger: createLogger(),
      backoff: { next: () => 1, reset: jest.fn() },
    })

    await expect(subscriber.subscribe(jest.fn())).rejects.toBeInstanceOf(RepositoryError)
    expect(client.subscribeTransactions).not.toHaveBeenCalled()
  })

  it("starts from the persisted cursor and saves the next cursor after successful handling", async () => {
    const stream = new FakeReadableStream()
    const subscribeTransactions = jest.fn().mockReturnValue(stream as any)
    const client = {
      subscribeTransactions,
      close: jest.fn(),
      waitForReady: jest.fn().mockResolvedValue(undefined),
    }
    const cursorsRepository = {
      get: jest.fn().mockResolvedValue("cursor-1"),
      set: jest.fn().mockResolvedValue(undefined),
    }
    const handle = jest.fn().mockResolvedValue(undefined)
    const monitoring = createMonitoring()

    const subscriber = TransactionSubscriber({
      client: client as any,
      cursorsRepository: cursorsRepository as any,
      logger: createLogger(),
      backoff: { next: () => 1, reset: jest.fn() },
      monitoring: monitoring as any,
    })

    const stop = await subscriber.subscribe(handle)

    const request = subscribeTransactions.mock.calls[0][0] as SubscribeTransactionsRequest
    expect(request.getAfterTransactionId()).toBe("cursor-1")

    stream.emit("data", createTransactionEvent("cursor-2"))
    await flushPromises()

    expect(handle).toHaveBeenCalledTimes(1)
    expect(cursorsRepository.set).toHaveBeenCalledWith("transactions", "cursor-2")
    expect(monitoring.markTransactionStreamDisconnected).toHaveBeenCalledTimes(1)
    expect(monitoring.markTransactionStreamConnected).toHaveBeenCalled()
    expect(monitoring.recordTransactionStreamReplayLagFromTimestamp).toHaveBeenCalledWith(
      1710000000,
    )

    await stop()
    expect(client.close).toHaveBeenCalledTimes(1)
  })

  it("marks the stream connected once the grpc channel is ready, before data arrives", async () => {
    const stream = new FakeReadableStream()
    const client = {
      subscribeTransactions: jest.fn().mockReturnValue(stream as any),
      close: jest.fn(),
      waitForReady: jest.fn().mockResolvedValue(undefined),
    }
    const cursorsRepository = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    }
    const monitoring = createMonitoring()

    const subscriber = TransactionSubscriber({
      client: client as any,
      cursorsRepository: cursorsRepository as any,
      logger: createLogger(),
      backoff: { next: () => 1, reset: jest.fn() },
      monitoring: monitoring as any,
    })

    const stop = await subscriber.subscribe(jest.fn())
    await flushPromises()

    expect(client.waitForReady).toHaveBeenCalledWith(expect.any(Date))
    expect(monitoring.markTransactionStreamDisconnected).toHaveBeenCalledTimes(1)
    expect(monitoring.markTransactionStreamConnected).toHaveBeenCalledTimes(1)

    await stop()
  })

  it("reconnects from the last persisted cursor when downstream handling fails", async () => {
    jest.useFakeTimers()

    const firstStream = new FakeReadableStream()
    const secondStream = new FakeReadableStream()
    const subscribeTransactions = jest
      .fn()
      .mockReturnValueOnce(firstStream as any)
      .mockReturnValueOnce(secondStream as any)
    const client = {
      subscribeTransactions,
      close: jest.fn(),
      waitForReady: jest.fn().mockResolvedValue(undefined),
    }
    const cursorsRepository = {
      get: jest.fn().mockResolvedValue("cursor-1"),
      set: jest.fn().mockResolvedValue(undefined),
    }
    const handle = jest.fn().mockRejectedValue(new Error("publish failed"))
    const monitoring = createMonitoring()

    const subscriber = TransactionSubscriber({
      client: client as any,
      cursorsRepository: cursorsRepository as any,
      logger: createLogger(),
      backoff: { next: () => 1, reset: jest.fn() },
      monitoring: monitoring as any,
    })

    const stop = await subscriber.subscribe(handle)

    firstStream.emit("data", createTransactionEvent("cursor-2"))
    await flushPromises()

    jest.runOnlyPendingTimers()
    await flushPromises()

    expect(cursorsRepository.set).not.toHaveBeenCalled()
    expect(subscribeTransactions).toHaveBeenCalledTimes(2)
    expect(monitoring.markTransactionStreamDisconnected).toHaveBeenCalled()
    expect(monitoring.recordTransactionStreamReconnect).toHaveBeenCalledTimes(1)

    const retriedRequest = subscribeTransactions.mock
      .calls[1][0] as SubscribeTransactionsRequest
    expect(retriedRequest.getAfterTransactionId()).toBe("cursor-1")

    await stop()
    jest.useRealTimers()
  })

  it("reconnects from the last persisted cursor when the stream drops", async () => {
    jest.useFakeTimers()

    const firstStream = new FakeReadableStream()
    const secondStream = new FakeReadableStream()
    const subscribeTransactions = jest
      .fn()
      .mockReturnValueOnce(firstStream as any)
      .mockReturnValueOnce(secondStream as any)
    const client = {
      subscribeTransactions,
      close: jest.fn(),
      waitForReady: jest.fn().mockResolvedValue(undefined),
    }
    const cursorsRepository = {
      get: jest.fn().mockResolvedValue("cursor-1"),
      set: jest.fn().mockResolvedValue(undefined),
    }
    const handle = jest.fn().mockResolvedValue(undefined)
    const monitoring = createMonitoring()

    const subscriber = TransactionSubscriber({
      client: client as any,
      cursorsRepository: cursorsRepository as any,
      logger: createLogger(),
      backoff: { next: () => 1, reset: jest.fn() },
      monitoring: monitoring as any,
    })

    const stop = await subscriber.subscribe(handle)

    firstStream.emit("data", createTransactionEvent("cursor-2"))
    await flushPromises()
    firstStream.emit("end")

    jest.runOnlyPendingTimers()
    await flushPromises()

    expect(cursorsRepository.set).toHaveBeenCalledWith("transactions", "cursor-2")
    expect(subscribeTransactions).toHaveBeenCalledTimes(2)
    expect(monitoring.markTransactionStreamDisconnected).toHaveBeenCalled()
    expect(monitoring.recordTransactionStreamReconnect).toHaveBeenCalledTimes(1)

    const retriedRequest = subscribeTransactions.mock
      .calls[1][0] as SubscribeTransactionsRequest
    expect(retriedRequest.getAfterTransactionId()).toBe("cursor-2")

    await stop()
    jest.useRealTimers()
  })

  it("reconnects from the stored cursor when the stream fails before new data", async () => {
    jest.useFakeTimers()

    const firstStream = new FakeReadableStream()
    const secondStream = new FakeReadableStream()
    const subscribeTransactions = jest
      .fn()
      .mockReturnValueOnce(firstStream as any)
      .mockReturnValueOnce(secondStream as any)
    const client = {
      subscribeTransactions,
      close: jest.fn(),
      waitForReady: jest.fn().mockResolvedValue(undefined),
    }
    const cursorsRepository = {
      get: jest.fn().mockResolvedValue("cursor-1"),
      set: jest.fn().mockResolvedValue(undefined),
    }
    const monitoring = createMonitoring()

    const subscriber = TransactionSubscriber({
      client: client as any,
      cursorsRepository: cursorsRepository as any,
      logger: createLogger(),
      backoff: { next: () => 1, reset: jest.fn() },
      monitoring: monitoring as any,
    })

    const stop = await subscriber.subscribe(jest.fn())

    firstStream.emit("error", {
      code: status.UNAVAILABLE,
      details: "disconnected",
      message: "disconnected",
      name: "ServiceError",
    })
    await flushPromises()

    jest.runOnlyPendingTimers()
    await flushPromises()

    expect(subscribeTransactions).toHaveBeenCalledTimes(2)
    expect(cursorsRepository.set).not.toHaveBeenCalled()
    expect(monitoring.markTransactionStreamDisconnected).toHaveBeenCalled()
    expect(monitoring.recordTransactionStreamReconnect).toHaveBeenCalledTimes(1)

    const retriedRequest = subscribeTransactions.mock
      .calls[1][0] as SubscribeTransactionsRequest
    expect(retriedRequest.getAfterTransactionId()).toBe("cursor-1")

    await stop()
    jest.useRealTimers()
  })

  it("reconnects from the persisted cursor when saving the cursor fails", async () => {
    jest.useFakeTimers()

    const firstStream = new FakeReadableStream()
    const secondStream = new FakeReadableStream()
    const subscribeTransactions = jest
      .fn()
      .mockReturnValueOnce(firstStream as any)
      .mockReturnValueOnce(secondStream as any)
    const client = {
      subscribeTransactions,
      close: jest.fn(),
      waitForReady: jest.fn().mockResolvedValue(undefined),
    }
    const cursorsRepository = {
      get: jest.fn().mockResolvedValue("cursor-1"),
      set: jest.fn().mockResolvedValue(new RepositoryError("save failed")),
    }
    const handle = jest.fn().mockResolvedValue(undefined)

    const subscriber = TransactionSubscriber({
      client: client as any,
      cursorsRepository: cursorsRepository as any,
      logger: createLogger(),
      backoff: { next: () => 1, reset: jest.fn() },
    })

    const stop = await subscriber.subscribe(handle)

    firstStream.emit("data", createTransactionEvent("cursor-2"))
    await flushPromises()

    jest.runOnlyPendingTimers()
    await flushPromises()

    expect(subscribeTransactions).toHaveBeenCalledTimes(2)
    const retriedRequest = subscribeTransactions.mock
      .calls[1][0] as SubscribeTransactionsRequest
    expect(retriedRequest.getAfterTransactionId()).toBe("cursor-1")

    await stop()
  })

  it("reconnects when a transaction event is missing its durable cursor", async () => {
    jest.useFakeTimers()

    const firstStream = new FakeReadableStream()
    const secondStream = new FakeReadableStream()
    const subscribeTransactions = jest
      .fn()
      .mockReturnValueOnce(firstStream as any)
      .mockReturnValueOnce(secondStream as any)
    const client = {
      subscribeTransactions,
      close: jest.fn(),
      waitForReady: jest.fn().mockResolvedValue(undefined),
    }
    const cursorsRepository = {
      get: jest.fn().mockResolvedValue("cursor-1"),
      set: jest.fn().mockResolvedValue(undefined),
    }
    const handle = jest.fn().mockResolvedValue(undefined)
    const missingCursorEvent = createTransactionEvent("cursor-2")
    missingCursorEvent.setLedgerTransactionId("")

    const subscriber = TransactionSubscriber({
      client: client as any,
      cursorsRepository: cursorsRepository as any,
      logger: createLogger(),
      backoff: { next: () => 1, reset: jest.fn() },
    })

    const stop = await subscriber.subscribe(handle)

    firstStream.emit("data", missingCursorEvent)
    await flushPromises()

    jest.runOnlyPendingTimers()
    await flushPromises()

    expect(cursorsRepository.set).not.toHaveBeenCalled()
    expect(handle).not.toHaveBeenCalled()
    expect(subscribeTransactions).toHaveBeenCalledTimes(2)

    const retriedRequest = subscribeTransactions.mock
      .calls[1][0] as SubscribeTransactionsRequest
    expect(retriedRequest.getAfterTransactionId()).toBe("cursor-1")

    await stop()
  })

  it("stops permanently when Blink Core rejects the stored cursor as invalid", async () => {
    jest.useFakeTimers()

    const stream = new FakeReadableStream()
    const subscribeTransactions = jest.fn().mockReturnValue(stream as any)
    const client = {
      subscribeTransactions,
      close: jest.fn(),
      waitForReady: jest.fn().mockResolvedValue(undefined),
    }
    const cursorsRepository = {
      get: jest.fn().mockResolvedValue("cursor-1"),
      set: jest.fn().mockResolvedValue(undefined),
    }

    const subscriber = TransactionSubscriber({
      client: client as any,
      cursorsRepository: cursorsRepository as any,
      logger: createLogger(),
      backoff: { next: () => 1, reset: jest.fn() },
    })

    await subscriber.subscribe(jest.fn())

    stream.emit("error", {
      code: status.INVALID_ARGUMENT,
      details: "invalid cursor",
      message: "invalid cursor",
      name: "ServiceError",
    })
    await flushPromises()
    jest.runOnlyPendingTimers()

    expect(client.close).toHaveBeenCalledTimes(1)
    expect(subscribeTransactions).toHaveBeenCalledTimes(1)
  })
})
