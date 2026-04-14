import type {
  ApiKey,
  Cursor,
  InvoiceBolt11,
  PaymentHash,
  Satoshis,
} from "@/domain/index.types"
import type { Description, DescriptionHash, WalletId } from "@/domain/core/index.types"
import type { Minutes } from "@/domain/units/index.types"
import { createInvoiceAmountless } from "@/graphql/internal-client/mutations/create-invoice-amountless"
import { createInvoice } from "@/graphql/internal-client/mutations/create-invoice"
import { payInvoice } from "@/graphql/internal-client/mutations/pay-invoice"
import { getBalance } from "@/graphql/internal-client/queries/get-balance"
import { getNodeInfo } from "@/graphql/internal-client/queries/get-node-info"
import { invoiceByPaymentHash } from "@/graphql/internal-client/queries/invoice-by-payment-hash"
import { invoiceStatusByPaymentHash } from "@/graphql/internal-client/queries/invoice-status-by-payment-hash"
import { invoiceStatusByPaymentRequest } from "@/graphql/internal-client/queries/invoice-status-by-payment-request"
import { invoicesForWalletId } from "@/graphql/internal-client/queries/invoices-for-wallet-id"
import { transactionsByPaymentHash } from "@/graphql/internal-client/queries/transactions-by-payment-hash"
import { transactionsForWalletId } from "@/graphql/internal-client/queries/transactions-for-wallet-id"

describe("graphql internal client wrappers", () => {
  const client = {
    mutate: jest.fn(),
    query: jest.fn(),
  }

  const apiKey = "api-key" as ApiKey
  const walletId = "wallet-id" as WalletId

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("calls createInvoice with the expected mutation payload", async () => {
    const data = { lnInvoiceCreateOnBehalfOfRecipient: { invoice: { id: "1" } } }
    client.mutate.mockResolvedValue({ data })

    const result = await createInvoice(
      client as never,
      apiKey,
      walletId,
      1000 as Satoshis,
      "memo" as Description,
      "hash" as DescriptionHash,
      30 as Minutes,
    )

    expect(client.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        mutation: expect.anything(),
        variables: {
          input: {
            amount: 1000,
            recipientWalletId: walletId,
            descriptionHash: "hash",
            expiresIn: "30",
            memo: "memo",
          },
        },
        context: { apiKey },
        fetchPolicy: "no-cache",
      }),
    )
    expect(result).toBe(data)
  })

  it("calls createInvoiceAmountless with the expected mutation payload", async () => {
    const data = { lnNoAmountInvoiceCreateOnBehalfOfRecipient: { invoice: { id: "1" } } }
    client.mutate.mockResolvedValue({ data })

    const result = await createInvoiceAmountless(
      client as never,
      apiKey,
      walletId,
      "memo" as Description,
      45 as Minutes,
    )

    expect(client.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        mutation: expect.anything(),
        variables: {
          input: {
            recipientWalletId: walletId,
            expiresIn: "45",
            memo: "memo",
          },
        },
        context: { apiKey },
        fetchPolicy: "no-cache",
      }),
    )
    expect(result).toBe(data)
  })

  it("calls payInvoice with the expected mutation payload", async () => {
    const data = { lnInvoicePaymentSend: { status: "SUCCESS" } }
    client.mutate.mockResolvedValue({ data })

    const result = await payInvoice(
      client as never,
      apiKey,
      "lnbc1invoice" as InvoiceBolt11,
      walletId,
      "memo" as Description,
    )

    expect(client.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        mutation: expect.anything(),
        variables: {
          input: {
            paymentRequest: "lnbc1invoice",
            memo: "memo",
            walletId,
          },
        },
        context: { apiKey },
        fetchPolicy: "no-cache",
      }),
    )
    expect(result).toBe(data)
  })

  it("returns the nested wallet balance", async () => {
    client.query.mockResolvedValue({
      data: {
        me: {
          defaultAccount: {
            walletById: {
              balance: 1234,
            },
          },
        },
      },
    })

    const result = await getBalance(client as never, apiKey, walletId)

    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.anything(),
        variables: { walletId },
        context: { apiKey },
        fetchPolicy: "no-cache",
      }),
    )
    expect(result).toBe(1234)
  })

  it("returns node info globals", async () => {
    const data = { globals: { network: "regtest" } }
    client.query.mockResolvedValue({ data })

    const result = await getNodeInfo(client as never)

    expect(client.query).toHaveBeenCalledWith({
      query: expect.anything(),
    })
    expect(result).toBe(data.globals)
  })

  it("queries invoice status by payment hash", async () => {
    const data = { lnInvoicePaymentStatusByHash: { paymentHash: "hash" } }
    client.query.mockResolvedValue({ data })

    const result = await invoiceStatusByPaymentHash(
      client as never,
      apiKey,
      "hash" as PaymentHash,
    )

    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.anything(),
        variables: { input: { paymentHash: "hash" } },
        context: { apiKey },
        fetchPolicy: "no-cache",
      }),
    )
    expect(result).toBe(data)
  })

  it("queries invoice status by payment request", async () => {
    const data = {
      lnInvoicePaymentStatusByPaymentRequest: { paymentHash: "hash" },
    }
    client.query.mockResolvedValue({ data })

    const result = await invoiceStatusByPaymentRequest(
      client as never,
      apiKey,
      "lnbc1invoice" as InvoiceBolt11,
    )

    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.anything(),
        variables: { input: { paymentRequest: "lnbc1invoice" } },
        context: { apiKey },
        fetchPolicy: "no-cache",
      }),
    )
    expect(result).toBe(data)
  })

  it("queries invoice details by payment hash", async () => {
    const data = { me: { defaultAccount: { walletById: { invoiceByPaymentHash: {} } } } }
    client.query.mockResolvedValue({ data })

    const result = await invoiceByPaymentHash(
      client as never,
      apiKey,
      walletId,
      "hash" as PaymentHash,
    )

    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.anything(),
        variables: { paymentHash: "hash", walletId },
        context: { apiKey },
        fetchPolicy: "no-cache",
      }),
    )
    expect(result).toBe(data)
  })

  it("queries paginated invoices for a wallet", async () => {
    const data = { me: { defaultAccount: { walletById: { invoices: { edges: [] } } } } }
    client.query.mockResolvedValue({ data })

    const result = await invoicesForWalletId(client as never, apiKey, walletId, {
      first: 20,
      after: "cursor-1" as Cursor,
      before: "cursor-0" as Cursor,
    })

    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.anything(),
        variables: {
          walletId,
          first: 20,
          after: "cursor-1",
          before: "cursor-0",
        },
        context: { apiKey },
        fetchPolicy: "no-cache",
      }),
    )
    expect(result).toBe(data)
  })

  it("queries transactions by payment hash", async () => {
    const data = {
      me: { defaultAccount: { walletById: { transactionsByPaymentHash: [] } } },
    }
    client.query.mockResolvedValue({ data })

    const result = await transactionsByPaymentHash(
      client as never,
      apiKey,
      walletId,
      "hash" as PaymentHash,
    )

    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.anything(),
        variables: { paymentHash: "hash", walletId },
        context: { apiKey },
        fetchPolicy: "no-cache",
      }),
    )
    expect(result).toBe(data)
  })

  it("queries paginated transactions for a wallet", async () => {
    const data = {
      me: { defaultAccount: { walletById: { transactions: { edges: [] } } } },
    }
    client.query.mockResolvedValue({ data })

    const result = await transactionsForWalletId(client as never, apiKey, walletId, {
      first: 10,
      after: "cursor-1" as Cursor,
      before: "cursor-0" as Cursor,
    })

    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.anything(),
        variables: {
          walletId,
          first: 10,
          after: "cursor-1",
          before: "cursor-0",
        },
        context: { apiKey },
        fetchPolicy: "no-cache",
      }),
    )
    expect(result).toBe(data)
  })
})
