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
