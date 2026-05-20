import { randomUUID } from "crypto"

import {
  createNwcConnection,
  updateNwcConnection,
  softDeleteNwcConnection,
  deleteNwcConnection,
  getNwcConnectionById,
  getNwcConnectionByIdForUser,
  nwcConnectionsByUserId,
  nwcConnectionsByWalletId,
  revokeNwcConnection,
} from "@/app/manage-connections"
import {
  getServerKeypair,
  NwcConnection,
  parseNwcUri,
  stringifyNwcUri,
} from "@/domain/connection"
import { Nip47Method } from "@/domain/nostr"
import { AccountId, UserId, WalletId } from "@/domain/core/index.types"
import { ApiKey, NwcAppPubkey, NwcConnectionId, NwcSecret } from "@/domain/index.types"
import {
  InvalidNwcUri,
  InvalidWalletId,
  InvalidPermissions,
  InvalidNwcAlias,
  InvalidNwcConnectionId,
  InvalidUserId,
  CouldNotFindNwcConnectionFromIdError,
} from "@/domain/errors"
import { NOSTR_RELAY_PUBLIC_URL } from "@/config"
import { Scope } from "@/graphql/internal-client/generated"
import { NwcBudgetPeriod } from "@/domain/nwc-budget"

const mockConnectionsRepository = {
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findByUserId: jest.fn(),
  findByWalletId: jest.fn(),
  softDelete: jest.fn(),
  delete: jest.fn(),
}

const mockGetAuthenticatedWallet = jest.fn()
const mockCreateApiKeyForNwc = jest.fn()
const mockSetApiKeyLimitForNwc = jest.fn()
const mockRemoveApiKeyLimitForNwc = jest.fn()
const mockRevokeApiKeyForNwc = jest.fn()
const mockGetApiKeysForNwc = jest.fn()

jest.mock("@/services/db/connections", () => ({
  ConnectionsRepository: () => mockConnectionsRepository,
}))

jest.mock("@/graphql/internal-client/queries/get-authenticated-wallet", () => ({
  getAuthenticatedWallet: (...args: unknown[]) => mockGetAuthenticatedWallet(...args),
}))

jest.mock("@/graphql/internal-client/queries/api-key-create", () => ({
  createApiKeyForNwc: (...args: unknown[]) => mockCreateApiKeyForNwc(...args),
}))

jest.mock("@/graphql/internal-client/queries/api-key-set-limit", () => ({
  setApiKeyLimitForNwc: (...args: unknown[]) => mockSetApiKeyLimitForNwc(...args),
}))

jest.mock("@/graphql/internal-client/queries/api-key-remove-limit", () => ({
  removeApiKeyLimitForNwc: (...args: unknown[]) => mockRemoveApiKeyLimitForNwc(...args),
}))

jest.mock("@/graphql/internal-client/queries/api-key-revoke", () => ({
  revokeApiKeyForNwc: (...args: unknown[]) => mockRevokeApiKeyForNwc(...args),
}))

jest.mock("@/graphql/internal-client/queries/api-keys", () => ({
  getApiKeysForNwc: (...args: unknown[]) => mockGetApiKeysForNwc(...args),
}))

describe("manage-connections", () => {
  const mockUserId = randomUUID() as UserId
  const mockAccountId = randomUUID() as AccountId
  const mockWalletId = randomUUID()
  const mockApiKey = randomUUID()
  const mockApiKeyId = randomUUID()
  const mockPermissions = [Nip47Method.GetInfo, Nip47Method.GetBalance]
  const mockAlias = "TestWallet"
  const mockAuthorization = "Bearer test-auth-token"
  const mockNwcUri = stringifyNwcUri({
    pubkey: getServerKeypair().pubkey,
    relay: NOSTR_RELAY_PUBLIC_URL,
    secret: "c".repeat(64) as NwcSecret,
  })
  const parsedNwcUri = parseNwcUri(mockNwcUri)

  if (parsedNwcUri instanceof Error) {
    throw parsedNwcUri
  }

  const mockConnection: NwcConnection = {
    id: randomUUID() as NwcConnectionId,
    userId: mockUserId,
    accountId: mockAccountId,
    walletId: mockWalletId as WalletId,
    walletCurrency: "BTC",
    apiKey: mockApiKey as ApiKey,
    apiKeyId: mockApiKeyId as any,
    connectionSecret: parsedNwcUri.secret as any,
    appPubkey: parsedNwcUri.appPubkey as NwcAppPubkey,
    permissions: mockPermissions,
    alias: mockAlias as any,
    notificationsEnabled: false,
    revoked: false,
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const emptyApiKeyLimitsSnapshot = () => ({
    dailyLimitSats: null as number | null,
    dailySpentSats: 0,
    weeklyLimitSats: null as number | null,
    weeklySpentSats: 0,
    monthlyLimitSats: null as number | null,
    monthlySpentSats: 0,
    annualLimitSats: null as number | null,
    annualSpentSats: 0,
  })

  let apiKeyLimitsSnapshot = emptyApiKeyLimitsSnapshot()

  beforeEach(() => {
    jest.clearAllMocks()
    apiKeyLimitsSnapshot = emptyApiKeyLimitsSnapshot()
    mockGetAuthenticatedWallet.mockResolvedValue({
      accountId: mockAccountId,
      id: mockWalletId as WalletId,
      walletCurrency: "BTC",
    })
    mockCreateApiKeyForNwc.mockResolvedValue({
      id: mockApiKeyId,
      secret: mockApiKey,
    })
    mockSetApiKeyLimitForNwc.mockImplementation(
      async (_client, _authorization, input) => {
        switch (input.limitTimeWindow) {
          case "DAILY":
            apiKeyLimitsSnapshot.dailyLimitSats = input.limitSats
            break
          case "WEEKLY":
            apiKeyLimitsSnapshot.weeklyLimitSats = input.limitSats
            break
          case "MONTHLY":
            apiKeyLimitsSnapshot.monthlyLimitSats = input.limitSats
            break
          case "ANNUAL":
            apiKeyLimitsSnapshot.annualLimitSats = input.limitSats
            break
        }
        return apiKeyLimitsSnapshot
      },
    )
    mockRemoveApiKeyLimitForNwc.mockImplementation(
      async (_client, _authorization, input) => {
        switch (input.limitTimeWindow) {
          case "DAILY":
            apiKeyLimitsSnapshot.dailyLimitSats = null
            break
          case "WEEKLY":
            apiKeyLimitsSnapshot.weeklyLimitSats = null
            break
          case "MONTHLY":
            apiKeyLimitsSnapshot.monthlyLimitSats = null
            break
          case "ANNUAL":
            apiKeyLimitsSnapshot.annualLimitSats = null
            break
        }
        return apiKeyLimitsSnapshot
      },
    )
    mockRevokeApiKeyForNwc.mockResolvedValue(undefined)
    mockGetApiKeysForNwc.mockImplementation(async () => [
      {
        id: mockApiKeyId,
        limits: apiKeyLimitsSnapshot,
      },
    ])
  })

  describe("createNwcConnection", () => {
    it("should create a new NWC connection successfully", async () => {
      mockConnectionsRepository.create.mockResolvedValue(mockConnection)

      const result = await createNwcConnection(mockUserId, mockAuthorization, {
        nwcUri: mockNwcUri,
        walletId: mockWalletId,
        permissions: mockPermissions,
        alias: mockAlias,
      })

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return

      expect(result.connectionObj).toEqual(mockConnection)
      expect(result.connectionUri).toBe(mockNwcUri)
      expect(result.budgets).toEqual([])

      expect(mockCreateApiKeyForNwc).toHaveBeenCalledWith(
        expect.anything(),
        mockAuthorization,
        {
          name: mockAlias,
          scopes: [Scope.Read],
        },
      )

      expect(mockConnectionsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          accountId: mockAccountId,
          walletId: mockWalletId,
          apiKey: mockApiKey,
          apiKeyId: mockApiKeyId,
          permissions: mockPermissions,
          alias: mockAlias,
          notificationsEnabled: false,
          connectionSecret: parsedNwcUri.secret,
          appPubkey: parsedNwcUri.appPubkey,
        }),
      )
    })

    it("should create connection without alias", async () => {
      mockConnectionsRepository.create.mockResolvedValue(mockConnection)

      const result = await createNwcConnection(mockUserId, mockAuthorization, {
        nwcUri: mockNwcUri,
        walletId: mockWalletId,
        permissions: mockPermissions,
      })

      expect(result).not.toBeInstanceOf(Error)
      expect(mockConnectionsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          alias: null,
        }),
      )
    })

    it("should return error for invalid walletId", async () => {
      const result = await createNwcConnection(mockUserId, mockAuthorization, {
        nwcUri: mockNwcUri,
        walletId: "invalid-wallet-id",
        permissions: mockPermissions,
      })

      expect(result).toBeInstanceOf(InvalidWalletId)
      expect(mockConnectionsRepository.create).not.toHaveBeenCalled()
    })

    it("should return error for invalid permissions", async () => {
      const result = await createNwcConnection(mockUserId, mockAuthorization, {
        nwcUri: mockNwcUri,
        walletId: mockWalletId,
        permissions: ["invalid_permission"],
      })

      expect(result).toBeInstanceOf(InvalidPermissions)
      expect(mockConnectionsRepository.create).not.toHaveBeenCalled()
    })

    it("should return error for invalid alias (too long)", async () => {
      const tooLongAlias = "a".repeat(33) // max is 32

      const result = await createNwcConnection(mockUserId, mockAuthorization, {
        nwcUri: mockNwcUri,
        walletId: mockWalletId,
        permissions: mockPermissions,
        alias: tooLongAlias,
      })

      expect(result).toBeInstanceOf(InvalidNwcAlias)
      expect(mockConnectionsRepository.create).not.toHaveBeenCalled()
    })

    it("should return error for invalid NWC URI", async () => {
      const result = await createNwcConnection(mockUserId, mockAuthorization, {
        nwcUri: "https://invalid-uri.example.com",
        walletId: mockWalletId,
        permissions: mockPermissions,
      })

      expect(result).toBeInstanceOf(InvalidNwcUri)
      expect(mockConnectionsRepository.create).not.toHaveBeenCalled()
    })

    it("should reject wallets that do not belong to the authenticated account", async () => {
      mockGetAuthenticatedWallet.mockResolvedValue(null)

      const result = await createNwcConnection(mockUserId, mockAuthorization, {
        nwcUri: mockNwcUri,
        walletId: mockWalletId,
        permissions: mockPermissions,
      })

      expect(result).toBeInstanceOf(InvalidWalletId)
      expect(mockConnectionsRepository.create).not.toHaveBeenCalled()
    })

    it("should create budgeted API key limits when budgets are provided", async () => {
      mockConnectionsRepository.create.mockResolvedValue(mockConnection)

      const result = await createNwcConnection(mockUserId, mockAuthorization, {
        nwcUri: mockNwcUri,
        walletId: mockWalletId,
        permissions: [...mockPermissions, Nip47Method.PayInvoice],
        budgets: [
          {
            amountSats: 5000,
            period: NwcBudgetPeriod.Daily,
          },
          {
            amountSats: 30000,
            period: NwcBudgetPeriod.Monthly,
          },
        ],
      })

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return

      expect(mockCreateApiKeyForNwc).toHaveBeenCalledWith(
        expect.anything(),
        mockAuthorization,
        {
          name: `nwc-${parsedNwcUri.appPubkey.slice(0, 8)}`,
          scopes: [Scope.Read, Scope.Write],
        },
      )
      expect(mockSetApiKeyLimitForNwc).toHaveBeenCalledWith(
        expect.anything(),
        mockAuthorization,
        {
          id: mockApiKeyId,
          limitSats: 5000,
          limitTimeWindow: "DAILY",
        },
      )
      expect(mockSetApiKeyLimitForNwc).toHaveBeenCalledWith(
        expect.anything(),
        mockAuthorization,
        {
          id: mockApiKeyId,
          limitSats: 30000,
          limitTimeWindow: "MONTHLY",
        },
      )
      expect(result.budgets).toEqual([
        {
          amountSats: 5000,
          period: "DAILY",
          usedSats: 0,
          remainingSats: 5000,
          resetsAt: null,
        },
        {
          amountSats: 30000,
          period: "MONTHLY",
          usedSats: 0,
          remainingSats: 30000,
          resetsAt: null,
        },
      ])
    })

    it("should map NEVER budgets to the non-resetting upstream limit window", async () => {
      mockConnectionsRepository.create.mockResolvedValue(mockConnection)

      const result = await createNwcConnection(mockUserId, mockAuthorization, {
        nwcUri: mockNwcUri,
        walletId: mockWalletId,
        permissions: [Nip47Method.PayInvoice],
        budgets: [
          {
            amountSats: 5000,
            period: NwcBudgetPeriod.Never,
          },
        ],
      })

      expect(result).not.toBeInstanceOf(Error)
      expect(mockSetApiKeyLimitForNwc).toHaveBeenCalledWith(
        expect.anything(),
        mockAuthorization,
        {
          id: mockApiKeyId,
          limitSats: 5000,
          limitTimeWindow: "ANNUAL",
        },
      )
    })

    it("should revoke the created API key if persistence fails", async () => {
      const repoError = new Error("Database error")
      mockConnectionsRepository.create.mockResolvedValue(repoError)

      const result = await createNwcConnection(mockUserId, mockAuthorization, {
        nwcUri: mockNwcUri,
        walletId: mockWalletId,
        permissions: mockPermissions,
      })

      expect(result).toBe(repoError)
      expect(mockRevokeApiKeyForNwc).toHaveBeenCalledWith(
        expect.anything(),
        mockAuthorization,
        mockApiKeyId,
      )
    })
  })

  describe("updateNwcConnection", () => {
    it("should update connection alias", async () => {
      mockConnectionsRepository.findById.mockResolvedValue(mockConnection)
      mockConnectionsRepository.update.mockResolvedValue({
        ...mockConnection,
        alias: "NewAlias",
      })

      const result = await updateNwcConnection(
        mockUserId,
        mockAuthorization,
        mockConnection.id,
        {
          alias: "NewAlias",
        },
      )

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return

      expect(result.alias).toBe("NewAlias")
      expect(result.permissions).toBe(mockConnection.permissions)
      expect(mockConnectionsRepository.update).toHaveBeenCalledWith(mockConnection.id, {
        alias: "NewAlias",
      })
    })

    it("should replace connection budgets", async () => {
      apiKeyLimitsSnapshot = {
        ...emptyApiKeyLimitsSnapshot(),
        dailyLimitSats: 5000,
        dailySpentSats: 200,
      }
      mockConnectionsRepository.findById.mockResolvedValue(mockConnection)
      mockConnectionsRepository.update.mockResolvedValue({
        ...mockConnection,
        alias: mockConnection.alias,
      })

      const result = await updateNwcConnection(
        mockUserId,
        mockAuthorization,
        mockConnection.id,
        {
          budgets: [
            {
              amountSats: 8000,
              period: NwcBudgetPeriod.Weekly,
            },
            {
              amountSats: 30000,
              period: NwcBudgetPeriod.Monthly,
            },
          ],
        },
      )

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return

      expect(mockSetApiKeyLimitForNwc).toHaveBeenCalledWith(
        expect.anything(),
        mockAuthorization,
        {
          id: mockApiKeyId,
          limitSats: 8000,
          limitTimeWindow: "WEEKLY",
        },
      )
      expect(mockSetApiKeyLimitForNwc).toHaveBeenCalledWith(
        expect.anything(),
        mockAuthorization,
        {
          id: mockApiKeyId,
          limitSats: 30000,
          limitTimeWindow: "MONTHLY",
        },
      )
      expect(mockRemoveApiKeyLimitForNwc).toHaveBeenCalledWith(
        expect.anything(),
        mockAuthorization,
        {
          id: mockApiKeyId,
          limitTimeWindow: "DAILY",
        },
      )
      expect(mockConnectionsRepository.update).toHaveBeenCalledWith(mockConnection.id, {
        alias: undefined,
      })
    })

    it("should remove connection budgets when null is provided", async () => {
      apiKeyLimitsSnapshot = {
        ...emptyApiKeyLimitsSnapshot(),
        dailyLimitSats: 5000,
        dailySpentSats: 200,
        monthlyLimitSats: 30000,
      }
      mockConnectionsRepository.findById.mockResolvedValue(mockConnection)
      mockConnectionsRepository.update.mockResolvedValue(mockConnection)

      const result = await updateNwcConnection(
        mockUserId,
        mockAuthorization,
        mockConnection.id,
        {
          budgets: null,
        },
      )

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return

      expect(mockGetApiKeysForNwc).toHaveBeenCalledWith(
        expect.anything(),
        mockAuthorization,
      )
      expect(mockRemoveApiKeyLimitForNwc).toHaveBeenCalledWith(
        expect.anything(),
        mockAuthorization,
        {
          id: mockApiKeyId,
          limitTimeWindow: "DAILY",
        },
      )
      expect(mockRemoveApiKeyLimitForNwc).toHaveBeenCalledWith(
        expect.anything(),
        mockAuthorization,
        {
          id: mockApiKeyId,
          limitTimeWindow: "MONTHLY",
        },
      )
    })

    it("should return error for invalid connectionId", async () => {
      const result = await updateNwcConnection(
        mockUserId,
        mockAuthorization,
        "invalid-id",
        {
          alias: "New Alias",
        },
      )

      expect(result).toBeInstanceOf(InvalidNwcConnectionId)
      expect(mockConnectionsRepository.findById).not.toHaveBeenCalled()
    })

    it("should return error when connection not found", async () => {
      mockConnectionsRepository.findById.mockResolvedValue(
        new CouldNotFindNwcConnectionFromIdError(),
      )

      const result = await updateNwcConnection(
        mockUserId,
        mockAuthorization,
        randomUUID(),
        {
          alias: "NewAlias",
        },
      )

      expect(result).toBeInstanceOf(CouldNotFindNwcConnectionFromIdError)
    })

    it("should clear alias when set to null", async () => {
      mockConnectionsRepository.findById.mockResolvedValue(mockConnection)
      mockConnectionsRepository.update.mockResolvedValue({
        ...mockConnection,
        alias: null,
      })

      const result = await updateNwcConnection(
        mockUserId,
        mockAuthorization,
        mockConnection.id,
        {
          alias: null,
        },
      )

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return

      expect(result.alias).toBeNull()
    })
  })

  describe("softDeleteNwcConnection", () => {
    it("should soft delete connection successfully", async () => {
      mockConnectionsRepository.findById.mockResolvedValue(mockConnection)
      mockConnectionsRepository.softDelete.mockResolvedValue(true)

      const result = await softDeleteNwcConnection(mockUserId, mockConnection.id)

      expect(result).toBe(true)
      expect(mockConnectionsRepository.softDelete).toHaveBeenCalledWith(mockConnection.id)
    })

    it("should return error for invalid connectionId", async () => {
      const result = await softDeleteNwcConnection(mockUserId, "invalid-id")

      expect(result).toBeInstanceOf(InvalidNwcConnectionId)
      expect(mockConnectionsRepository.findById).not.toHaveBeenCalled()
    })

    it("should return error when connection not found", async () => {
      mockConnectionsRepository.findById.mockResolvedValue(
        new CouldNotFindNwcConnectionFromIdError(),
      )

      const result = await softDeleteNwcConnection(mockUserId, randomUUID())

      expect(result).toBeInstanceOf(CouldNotFindNwcConnectionFromIdError)
    })
  })

  describe("revokeNwcConnection", () => {
    it("should return the revoked connection after revocation", async () => {
      const revokedConnection = {
        ...mockConnection,
        revoked: true,
        revokedAt: new Date(),
      }
      mockConnectionsRepository.findById
        .mockResolvedValueOnce(mockConnection)
        .mockResolvedValueOnce(revokedConnection)
      mockConnectionsRepository.softDelete.mockResolvedValue(true)

      const result = await revokeNwcConnection(mockUserId, mockConnection.id)

      expect(result).toEqual(revokedConnection)
      expect(mockConnectionsRepository.softDelete).toHaveBeenCalledWith(mockConnection.id)
      expect(mockConnectionsRepository.findById).toHaveBeenNthCalledWith(
        1,
        mockConnection.id,
      )
      expect(mockConnectionsRepository.findById).toHaveBeenNthCalledWith(
        2,
        mockConnection.id,
      )
    })
  })

  describe("deleteNwcConnection", () => {
    it("should hard delete connection successfully", async () => {
      mockConnectionsRepository.findById.mockResolvedValue(mockConnection)
      mockConnectionsRepository.delete.mockResolvedValue(true)

      const result = await deleteNwcConnection(mockConnection.id)

      expect(result).toBe(true)
      expect(mockConnectionsRepository.delete).toHaveBeenCalledWith(mockConnection.id)
    })

    it("should return error for invalid connectionId", async () => {
      const result = await deleteNwcConnection("invalid-id" as NwcConnectionId)

      expect(result).toBeInstanceOf(InvalidNwcConnectionId)
      expect(mockConnectionsRepository.findById).not.toHaveBeenCalled()
    })

    it("should return error when connection not found", async () => {
      mockConnectionsRepository.findById.mockResolvedValue(
        new CouldNotFindNwcConnectionFromIdError(),
      )

      const result = await deleteNwcConnection(randomUUID() as NwcConnectionId)

      expect(result).toBeInstanceOf(CouldNotFindNwcConnectionFromIdError)
    })
  })

  describe("getNwcConnectionById", () => {
    it("should return connection by id", async () => {
      mockConnectionsRepository.findById.mockResolvedValue(mockConnection)

      const result = await getNwcConnectionById(mockConnection.id)

      expect(result).toEqual(mockConnection)
      expect(mockConnectionsRepository.findById).toHaveBeenCalledWith(mockConnection.id)
    })

    it("should return error for invalid connectionId", async () => {
      const result = await getNwcConnectionById("invalid-id" as NwcConnectionId)

      expect(result).toBeInstanceOf(InvalidNwcConnectionId)
    })

    it("should return error when connection not found", async () => {
      mockConnectionsRepository.findById.mockResolvedValue(
        new CouldNotFindNwcConnectionFromIdError(),
      )

      const result = await getNwcConnectionById(randomUUID() as NwcConnectionId)

      expect(result).toBeInstanceOf(CouldNotFindNwcConnectionFromIdError)
    })
  })

  describe("getNwcConnectionByIdForUser", () => {
    it("should return connection for matching user", async () => {
      mockConnectionsRepository.findById.mockResolvedValue(mockConnection)

      const result = await getNwcConnectionByIdForUser(mockUserId, mockConnection.id)

      expect(result).toEqual(mockConnection)
      expect(mockConnectionsRepository.findById).toHaveBeenCalledWith(mockConnection.id)
    })

    it("should return not found when connection belongs to another user", async () => {
      mockConnectionsRepository.findById.mockResolvedValue({
        ...mockConnection,
        userId: randomUUID() as UserId,
      })

      const result = await getNwcConnectionByIdForUser(mockUserId, mockConnection.id)

      expect(result).toBeInstanceOf(CouldNotFindNwcConnectionFromIdError)
    })
  })

  describe("nwcConnectionsByUserId", () => {
    it("should return connections by userId", async () => {
      const connections = [mockConnection]
      mockConnectionsRepository.findByUserId.mockResolvedValue(connections)

      const result = await nwcConnectionsByUserId(mockUserId)

      expect(result).toEqual(connections)
      expect(mockConnectionsRepository.findByUserId).toHaveBeenCalledWith(mockUserId)
    })

    it("should return empty array when no connections found", async () => {
      mockConnectionsRepository.findByUserId.mockResolvedValue([])

      const result = await nwcConnectionsByUserId(randomUUID())

      expect(result).toEqual([])
    })

    it("should return error for invalid userId", async () => {
      const result = await nwcConnectionsByUserId("invalid-user-id")

      expect(result).toBeInstanceOf(InvalidUserId)
      expect(mockConnectionsRepository.findByUserId).not.toHaveBeenCalled()
    })
  })

  describe("nwcConnectionsByWalletId", () => {
    it("should return connections by walletId", async () => {
      const connections = [mockConnection]
      mockConnectionsRepository.findByWalletId.mockResolvedValue(connections)

      const result = await nwcConnectionsByWalletId(mockWalletId)

      expect(result).toEqual(connections)
      expect(mockConnectionsRepository.findByWalletId).toHaveBeenCalledWith(mockWalletId)
    })

    it("should return empty array when no connections found", async () => {
      mockConnectionsRepository.findByWalletId.mockResolvedValue([])

      const result = await nwcConnectionsByWalletId(randomUUID())

      expect(result).toEqual([])
    })

    it("should return error for invalid walletId", async () => {
      const result = await nwcConnectionsByWalletId("invalid-wallet-id")

      expect(result).toBeInstanceOf(InvalidWalletId)
      expect(mockConnectionsRepository.findByWalletId).not.toHaveBeenCalled()
    })
  })
})
