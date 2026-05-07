import type { ApiKey, PaymentHash } from "@/domain/index.types"
import { invoiceStatusByPaymentHash } from "@/graphql/internal-client/queries/invoice-status-by-payment-hash"

describe("invoiceStatusByPaymentHash", () => {
  const client = {
    query: jest.fn(),
  }

  const apiKey = "api-key" as ApiKey

  beforeEach(() => {
    jest.clearAllMocks()
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
})
