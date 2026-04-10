import { randomUUID } from "crypto"

const mockConnectionsRepository = {
  findById: jest.fn(),
  softDelete: jest.fn(),
}

jest.mock("@/services/db/connections", () => ({
  ConnectionsRepository: () => mockConnectionsRepository,
}))

import { resolvers } from "@/graphql/resolvers"
import { NwcConnection } from "@/domain/connection"
import { AccountId, ApiKey, NwcAppPubkey, NwcConnectionId } from "@/domain/index.types"
import { Account, UserId, WalletId } from "@/domain/core/index.types"
import { Nip47Method } from "@/domain/nostr"

describe("graphql resolvers", () => {
  const userId = randomUUID() as UserId
  const otherUserId = randomUUID() as UserId
  const connection: NwcConnection = {
    id: randomUUID() as NwcConnectionId,
    userId: otherUserId,
    accountId: randomUUID() as AccountId,
    walletId: randomUUID() as WalletId,
    walletCurrency: "BTC",
    apiKey: randomUUID() as ApiKey,
    apiKeyId: null,
    connectionSecret: "secret" as never,
    alias: "Wallet" as never,
    appPubkey: "a".repeat(64) as NwcAppPubkey,
    permissions: [Nip47Method.GetBalance],
    notificationsEnabled: false,
    revoked: false,
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const domainAccount: Account = {
    id: connection.accountId,
    kratosUserId: connection.userId,
    username: undefined,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns null when a user requests another user's connection by id", async () => {
    mockConnectionsRepository.findById.mockResolvedValue(connection)
    const nwcConnectionResolver = resolvers.User!.nwcConnection as (
      user: { id: string },
      args: { id: string },
    ) => Promise<unknown>

    const result = await nwcConnectionResolver({ id: userId }, { id: connection.id })

    expect(result).toBeNull()
    expect(mockConnectionsRepository.findById).toHaveBeenCalledWith(connection.id)
  })

  it("returns the revoked connection payload from nwcConnectionRevoke", async () => {
    const revokedConnection: NwcConnection = {
      ...connection,
      revoked: true,
      revokedAt: new Date(),
    }
    const nwcConnectionRevokeResolver = resolvers.Mutation!.nwcConnectionRevoke as (
      parent: unknown,
      args: { input: { id: string } },
      context: { domainAccount: Account },
      info: unknown,
    ) => Promise<unknown>
    mockConnectionsRepository.findById
      .mockResolvedValueOnce(connection)
      .mockResolvedValueOnce(revokedConnection)
    mockConnectionsRepository.softDelete.mockResolvedValue(true)

    const result = await nwcConnectionRevokeResolver(
      {},
      { input: { id: connection.id } },
      { domainAccount },
      {} as never,
    )

    expect(result).toEqual({
      errors: [],
      connection: expect.objectContaining({
        id: connection.id,
        revoked: true,
      }),
    })
    expect(mockConnectionsRepository.softDelete).toHaveBeenCalledWith(connection.id)
  })
})
