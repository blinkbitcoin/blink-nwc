import type { Satoshis, ApiKey } from "@/domain/index.types"
import type { Description, DescriptionHash, WalletId } from "@/domain/core/index.types"
import type { Minutes } from "@/domain/units/index.types"
import { createInvoice } from "@/graphql/internal-client/mutations/create-invoice"

describe("createInvoice", () => {
  const client = {
    mutate: jest.fn(),
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
})
