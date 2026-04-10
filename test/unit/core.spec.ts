import { ApiKey, InvoiceBolt11 } from "@/domain/index.types"
import { WalletId } from "@/domain/core/index.types"

const mockWrapAsyncFunctionsToRunInSpan = jest.fn(({ fns }) => fns)
const mockInvoiceStatusByPaymentRequest = jest.fn()
const mockInvoiceByPaymentHash = jest.fn()
const mockTransactionsByPaymentHash = jest.fn()

jest.mock("@/graphql/internal-client", () => ({}))

jest.mock("@/services/tracing", () => ({
  wrapAsyncFunctionsToRunInSpan: (args: unknown) =>
    mockWrapAsyncFunctionsToRunInSpan(args),
}))

jest.mock("@/graphql/internal-client/queries/invoice-status-by-payment-request", () => ({
  invoiceStatusByPaymentRequest: (client: unknown, apiKey: unknown, bolt11: unknown) =>
    mockInvoiceStatusByPaymentRequest(client, apiKey, bolt11),
}))

jest.mock("@/graphql/internal-client/queries/invoice-by-payment-hash", () => ({
  invoiceByPaymentHash: (
    client: unknown,
    apiKey: unknown,
    walletId: unknown,
    hash: unknown,
  ) => mockInvoiceByPaymentHash(client, apiKey, walletId, hash),
}))

jest.mock("@/graphql/internal-client/queries/transactions-by-payment-hash", () => ({
  transactionsByPaymentHash: (
    client: unknown,
    apiKey: unknown,
    walletId: unknown,
    hash: unknown,
  ) => mockTransactionsByPaymentHash(client, apiKey, walletId, hash),
}))

jest.mock("@/graphql/internal-client/mutations/create-invoice", () => ({
  createInvoice: jest.fn(),
}))

jest.mock("@/graphql/internal-client/mutations/create-invoice-amountless", () => ({
  createInvoiceAmountless: jest.fn(),
}))

jest.mock("@/graphql/internal-client/mutations/pay-invoice", () => ({
  payInvoice: jest.fn(),
}))

jest.mock("@/graphql/internal-client/queries/get-balance", () => ({
  getBalance: jest.fn(),
}))

jest.mock("@/graphql/internal-client/queries/get-node-info", () => ({
  getNodeInfo: jest.fn(),
}))

jest.mock("@/graphql/internal-client/queries/invoices-for-wallet-id", () => ({
  invoicesForWalletId: jest.fn(),
}))

jest.mock("@/graphql/internal-client/queries/transactions-for-wallet-id", () => ({
  transactionsForWalletId: jest.fn(),
}))

import { BlinkCoreService } from "@/services/core"

describe("BlinkCoreService", () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockInvoiceStatusByPaymentRequest.mockResolvedValue({
      lnInvoicePaymentStatusByPaymentRequest: {
        paymentHash: "payment-hash",
      },
    })
    mockInvoiceByPaymentHash.mockResolvedValue({
      me: {
        defaultAccount: {
          walletById: {
            invoiceByPaymentHash: {
              paymentHash: "payment-hash",
              paymentRequest: "lnbc1invoice",
              paymentStatus: "PAID",
              satoshis: 123,
              createdAt: 1710000000,
            },
          },
        },
      },
    })
    mockTransactionsByPaymentHash.mockResolvedValue({
      me: {
        defaultAccount: {
          walletById: {
            transactionsByPaymentHash: [],
          },
        },
      },
    })
  })

  it("reuses the current service instance for invoice lookups by payment request", async () => {
    const service = BlinkCoreService()

    const result = await service.lookupInvoice(
      "api-key" as ApiKey,
      "wallet-id" as WalletId,
      undefined,
      "lnbc1invoice" as InvoiceBolt11,
    )

    expect(mockWrapAsyncFunctionsToRunInSpan).toHaveBeenCalledTimes(1)
    expect(mockInvoiceStatusByPaymentRequest).toHaveBeenCalledTimes(1)
    expect(mockInvoiceByPaymentHash).toHaveBeenCalledTimes(1)
    expect(result).toEqual(
      expect.objectContaining({
        paymentHash: "payment-hash",
        invoice: "lnbc1invoice",
      }),
    )
  })
})
