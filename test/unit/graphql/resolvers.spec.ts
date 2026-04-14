const mockExampleHello = jest.fn()
const mockCreateNwcConnection = jest.fn()
const mockGetNwcConnectionByIdForUser = jest.fn()
const mockNwcConnectionsByUserId = jest.fn()
const mockRevokeAllNwcConnections = jest.fn()
const mockRevokeNwcConnection = jest.fn()
const mockSoftDeleteNwcConnection = jest.fn()
const mockUpdateNwcConnection = jest.fn()

jest.mock("@/app", () => ({
  Example: {
    hello: (...args: unknown[]) => mockExampleHello(...args),
  },
}))

jest.mock("@/app/manage-connections", () => ({
  createNwcConnection: (...args: unknown[]) => mockCreateNwcConnection(...args),
  getNwcConnectionByIdForUser: (...args: unknown[]) =>
    mockGetNwcConnectionByIdForUser(...args),
  nwcConnectionsByUserId: (...args: unknown[]) => mockNwcConnectionsByUserId(...args),
  revokeAllNwcConnections: (...args: unknown[]) => mockRevokeAllNwcConnections(...args),
  revokeNwcConnection: (...args: unknown[]) => mockRevokeNwcConnection(...args),
  softDeleteNwcConnection: (...args: unknown[]) => mockSoftDeleteNwcConnection(...args),
  updateNwcConnection: (...args: unknown[]) => mockUpdateNwcConnection(...args),
}))

import {
  NOSTR_RELAY_PUBLIC_URL,
  SUPPORTED_NWC_METHODS,
  SUPPORTED_NWC_NOTIFICATIONS,
} from "@/config"
import type { NwcConnection } from "@/domain/connection"
import type { Account, WalletId } from "@/domain/core/index.types"
import { InvalidWalletId } from "@/domain/errors"
import { ExampleError } from "@/domain/example/errors"
import type { ApiKey, NwcAppPubkey, NwcConnectionId } from "@/domain/index.types"
import { Nip47Method } from "@/domain/nostr"
import { resolvers } from "@/graphql/resolvers"

describe("graphql resolvers", () => {
  const connection: NwcConnection = {
    id: "connection-id" as NwcConnectionId,
    userId: "user-1" as never,
    accountId: "account-1" as never,
    walletId: "wallet-1" as WalletId,
    walletCurrency: "BTC",
    apiKey: "api-key" as ApiKey,
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
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-02T00:00:00.000Z"),
  }

  const domainAccount: Account = {
    id: connection.accountId,
    kratosUserId: connection.userId,
    username: undefined,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns hello results", async () => {
    const helloResolver = resolvers.Query!.hello as {
      resolve: (
        parent: unknown,
        args: unknown,
        context: unknown,
        info: unknown,
      ) => Promise<unknown>
    }
    mockExampleHello.mockResolvedValue("world")

    const result = await helloResolver.resolve({}, {}, {}, {} as never)

    expect(result).toBe("world")
  })

  it("maps hello domain errors into graphql errors", async () => {
    const helloResolver = resolvers.Query!.hello as {
      resolve: (
        parent: unknown,
        args: unknown,
        context: unknown,
        info: unknown,
      ) => Promise<unknown>
    }
    mockExampleHello.mockResolvedValue(new ExampleError("missing example"))

    await expect(helloResolver.resolve({}, {}, {}, {} as never)).rejects.toMatchObject({
      extensions: { code: "NOT_FOUND" },
      message: "missing example",
    })
  })

  it("returns service info constants", () => {
    const serviceInfoResolver = resolvers.Query!.nwcServiceInfo as (
      parent: unknown,
      args: unknown,
      context: unknown,
      info: unknown,
    ) => unknown

    expect(serviceInfoResolver({}, {}, {}, {} as never)).toEqual({
      supportedMethods: SUPPORTED_NWC_METHODS,
      supportedNotifications: SUPPORTED_NWC_NOTIFICATIONS,
      relayUrl: NOSTR_RELAY_PUBLIC_URL,
    })
  })

  it("resolves federated user references", async () => {
    const result = await resolvers.User!.__resolveReference!(
      { id: "user-1" },
      {} as never,
    )

    expect(result).toEqual({ id: "user-1" })
  })

  it("returns a stripped user connection by id", async () => {
    mockGetNwcConnectionByIdForUser.mockResolvedValue(connection)
    const nwcConnectionResolver = resolvers.User!.nwcConnection as (
      user: { id: string },
      args: { id: string },
    ) => Promise<unknown>

    const result = await nwcConnectionResolver(
      { id: connection.userId },
      { id: connection.id },
    )

    expect(mockGetNwcConnectionByIdForUser).toHaveBeenCalledWith(
      connection.userId,
      connection.id,
    )
    expect(result).toEqual(
      expect.not.objectContaining({
        apiKey: expect.anything(),
        connectionSecret: expect.anything(),
      }),
    )
    expect(result).toEqual(expect.objectContaining({ id: connection.id }))
  })

  it("returns null when loading a user connection fails", async () => {
    mockGetNwcConnectionByIdForUser.mockResolvedValue(new InvalidWalletId("bad wallet"))
    const nwcConnectionResolver = resolvers.User!.nwcConnection as (
      user: { id: string },
      args: { id: string },
    ) => Promise<unknown>

    await expect(
      nwcConnectionResolver({ id: connection.userId }, { id: connection.id }),
    ).resolves.toBeNull()
  })

  it("lists stripped user connections and passes includeRevoked through", async () => {
    mockNwcConnectionsByUserId.mockResolvedValue([connection])
    const nwcConnectionsResolver = resolvers.User!.nwcConnections as (
      user: { id: string },
      args: { includeRevoked?: boolean | null },
    ) => Promise<unknown>

    const result = await nwcConnectionsResolver(
      { id: connection.userId },
      { includeRevoked: true },
    )

    expect(mockNwcConnectionsByUserId).toHaveBeenCalledWith(connection.userId, true)
    expect(result).toEqual([
      expect.not.objectContaining({
        apiKey: expect.anything(),
        connectionSecret: expect.anything(),
      }),
    ])
  })

  it("throws graphql errors when listing user connections fails", async () => {
    mockNwcConnectionsByUserId.mockResolvedValue(new InvalidWalletId("bad wallet"))
    const nwcConnectionsResolver = resolvers.User!.nwcConnections as (
      user: { id: string },
      args: { includeRevoked?: boolean | null },
    ) => Promise<unknown>

    await expect(
      nwcConnectionsResolver({ id: connection.userId }, {}),
    ).rejects.toMatchObject({
      extensions: { code: "INVALID_INPUT" },
      message: "bad wallet",
    })
  })

  it("creates connections with normalized optional arguments", async () => {
    mockCreateNwcConnection.mockResolvedValue({
      connectionObj: connection,
      connectionUri: "nostr+walletconnect://uri",
    })
    const createResolver = resolvers.Mutation!.nwcConnectionCreate as (
      parent: unknown,
      args: {
        input: {
          walletId: string
          alias?: string | null
          permissions: string[]
          apiKey: string
          apiKeyId?: string | null
          walletCurrency?: "BTC" | "USD" | null
          expiresAt?: string | null
          notificationsEnabled?: boolean | null
        }
      },
      context: { domainAccount: Account },
      info: unknown,
    ) => Promise<unknown>

    const result = await createResolver(
      {},
      {
        input: {
          walletId: connection.walletId,
          alias: null,
          permissions: [Nip47Method.GetBalance],
          apiKey: "raw-api-key",
          apiKeyId: null,
          walletCurrency: "BTC",
          expiresAt: "2025-03-01T00:00:00.000Z",
          notificationsEnabled: false,
        },
      },
      { domainAccount },
      {} as never,
    )

    expect(mockCreateNwcConnection).toHaveBeenCalledWith(
      domainAccount,
      connection.walletId,
      "raw-api-key",
      [Nip47Method.GetBalance],
      undefined,
      "BTC",
      new Date("2025-03-01T00:00:00.000Z"),
      false,
      undefined,
    )
    expect(result).toEqual({
      errors: [],
      connection: expect.not.objectContaining({
        apiKey: expect.anything(),
        connectionSecret: expect.anything(),
      }),
      connectionUri: "nostr+walletconnect://uri",
    })
  })

  it("returns graphql payload errors when creating a connection fails", async () => {
    mockCreateNwcConnection.mockResolvedValue(new InvalidWalletId("bad wallet"))
    const createResolver = resolvers.Mutation!.nwcConnectionCreate as (
      parent: unknown,
      args: { input: Record<string, unknown> },
      context: { domainAccount: Account },
      info: unknown,
    ) => Promise<unknown>

    const result = await createResolver(
      {},
      {
        input: {
          walletId: connection.walletId,
          permissions: [Nip47Method.GetBalance],
          apiKey: "raw-api-key",
        },
      },
      { domainAccount },
      {} as never,
    )

    expect(result).toEqual({
      errors: [
        {
          message: "bad wallet",
          path: undefined,
          code: "INVALID_INPUT",
        },
      ],
    })
  })

  it("updates connections and normalizes null permissions to an empty list", async () => {
    mockUpdateNwcConnection.mockResolvedValue(connection)
    const updateResolver = resolvers.Mutation!.nwcConnectionUpdate as (
      parent: unknown,
      args: {
        input: { id: string; alias?: string | null; permissions?: string[] | null }
      },
      context: { domainAccount: Account },
      info: unknown,
    ) => Promise<unknown>

    const result = await updateResolver(
      {},
      { input: { id: connection.id, alias: "Updated", permissions: null } },
      { domainAccount },
      {} as never,
    )

    expect(mockUpdateNwcConnection).toHaveBeenCalledWith(domainAccount, connection.id, {
      alias: "Updated",
      permissions: [],
    })
    expect(result).toEqual({
      errors: [],
      connection: expect.objectContaining({
        id: connection.id,
        alias: "Wallet",
      }),
    })
  })

  it("returns graphql payload errors when updating a connection fails", async () => {
    mockUpdateNwcConnection.mockResolvedValue(new InvalidWalletId("bad wallet"))
    const updateResolver = resolvers.Mutation!.nwcConnectionUpdate as (
      parent: unknown,
      args: { input: { id: string; permissions?: string[] | null } },
      context: { domainAccount: Account },
      info: unknown,
    ) => Promise<unknown>

    const result = await updateResolver(
      {},
      { input: { id: connection.id, permissions: [] } },
      { domainAccount },
      {} as never,
    )

    expect(result).toEqual({
      errors: [{ message: "bad wallet", path: undefined, code: "INVALID_INPUT" }],
    })
  })

  it("returns delete success payloads", async () => {
    mockSoftDeleteNwcConnection.mockResolvedValue(true)
    const deleteResolver = resolvers.Mutation!.nwcConnectionDelete as (
      parent: unknown,
      args: { input: { id: string } },
      context: { domainAccount: Account },
      info: unknown,
    ) => Promise<unknown>

    const result = await deleteResolver(
      {},
      { input: { id: connection.id } },
      { domainAccount },
      {} as never,
    )

    expect(mockSoftDeleteNwcConnection).toHaveBeenCalledWith(domainAccount, connection.id)
    expect(result).toEqual({
      errors: [],
      success: true,
    })
  })

  it("returns delete error payloads", async () => {
    mockSoftDeleteNwcConnection.mockResolvedValue(new InvalidWalletId("bad wallet"))
    const deleteResolver = resolvers.Mutation!.nwcConnectionDelete as (
      parent: unknown,
      args: { input: { id: string } },
      context: { domainAccount: Account },
      info: unknown,
    ) => Promise<unknown>

    const result = await deleteResolver(
      {},
      { input: { id: connection.id } },
      { domainAccount },
      {} as never,
    )

    expect(result).toEqual({
      errors: [{ message: "bad wallet", path: undefined, code: "INVALID_INPUT" }],
      success: false,
    })
  })

  it("returns the revoked connection payload from nwcConnectionRevoke", async () => {
    mockRevokeNwcConnection.mockResolvedValue({
      ...connection,
      revoked: true,
      revokedAt: new Date("2025-01-03T00:00:00.000Z"),
    })
    const revokeResolver = resolvers.Mutation!.nwcConnectionRevoke as (
      parent: unknown,
      args: { input: { id: string } },
      context: { domainAccount: Account },
      info: unknown,
    ) => Promise<unknown>

    const result = await revokeResolver(
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
  })

  it("returns graphql payload errors when revoking a connection fails", async () => {
    mockRevokeNwcConnection.mockResolvedValue(new InvalidWalletId("bad wallet"))
    const revokeResolver = resolvers.Mutation!.nwcConnectionRevoke as (
      parent: unknown,
      args: { input: { id: string } },
      context: { domainAccount: Account },
      info: unknown,
    ) => Promise<unknown>

    const result = await revokeResolver(
      {},
      { input: { id: connection.id } },
      { domainAccount },
      {} as never,
    )

    expect(result).toEqual({
      errors: [{ message: "bad wallet", path: undefined, code: "INVALID_INPUT" }],
    })
  })

  it("returns revoke-all payloads", async () => {
    mockRevokeAllNwcConnections.mockResolvedValue(3)
    const revokeAllResolver = resolvers.Mutation!.nwcConnectionRevokeAll as (
      parent: unknown,
      args: unknown,
      context: { domainAccount: Account },
      info: unknown,
    ) => Promise<unknown>

    const result = await revokeAllResolver({}, {}, { domainAccount }, {} as never)

    expect(mockRevokeAllNwcConnections).toHaveBeenCalledWith(domainAccount)
    expect(result).toEqual({
      errors: [],
      revokedCount: 3,
    })
  })

  it("returns revoke-all errors", async () => {
    mockRevokeAllNwcConnections.mockResolvedValue(new InvalidWalletId("bad wallet"))
    const revokeAllResolver = resolvers.Mutation!.nwcConnectionRevokeAll as (
      parent: unknown,
      args: unknown,
      context: { domainAccount: Account },
      info: unknown,
    ) => Promise<unknown>

    const result = await revokeAllResolver({}, {}, { domainAccount }, {} as never)

    expect(result).toEqual({
      errors: [{ message: "bad wallet", path: undefined, code: "INVALID_INPUT" }],
      revokedCount: 0,
    })
  })
})
