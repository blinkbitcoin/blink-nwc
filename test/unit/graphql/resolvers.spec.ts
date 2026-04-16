import { readFileSync } from "fs"
import path from "path"

import { buildSubgraphSchema } from "@apollo/subgraph"
import { graphql } from "graphql"
import { gql } from "graphql-tag"

import { NWC_KNOWN_APPS } from "@/config/nwc-known-apps"

const mockExampleHello = jest.fn()
const mockCreateNwcConnection = jest.fn()
const mockGetApiKeysForNwc = jest.fn()
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

jest.mock("@/graphql/internal-client/queries/api-keys", () => ({
  getApiKeysForNwc: (...args: unknown[]) => mockGetApiKeysForNwc(...args),
}))

import {
  NOSTR_RELAY_PUBLIC_URL,
  SUPPORTED_NWC_METHODS,
  SUPPORTED_NWC_NOTIFICATIONS,
} from "@/config"
import { getServerKeypair, type NwcConnection } from "@/domain/connection"
import type { UserId, WalletId } from "@/domain/core/index.types"
import { InvalidWalletId } from "@/domain/errors"
import { ExampleError } from "@/domain/example/errors"
import type {
  AccountId,
  ApiKey,
  ApiKeyId,
  NwcAppPubkey,
  NwcConnectionId,
} from "@/domain/index.types"
import { NwcBudgetPeriod } from "@/domain/nwc-budget"
import { Nip47Method } from "@/domain/nostr"
import { resolvers } from "@/graphql/resolvers"
import {
  NWC_PERMISSION_PRESETS,
  NwcPermissionPresetId,
} from "@/domain/nwc-permission-preset"

const schemaPath = path.resolve(__dirname, "../../../src/graphql/schema.graphql")

const buildExecutableSchema = () =>
  buildSubgraphSchema({
    typeDefs: gql(readFileSync(schemaPath, "utf8")),
    resolvers,
  })

describe("graphql resolvers", () => {
  const userId = "user-1" as UserId
  const authorization = "Bearer token"
  const connection: NwcConnection = {
    id: "connection-id" as NwcConnectionId,
    userId,
    accountId: "account-1" as AccountId,
    walletId: "wallet-1" as WalletId,
    walletCurrency: "BTC",
    apiKey: "api-key" as ApiKey,
    apiKeyId: "api-key-id" as ApiKeyId,
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
  const budget = {
    amountSats: 1_000,
    period: NwcBudgetPeriod.Daily,
    usedSats: 400,
    remainingSats: 600,
    resetsAt: null,
  }
  const apiKeyLimits = {
    dailyLimitSats: 1_000,
    dailySpentSats: 400,
    weeklyLimitSats: null,
    weeklySpentSats: 0,
    monthlyLimitSats: null,
    monthlySpentSats: 0,
    annualLimitSats: null,
    annualSpentSats: 0,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetApiKeysForNwc.mockResolvedValue([])
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
      serverPubkey: getServerKeypair().pubkey,
      supportedMethods: SUPPORTED_NWC_METHODS,
      supportedNotifications: SUPPORTED_NWC_NOTIFICATIONS,
      relayUrl: NOSTR_RELAY_PUBLIC_URL,
    })
  })

  it("resolves federated user references", async () => {
    const result = await resolvers.User!.__resolveReference!({ id: userId }, {} as never)

    expect(result).toEqual({ id: userId })
  })

  it("requires an authenticated user for top-level connection queries", async () => {
    const nwcConnectionResolver = resolvers.Query!.nwcConnection as (
      parent: unknown,
      args: { id: string },
      context: { user?: { id?: string }; authorization?: string },
      info: unknown,
    ) => Promise<unknown>

    await expect(
      nwcConnectionResolver({}, { id: connection.id }, {}, {} as never),
    ).rejects.toMatchObject({
      message: "Authentication required",
    })
  })

  it("returns a stripped top-level connection with derived budget", async () => {
    mockGetNwcConnectionByIdForUser.mockResolvedValue(connection)
    mockGetApiKeysForNwc.mockResolvedValue([
      { id: connection.apiKeyId, limits: apiKeyLimits },
    ])
    const nwcConnectionResolver = resolvers.Query!.nwcConnection as (
      parent: unknown,
      args: { id: string },
      context: { user?: { id?: string }; authorization?: string },
      info: unknown,
    ) => Promise<Record<string, unknown> | null>

    const result = await nwcConnectionResolver(
      {},
      { id: connection.id },
      { user: { id: userId }, authorization },
      {} as never,
    )

    expect(mockGetNwcConnectionByIdForUser).toHaveBeenCalledWith(userId, connection.id)
    expect(mockGetApiKeysForNwc).toHaveBeenCalledWith(expect.anything(), authorization)
    expect(result).toEqual(
      expect.objectContaining({
        id: connection.id,
        budget,
      }),
    )
    expect(result).not.toHaveProperty("apiKey")
    expect(result).not.toHaveProperty("connectionSecret")
  })

  it("returns null when loading a top-level connection fails", async () => {
    mockGetNwcConnectionByIdForUser.mockResolvedValue(new InvalidWalletId("bad wallet"))
    const nwcConnectionResolver = resolvers.Query!.nwcConnection as (
      parent: unknown,
      args: { id: string },
      context: { user?: { id?: string }; authorization?: string },
      info: unknown,
    ) => Promise<unknown>

    await expect(
      nwcConnectionResolver(
        {},
        { id: connection.id },
        { user: { id: userId }, authorization },
        {} as never,
      ),
    ).resolves.toBeNull()
  })

  it("lists stripped user connections and passes includeRevoked through", async () => {
    mockNwcConnectionsByUserId.mockResolvedValue([connection])
    const nwcConnectionsResolver = resolvers.User!.nwcConnections as unknown as (
      user: { id: string },
      args: { includeRevoked?: boolean | null },
      context?: { authorization?: string },
    ) => Promise<Array<Record<string, unknown>>>

    const result = await nwcConnectionsResolver(
      { id: connection.userId },
      { includeRevoked: true },
      { authorization: undefined },
    )

    expect(mockNwcConnectionsByUserId).toHaveBeenCalledWith(connection.userId, true)
    expect(result).toEqual([
      expect.objectContaining({
        id: connection.id,
        budget: null,
      }),
    ])
    expect(result[0]).not.toHaveProperty("apiKey")
    expect(result[0]).not.toHaveProperty("connectionSecret")
  })

  it("throws graphql errors when listing user connections fails", async () => {
    mockNwcConnectionsByUserId.mockResolvedValue(new InvalidWalletId("bad wallet"))
    const nwcConnectionsResolver = resolvers.User!.nwcConnections as (
      user: { id: string },
      args: { includeRevoked?: boolean | null },
      context?: { authorization?: string },
    ) => Promise<unknown>

    await expect(
      nwcConnectionsResolver({ id: connection.userId }, {}, {}),
    ).rejects.toMatchObject({
      extensions: { code: "INVALID_INPUT" },
      message: "bad wallet",
    })
  })

  it("requires authorization for connection creation", async () => {
    const createResolver = resolvers.Mutation!.nwcConnectionCreate as (
      parent: unknown,
      args: { input: Record<string, unknown> },
      context: { user?: { id?: string }; authorization?: string },
      info: unknown,
    ) => Promise<unknown>

    await expect(
      createResolver(
        {},
        {
          input: {
            nwcUri: "nostr+walletconnect://server",
            permissions: [Nip47Method.GetBalance],
          },
        },
        { user: { id: userId } },
        {} as never,
      ),
    ).rejects.toMatchObject({
      message: "Authentication required",
    })
  })

  it("creates connections with the E2 input contract", async () => {
    mockCreateNwcConnection.mockResolvedValue({
      connectionObj: {
        ...connection,
        apiKeyId: null,
      },
      connectionUri: "nostr+walletconnect://uri",
      budget,
    })
    const createResolver = resolvers.Mutation!.nwcConnectionCreate as (
      parent: unknown,
      args: {
        input: {
          nwcUri: string
          walletId?: string | null
          alias?: string | null
          permissions: string[]
          budget?: { amountSats: number; period: string } | null
          expiresAt?: string | null
        }
      },
      context: { user?: { id?: string }; authorization?: string },
      info: unknown,
    ) => Promise<Record<string, unknown>>

    const result = await createResolver(
      {},
      {
        input: {
          nwcUri: "nostr+walletconnect://uri",
          walletId: connection.walletId,
          alias: null,
          permissions: [Nip47Method.GetBalance],
          budget: {
            amountSats: budget.amountSats,
            period: budget.period,
          },
          expiresAt: "2025-03-01T00:00:00.000Z",
        },
      },
      { user: { id: userId }, authorization },
      {} as never,
    )

    expect(mockCreateNwcConnection).toHaveBeenCalledWith(userId, authorization, {
      nwcUri: "nostr+walletconnect://uri",
      walletId: connection.walletId,
      permissions: [Nip47Method.GetBalance],
      alias: undefined,
      budget: {
        amountSats: budget.amountSats,
        period: budget.period,
      },
      expiresAt: new Date("2025-03-01T00:00:00.000Z"),
    })
    expect(result).toEqual({
      errors: [],
      connection: expect.objectContaining({
        id: connection.id,
        budget,
      }),
      connectionUri: "nostr+walletconnect://uri",
    })
    expect(result.connection).not.toHaveProperty("apiKey")
    expect(result.connection).not.toHaveProperty("connectionSecret")
  })

  it("returns graphql payload errors when creating a connection fails", async () => {
    mockCreateNwcConnection.mockResolvedValue(new InvalidWalletId("bad wallet"))
    const createResolver = resolvers.Mutation!.nwcConnectionCreate as (
      parent: unknown,
      args: { input: Record<string, unknown> },
      context: { user?: { id?: string }; authorization?: string },
      info: unknown,
    ) => Promise<unknown>

    const result = await createResolver(
      {},
      {
        input: {
          nwcUri: "nostr+walletconnect://uri",
          permissions: [Nip47Method.GetBalance],
        },
      },
      { user: { id: userId }, authorization },
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

  it("updates connections with alias and budget using the E2 input contract", async () => {
    mockUpdateNwcConnection.mockResolvedValue({
      ...connection,
      alias: "Updated" as never,
    })
    mockGetApiKeysForNwc.mockResolvedValue([
      { id: connection.apiKeyId, limits: apiKeyLimits },
    ])
    const updateResolver = resolvers.Mutation!.nwcConnectionUpdate as (
      parent: unknown,
      args: {
        input: {
          connectionId: string
          alias?: string | null
          budget?: { amountSats: number; period: string } | null
        }
      },
      context: { user?: { id?: string }; authorization?: string },
      info: unknown,
    ) => Promise<unknown>

    const result = await updateResolver(
      {},
      {
        input: {
          connectionId: connection.id,
          alias: "Updated",
          budget: {
            amountSats: budget.amountSats,
            period: budget.period,
          },
        },
      },
      { user: { id: userId }, authorization },
      {} as never,
    )

    expect(mockUpdateNwcConnection).toHaveBeenCalledWith(
      userId,
      authorization,
      connection.id,
      {
        alias: "Updated",
        budget: {
          amountSats: budget.amountSats,
          period: budget.period,
        },
      },
    )
    expect(result).toEqual({
      errors: [],
      connection: expect.objectContaining({
        id: connection.id,
        alias: "Updated",
        budget,
      }),
    })
  })

  it("returns graphql payload errors when updating a connection fails", async () => {
    mockUpdateNwcConnection.mockResolvedValue(new InvalidWalletId("bad wallet"))
    const updateResolver = resolvers.Mutation!.nwcConnectionUpdate as (
      parent: unknown,
      args: { input: { connectionId: string; alias?: string | null } },
      context: { user?: { id?: string }; authorization?: string },
      info: unknown,
    ) => Promise<unknown>

    const result = await updateResolver(
      {},
      { input: { connectionId: connection.id, alias: "Updated" } },
      { user: { id: userId }, authorization },
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
      args: { input: { connectionId: string } },
      context: { user?: { id?: string } },
      info: unknown,
    ) => Promise<unknown>

    const result = await deleteResolver(
      {},
      { input: { connectionId: connection.id } },
      { user: { id: userId } },
      {} as never,
    )

    expect(mockSoftDeleteNwcConnection).toHaveBeenCalledWith(userId, connection.id)
    expect(result).toEqual({
      errors: [],
      success: true,
    })
  })

  it("returns delete error payloads", async () => {
    mockSoftDeleteNwcConnection.mockResolvedValue(new InvalidWalletId("bad wallet"))
    const deleteResolver = resolvers.Mutation!.nwcConnectionDelete as (
      parent: unknown,
      args: { input: { connectionId: string } },
      context: { user?: { id?: string } },
      info: unknown,
    ) => Promise<unknown>

    const result = await deleteResolver(
      {},
      { input: { connectionId: connection.id } },
      { user: { id: userId } },
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
      args: { input: { connectionId: string } },
      context: { user?: { id?: string } },
      info: unknown,
    ) => Promise<unknown>

    const result = await revokeResolver(
      {},
      { input: { connectionId: connection.id } },
      { user: { id: userId } },
      {} as never,
    )

    expect(mockRevokeNwcConnection).toHaveBeenCalledWith(userId, connection.id)
    expect(result).toEqual({
      errors: [],
      success: true,
      connection: expect.objectContaining({
        id: connection.id,
        revoked: true,
      }),
    })
  })

  it("returns revoke-all payloads for both E2 mutation names", async () => {
    mockRevokeAllNwcConnections.mockResolvedValueOnce(3).mockResolvedValueOnce(2)
    const revokeAllResolver = resolvers.Mutation!.nwcConnectionsRevokeAll as (
      parent: unknown,
      args: unknown,
      context: { user?: { id?: string } },
      info: unknown,
    ) => Promise<unknown>
    const revokeAllAliasResolver = resolvers.Mutation!.nwcConnectionRevokeAll as (
      parent: unknown,
      args: unknown,
      context: { user?: { id?: string } },
      info: unknown,
    ) => Promise<unknown>

    const firstResult = await revokeAllResolver(
      {},
      {},
      { user: { id: userId } },
      {} as never,
    )
    const secondResult = await revokeAllAliasResolver(
      {},
      {},
      { user: { id: userId } },
      {} as never,
    )

    expect(mockRevokeAllNwcConnections).toHaveBeenNthCalledWith(1, userId)
    expect(mockRevokeAllNwcConnections).toHaveBeenNthCalledWith(2, userId)
    expect(firstResult).toEqual({
      errors: [],
      revokedCount: 3,
    })
    expect(secondResult).toEqual({
      errors: [],
      revokedCount: 2,
    })
  })

  it("returns the configured permission presets", async () => {
    const nwcPermissionPresetsResolver = resolvers.Query!.nwcPermissionPresets as (
      parent: unknown,
      args: unknown,
      context: unknown,
      info: unknown,
    ) => Promise<unknown> | unknown

    const result = await nwcPermissionPresetsResolver({}, {}, {}, {} as never)

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: NwcPermissionPresetId.SatsbackUser,
          name: "Satsback User",
        }),
        expect.objectContaining({
          id: NwcPermissionPresetId.ReadOnly,
          name: "Read-Only",
        }),
      ]),
    )
  })

  it("keeps permission preset ids aligned with configured presets", () => {
    expect(NWC_PERMISSION_PRESETS.map((preset) => preset.id).sort()).toEqual(
      Object.values(NwcPermissionPresetId).sort(),
    )
  })

  it("serializes permission preset ids through the executable schema", async () => {
    const result = await graphql({
      schema: buildExecutableSchema(),
      source: `
        query PermissionPresets {
          nwcPermissionPresets {
            id
            name
          }
        }
      `,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      nwcPermissionPresets: expect.arrayContaining([
        expect.objectContaining({
          id: "SATSBACK_USER",
          name: "Satsback User",
        }),
        expect.objectContaining({
          id: "READ_ONLY",
          name: "Read-Only",
        }),
      ]),
    })
  })

  it("resolves known app metadata through the executable schema", async () => {
    const knownApp = NWC_KNOWN_APPS[0]
    const result = await graphql({
      schema: buildExecutableSchema(),
      source: `
        query KnownApp($pubkey: String!) {
          nwcKnownApp(pubkey: $pubkey) {
            pubkey
            name
            recommendedPreset {
              id
            }
          }
        }
      `,
      variableValues: { pubkey: knownApp.pubkey },
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      nwcKnownApp: {
        pubkey: knownApp.pubkey,
        name: knownApp.name,
        recommendedPreset: {
          id: "SATSBACK_USER",
        },
      },
    })
  })

  it("returns known app metadata by pubkey", async () => {
    const nwcKnownAppResolver = resolvers.Query!.nwcKnownApp as (
      parent: unknown,
      args: { pubkey: string },
      context: unknown,
      info: unknown,
    ) => Promise<unknown> | unknown
    const knownApp = NWC_KNOWN_APPS[0]

    const result = await nwcKnownAppResolver(
      {},
      { pubkey: knownApp.pubkey },
      {},
      {} as never,
    )

    expect(result).toEqual(
      expect.objectContaining({
        pubkey: knownApp.pubkey,
        name: "Satsback",
        recommendedPreset: expect.objectContaining({
          id: NwcPermissionPresetId.SatsbackUser,
        }),
      }),
    )
  })

  it("matches known app metadata case-insensitively by pubkey", async () => {
    const nwcKnownAppResolver = resolvers.Query!.nwcKnownApp as (
      parent: unknown,
      args: { pubkey: string },
      context: unknown,
      info: unknown,
    ) => Promise<unknown> | unknown
    const knownApp = NWC_KNOWN_APPS[0]

    const result = await nwcKnownAppResolver(
      {},
      { pubkey: knownApp.pubkey.toUpperCase() },
      {},
      {} as never,
    )

    expect(result).toEqual(
      expect.objectContaining({
        pubkey: knownApp.pubkey,
      }),
    )
  })

  it("returns null for malformed known app pubkeys", async () => {
    const nwcKnownAppResolver = resolvers.Query!.nwcKnownApp as (
      parent: unknown,
      args: { pubkey: string },
      context: unknown,
      info: unknown,
    ) => Promise<unknown> | unknown

    const result = await nwcKnownAppResolver(
      {},
      { pubkey: "not-a-pubkey" },
      {},
      {} as never,
    )

    expect(result).toBeNull()
  })
})
