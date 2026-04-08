import {
  CannotConnectToDbError,
  UnknownRepositoryError,
  UniqueConstraintViolationError,
  ForeignKeyViolationError,
  NotNullConstraintViolationError,
} from "@/domain/errors"
import { parseErrorMessageFromUnknown } from "@/domain/error-parsers"

export * from "./query-builder"
export * from "./connections"

export const KnownDbErrorDetails = {
  InvalidConnection: "ECONNREFUSED",
  InvalidCredentials: "28P01",
  InvalidDatabase: "3D000",
  UniqueViolation: "23505",
  ForeignKeyViolation: "23503",
  NotNullViolation: "23502",
} as const

type PgError = Error & {
  code?: string
  constraint?: string
}

const isPgError = (e: unknown): e is PgError => {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as any).code === "string"
  )
}

export const parseRepositoryError = (err: unknown) => {
  if (!isPgError(err)) {
    const msg = parseErrorMessageFromUnknown(err)
    return new UnknownRepositoryError(msg)
  }

  switch (err.code) {
    case KnownDbErrorDetails.InvalidConnection:
    case KnownDbErrorDetails.InvalidCredentials:
    case KnownDbErrorDetails.InvalidDatabase:
      return new CannotConnectToDbError()

    case KnownDbErrorDetails.UniqueViolation:
      return new UniqueConstraintViolationError(err.constraint ?? "unknown_constraint")

    case KnownDbErrorDetails.ForeignKeyViolation:
      return new ForeignKeyViolationError(`Foreign key violation: ${err.constraint}`)

    case KnownDbErrorDetails.NotNullViolation:
      return new NotNullConstraintViolationError(
        `Missing required column: ${err.constraint}`,
      )

    default:
      console.error("Unknown PG error code:", err.code, err.message)
      return new UnknownRepositoryError()
  }
}
