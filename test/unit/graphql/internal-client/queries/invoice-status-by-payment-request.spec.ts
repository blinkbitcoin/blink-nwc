import type { ApiKey, InvoiceBolt11 } from "@/domain/index.types"
import { invoiceStatusByPaymentRequest } from "@/graphql/internal-client/queries/invoice-status-by-payment-request"

describe("invoiceStatusByPaymentRequest", () => {
  const client = {
    query: jest.fn(),
  }

  const apiKey = "api-key" as ApiKey

  beforeEach(() => {
    jest.clearAllMocks()
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
})
