import { EventEmitter } from "events"

import { Metadata, status } from "@grpc/grpc-js"

import { FibonacciBackoff } from "@/services/core/grpc/stream-client/backoff"
import { streamBuilder } from "@/services/core/grpc/stream-client/stream-builder"
import { Stream, StreamEvents } from "@/services/core/grpc/stream-client/stream"
import {
  SubscribeTransactionsRequest,
  TransactionEvent,
  TransactionType,
} from "@/services/core/grpc/proto/transactions_pb"

class FakeReadableStream extends EventEmitter {
  cancel = jest.fn()
}

const createTransactionEvent = () => {
  const event = new TransactionEvent()
  event.setLedgerTransactionId("cursor-1")
  event.setWalletId("wallet-1")
  event.setPaymentHash("payment-hash-1")
  event.setCurrency("BTC")
  event.setType(TransactionType.RECEIVED)
  event.setTimestamp(1710000000)
  return event
}

describe("FibonacciBackoff", () => {
  it("grows according to the fibonacci sequence and caps at the configured max index", () => {
    const backoff = new FibonacciBackoff(100, 3)

    expect(backoff.next()).toBe(100)
    expect(backoff.next()).toBe(200)
    expect(backoff.next()).toBe(300)
    expect(backoff.next()).toBe(300)
  })

  it("resets back to the initial value", () => {
    const backoff = new FibonacciBackoff(50, 4)

    backoff.next()
    backoff.next()
    backoff.reset()

    expect(backoff.next()).toBe(50)
  })
})

describe("streamBuilder", () => {
  it("builds a stream with the configured request, metadata, backoff, and listeners", () => {
    const transport = new FakeReadableStream()
    const method = jest.fn().mockReturnValue(transport as never)
    const request = new SubscribeTransactionsRequest()
    request.setAfterTransactionId("cursor-1")
    const metadata = new Metadata()
    metadata.set("trace-id", "abc")
    const backoff = { next: jest.fn(() => 1), reset: jest.fn() }
    const onData = jest.fn()
    const onRetry = jest.fn()

    const stream = streamBuilder<TransactionEvent, SubscribeTransactionsRequest>(method)
      .withRequest(request)
      .withMetadata(metadata)
      .withBackoff(backoff)
      .withOptions({ retry: true })
      .onData(onData)
      .onRetry(onRetry)
      .build()

    transport.emit(StreamEvents.data, createTransactionEvent())

    expect(method).toHaveBeenCalledWith(request, metadata)
    expect(stream.request).toBe(request)
    expect(onData).toHaveBeenCalledWith(stream, expect.any(TransactionEvent))
    expect(backoff.reset).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
  })
})

describe("Stream", () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it("merges metadata and removes once listeners after they fire", () => {
    const transport = new FakeReadableStream()
    const method = jest.fn().mockReturnValue(transport as never)
    const request = new SubscribeTransactionsRequest()
    const metadata = new Metadata()
    metadata.set("trace-id", "abc")
    const stream = new Stream<TransactionEvent, SubscribeTransactionsRequest>(
      method,
      request,
      metadata,
    )
    const nextMetadata = new Metadata()
    nextMetadata.set("request-id", "123")
    const onData = jest.fn()

    stream.metaData = nextMetadata
    stream.addEventListener(
      StreamEvents.data,
      onData as never,
      { once: true } as AddEventListenerOptions,
    )
    stream.connect()

    transport.emit(StreamEvents.data, createTransactionEvent())
    transport.emit(StreamEvents.data, createTransactionEvent())

    expect(stream.metaData?.get("trace-id")).toEqual(["abc"])
    expect(stream.metaData?.get("request-id")).toEqual(["123"])
    expect(onData).toHaveBeenCalledTimes(1)
  })

  it("removes only the listener with the matching callback and options", () => {
    const method = jest.fn().mockReturnValue(new FakeReadableStream() as never)
    const stream = new Stream<TransactionEvent, SubscribeTransactionsRequest>(
      method,
      new SubscribeTransactionsRequest(),
    )
    const listenerOptions = { once: true } as AddEventListenerOptions
    const firstListener = jest.fn()
    const secondListener = jest.fn()

    stream.addEventListener(StreamEvents.data, firstListener as never, listenerOptions)
    stream.addEventListener(StreamEvents.data, secondListener as never, listenerOptions)
    stream.removeEventListener(StreamEvents.data, firstListener as never, listenerOptions)

    expect(stream.eventListeners.data).toHaveLength(1)
    expect(stream.eventListeners.data[0].listener).toBe(secondListener)
  })

  it("retries on stream errors when retry is enabled and reconnects with backoff", () => {
    jest.useFakeTimers()

    const firstTransport = new FakeReadableStream()
    const secondTransport = new FakeReadableStream()
    const method = jest
      .fn()
      .mockReturnValueOnce(firstTransport as never)
      .mockReturnValueOnce(secondTransport as never)
    const backoff = { next: jest.fn(() => 5), reset: jest.fn() }
    const request = new SubscribeTransactionsRequest()
    const stream = new Stream<TransactionEvent, SubscribeTransactionsRequest>(
      method,
      request,
      undefined,
      backoff,
      { retry: true, acceptDataOnReconnect: false },
    )
    const onRetry = jest.fn()
    const onError = jest.fn()
    const removeAllListenersSpy = jest.spyOn(firstTransport, "removeAllListeners")

    stream.addEventListener(StreamEvents.retry, onRetry as never)
    stream.addEventListener(StreamEvents.error, onError as never)
    stream.connect()

    firstTransport.emit(StreamEvents.error, {
      code: status.UNAVAILABLE,
      details: "disconnected",
      message: "disconnected",
      name: "ServiceError",
    })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(backoff.next).toHaveBeenCalledTimes(1)
    expect(removeAllListenersSpy).toHaveBeenCalledWith(StreamEvents.data)

    jest.advanceTimersByTime(5)

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(method).toHaveBeenCalledTimes(2)
  })

  it("does not remove data listeners during reconnect when acceptDataOnReconnect is enabled", () => {
    jest.useFakeTimers()

    const firstTransport = new FakeReadableStream()
    const secondTransport = new FakeReadableStream()
    const method = jest
      .fn()
      .mockReturnValueOnce(firstTransport as never)
      .mockReturnValueOnce(secondTransport as never)
    const backoff = { next: jest.fn(() => 5), reset: jest.fn() }
    const stream = new Stream<TransactionEvent, SubscribeTransactionsRequest>(
      method,
      new SubscribeTransactionsRequest(),
      undefined,
      backoff,
      { retry: true, acceptDataOnReconnect: true },
    )
    const removeAllListenersSpy = jest.spyOn(firstTransport, "removeAllListeners")
    stream.connect()

    firstTransport.emit(StreamEvents.end)

    expect(removeAllListenersSpy).not.toHaveBeenCalledWith(StreamEvents.data)

    jest.advanceTimersByTime(5)

    expect(method).toHaveBeenCalledTimes(2)
    stream.cancel()
  })

  it("cancels pending reconnects and closes the active stream", () => {
    jest.useFakeTimers()

    const transport = new FakeReadableStream()
    const method = jest.fn().mockReturnValue(transport as never)
    const backoff = { next: jest.fn(() => 10), reset: jest.fn() }
    const stream = new Stream<TransactionEvent, SubscribeTransactionsRequest>(
      method,
      new SubscribeTransactionsRequest(),
      undefined,
      backoff,
      { retry: true },
    )
    stream.connect()

    transport.emit(StreamEvents.end)
    stream.cancel()
    jest.advanceTimersByTime(10)

    expect(transport.cancel).toHaveBeenCalledTimes(1)
    expect(method).toHaveBeenCalledTimes(1)
  })
})
