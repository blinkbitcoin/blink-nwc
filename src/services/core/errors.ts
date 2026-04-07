import { DomainError, ErrorLevel } from "@/domain/errors"
import { IError } from "@/graphql/index.types"
import { GraphQlApplicationError } from "@/graphql/internal-client/generated"
import { recordExceptionInCurrentSpan } from "@/services/tracing"

export class BlinkServiceError extends DomainError {}

// General errors
export class InvalidResponseError extends BlinkServiceError {}
export class UnknownBlinkServiceError extends BlinkServiceError {
  level = ErrorLevel.Critical
}
export class CouldNotAuthorizeError extends BlinkServiceError {}

// Node info errors
export class CouldNotFetchNodeInfoError extends BlinkServiceError {}

// Balance errors
export class CouldNotGetBalanceError extends BlinkServiceError {}

// Invoice errors
export class CouldNotCreateInvoiceError extends BlinkServiceError {}
export class InvoiceNotFoundError extends BlinkServiceError {}
export class InvoiceExpiredError extends BlinkServiceError {}
export class InvoiceAlreadyPaidError extends BlinkServiceError {}
export class InvoiceDecodeError extends BlinkServiceError {}
export class InvalidInvoiceAmountError extends BlinkServiceError {}

// Payment errors
export class CouldNotPayInvoiceError extends BlinkServiceError {}
export class InsufficientBalanceError extends BlinkServiceError {}
export class PaymentFailedError extends BlinkServiceError {}
export class PaymentPendingError extends BlinkServiceError {}
export class RouteNotFoundError extends BlinkServiceError {}
export class PaymentRejectedError extends BlinkServiceError {}
export class PaymentTimedOutError extends BlinkServiceError {}
export class SelfPaymentError extends BlinkServiceError {}

// Rate limit errors
export class RateLimitError extends BlinkServiceError {}

// Transaction restrictions
export class TransactionRestrictedError extends BlinkServiceError {}

// Validation errors
export class ValidationError extends BlinkServiceError {}
export class InvalidWalletIdError extends BlinkServiceError {}

// Service availability errors
export class ServiceUnavailableError extends BlinkServiceError {}
export class PriceServiceOfflineError extends BlinkServiceError {}
export class DealerOfflineError extends BlinkServiceError {}

export class QuotaExceededError extends BlinkServiceError {}

export const parseBlinkError = (err: IError | GraphQlApplicationError) => {
  const code = err.code || undefined
  const message = err.message.toLowerCase() || "Unknown error"

  switch (code) {
    // auth errors
    case KnownBlinkErrorCodes.NotAuthenticated:
    case KnownBlinkErrorCodes.NotAuthorized:
    case KnownBlinkErrorCodes.PhoneAccountAlreadyExists:
    case KnownBlinkErrorCodes.PhoneAccountAlreadyExistsNeedToSweepFunds:
    case KnownBlinkErrorCodes.EmailAccountAlreadyExists:
    case KnownBlinkErrorCodes.EmailAlreadyAttached:
    case KnownBlinkErrorCodes.PhoneAlreadyAttached:
    case KnownBlinkErrorCodes.PhoneCodeError:
    case KnownBlinkErrorCodes.PhoneProviderError:
    case KnownBlinkErrorCodes.EmailNotVerified:
    case KnownBlinkErrorCodes.SessionRefreshRequired:
    case KnownBlinkErrorCodes.CodeExpired:
    case KnownBlinkErrorCodes.TotpAlreadyExists:
    case KnownBlinkErrorCodes.IpNotAllowedToOnboard:
    case KnownBlinkErrorCodes.PhoneNotAllowedToOnboard:
    case KnownBlinkErrorCodes.InvalidPhoneMetadataForOnboarding:
    case KnownBlinkErrorCodes.UnauthorizedIpForQuizzes:
    case KnownBlinkErrorCodes.UnauthorizedCountryIpForQuizzes:
    case KnownBlinkErrorCodes.UnauthorizedVpnIpForQuizzes:
      return new CouldNotAuthorizeError(message)

    // balance errors
    case KnownBlinkErrorCodes.InsufficientBalance:
      return new InsufficientBalanceError(message)

    // payment errors
    case KnownBlinkErrorCodes.LightningPaymentError:
      return new PaymentFailedError(message)
    case KnownBlinkErrorCodes.RouteFindingError:
      return new RouteNotFoundError(message)
    case KnownBlinkErrorCodes.SelfPayment:
      return new SelfPaymentError(message)

    // invoice errors
    case KnownBlinkErrorCodes.InvoiceDecodeError:
      return new InvoiceDecodeError(message)
    case KnownBlinkErrorCodes.NotFound:
      return new InvoiceNotFoundError(message)

    // rate limiting
    case KnownBlinkErrorCodes.TooManyRequests:
      return new RateLimitError(message)

    // transaction restrictions
    case KnownBlinkErrorCodes.TransactionRestricted:
    case KnownBlinkErrorCodes.OperationRestricted:
      if (message.startsWith('{"daily"')) {
        return new QuotaExceededError(message)
      }
      return new TransactionRestrictedError(message)

    // validation errors
    case KnownBlinkErrorCodes.InvalidInput:
      return new ValidationError(message)

    // service availability
    case KnownBlinkErrorCodes.LndOffline:
    case KnownBlinkErrorCodes.OnchainServiceUnavailable:
      return new ServiceUnavailableError(message)
    case KnownBlinkErrorCodes.PriceServiceOffline:
      return new PriceServiceOfflineError(message)
    case KnownBlinkErrorCodes.DealerOffline:
      return new DealerOfflineError(message)

    // database errors
    case KnownBlinkErrorCodes.DbError:
      return new ServiceUnavailableError(message)

    // unknown/unexpected errors
    case KnownBlinkErrorCodes.UnknownClientError:
    case KnownBlinkErrorCodes.UnexpectedClientError:
      return new UnknownBlinkServiceError(message)
  }
  if (
    message.includes("not authenticated") ||
    message.includes("not authorized") ||
    message.includes("unauthorized") ||
    message.includes("invalid or incorrect code") ||
    message.includes("session") ||
    message.includes("token") ||
    message.includes("invalid api key") ||
    message.includes("401") ||
    message.includes("403")
  ) {
    return new CouldNotAuthorizeError(message)
  }

  if (message.includes("too many") || message.includes("rate limit")) {
    return new RateLimitError(message)
  }

  if (
    message.includes("user tried to pay invoice with hash") &&
    message.includes("does not exist")
  ) {
    return new InvoiceNotFoundError(message)
  }
  if (message.includes("invoice already expired")) {
    return new InvoiceExpiredError(message)
  }
  if (
    message.includes("invoice is already paid") ||
    message.includes("alreadyPaidError")
  ) {
    return new InvoiceAlreadyPaidError(message)
  }
  if (message.includes("invalid invoice amount")) {
    return new InvalidInvoiceAmountError(message)
  }

  if (message.includes("payment was rejected by destination")) {
    return new PaymentRejectedError(message)
  }
  if (
    message.includes("temporary failure when trying to pay") ||
    message.includes("timed out")
  ) {
    return new PaymentTimedOutError(message)
  }
  if (message.includes("unable to find a route")) {
    return new RouteNotFoundError(message)
  }
  if (
    message.includes("insufficient balance") ||
    message.includes("balance is too low")
  ) {
    return new InsufficientBalanceError(message)
  }

  if (message.includes("invalid walletid")) {
    return new InvalidWalletIdError(message)
  }

  if (
    message.includes("service offline") ||
    message.includes("service unavailable") ||
    message.includes("temporarily unavailable") ||
    message.includes("connection") ||
    message.includes("timeout")
  ) {
    return new ServiceUnavailableError(message)
  }

  recordExceptionInCurrentSpan({
    error: `Unknown core service error occurred. Code: ${err.code} Message: ${err.message}`,
    level: ErrorLevel.Warn,
  })
  return new UnknownBlinkServiceError(message)
}
export const KnownBlinkErrorCodes = {
  NotAuthenticated: "NOT_AUTHENTICATED",
  NotAuthorized: "NOT_AUTHORIZED",
  PhoneAccountAlreadyExists: "PHONE_ACCOUNT_ALREADY_EXISTS_ERROR",
  PhoneAccountAlreadyExistsNeedToSweepFunds:
    "PHONE_ACCOUNT_ALREADY_EXISTS_NEED_TO_SWEEP_FUNDS_ERROR",
  EmailAccountAlreadyExists: "EMAIL_ACCOUNT_ALREADY_EXISTS_ERROR",
  EmailAlreadyAttached: "EMAIL_ALREADY_ATTACHED_ERROR",
  PhoneAlreadyAttached: "PHONE_ALREADY_ATTACHED_ERROR",
  PhoneCodeError: "PHONE_CODE_ERROR",
  PhoneProviderError: "PHONE_PROVIDER_ERROR",
  EmailNotVerified: "EMAIL_NOT_VERIFIED_ERROR",
  SessionRefreshRequired: "SESSION_REFRESH_REQUIRED_ERROR",
  CodeExpired: "CODE_EXPIRED_ERROR",
  TotpAlreadyExists: "TOTP_ACCOUNT_ALREADY_EXISTS_ERROR",

  IpNotAllowedToOnboard: "IP_NOT_ALLOWED_TO_ONBOARD_ERROR",
  PhoneNotAllowedToOnboard: "PHONE_NOT_ALLOWED_TO_ONBOARD_ERROR",
  InvalidPhoneMetadataForOnboarding: "INVALID_PHONE_METADATA_FOR_ONBOARDING_ERROR",
  UnauthorizedIpForQuizzes: "UNAUTHORIZED_IP_FOR_QUIZZES",
  UnauthorizedCountryIpForQuizzes: "UNAUTHORIZED_COUNTRY_IP_FOR_QUIZZES",
  UnauthorizedVpnIpForQuizzes: "UNAUTHORIZED_VPN_IP_FOR_QUIZZES",

  InsufficientBalance: "INSUFFICIENT_BALANCE",

  LightningPaymentError: "LIGHTNING_PAYMENT_ERROR",
  RouteFindingError: "ROUTE_FINDING_ERROR",
  SelfPayment: "CANT_PAY_SELF",

  InvoiceDecodeError: "INVOICE_DECODE_ERROR",
  NotFound: "NOT_FOUND",

  TooManyRequests: "TOO_MANY_REQUEST",

  TransactionRestricted: "TRANSACTION_RESTRICTED",
  OperationRestricted: "OPERATION_RESTRICTED",

  InvalidInput: "INVALID_INPUT",

  LndOffline: "LND_OFFLINE",
  OnchainServiceUnavailable: "ONCHAIN_SERVICE_UNAVAILABLE",
  PriceServiceOffline: "PRICE_SERVICE_OFFLINE",
  DealerOffline: "DEALER_OFFLINE",

  DbError: "DB_ERROR",

  UnknownClientError: "UNKNOWN_CLIENT_ERROR",
  UnexpectedClientError: "UNEXPECTED_CLIENT_ERROR",
} as const
