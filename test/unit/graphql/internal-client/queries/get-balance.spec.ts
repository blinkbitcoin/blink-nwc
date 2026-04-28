import type { ApiKey } from "@/domain/index.types"
import type { WalletId } from "@/domain/core/index.types"
import { getBalance } from "@/graphql/internal-client/queries/get-balance"

describe("getBalance", () => {
  const client = {
    query: jest.fn(),
  }

  const apiKey = "api-key" as ApiKey
  const walletId = "wallet-id" as WalletId

  beforeEach(() => {
    jest.clearAllMocks()
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
})
