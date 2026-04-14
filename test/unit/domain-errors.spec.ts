import {
  CannotConnectToDbError,
  ConstraintViolationError,
  CouldNotFindError,
  CouldNotFindNwcConnectionFromAccountIdError,
  CouldNotFindNwcConnectionFromAppPubkeyError,
  CouldNotFindNwcConnectionFromIdError,
  CouldNotFindNwcConnectionFromUserIdError,
  CouldNotFindNwcConnectionFromWalletIdError,
  CouldNotFindWebhookConnectionError,
  DomainError,
  ErrorLevel,
  ForeignKeyViolationError,
  InvalidAmount,
  InvalidApiKey,
  InvalidDescription,
  InvalidHash,
  InvalidInvoice,
  InvalidNwcAlias,
  InvalidNwcConnectionId,
  InvalidPaymentDirection,
  InvalidPermissions,
  InvalidUnixTimestamp,
  InvalidUserId,
  InvalidWalletId,
  NotNullConstraintViolationError,
  NwcCreateConnectionError,
  RankedErrorLevel,
  RepositoryError,
  UniqueConstraintViolationError,
  UnknownRepositoryError,
  ValidationError,
  parseErrorFromUnknown,
} from "@/domain/errors"

describe("domain errors", () => {
  it("exposes ranked error levels in ascending severity order", () => {
    expect(ErrorLevel).toEqual({
      Info: "info",
      Warn: "warn",
      Critical: "critical",
    })
    expect(RankedErrorLevel).toEqual(["info", "warn", "critical"])
  })

  it("normalizes unknown input passed to DomainError", () => {
    expect(new DomainError("boom").message).toBe("boom")
    expect(new DomainError(new Error("nested")).message).toBe("nested")
    expect(new DomainError({ reason: "bad" }).message).toBe(
      JSON.stringify({ reason: "bad" }),
    )
  })

  it.each([
    ["ValidationError", ValidationError],
    ["InvalidWalletId", InvalidWalletId],
    ["InvalidUserId", InvalidUserId],
    ["InvalidApiKey", InvalidApiKey],
    ["InvalidPermissions", InvalidPermissions],
    ["InvalidNwcConnectionId", InvalidNwcConnectionId],
    ["InvalidInvoice", InvalidInvoice],
    ["InvalidAmount", InvalidAmount],
    ["InvalidNwcAlias", InvalidNwcAlias],
    ["InvalidUnixTimestamp", InvalidUnixTimestamp],
    ["InvalidHash", InvalidHash],
    ["InvalidPaymentDirection", InvalidPaymentDirection],
    ["InvalidDescription", InvalidDescription],
    ["RepositoryError", RepositoryError],
    ["CouldNotFindError", CouldNotFindError],
    ["CouldNotFindNwcConnectionFromIdError", CouldNotFindNwcConnectionFromIdError],
    [
      "CouldNotFindNwcConnectionFromAppPubkeyError",
      CouldNotFindNwcConnectionFromAppPubkeyError,
    ],
    [
      "CouldNotFindNwcConnectionFromWalletIdError",
      CouldNotFindNwcConnectionFromWalletIdError,
    ],
    [
      "CouldNotFindNwcConnectionFromAccountIdError",
      CouldNotFindNwcConnectionFromAccountIdError,
    ],
    [
      "CouldNotFindNwcConnectionFromUserIdError",
      CouldNotFindNwcConnectionFromUserIdError,
    ],
    ["ConstraintViolationError", ConstraintViolationError],
    ["UniqueConstraintViolationError", UniqueConstraintViolationError],
    ["NotNullConstraintViolationError", NotNullConstraintViolationError],
    ["ForeignKeyViolationError", ForeignKeyViolationError],
    ["CouldNotFindWebhookConnectionError", CouldNotFindWebhookConnectionError],
    ["CannotConnectToDbError", CannotConnectToDbError],
    ["UnknownRepositoryError", UnknownRepositoryError],
    ["NwcCreateConnectionError", NwcCreateConnectionError],
  ])("%s preserves name, message, and inheritance", (_name, ErrorClass) => {
    const error = new ErrorClass("boom")

    expect(error).toBeInstanceOf(DomainError)
    expect(error.name).toBe(ErrorClass.name)
    expect(error.message).toBe("boom")
  })

  it("marks database connectivity errors as critical", () => {
    expect(new CannotConnectToDbError().level).toBe(ErrorLevel.Critical)
    expect(new UnknownRepositoryError().level).toBe(ErrorLevel.Critical)
  })

  it("normalizes unknown values into Error instances", () => {
    const original = new Error("boom")

    expect(parseErrorFromUnknown(original)).toBe(original)
    expect(parseErrorFromUnknown("oops")).toEqual(new Error("oops"))
    expect(parseErrorFromUnknown({ reason: "bad" })).toEqual(
      new Error(JSON.stringify({ reason: "bad" })),
    )
    expect(parseErrorFromUnknown(undefined)).toEqual(new Error("Unknown error"))
  })
})
