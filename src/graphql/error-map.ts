import { NotFoundError, UnexpectedClientError, UnknownClientError, InputValidationError } from "./errors"

import { baseLogger } from "@/services/logger"

const assertUnreachable = (x: never): never => {
  throw new Error(`This should never compile with ${x}`)
}

export const mapError = (error: ApplicationError): CustomGraphQLError => {
  const errorName = error.name as ApplicationErrorKey
  let message = ""
  switch (errorName) {
    case "ExampleError":
      message = error.message
      return new NotFoundError({ message, logger: baseLogger })

    case "UnknownExampleError":
      message = `Unknown error occurred (code: ${error.name}${
        error.message ? ": " + error.message : ""
      })`
      return new UnknownClientError({ message, logger: baseLogger })

    case "ValidationError":
    case "InvalidUserId":
    case "InvalidWalletId":
    case "InvalidApiKey":
      message = error.message
      return new InputValidationError({ message, logger: baseLogger })

    case "CouldNotFindError":
    case "CouldNotFindNwcConnectionFromIdError":
    case "CouldNotFindNwcConnectionFromAppPubkeyError":
    case "CouldNotFindNwcConnectionFromWalletIdError":
    case "CouldNotFindNwcConnectionFromAccountIdError":
    case "CouldNotFindNwcConnectionFromUserIdError":
      message = error.message
      return new NotFoundError({ message, logger: baseLogger })

    case "RepositoryError":
    case "NwcCreateConnectionError":
      message = `Database error occurred, please try again or contact support if it persists (code: ${
        error.name
      }${error.message ? ": " + error.message : ""})`
      return new UnexpectedClientError({ message, logger: baseLogger })

    case "ErrorLevel":
    case "RankedErrorLevel":
    case "DomainError":
    case "parseErrorFromUnknown":
      message = `Unexpected error occurred, please try again or contact support if it persists (code: ${
        error.name
      }${error.message ? ": " + error.message : ""})`
      return new UnexpectedClientError({ message, logger: baseLogger })
    default:
      return assertUnreachable(errorName)
  }
}

export const mapAndParseErrorForGqlResponse = (err: ApplicationError): IError => {
  const mappedError = mapError(err)
  return {
    message: mappedError.message,
    path: mappedError.path,
    code: `${mappedError.extensions.code}`,
  }
}
