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

import { parseRepositoryError } from "@/services/db/index"
import { queryBuilder } from "@/services/db/query-builder"
import { StreamCursorsRepository } from "@/services/db/stream-cursors"

const mockParseRepositoryError = parseRepositoryError as jest.Mock
const mockQueryBuilder = queryBuilder as unknown as jest.Mock & {
  fn: {
    now: jest.Mock
  }
}

describe("StreamCursorsRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns the stored cursor value when present", async () => {
    const first = jest.fn().mockResolvedValue({
      cursor_value: "cursor-1",
    })
    const where = jest.fn().mockReturnValue({ first })
    mockQueryBuilder.mockReturnValue({ where })

    const repo = StreamCursorsRepository()

    await expect(repo.get("transactions")).resolves.toBe("cursor-1")
    expect(mockQueryBuilder).toHaveBeenCalledWith("stream_cursors")
    expect(where).toHaveBeenCalledWith({ stream_name: "transactions" })
  })

  it("returns null when no cursor has been stored", async () => {
    const first = jest.fn().mockResolvedValue(undefined)
    const where = jest.fn().mockReturnValue({ first })
    mockQueryBuilder.mockReturnValue({ where })

    const repo = StreamCursorsRepository()

    await expect(repo.get("transactions")).resolves.toBeNull()
  })

  it("upserts the stream cursor value", async () => {
    const merge = jest.fn().mockResolvedValue(undefined)
    const onConflict = jest.fn().mockReturnValue({ merge })
    const insert = jest.fn().mockReturnValue({ onConflict })
    mockQueryBuilder.mockReturnValue({ insert })

    const repo = StreamCursorsRepository()

    await expect(repo.set("transactions", "cursor-2")).resolves.toBeUndefined()

    expect(insert).toHaveBeenCalledWith({
      stream_name: "transactions",
      cursor_value: "cursor-2",
      updated_at: "NOW",
    })
    expect(onConflict).toHaveBeenCalledWith("stream_name")
    expect(merge).toHaveBeenCalledWith({
      cursor_value: "cursor-2",
      updated_at: "NOW",
    })
  })

  it("maps get failures through parseRepositoryError", async () => {
    const failure = new Error("db read failed")
    const parsed = new Error("parsed read failure")
    mockParseRepositoryError.mockReturnValue(parsed)
    mockQueryBuilder.mockImplementation(() => {
      throw failure
    })

    const repo = StreamCursorsRepository()

    await expect(repo.get("transactions")).resolves.toBe(parsed)
    expect(mockParseRepositoryError).toHaveBeenCalledWith(failure)
  })

  it("maps set failures through parseRepositoryError", async () => {
    const failure = new Error("db write failed")
    const parsed = new Error("parsed write failure")
    mockParseRepositoryError.mockReturnValue(parsed)
    mockQueryBuilder.mockImplementation(() => {
      throw failure
    })

    const repo = StreamCursorsRepository()

    await expect(repo.set("transactions", "cursor-3")).resolves.toBe(parsed)
    expect(mockParseRepositoryError).toHaveBeenCalledWith(failure)
  })
})
