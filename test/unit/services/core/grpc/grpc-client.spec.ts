jest.mock("@grpc/grpc-js", () => ({
  credentials: {
    createInsecure: jest.fn(() => "insecure-creds"),
  },
}))

jest.mock("@/services/core/grpc/proto/transactions_grpc_pb", () => {
  const subscribeTransactions = jest.fn()
  const waitForReady = jest.fn()
  const close = jest.fn()

  return {
    TransactionsStreamClient: jest.fn().mockImplementation(() => ({
      subscribeTransactions,
      waitForReady,
      close,
    })),
  }
})

import { credentials } from "@grpc/grpc-js"

import { BlinkCoreGrpcClient } from "@/services/core/grpc/grpc-client"
import { TransactionsStreamClient } from "@/services/core/grpc/proto/transactions_grpc_pb"
import { SubscribeTransactionsRequest } from "@/services/core/grpc/proto/transactions_pb"

const mockCreateInsecure = credentials.createInsecure as jest.Mock
const mockClientConstructor = TransactionsStreamClient as jest.Mock

const lastMockClientInstance = () =>
  mockClientConstructor.mock.results.at(-1)?.value as {
    subscribeTransactions: jest.Mock
    waitForReady: jest.Mock
    close: jest.Mock
  }

describe("BlinkCoreGrpcClient", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("constructs the client with the default configured address", () => {
    BlinkCoreGrpcClient()

    expect(mockCreateInsecure).toHaveBeenCalledTimes(1)
    expect(mockClientConstructor).toHaveBeenCalledWith(
      "localhost:50053",
      "insecure-creds",
    )
  })

  it("subscribes using explicit metadata when provided", () => {
    const client = BlinkCoreGrpcClient({ address: "blink-core:50054" })
    const request = new SubscribeTransactionsRequest()
    const metadata = { traceId: "abc" } as never
    const options = { deadline: new Date("2026-01-01T00:00:00.000Z") } as never

    client.subscribeTransactions(request, metadata, options)

    expect(mockClientConstructor).toHaveBeenCalledWith(
      "blink-core:50054",
      "insecure-creds",
    )
    expect(lastMockClientInstance().subscribeTransactions).toHaveBeenCalledWith(
      request,
      metadata,
      options,
    )
  })

  it("subscribes without metadata when only options are provided", () => {
    const client = BlinkCoreGrpcClient()
    const request = new SubscribeTransactionsRequest()
    const options = { waitForReady: true } as never

    client.subscribeTransactions(request, undefined, options)

    expect(lastMockClientInstance().subscribeTransactions).toHaveBeenCalledWith(
      request,
      options,
    )
  })

  it("closes the underlying grpc client", () => {
    const client = BlinkCoreGrpcClient()

    client.close()

    expect(lastMockClientInstance().close).toHaveBeenCalledTimes(1)
  })

  it("resolves when the underlying grpc channel is ready", async () => {
    const client = BlinkCoreGrpcClient()
    const deadline = new Date("2026-01-01T00:00:00.000Z")

    lastMockClientInstance().waitForReady.mockImplementationOnce((_, callback) =>
      callback(undefined),
    )

    await expect(client.waitForReady(deadline)).resolves.toBeUndefined()

    expect(lastMockClientInstance().waitForReady).toHaveBeenCalledWith(
      deadline,
      expect.any(Function),
    )
  })

  it("rejects when the underlying grpc channel is not ready", async () => {
    const client = BlinkCoreGrpcClient()
    const error = new Error("not ready")

    lastMockClientInstance().waitForReady.mockImplementationOnce((_, callback) =>
      callback(error),
    )

    await expect(client.waitForReady(new Date())).rejects.toBe(error)
  })
})
