import { parseErrorMessageFromUnknown } from "./error-parsers"
import { ErrorLevel as ErrorLevelType } from "./index.types"

export const ErrorLevel = {
  Info: "info",
  Warn: "warn",
  Critical: "critical",
} as const

export const RankedErrorLevel = [ErrorLevel.Info, ErrorLevel.Warn, ErrorLevel.Critical]

export class DomainError extends Error {
  name: string
  level?: ErrorLevelType
  constructor(message?: string | unknown | Error) {
    super(parseErrorMessageFromUnknown(message))
    this.name = this.constructor.name
    this.level = ErrorLevel.Info
  }
}

export class ValidationError extends DomainError {}
export class InvalidWalletId extends ValidationError {}
export class InvalidUserId extends ValidationError {}
export class InvalidApiKey extends ValidationError {}

export class RepositoryError extends DomainError {}
export class CouldNotFindError extends RepositoryError {}
export class CouldNotFindNwcConnectionFromIdError extends CouldNotFindError {}
export class CouldNotFindNwcConnectionFromAppPubkeyError extends CouldNotFindError {}
export class CouldNotFindNwcConnectionFromWalletIdError extends CouldNotFindError {}
export class CouldNotFindNwcConnectionFromAccountIdError extends CouldNotFindError {}
export class CouldNotFindNwcConnectionFromUserIdError extends CouldNotFindError {}


export class NwcCreateConnectionError extends DomainError {}

export const parseErrorFromUnknown = (error: unknown): Error => {
  const err =
    error instanceof Error
      ? error
      : typeof error === "string"
        ? new Error(error)
        : error instanceof Object
          ? new Error(JSON.stringify(error))
          : new Error("Unknown error")
  return err
}
