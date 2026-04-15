const mockRecordExceptionInCurrentSpan = jest.fn()

jest.mock("@/services/tracing", () => ({
  recordExceptionInCurrentSpan: (args: unknown) => mockRecordExceptionInCurrentSpan(args),
}))

import { ErrorLevel } from "@/domain/errors"
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
  KnownBlinkErrorCodes,
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
  parseBlinkError,
} from "@/services/core/errors"

describe("Blink service errors", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    ["BlinkServiceError", BlinkServiceError, ErrorLevel.Info],
    ["InvalidResponseError", InvalidResponseError, ErrorLevel.Info],
    ["UnknownBlinkServiceError", UnknownBlinkServiceError, ErrorLevel.Critical],
    ["CouldNotAuthorizeError", CouldNotAuthorizeError, ErrorLevel.Info],
    ["CouldNotFetchNodeInfoError", CouldNotFetchNodeInfoError, ErrorLevel.Info],
    ["CouldNotGetBalanceError", CouldNotGetBalanceError, ErrorLevel.Info],
    ["CouldNotCreateInvoiceError", CouldNotCreateInvoiceError, ErrorLevel.Info],
    ["InvoiceNotFoundError", InvoiceNotFoundError, ErrorLevel.Info],
    ["InvoiceExpiredError", InvoiceExpiredError, ErrorLevel.Info],
    ["InvoiceAlreadyPaidError", InvoiceAlreadyPaidError, ErrorLevel.Info],
    ["InvoiceDecodeError", InvoiceDecodeError, ErrorLevel.Info],
    ["InvalidInvoiceAmountError", InvalidInvoiceAmountError, ErrorLevel.Info],
    ["CouldNotPayInvoiceError", CouldNotPayInvoiceError, ErrorLevel.Info],
    ["InsufficientBalanceError", InsufficientBalanceError, ErrorLevel.Info],
    ["PaymentFailedError", PaymentFailedError, ErrorLevel.Info],
    ["PaymentPendingError", PaymentPendingError, ErrorLevel.Info],
    ["RouteNotFoundError", RouteNotFoundError, ErrorLevel.Info],
    ["PaymentRejectedError", PaymentRejectedError, ErrorLevel.Info],
    ["PaymentTimedOutError", PaymentTimedOutError, ErrorLevel.Info],
    ["SelfPaymentError", SelfPaymentError, ErrorLevel.Info],
    ["RateLimitError", RateLimitError, ErrorLevel.Info],
    ["TransactionRestrictedError", TransactionRestrictedError, ErrorLevel.Info],
    ["ValidationError", ValidationError, ErrorLevel.Info],
    ["InvalidWalletIdError", InvalidWalletIdError, ErrorLevel.Info],
    ["ServiceUnavailableError", ServiceUnavailableError, ErrorLevel.Info],
    ["PriceServiceOfflineError", PriceServiceOfflineError, ErrorLevel.Info],
    ["DealerOfflineError", DealerOfflineError, ErrorLevel.Info],
    ["QuotaExceededError", QuotaExceededError, ErrorLevel.Info],
  ])("%s preserves inheritance, level, and message", (_name, ErrorClass, level) => {
    const error = new ErrorClass("boom")

    expect(error).toBeInstanceOf(BlinkServiceError)
    expect(error.name).toBe(ErrorClass.name)
    expect(error.message).toBe("boom")
    expect(error.level).toBe(level)
  })

  it.each([
    [KnownBlinkErrorCodes.NotAuthenticated, CouldNotAuthorizeError],
    [KnownBlinkErrorCodes.InsufficientBalance, InsufficientBalanceError],
    [KnownBlinkErrorCodes.LightningPaymentError, PaymentFailedError],
    [KnownBlinkErrorCodes.RouteFindingError, RouteNotFoundError],
    [KnownBlinkErrorCodes.SelfPayment, SelfPaymentError],
    [KnownBlinkErrorCodes.InvoiceDecodeError, InvoiceDecodeError],
    [KnownBlinkErrorCodes.NotFound, InvoiceNotFoundError],
    [KnownBlinkErrorCodes.TooManyRequests, RateLimitError],
    [KnownBlinkErrorCodes.InvalidInput, ValidationError],
    [KnownBlinkErrorCodes.LndOffline, ServiceUnavailableError],
    [KnownBlinkErrorCodes.PriceServiceOffline, PriceServiceOfflineError],
    [KnownBlinkErrorCodes.DealerOffline, DealerOfflineError],
    [KnownBlinkErrorCodes.DbError, ServiceUnavailableError],
    [KnownBlinkErrorCodes.UnknownClientError, UnknownBlinkServiceError],
  ])("maps blink error code %s", (code, ExpectedError) => {
    const error = parseBlinkError({ code, message: "Boom" } as never)

    expect(error).toBeInstanceOf(ExpectedError)
    expect(error.message).toBe("boom")
  })

  it("maps quota-restricted responses separately from generic restrictions", () => {
    expect(
      parseBlinkError({
        code: KnownBlinkErrorCodes.TransactionRestricted,
        message: '{"daily":1000}',
      } as never),
    ).toBeInstanceOf(QuotaExceededError)

    expect(
      parseBlinkError({
        code: KnownBlinkErrorCodes.TransactionRestricted,
        message: "policy blocked this action",
      } as never),
    ).toBeInstanceOf(TransactionRestrictedError)
  })

  it.each([
    ["invoice already expired", InvoiceExpiredError],
    ["invoice is already paid", InvoiceAlreadyPaidError],
    ["invalid invoice amount", InvalidInvoiceAmountError],
    ["payment was rejected by destination", PaymentRejectedError],
    ["temporary failure when trying to pay", PaymentTimedOutError],
    ["unable to find a route", RouteNotFoundError],
    ["balance is too low", InsufficientBalanceError],
    ["invalid walletId", InvalidWalletIdError],
    ["service unavailable timeout", ServiceUnavailableError],
    ["too many requests", RateLimitError],
    ["invalid api key", CouldNotAuthorizeError],
  ])("maps heuristic error message %s", (message, ExpectedError) => {
    const error = parseBlinkError({ code: "UNMAPPED", message } as never)

    expect(error).toBeInstanceOf(ExpectedError)
  })

  it("records unknown errors in the current span", () => {
    const error = parseBlinkError({
      code: "UNMAPPED",
      message: "totally new failure",
    } as never)

    expect(error).toBeInstanceOf(UnknownBlinkServiceError)
    expect(mockRecordExceptionInCurrentSpan).toHaveBeenCalledWith({
      error:
        "Unknown core service error occurred. Code: UNMAPPED Message: totally new failure",
      level: ErrorLevel.Warn,
    })
  })
})
