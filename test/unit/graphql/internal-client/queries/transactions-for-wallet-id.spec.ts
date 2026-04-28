import type { ApiKey, Cursor } from "@/domain/index.types"
import type { WalletId } from "@/domain/core/index.types"
import { transactionsForWalletId } from "@/graphql/internal-client/queries/transactions-for-wallet-id"

describe("transactionsForWalletId", () => {
  const client = {
    query: jest.fn(),
  }

  const apiKey = "api-key" as ApiKey
  const walletId = "wallet-id" as WalletId

  beforeEach(() => {
    jest.clearAllMocks()
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
