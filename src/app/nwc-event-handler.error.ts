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
import {
  BlinkServiceError,
  CouldNotAuthorizeError,
  CouldNotCreateInvoiceError,
  CouldNotFetchNodeInfoError,
  CouldNotGetBalanceError,
  CouldNotPayInvoiceError,
  DealerOfflineError,
  InsufficientBalanceError,
  InvalidInvoiceAmountError,
  InvalidResponseError,
  InvalidWalletIdError,
  InvoiceAlreadyPaidError,
  InvoiceDecodeError,
  InvoiceExpiredError,
  InvoiceNotFoundError,
  PaymentFailedError,
  PaymentPendingError,
  PaymentRejectedError,
  PaymentTimedOutError,
  PriceServiceOfflineError,
  QuotaExceededError,
  RateLimitError,
  RouteNotFoundError,
  SelfPaymentError,
  ServiceUnavailableError,
  TransactionRestrictedError,
  UnknownBlinkServiceError,
  ValidationError,
} from "@/services/core/errors"

export const parseErrorForNip47Response = (err: BlinkServiceError): Nip47Error => {
  const message = err.message || "An error occurred"

  if (err instanceof QuotaExceededError) {
    return new Nip47QuotaExceededError(message)
  }

  if (err instanceof InvoiceNotFoundError) {
    return new Nip47NotFoundError(message)
  }

  if (err instanceof InsufficientBalanceError) {
    return new Nip47InsufficientBalanceError(message)
  }

  if (err instanceof RateLimitError) {
    return new Nip47RateLimitedError(message)
  }

  if (err instanceof CouldNotAuthorizeError) {
    return new Nip47UnauthorizedError(message)
  }

  if (err instanceof TransactionRestrictedError || err instanceof SelfPaymentError) {
    return new Nip47RestrictedError(message)
  }

  if (
    err instanceof PaymentFailedError ||
    err instanceof PaymentPendingError ||
    err instanceof RouteNotFoundError ||
    err instanceof PaymentRejectedError ||
    err instanceof PaymentTimedOutError ||
    err instanceof InvoiceExpiredError ||
    err instanceof InvoiceAlreadyPaidError
  ) {
    return new Nip47PaymentFailedError(message)
  }

  if (
    err instanceof InvoiceDecodeError ||
    err instanceof InvalidInvoiceAmountError ||
    err instanceof ValidationError ||
    err instanceof InvalidWalletIdError
  ) {
    return new Nip47OtherError(message)
  }

  if (
    err instanceof ServiceUnavailableError ||
    err instanceof PriceServiceOfflineError ||
    err instanceof DealerOfflineError ||
    err instanceof CouldNotFetchNodeInfoError ||
    err instanceof CouldNotGetBalanceError ||
    err instanceof CouldNotCreateInvoiceError ||
    err instanceof CouldNotPayInvoiceError
  ) {
    return new Nip47InternalError(message)
  }

  if (err instanceof UnknownBlinkServiceError || err instanceof InvalidResponseError) {
    return new Nip47InternalError(
      `Unknown error occurred. Please try again later or contact support if it persists. ${message ? `Details: ${message}` : ""}`,
    )
  }

  return new Nip47OtherError(
    `Unexpected error occurred. Please try again later or contact support if it persists. ${message ? `Details: ${message}` : ""}`,
  )
}
