import {
  clearAllTables,
  closeTestDb,
  getProcessedRequestByEventId,
  runMigrations,
} from "../helpers"

import { closeDbConnections } from "@/services/db/query-builder"
import { ProcessedNwcRequestsRepository } from "@/services/db/processed-nwc-requests"

describe("ProcessedNwcRequestsRepository", () => {
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

  it("tracks processed request ids across repository instances", async () => {
    const eventId = "request-id"
    const expiresAt = new Date(Date.now() + 60_000)

    const firstRepo = ProcessedNwcRequestsRepository()
    const secondRepo = ProcessedNwcRequestsRepository()

    const markResult = await firstRepo.markProcessed(eventId, expiresAt)
    expect(markResult).toBeUndefined()

    const stored = await getProcessedRequestByEventId(eventId)
    expect(stored).toBeDefined()

    const isProcessed = await secondRepo.isProcessed(eventId)
    expect(isProcessed).toBe(true)
  })

  it("prunes expired processed request ids", async () => {
    const repo = ProcessedNwcRequestsRepository()
    const eventId = "expired-request-id"

    const markResult = await repo.markProcessed(eventId, new Date(Date.now() - 60_000))
    expect(markResult).toBeUndefined()

    const pruneResult = await repo.pruneExpired()
    expect(pruneResult).toBe(1)

    const stored = await getProcessedRequestByEventId(eventId)
    expect(stored).toBeUndefined()

    const isProcessed = await repo.isProcessed(eventId)
    expect(isProcessed).toBe(false)
  })
})
