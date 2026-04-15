import { mapAndParseErrorForGqlResponse, mapError } from "@/graphql/error-map"
import {
  DbError,
  InputValidationError,
  NotFoundError,
  UnexpectedClientError,
  UnknownClientError,
} from "@/graphql/errors"
import {
  CannotConnectToDbError,
  CouldNotFindNwcConnectionFromIdError,
  InvalidWalletId,
  NwcCreateConnectionError,
} from "@/domain/errors"
import { ExampleError, UnknownExampleError } from "@/domain/example/errors"

describe("graphql error mapping", () => {
  it("maps example errors to client-facing graphql errors", () => {
    const notFound = mapError(new ExampleError("missing example"))
    const unknown = mapError(new UnknownExampleError("opaque failure"))

    expect(notFound).toBeInstanceOf(NotFoundError)
    expect(notFound.message).toBe("missing example")
    expect(notFound.extensions?.code).toBe("NOT_FOUND")

    expect(unknown).toBeInstanceOf(UnknownClientError)
    expect(unknown.message).toContain("UnknownExampleError")
    expect(unknown.extensions?.code).toBe("UNKNOWN_CLIENT_ERROR")
  })

  it("maps validation and lookup errors", () => {
    const validation = mapError(new InvalidWalletId("bad wallet"))
    const notFound = mapError(new CouldNotFindNwcConnectionFromIdError("missing"))

    expect(validation).toBeInstanceOf(InputValidationError)
    expect(validation.message).toBe("bad wallet")
    expect(validation.extensions?.code).toBe("INVALID_INPUT")

    expect(notFound).toBeInstanceOf(NotFoundError)
    expect(notFound.message).toBe("missing")
    expect(notFound.extensions?.code).toBe("NOT_FOUND")
  })

  it("maps database and repository errors", () => {
    const db = mapError(new CannotConnectToDbError())
    const repository = mapError(new NwcCreateConnectionError("write failed"))
    const unexpected = mapError({
      name: "ConstraintViolationError",
      message: "unexpected",
    } as never)

    expect(db).toBeInstanceOf(DbError)
    expect(db.extensions?.code).toBe("DB_ERROR")

    expect(repository).toBeInstanceOf(UnexpectedClientError)
    expect(repository.message).toContain("NwcCreateConnectionError")
    expect(repository.extensions?.code).toBe("UNEXPECTED_CLIENT_ERROR")

    expect(unexpected).toBeInstanceOf(UnexpectedClientError)
    expect(unexpected.message).toContain("ConstraintViolationError")
  })

  it("serializes mapped errors for graphql mutation payloads", () => {
    const gqlError = mapAndParseErrorForGqlResponse(new InvalidWalletId("bad wallet"))

    expect(gqlError).toEqual({
      message: "bad wallet",
      path: undefined,
      code: "INVALID_INPUT",
    })
  })
})
