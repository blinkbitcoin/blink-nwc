import { randomUUID } from "crypto"

import { NwcConnection } from "@/domain/connection"
import { PaymentState } from "@/domain/core/payment-state"
import {
  Nip47GetBalanceResult,
  Nip47GetInfoResult,
  Nip47ListTransactionsResult,
  Nip47LookupInvoiceResult,
  Nip47MakeInvoiceResult,
  Nip47PayInvoiceResult,
  Nip47Result,
} from "@/domain/index.types"
import { Nip47Error, Nip47Method } from "@/domain/nostr"
import {
  NwcNotificationType,
  toNotificationPermission,
} from "@/domain/nostr/notification-type"
import {
  TEST_USERS,
  createRuntimeConnection,
  getWalletByCurrency,
  loginTestUser,
  retryAsync,
} from "test/integration/helpers/blink"

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

type HandlerFactory = typeof import("@/app/nwc-event-handler").default
const describeRealCore =
  process.env.RUN_REAL_BLINK_CORE_INTEGRATION === "true" ? describe : describe.skip

const requireSuccess = <T>(result: Nip47Result): T => {
  if (result instanceof Nip47Error) {
    if (result.message.includes("offchain action failed")) {
      throw new Error(
        "Real BlinkCore integration requires the full quickstart lightning stack to be initialized. Run the vendored quickstart init flow before enabling RUN_REAL_BLINK_CORE_INTEGRATION.",
      )
    }

    throw new Error(`Expected success, got ${result.code}: ${result.message}`)
  }

  return result as T
}

describeRealCore("NwcEventHandler with real BlinkCoreService", () => {
  let NwcEventHandler: HandlerFactory
  let aliceConnection: NwcConnection
  let bobConnection: NwcConnection
  let aliceWalletBalance: number

  beforeAll(async () => {
    process.env.ROUTER_URL =
      process.env.GALOY_GRAPHQL_URL || "http://localhost:4455/graphql"
    ;({ default: NwcEventHandler } = await import("@/app/nwc-event-handler"))

    const aliceAuthToken = await loginTestUser(TEST_USERS.alice)
    const bobAuthToken = await loginTestUser(TEST_USERS.bob)

    const [aliceWallet, bobWallet] = await Promise.all([
      getWalletByCurrency(aliceAuthToken, "BTC"),
      getWalletByCurrency(bobAuthToken, "BTC"),
    ])

    aliceWalletBalance = aliceWallet.balance

    const fullPermissions: NwcConnection["permissions"] = [
      Nip47Method.GetInfo,
      Nip47Method.GetBalance,
      Nip47Method.MakeInvoice,
      Nip47Method.PayInvoice,
      Nip47Method.LookupInvoice,
      Nip47Method.ListTransactions,
      toNotificationPermission(NwcNotificationType.PaymentSent),
      toNotificationPermission(NwcNotificationType.PaymentReceived),
    ]

    // The current local stack exposes the user-auth GraphQL path reliably for these
    // operations, while API-key bootstrap is not yet available on the endpoint this
    // test can reach. Switch this setup to real API keys once that surface is wired.
    aliceConnection = createRuntimeConnection({
      apiKey: aliceAuthToken as NwcConnection["apiKey"],
      walletId: aliceWallet.id,
      permissions: fullPermissions,
    })

    bobConnection = createRuntimeConnection({
      apiKey: bobAuthToken as NwcConnection["apiKey"],
      walletId: bobWallet.id,
      permissions: fullPermissions,
    })

    const handler = NwcEventHandler()
    const info = await handler.handle(
      {
        method: Nip47Method.GetInfo,
        params: {},
      },
      aliceConnection,
    )

    if (info instanceof Nip47Error) {
      throw new Error(
        "Real BlinkCore integration requires a fully initialized quickstart backend. `get_info` could not fetch block info from the local stack. Run the vendored quickstart init flow before enabling RUN_REAL_BLINK_CORE_INTEGRATION.",
      )
    }
  }, 30000)

  const createInvoiceForBob = async ({
    amount = 10_000,
    description = `integration-${randomUUID()}`,
  }: {
    amount?: number
    description?: string
  } = {}): Promise<Nip47MakeInvoiceResult> => {
    const handler = NwcEventHandler()

    return requireSuccess<Nip47MakeInvoiceResult>(
      await handler.handle(
        {
          method: Nip47Method.MakeInvoice,
          params: { amount, description },
        },
        bobConnection,
      ),
    )
  }

  it("returns connection-specific info from the real service", async () => {
    const handler = NwcEventHandler()

    const result = requireSuccess<Nip47GetInfoResult>(
      await handler.handle(
        {
          method: Nip47Method.GetInfo,
          params: {},
        },
        aliceConnection,
      ),
    )

    expect(result.alias).toBeDefined()
    expect(result.color).toBeDefined()
    expect(result.pubkey).toHaveLength(64)
    expect(result.methods).toEqual([
      Nip47Method.GetInfo,
      Nip47Method.GetBalance,
      Nip47Method.MakeInvoice,
      Nip47Method.PayInvoice,
      Nip47Method.LookupInvoice,
      Nip47Method.ListTransactions,
    ])
    expect(result.notifications).toHaveLength(2)
    expect(typeof result.block_height).toBe("number")
    expect(result.block_hash).toHaveLength(64)
    expect(result.network.length).toBeGreaterThan(0)
  })

  it("returns wallet balance in millisatoshis from the real service", async () => {
    const handler = NwcEventHandler()

    const result = requireSuccess<Nip47GetBalanceResult>(
      await handler.handle(
        {
          method: Nip47Method.GetBalance,
          params: {},
        },
        aliceConnection,
      ),
    )

    expect(result.balance).toBe(aliceWalletBalance * 1000)
  })

  it("creates and looks up a real invoice by both payment hash and invoice string", async () => {
    const handler = NwcEventHandler()
    const created = await createInvoiceForBob()

    expect(created.amount).toBe(10_000)
    expect(created.invoice).toBeDefined()
    const createdInvoice = created.invoice as string

    expect(createdInvoice.startsWith("ln")).toBe(true)
    expect(created.payment_hash).toHaveLength(64)
    expect(created.state).toBe(PaymentState.PENDING)

    const lookupByHash = await retryAsync(async () =>
      requireSuccess<Nip47LookupInvoiceResult>(
        await handler.handle(
          {
            method: Nip47Method.LookupInvoice,
            params: { payment_hash: created.payment_hash },
          },
          bobConnection,
        ),
      ),
    )

    const lookupByInvoice = await retryAsync(async () =>
      requireSuccess<Nip47LookupInvoiceResult>(
        await handler.handle(
          {
            method: Nip47Method.LookupInvoice,
            params: { invoice: createdInvoice },
          },
          bobConnection,
        ),
      ),
    )

    expect(lookupByHash.payment_hash).toBe(created.payment_hash)
    expect(lookupByHash.invoice).toBe(createdInvoice)
    expect(lookupByHash.state).toBe(PaymentState.PENDING)
    expect(lookupByInvoice.payment_hash).toBe(created.payment_hash)
    expect(lookupByInvoice.invoice).toBe(createdInvoice)
  })

  it("lists unpaid incoming invoices through the real transaction range helpers", async () => {
    const handler = NwcEventHandler()
    const created = await createInvoiceForBob({
      amount: 11_000,
      description: `list-${randomUUID()}`,
    })

    const result = await retryAsync(async () => {
      const list = requireSuccess<Nip47ListTransactionsResult>(
        await handler.handle(
          {
            method: Nip47Method.ListTransactions,
            params: {
              type: "incoming",
              unpaid: true,
              limit: 20,
            },
          },
          bobConnection,
        ),
      )

      const matching = list.transactions.find(
        (transaction) => transaction.payment_hash === created.payment_hash,
      )
      if (!matching) {
        throw new Error("Created invoice not visible in list_transactions yet")
      }

      return { list, matching }
    })

    expect(result.matching.type).toBe("incoming")
    expect(result.matching.invoice).toBe(created.invoice)
    expect(result.matching.amount).toBe(created.amount)
  })

  it("pays a real invoice and returns preimage and fees", async () => {
    const handler = NwcEventHandler()
    const created = await createInvoiceForBob({
      amount: 12_000,
      description: `pay-${randomUUID()}`,
    })
    const createdInvoice = created.invoice as string

    const payment = requireSuccess<Nip47PayInvoiceResult>(
      await handler.handle(
        {
          method: Nip47Method.PayInvoice,
          params: { invoice: createdInvoice },
        },
        aliceConnection,
      ),
    )

    expect(payment.preimage).toHaveLength(64)
    expect(payment.fees_paid).toBeGreaterThanOrEqual(0)

    const settledInvoice = await retryAsync(async () => {
      const lookup = requireSuccess<Nip47LookupInvoiceResult>(
        await handler.handle(
          {
            method: Nip47Method.LookupInvoice,
            params: { payment_hash: created.payment_hash },
          },
          bobConnection,
        ),
      )

      if (lookup.state !== PaymentState.PAID) {
        throw new Error(`Invoice ${created.payment_hash} is not settled yet`)
      }

      return lookup
    })

    expect(settledInvoice.state).toBe(PaymentState.PAID)
    expect(settledInvoice.settled_at).toBeDefined()
  })
})
