import {
  NotFoundError,
  UnexpectedClientError,
  UnknownClientError,
  InputValidationError,
  DbError,
} from "./errors"

import { baseLogger } from "@/services/logger"
import { CustomGraphQLError, IError } from "@/graphql/index.types"

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

    case "CannotConnectToDbError":
      message =
        "Service offline, please try again in a few minutes. If the problem persists, please contact support."
      return new DbError({ message, logger: baseLogger })

    case "ValidationError":
    case "InvalidUserId":
    case "InvalidWalletId":
    case "InvalidApiKey":
    case "InvalidPermissions":
    case "InvalidNwcConnectionId":
    case "InvalidNwcUri":
    case "InvalidNwcBudget":
    case "InvalidInvoice":
    case "InvalidAmount":
    case "InvalidNwcAlias":
    case "InvalidUnixTimestamp":
    case "InvalidHash":
    case "InvalidPaymentDirection":
    case "InvalidDescription":
      message = error.message
      return new InputValidationError({ message, logger: baseLogger })

    case "CouldNotFindError":
    case "CouldNotFindNwcConnectionFromIdError":
    case "CouldNotFindNwcConnectionFromAppPubkeyError":
    case "CouldNotFindNwcConnectionFromWalletIdError":
    case "CouldNotFindNwcConnectionFromAccountIdError":
    case "CouldNotFindNwcConnectionFromUserIdError":
    case "CouldNotFindWebhookConnectionError":
      message = error.message
      return new NotFoundError({ message, logger: baseLogger })

    case "RepositoryError":
    case "NwcCreateConnectionError":
      message = `Database error occurred, please try again or contact support if it persists (code: ${
        error.name
      }${error.message ? ": " + error.message : ""})`
      return new UnexpectedClientError({ message, logger: baseLogger })

    case "ConstraintViolationError":
    case "UniqueConstraintViolationError":
    case "NotNullConstraintViolationError":
    case "ForeignKeyViolationError":
    case "UnknownRepositoryError":
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
    path: mappedError.path as any,
    code: `${mappedError.extensions.code}`,
  }
}
