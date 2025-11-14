import { DomainError, ErrorLevel } from "@/domain/errors"

export class BlinkServiceError extends DomainError {}
export class CouldNotFetchNodeInfoError extends BlinkServiceError {}
export class CouldNotGetBalanceError extends BlinkServiceError {}
export class CouldNotCreateInvoiceError extends BlinkServiceError {}
export class CouldNotPayInvoiceError extends BlinkServiceError {}

export class InvalidResponseError extends BlinkServiceError {}
export class UnknownBlinkServiceError extends BlinkServiceError {
  level = ErrorLevel.Critical
}
export class InsufficientBalanceError extends BlinkServiceError {}
export class UnknownError extends BlinkServiceError {}

export class CouldNotAuthorizeError extends BlinkServiceError {}
export class InvoiceNotFoundError extends BlinkServiceError {}
