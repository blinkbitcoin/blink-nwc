import { PUBLIC_GRAPHQL_URL } from "@/config"
import { getNodeInfo } from "@/graphql/internal-client/queries/get-node-info"

describe("getNodeInfo", () => {
  const client = {
    query: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns node info globals", async () => {
    const data = { globals: { network: "regtest" } }
    client.query.mockResolvedValue({ data })

    const result = await getNodeInfo(client as never)

    expect(client.query).toHaveBeenCalledWith({
      query: expect.anything(),
      context: { uri: PUBLIC_GRAPHQL_URL },
      fetchPolicy: "no-cache",
    })
    expect(result).toBe(data.globals)
  })
})
