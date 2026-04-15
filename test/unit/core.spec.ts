import { CombinedGraphQLErrors, ServerError } from "@apollo/client"
import { GraphQLError } from "graphql"

import type { WalletId } from "@/domain/core/index.types"
import { PaymentState } from "@/domain/core/payment-state"
import type { Cursor, ApiKey, InvoiceBolt11 } from "@/domain/index.types"
import { PaymentDirection as PD } from "@/domain/nostr/payment-direction"
import {
  CouldNotAuthorizeError,
  CouldNotFetchNodeInfoError,
  InvalidResponseError,
  InvoiceAlreadyPaidError,
  PaymentPendingError,
  PaymentFailedError,
  RateLimitError,
  ServiceUnavailableError,
  ValidationError,
} from "@/services/core/errors"

const mockWrapAsyncFunctionsToRunInSpan = jest.fn(({ fns }) => fns)
const mockCreateInvoice = jest.fn()
const mockCreateInvoiceAmountless = jest.fn()
const mockGetBalance = jest.fn()
const mockGetNodeInfo = jest.fn()
const mockInvoiceStatusByPaymentRequest = jest.fn()
const mockInvoiceByPaymentHash = jest.fn()
const mockInvoicesForWalletId = jest.fn()
const mockPayInvoice = jest.fn()
const mockTransactionsByPaymentHash = jest.fn()
const mockTransactionsForWalletId = jest.fn()

jest.mock("@/graphql/internal-client", () => ({}))

jest.mock("@/services/tracing", () => ({
  wrapAsyncFunctionsToRunInSpan: (args: unknown) =>
    mockWrapAsyncFunctionsToRunInSpan(args),
}))

jest.mock("@/graphql/internal-client/mutations/create-invoice", () => ({
  createInvoice: (...args: unknown[]) => mockCreateInvoice(...args),
}))

jest.mock("@/graphql/internal-client/mutations/create-invoice-amountless", () => ({
  createInvoiceAmountless: (...args: unknown[]) => mockCreateInvoiceAmountless(...args),
}))

jest.mock("@/graphql/internal-client/mutations/pay-invoice", () => ({
  payInvoice: (...args: unknown[]) => mockPayInvoice(...args),
}))

jest.mock("@/graphql/internal-client/queries/get-balance", () => ({
  getBalance: (...args: unknown[]) => mockGetBalance(...args),
}))

jest.mock("@/graphql/internal-client/queries/get-node-info", () => ({
  getNodeInfo: (...args: unknown[]) => mockGetNodeInfo(...args),
}))

jest.mock("@/graphql/internal-client/queries/invoice-status-by-payment-request", () => ({
  invoiceStatusByPaymentRequest: (...args: unknown[]) =>
    mockInvoiceStatusByPaymentRequest(...args),
}))

jest.mock("@/graphql/internal-client/queries/invoice-by-payment-hash", () => ({
  invoiceByPaymentHash: (...args: unknown[]) => mockInvoiceByPaymentHash(...args),
}))

jest.mock("@/graphql/internal-client/queries/invoices-for-wallet-id", () => ({
  invoicesForWalletId: (...args: unknown[]) => mockInvoicesForWalletId(...args),
}))

jest.mock("@/graphql/internal-client/queries/transactions-by-payment-hash", () => ({
  transactionsByPaymentHash: (...args: unknown[]) =>
    mockTransactionsByPaymentHash(...args),
}))

jest.mock("@/graphql/internal-client/queries/transactions-for-wallet-id", () => ({
  transactionsForWalletId: (...args: unknown[]) => mockTransactionsForWalletId(...args),
}))

import { BlinkCoreService } from "@/services/core"

describe("BlinkCoreService", () => {
  const apiKey = "api-key" as ApiKey
  const walletId = "wallet-id" as WalletId
  const invoice = "lnbc1invoice" as InvoiceBolt11

  const buildServerError = (statusCode: number) =>
    new ServerError(`HTTP ${statusCode}`, {
      response: new Response("", { status: statusCode }),
      bodyText: "{}",
    })

  const buildCombinedGraphQLError = (code: string, message: string) =>
    new CombinedGraphQLErrors({
      data: null,
      errors: [{ message, extensions: { code } }] as never,
    })

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
              paymentRequest: invoice,
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

  it("maps complete node info responses", async () => {
    mockGetNodeInfo.mockResolvedValue({
      network: "regtest",
      blockInfo: {
        blockHeight: 101,
        blockHash: "block-hash",
      },
    })

    const result = await BlinkCoreService().getNodeInfo()

    expect(result).toEqual({
      network: "regtest",
      blockHeight: 101,
      blockHash: "block-hash",
    })
  })

  it("returns CouldNotFetchNodeInfoError for malformed or failed node info lookups", async () => {
    mockGetNodeInfo.mockResolvedValueOnce({ network: "regtest", blockInfo: null })
    const service = BlinkCoreService()

    await expect(service.getNodeInfo()).resolves.toBeInstanceOf(
      CouldNotFetchNodeInfoError,
    )

    mockGetNodeInfo.mockRejectedValueOnce(new Error("offline"))

    await expect(service.getNodeInfo()).resolves.toBeInstanceOf(
      CouldNotFetchNodeInfoError,
    )
  })

  it("returns balances for valid responses", async () => {
    mockGetBalance.mockResolvedValue(420)

    const result = await BlinkCoreService().getBalance(apiKey, walletId)

    expect(result).toEqual({ balance: 420 })
  })

  it("rejects malformed balance responses and maps auth/graphql failures", async () => {
    const service = BlinkCoreService()

    mockGetBalance.mockResolvedValueOnce(null)
    await expect(service.getBalance(apiKey, walletId)).resolves.toBeInstanceOf(
      InvalidResponseError,
    )

    mockGetBalance.mockRejectedValueOnce(buildServerError(401))
    await expect(service.getBalance(apiKey, walletId)).resolves.toBeInstanceOf(
      CouldNotAuthorizeError,
    )

    mockGetBalance.mockRejectedValueOnce(
      buildCombinedGraphQLError("INVALID_INPUT", "bad wallet"),
    )
    await expect(service.getBalance(apiKey, walletId)).resolves.toBeInstanceOf(
      ValidationError,
    )
  })

  it("creates invoices from successful mutation responses", async () => {
    mockCreateInvoice.mockResolvedValue({
      lnInvoiceCreateOnBehalfOfRecipient: {
        errors: [],
        invoice: {
          createdAt: 1710000100,
          paymentHash: "payment-hash",
          paymentRequest: invoice,
          satoshis: 2500,
        },
      },
    })

    const result = await BlinkCoreService().createInvoice(
      apiKey,
      walletId,
      2500 as never,
      "memo" as never,
      "description-hash" as never,
      30 as never,
    )

    expect(result).toEqual({
      createdAt: 1710000100,
      expiresAt: undefined,
      paymentHash: "payment-hash",
      paymentRequest: invoice,
      satoshis: 2500,
    })
  })

  it("maps invoice creation graphql errors, transport failures, and malformed responses", async () => {
    const service = BlinkCoreService()

    mockCreateInvoice.mockResolvedValueOnce({
      lnInvoiceCreateOnBehalfOfRecipient: {
        errors: [{ code: "TOO_MANY_REQUEST", message: "too many requests" }],
        invoice: null,
      },
    })
    await expect(
      service.createInvoice(apiKey, walletId, 2500 as never, undefined, undefined),
    ).resolves.toBeInstanceOf(RateLimitError)

    mockCreateInvoice.mockRejectedValueOnce({
      graphQLErrors: [
        new GraphQLError("too many requests", {
          extensions: { code: "TOO_MANY_REQUEST" },
        }),
      ],
    })
    await expect(
      service.createInvoice(apiKey, walletId, 2500 as never, undefined, undefined),
    ).resolves.toBeInstanceOf(RateLimitError)

    mockCreateInvoice.mockRejectedValueOnce({ networkError: new Error("offline") })
    await expect(
      service.createInvoice(apiKey, walletId, 2500 as never, undefined, undefined),
    ).resolves.toBeInstanceOf(ServiceUnavailableError)

    mockCreateInvoice.mockResolvedValueOnce({
      lnInvoiceCreateOnBehalfOfRecipient: {
        errors: [],
        invoice: null,
      },
    })
    await expect(
      service.createInvoice(apiKey, walletId, 2500 as never, undefined, undefined),
    ).resolves.toBeInstanceOf(InvalidResponseError)
  })

  it("creates amountless invoices and validates malformed responses", async () => {
    const service = BlinkCoreService()

    mockCreateInvoiceAmountless.mockResolvedValueOnce({
      lnNoAmountInvoiceCreateOnBehalfOfRecipient: {
        errors: [],
        invoice: {
          createdAt: 1710000200,
          paymentHash: "payment-hash",
          paymentRequest: invoice,
        },
      },
    })
    await expect(
      service.createInvoiceAmountless(apiKey, walletId, "memo" as never, 30 as never),
    ).resolves.toEqual({
      createdAt: 1710000200,
      expiresAt: undefined,
      paymentHash: "payment-hash",
      paymentRequest: invoice,
      satoshis: 0,
    })

    mockCreateInvoiceAmountless.mockResolvedValueOnce({
      lnNoAmountInvoiceCreateOnBehalfOfRecipient: {
        errors: [],
        invoice: null,
      },
    })
    await expect(
      service.createInvoiceAmountless(apiKey, walletId, "memo" as never, 30 as never),
    ).resolves.toBeInstanceOf(InvalidResponseError)
  })

  it("returns preimages and fees for successful invoice payments", async () => {
    mockPayInvoice.mockResolvedValue({
      lnInvoicePaymentSend: {
        status: "SUCCESS",
        errors: [],
        transaction: {
          settlementFee: 12,
          settlementVia: {
            preImage: "preimage-123",
          },
        },
      },
    })

    const result = await BlinkCoreService().payInvoice(apiKey, walletId, invoice)

    expect(result).toEqual({
      preimage: "preimage-123",
      feesPaid: 12,
    })
  })

  it("maps payInvoice statuses, transport failures, and malformed responses", async () => {
    const service = BlinkCoreService()

    mockPayInvoice.mockResolvedValueOnce({
      lnInvoicePaymentSend: {
        status: "ALREADY_PAID",
        errors: [],
      },
    })
    await expect(service.payInvoice(apiKey, walletId, invoice)).resolves.toBeInstanceOf(
      InvoiceAlreadyPaidError,
    )

    mockPayInvoice.mockResolvedValueOnce({
      lnInvoicePaymentSend: {
        status: "PENDING",
        errors: [],
      },
    })
    await expect(service.payInvoice(apiKey, walletId, invoice)).resolves.toBeInstanceOf(
      PaymentPendingError,
    )

    mockPayInvoice.mockResolvedValueOnce({
      lnInvoicePaymentSend: {
        status: "FAILURE",
        errors: [],
      },
    })
    await expect(service.payInvoice(apiKey, walletId, invoice)).resolves.toBeInstanceOf(
      PaymentFailedError,
    )

    mockPayInvoice.mockRejectedValueOnce({ networkError: new Error("offline") })
    await expect(service.payInvoice(apiKey, walletId, invoice)).resolves.toBeInstanceOf(
      ServiceUnavailableError,
    )

    mockPayInvoice.mockResolvedValueOnce({
      lnInvoicePaymentSend: {
        status: "SUCCESS",
        errors: [],
        transaction: {
          settlementVia: {},
        },
      },
    })
    await expect(service.payInvoice(apiKey, walletId, invoice)).resolves.toBeInstanceOf(
      InvalidResponseError,
    )
  })

  it("reuses the current service instance for invoice lookups by payment request", async () => {
    const result = await BlinkCoreService().lookupInvoice(
      apiKey,
      walletId,
      undefined,
      invoice,
    )

    expect(mockWrapAsyncFunctionsToRunInSpan).toHaveBeenCalledTimes(1)
    expect(mockInvoiceStatusByPaymentRequest).toHaveBeenCalledTimes(1)
    expect(mockInvoiceByPaymentHash).toHaveBeenCalledTimes(1)
    expect(result).toEqual(
      expect.objectContaining({
        paymentHash: "payment-hash",
        invoice,
      }),
    )
  })

  it("maps transaction listings into core-service transactions", async () => {
    mockTransactionsForWalletId.mockResolvedValue({
      me: {
        defaultAccount: {
          walletById: {
            transactions: {
              edges: [
                {
                  cursor: "cursor-1",
                  node: {
                    createdAt: 300,
                    direction: "RECEIVE",
                    initiationVia: {
                      paymentHash: "hash-1",
                      paymentRequest: "lnbc1incoming",
                    },
                    memo: "incoming memo",
                    settlementAmount: 120,
                    settlementFee: null,
                    settlementVia: {
                      preImage: "preimage-1",
                    },
                    status: "SUCCESS",
                  },
                },
                {
                  cursor: "cursor-2",
                  node: {
                    createdAt: 200,
                    direction: "SEND",
                    initiationVia: null,
                    memo: "outgoing memo",
                    settlementAmount: -80,
                    settlementFee: 2,
                    settlementVia: null,
                    status: "FAILURE",
                  },
                },
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        },
      },
    })

    const result = await BlinkCoreService().listTransactions(apiKey, walletId, {
      first: 2,
      after: "cursor-0" as Cursor,
    })

    expect(result).toEqual({
      transactions: [
        {
          type: "incoming",
          state: PaymentState.PAID,
          invoice: "lnbc1incoming",
          description: "incoming memo",
          paymentHash: "hash-1",
          preimage: "preimage-1",
          amount: 120,
          feesPaid: 0,
          createdAt: 300,
          settledAt: 300,
        },
        {
          type: "outgoing",
          state: PaymentState.FAILED,
          invoice: undefined,
          description: "outgoing memo",
          paymentHash: "",
          preimage: undefined,
          amount: 80,
          feesPaid: 2,
          createdAt: 200,
          settledAt: undefined,
        },
      ],
      pageInfo: {
        hasNextPage: false,
        endCursor: undefined,
      },
    })
  })

  it("maps transaction listing failures and malformed responses", async () => {
    const service = BlinkCoreService()

    mockTransactionsForWalletId.mockResolvedValueOnce({
      me: {
        defaultAccount: {
          walletById: {
            transactions: null,
          },
        },
      },
    })
    await expect(service.listTransactions(apiKey, walletId)).resolves.toBeInstanceOf(
      InvalidResponseError,
    )

    mockTransactionsForWalletId.mockRejectedValueOnce({
      graphQLErrors: [
        new GraphQLError("too many requests", {
          extensions: { code: "TOO_MANY_REQUEST" },
        }),
      ],
    })
    await expect(service.listTransactions(apiKey, walletId)).resolves.toBeInstanceOf(
      RateLimitError,
    )
  })

  it("maps invoice listings into core-service invoices", async () => {
    mockInvoicesForWalletId.mockResolvedValue({
      me: {
        defaultAccount: {
          walletById: {
            invoices: {
              edges: [
                {
                  cursor: "cursor-1",
                  node: {
                    __typename: "LnInvoice",
                    createdAt: 400,
                    paymentHash: "hash-1",
                    paymentRequest: "lnbc1incoming",
                    paymentStatus: "PAID",
                    satoshis: 250,
                  },
                },
                {
                  cursor: "cursor-2",
                  node: {
                    __typename: "LnNoAmountInvoice",
                    createdAt: 350,
                    paymentHash: "hash-2",
                    paymentRequest: "lnbc1zero",
                    paymentStatus: "PENDING",
                  },
                },
              ],
              pageInfo: {
                hasNextPage: true,
                endCursor: "cursor-2",
              },
            },
          },
        },
      },
    })

    const result = await BlinkCoreService().listInvoices(apiKey, walletId, {
      first: 2,
    })

    expect(result).toEqual({
      invoices: [
        {
          type: "incoming",
          invoice: "lnbc1incoming",
          state: PaymentState.PAID,
          description: undefined,
          descriptionHash: undefined,
          paymentHash: "hash-1",
          preimage: undefined,
          amount: 250,
          feesPaid: 0,
          createdAt: 400,
          settledAt: undefined,
          expiresAt: undefined,
        },
        {
          type: "incoming",
          invoice: "lnbc1zero",
          state: PaymentState.PENDING,
          description: undefined,
          descriptionHash: undefined,
          paymentHash: "hash-2",
          preimage: undefined,
          amount: 0,
          feesPaid: 0,
          createdAt: 350,
          settledAt: undefined,
          expiresAt: undefined,
        },
      ],
      pageInfo: {
        hasNextPage: true,
        endCursor: "cursor-2",
      },
    })
  })

  it("maps invoice listing failures and malformed responses", async () => {
    const service = BlinkCoreService()

    mockInvoicesForWalletId.mockResolvedValueOnce({
      me: {
        defaultAccount: {
          walletById: {
            invoices: null,
          },
        },
      },
    })
    await expect(service.listInvoices(apiKey, walletId)).resolves.toBeInstanceOf(
      InvalidResponseError,
    )

    mockInvoicesForWalletId.mockRejectedValueOnce({ networkError: new Error("offline") })
    await expect(service.listInvoices(apiKey, walletId)).resolves.toBeInstanceOf(
      ServiceUnavailableError,
    )
  })

  it("paginates and filters transactions in range", async () => {
    mockTransactionsForWalletId
      .mockResolvedValueOnce({
        me: {
          defaultAccount: {
            walletById: {
              transactions: {
                edges: [
                  {
                    cursor: "cursor-1",
                    node: {
                      createdAt: 400,
                      direction: "RECEIVE",
                      initiationVia: { paymentHash: "hash-1", paymentRequest: "ln-1" },
                      memo: "incoming",
                      settlementAmount: 100,
                      settlementFee: 0,
                      settlementVia: { preImage: "pre-1" },
                      status: "SUCCESS",
                    },
                  },
                  {
                    cursor: "cursor-2",
                    node: {
                      createdAt: 350,
                      direction: "SEND",
                      initiationVia: { paymentHash: "hash-2", paymentRequest: "ln-2" },
                      memo: "outgoing-1",
                      settlementAmount: -50,
                      settlementFee: 1,
                      settlementVia: { preImage: "pre-2" },
                      status: "SUCCESS",
                    },
                  },
                  {
                    cursor: "cursor-3",
                    node: {
                      createdAt: 300,
                      direction: "SEND",
                      initiationVia: { paymentHash: "hash-3", paymentRequest: "ln-3" },
                      memo: "outgoing-2",
                      settlementAmount: -25,
                      settlementFee: 1,
                      settlementVia: { preImage: "pre-3" },
                      status: "SUCCESS",
                    },
                  },
                ],
                pageInfo: {
                  hasNextPage: true,
                  endCursor: "cursor-3",
                },
              },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        me: {
          defaultAccount: {
            walletById: {
              transactions: {
                edges: [
                  {
                    cursor: "cursor-4",
                    node: {
                      createdAt: 250,
                      direction: "SEND",
                      initiationVia: { paymentHash: "hash-4", paymentRequest: "ln-4" },
                      memo: "outgoing-3",
                      settlementAmount: -10,
                      settlementFee: 1,
                      settlementVia: { preImage: "pre-4" },
                      status: "SUCCESS",
                    },
                  },
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null,
                },
              },
            },
          },
        },
      })

    const result = await BlinkCoreService().fetchTransactionsInRange(
      apiKey,
      walletId,
      200 as never,
      "cursor-0" as Cursor,
      1,
      2,
      PD.Outgoing,
    )

    expect(result).toEqual([
      expect.objectContaining({
        type: "outgoing",
        paymentHash: "hash-3",
        createdAt: 300,
      }),
      expect.objectContaining({
        type: "outgoing",
        paymentHash: "hash-4",
        createdAt: 250,
      }),
    ])
  })

  it("paginates invoices in range", async () => {
    mockInvoicesForWalletId
      .mockResolvedValueOnce({
        me: {
          defaultAccount: {
            walletById: {
              invoices: {
                edges: [
                  {
                    cursor: "cursor-1",
                    node: {
                      __typename: "LnInvoice",
                      createdAt: 500,
                      paymentHash: "hash-1",
                      paymentRequest: "ln-1",
                      paymentStatus: "PAID",
                      satoshis: 10,
                    },
                  },
                  {
                    cursor: "cursor-2",
                    node: {
                      __typename: "LnInvoice",
                      createdAt: 400,
                      paymentHash: "hash-2",
                      paymentRequest: "ln-2",
                      paymentStatus: "PAID",
                      satoshis: 20,
                    },
                  },
                ],
                pageInfo: {
                  hasNextPage: true,
                  endCursor: "cursor-2",
                },
              },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        me: {
          defaultAccount: {
            walletById: {
              invoices: {
                edges: [
                  {
                    cursor: "cursor-3",
                    node: {
                      __typename: "LnInvoice",
                      createdAt: 300,
                      paymentHash: "hash-3",
                      paymentRequest: "ln-3",
                      paymentStatus: "PENDING",
                      satoshis: 30,
                    },
                  },
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null,
                },
              },
            },
          },
        },
      })

    const result = await BlinkCoreService().fetchInvoicesInRange(
      apiKey,
      walletId,
      250 as never,
      "cursor-0" as Cursor,
      1,
      2,
      PD.Incoming,
    )

    expect(result).toEqual([
      expect.objectContaining({
        paymentHash: "hash-2",
        createdAt: 400,
      }),
      expect.objectContaining({
        paymentHash: "hash-3",
        createdAt: 300,
      }),
    ])
  })
})
