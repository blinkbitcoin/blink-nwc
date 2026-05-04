jest.mock("@/services/db/index", () => ({
  parseRepositoryError: jest.fn(),
}))

jest.mock("@/services/db/query-builder", () => ({
  queryBuilder: Object.assign(jest.fn(), {
    fn: {
      now: jest.fn(() => "NOW"),
    },
  }),
}))

jest.mock("@/services/tracing", () => ({
  wrapAsyncFunctionsToRunInSpan: jest.fn(({ fns }) => fns),
}))

import { RepositoryError } from "@/domain/errors"
import { parseRepositoryError } from "@/services/db/index"
import { queryBuilder } from "@/services/db/query-builder"
import { NotificationAuditRepository } from "@/services/db/notification-audit"

const mockParseRepositoryError = parseRepositoryError as jest.Mock
const mockQueryBuilder = queryBuilder as unknown as jest.Mock & {
  fn: {
    now: jest.Mock
  }
}

describe("NotificationAuditRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("detects an already published notification for a connection and ledger transaction", async () => {
    const first = jest.fn().mockResolvedValue({ id: "audit-1" })
    const whereRaw = jest.fn().mockReturnValue({ first })
    const where = jest.fn().mockReturnValue({ whereRaw })
    mockQueryBuilder.mockReturnValue({ where })

    const repo = NotificationAuditRepository()

    await expect(
      repo.hasPublishedNotification({
        connectionId: "connection-1" as never,
        notificationType: "payment_received",
        ledgerTransactionId: "ledger-1",
      }),
    ).resolves.toBe(true)

    expect(mockQueryBuilder).toHaveBeenCalledWith("nwc_audit_log")
    expect(where).toHaveBeenCalledWith({
      connection_id: "connection-1",
      action: "notification_published",
      method: "payment_received",
      status: "success",
    })
    expect(whereRaw).toHaveBeenCalledWith("metadata @> ?::jsonb", [
      JSON.stringify({ ledger_transaction_id: "ledger-1" }),
    ])
    expect(first).toHaveBeenCalledWith("id")
  })

  it("returns false when no published notification audit row exists", async () => {
    const first = jest.fn().mockResolvedValue(undefined)
    const whereRaw = jest.fn().mockReturnValue({ first })
    const where = jest.fn().mockReturnValue({ whereRaw })
    mockQueryBuilder.mockReturnValue({ where })

    const repo = NotificationAuditRepository()

    await expect(
      repo.hasPublishedNotification({
        connectionId: "connection-1" as never,
        notificationType: "payment_sent",
        ledgerTransactionId: "ledger-1",
      }),
    ).resolves.toBe(false)
  })

  it("records a successful notification publish audit row", async () => {
    const insert = jest.fn().mockResolvedValue(undefined)
    mockQueryBuilder.mockReturnValue({ insert })

    const repo = NotificationAuditRepository()

    await expect(
      repo.recordPublishedNotification({
        connectionId: "connection-1" as never,
        userId: "user-1",
        notificationType: "payment_received",
        ledgerTransactionId: "ledger-1",
        paymentHash: "payment-hash-1" as never,
      }),
    ).resolves.toBeUndefined()

    expect(insert).toHaveBeenCalledWith({
      connection_id: "connection-1",
      user_id: "user-1",
      action: "notification_published",
      method: "payment_received",
      status: "success",
      metadata: {
        connection_id: "connection-1",
        ledger_transaction_id: "ledger-1",
        notification_type: "payment_received",
        payment_hash: "payment-hash-1",
      },
      created_at: "NOW",
    })
  })

  it("maps repository failures through parseRepositoryError", async () => {
    const failure = new Error("db failed")
    const parsed = new RepositoryError("parsed db failure")
    mockParseRepositoryError.mockReturnValue(parsed)
    mockQueryBuilder.mockImplementation(() => {
      throw failure
    })

    const repo = NotificationAuditRepository()

    await expect(
      repo.hasPublishedNotification({
        connectionId: "connection-1" as never,
        notificationType: "payment_received",
        ledgerTransactionId: "ledger-1",
      }),
    ).resolves.toBe(parsed)
    expect(mockParseRepositoryError).toHaveBeenCalledWith(failure)
  })
})
