import type { ApiKey, Description, InvoiceBolt11 } from "@/domain/index.types"
import type { WalletId } from "@/domain/core/index.types"
import { payInvoice } from "@/graphql/internal-client/mutations/pay-invoice"

describe("payInvoice", () => {
  const client = {
    mutate: jest.fn(),
  }

  const apiKey = "api-key" as ApiKey
  const walletId = "wallet-id" as WalletId

  beforeEach(() => {
    jest.clearAllMocks()
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
})
