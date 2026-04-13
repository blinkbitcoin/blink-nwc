import {
  Nip47Error,
  Nip47InsufficientBalanceError,
  Nip47InternalError,
  Nip47NotFoundError,
  Nip47OtherError,
  Nip47PaymentFailedError,
  Nip47QuotaExceededError,
  Nip47RateLimitedError,
  Nip47RestrictedError,
  Nip47UnauthorizedError,
} from "@/domain/nostr"
import { BlinkServiceError } from "@/services/core/errors"

export const parseErrorForNip47Response = (err: BlinkServiceError): Nip47Error => {
  const message = err.message || "An error occurred"

  switch (err.name) {
    case "QuotaExceededError":
      return new Nip47QuotaExceededError(message)
    case "InvoiceNotFoundError":
      return new Nip47NotFoundError(message)
    case "InsufficientBalanceError":
      return new Nip47InsufficientBalanceError(message)
    case "RateLimitError":
      return new Nip47RateLimitedError(message)
    case "CouldNotAuthorizeError":
      return new Nip47UnauthorizedError(message)
    case "TransactionRestrictedError":
      return new Nip47RestrictedError(message)
    case "PaymentFailedError":
    case "PaymentPendingError":
    case "RouteNotFoundError":
    case "PaymentRejectedError":
    case "PaymentTimedOutError":
    case "InvoiceExpiredError":
    case "InvoiceAlreadyPaidError":
      return new Nip47PaymentFailedError(message)
    case "InvoiceDecodeError":
    case "InvalidInvoiceAmountError":
    case "ValidationError":
    case "InvalidWalletIdError":
      return new Nip47OtherError(message)
    case "SelfPaymentError":
      return new Nip47RestrictedError(message)
    case "ServiceUnavailableError":
    case "PriceServiceOfflineError":
    case "DealerOfflineError":
    case "CouldNotFetchNodeInfoError":
    case "CouldNotGetBalanceError":
    case "CouldNotCreateInvoiceError":
    case "CouldNotPayInvoiceError":
      return new Nip47InternalError(message)
    case "UnknownBlinkServiceError":
    case "UnknownError":
    case "InvalidResponseError":
      return new Nip47InternalError(
        `Unknown error occurred. Please try again later or contact support if it persists. ${message ? `Details: ${message}` : ""}`,
      )
    default:
      return new Nip47OtherError(
        `Unexpected error occurred. Please try again later or contact support if it persists. Code: ${err.name || "unknown"}`,
      )
  }
}
