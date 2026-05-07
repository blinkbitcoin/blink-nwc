import type { ApiKey } from "@/domain/index.types"
import type { PaymentHash, WalletId } from "@/domain/core/index.types"
import { transactionsByPaymentHash } from "@/graphql/internal-client/queries/transactions-by-payment-hash"

describe("transactionsByPaymentHash", () => {
  const client = {
    query: jest.fn(),
  }

  const apiKey = "api-key" as ApiKey
  const walletId = "wallet-id" as WalletId

  beforeEach(() => {
    jest.clearAllMocks()
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
})
