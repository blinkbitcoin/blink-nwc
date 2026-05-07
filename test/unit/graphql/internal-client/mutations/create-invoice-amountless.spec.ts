import type { ApiKey, Description } from "@/domain/index.types"
import type { WalletId } from "@/domain/core/index.types"
import type { Minutes } from "@/domain/units/index.types"
import { createInvoiceAmountless } from "@/graphql/internal-client/mutations/create-invoice-amountless"

describe("createInvoiceAmountless", () => {
  const client = {
    mutate: jest.fn(),
  }

  const apiKey = "api-key" as ApiKey
  const walletId = "wallet-id" as WalletId

  beforeEach(() => {
    jest.clearAllMocks()
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
})
