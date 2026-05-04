import {
  clearAllTables,
  closeTestDb,
  getStreamCursorByName,
  runMigrations,
} from "../helpers"

import { closeDbConnections } from "@/services/db/query-builder"
import { StreamCursorsRepository } from "@/services/db/stream-cursors"

describe("StreamCursorsRepository", () => {
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

  it("returns null when no cursor has been stored for the stream", async () => {
    const repo = StreamCursorsRepository()

    const result = await repo.get("transactions")

    expect(result).toBeNull()
  })

  it("persists and returns a cursor across repository instances", async () => {
    const firstRepo = StreamCursorsRepository()
    const secondRepo = StreamCursorsRepository()

    const saveResult = await firstRepo.set("transactions", "cursor-1")
    expect(saveResult).toBeUndefined()

    const stored = await getStreamCursorByName("transactions")
    expect(stored?.cursor_value).toBe("cursor-1")

    const loaded = await secondRepo.get("transactions")
    expect(loaded).toBe("cursor-1")
  })

  it("upserts an existing cursor value", async () => {
    const repo = StreamCursorsRepository()

    await repo.set("transactions", "cursor-1")
    const updated = await repo.set("transactions", "cursor-2")

    expect(updated).toBeUndefined()

    const stored = await getStreamCursorByName("transactions")
    expect(stored?.cursor_value).toBe("cursor-2")
  })
})
