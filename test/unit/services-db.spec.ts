jest.mock("@/services/logger", () => {
  const logger = {
    error: jest.fn(),
  }

  return {
    __logger: logger,
    baseLogger: {
      child: jest.fn(() => logger),
    },
  }
})

import {
  CannotConnectToDbError,
  ForeignKeyViolationError,
  NotNullConstraintViolationError,
  UniqueConstraintViolationError,
  UnknownRepositoryError,
} from "@/domain/errors"
import { KnownDbErrorDetails, parseRepositoryError } from "@/services/db/index"

describe("parseRepositoryError", () => {
  const loggerModule = jest.requireMock("@/services/logger") as {
    __logger: { error: jest.Mock }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    KnownDbErrorDetails.InvalidConnection,
    KnownDbErrorDetails.InvalidCredentials,
    KnownDbErrorDetails.InvalidDatabase,
  ])("maps %s to CannotConnectToDbError", (code) => {
    const error = parseRepositoryError({ code, message: "db is down" })

    expect(error).toBeInstanceOf(CannotConnectToDbError)
  })

  it("maps unique constraint violations", () => {
    const error = parseRepositoryError({
      code: KnownDbErrorDetails.UniqueViolation,
      constraint: "nwc_connections_app_pubkey_key",
    })

    expect(error).toBeInstanceOf(UniqueConstraintViolationError)
    expect(error.message).toContain("nwc_connections_app_pubkey_key")
  })

  it("maps foreign key violations", () => {
    const error = parseRepositoryError({
      code: KnownDbErrorDetails.ForeignKeyViolation,
      constraint: "nwc_connections_wallet_id_fkey",
    })

    expect(error).toBeInstanceOf(ForeignKeyViolationError)
    expect(error.message).toContain("nwc_connections_wallet_id_fkey")
  })

  it("maps not-null violations", () => {
    const error = parseRepositoryError({
      code: KnownDbErrorDetails.NotNullViolation,
      constraint: "api_key",
    })

    expect(error).toBeInstanceOf(NotNullConstraintViolationError)
    expect(error.message).toContain("api_key")
  })

  it("maps non-postgres values to UnknownRepositoryError with the parsed message", () => {
    const error = parseRepositoryError({ reason: "bad input" })

    expect(error).toBeInstanceOf(UnknownRepositoryError)
    expect(error.message).toBe(JSON.stringify({ reason: "bad input" }))
  })

  it("logs and maps unknown postgres error codes", () => {
    const error = parseRepositoryError({
      code: "99999",
      message: "something unexpected happened",
    })

    expect(error).toBeInstanceOf(UnknownRepositoryError)
    expect(loggerModule.__logger.error).toHaveBeenCalledWith(
      { code: "99999", error: "something unexpected happened" },
      "unknown PG error code",
    )
  })
})
