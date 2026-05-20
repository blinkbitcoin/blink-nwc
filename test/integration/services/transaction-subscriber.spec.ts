import { Server, ServerCredentials, ServerWritableStream } from "@grpc/grpc-js"

import {
  clearAllTables,
  closeTestDb,
  getStreamCursorByName,
  runMigrations,
} from "../helpers"

import { sleep } from "@/domain/utils"
import { closeDbConnections } from "@/services/db/query-builder"
import { StreamCursorsRepository } from "@/services/db/stream-cursors"
import { BlinkCoreGrpcClient } from "@/services/core/grpc/grpc-client"
import { FibonacciBackoff } from "@/services/core/grpc/stream-client"
import { TransactionSubscriber } from "@/services/core/grpc/transaction-subscriber"
import { TransactionsStreamService } from "@/services/core/grpc/proto/transactions_grpc_pb"
import {
  SettlementViaType,
  SubscribeTransactionsRequest,
  TransactionEvent,
  TransactionType,
} from "@/services/core/grpc/proto/transactions_pb"

type SubscribeCall = ServerWritableStream<SubscribeTransactionsRequest, TransactionEvent>

const createLogger = () =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as Logger

const createTransactionEvent = (ledgerTransactionId: string): TransactionEvent => {
  const event = new TransactionEvent()
  event.setLedgerTransactionId(ledgerTransactionId)
  event.setWalletId("wallet-1")
  event.setAccountId("account-1")
  event.setPaymentHash(`payment-hash-${ledgerTransactionId}`)
  event.setSatsAmount(21)
  event.setCurrency("BTC")
  event.setType(TransactionType.RECEIVED)
  event.setSettlementVia(SettlementViaType.LIGHTNING)
  event.setPending(false)
  event.setTimestamp(1710000000)
  return event
}

const waitFor = async (
  check: () => Promise<void> | void,
  { attempts = 40, delayMs = 25 }: { attempts?: number; delayMs?: number } = {},
) => {
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await check()
      return
    } catch (error) {
      lastError = error
      if (attempt === attempts - 1) {
        break
      }
      await sleep(delayMs)
    }
  }

  throw lastError instanceof Error ? lastError : new Error("waitFor failed")
}

const startGrpcServer = async (
  subscribeTransactions: (call: SubscribeCall) => void,
): Promise<{ server: Server; address: string }> => {
  const server = new Server()
  server.addService(TransactionsStreamService, {
    subscribeTransactions,
  })

  const port = await new Promise<number>((resolve, reject) => {
    server.bindAsync(
      "127.0.0.1:0",
      ServerCredentials.createInsecure(),
      (error, boundPort) => {
        if (error) {
          reject(error)
          return
        }

        resolve(boundPort)
      },
    )
  })
  server.start()

  return {
    server,
    address: `127.0.0.1:${port}`,
  }
}

const stopGrpcServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.tryShutdown((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

describe("TransactionSubscriber integration", () => {
  beforeAll(async () => {
    await runMigrations()
  })

  beforeEach(async () => {
    await clearAllTables()
  })

  afterAll(async () => {
    await closeTestDb()
    await closeDbConnections()
  })

  it("reconnects with the persisted cursor after the stream ends", async () => {
    const requestCursors: Array<string | null> = []
    let subscribeCount = 0

    const { server, address } = await startGrpcServer((call) => {
      requestCursors.push(
        call.request.hasAfterTransactionId()
          ? (call.request.getAfterTransactionId() ?? null)
          : null,
      )
      subscribeCount += 1

      if (subscribeCount === 1) {
        call.write(createTransactionEvent("tx-1"))
        setTimeout(() => call.end(), 5)
        return
      }

      call.write(createTransactionEvent("tx-2"))
    })

    const handled: string[] = []
    const subscriber = TransactionSubscriber({
      client: BlinkCoreGrpcClient({ address }),
      cursorsRepository: StreamCursorsRepository(),
      logger: createLogger(),
      backoff: new FibonacciBackoff(10, 2),
    })

    const stop = await subscriber.subscribe(async (event) => {
      handled.push(event.getLedgerTransactionId())
    })

    await waitFor(async () => {
      expect(handled).toEqual(["tx-1", "tx-2"])
      expect(requestCursors).toEqual([null, "tx-1"])
      expect((await getStreamCursorByName("transactions"))?.cursor_value).toBe("tx-2")
    })

    await stop()
    await stopGrpcServer(server)
  })

  it("starts a new subscriber instance from the stored cursor after restart", async () => {
    const requestCursors: Array<string | null> = []
    const phaseOneEvents = [createTransactionEvent("tx-1")]
    const phaseTwoEvents = [createTransactionEvent("tx-2")]

    const { server, address } = await startGrpcServer((call) => {
      requestCursors.push(
        call.request.hasAfterTransactionId()
          ? (call.request.getAfterTransactionId() ?? null)
          : null,
      )

      const events = call.request.hasAfterTransactionId()
        ? phaseTwoEvents
        : phaseOneEvents
      for (const event of events) {
        call.write(event)
      }
    })

    const logger = createLogger()
    const firstHandled: string[] = []
    const firstSubscriber = TransactionSubscriber({
      client: BlinkCoreGrpcClient({ address }),
      cursorsRepository: StreamCursorsRepository(),
      logger,
      backoff: new FibonacciBackoff(10, 2),
    })

    const stopFirst = await firstSubscriber.subscribe(async (event) => {
      firstHandled.push(event.getLedgerTransactionId())
    })

    await waitFor(async () => {
      expect(firstHandled).toEqual(["tx-1"])
      expect((await getStreamCursorByName("transactions"))?.cursor_value).toBe("tx-1")
    })

    await stopFirst()

    const secondHandled: string[] = []
    const secondSubscriber = TransactionSubscriber({
      client: BlinkCoreGrpcClient({ address }),
      cursorsRepository: StreamCursorsRepository(),
      logger: createLogger(),
      backoff: new FibonacciBackoff(10, 2),
    })

    const stopSecond = await secondSubscriber.subscribe(async (event) => {
      secondHandled.push(event.getLedgerTransactionId())
    })

    await waitFor(async () => {
      expect(secondHandled).toEqual(["tx-2"])
      expect(requestCursors).toEqual([null, "tx-1"])
      expect((await getStreamCursorByName("transactions"))?.cursor_value).toBe("tx-2")
    })

    await stopSecond()
    await stopGrpcServer(server)
  })
})
