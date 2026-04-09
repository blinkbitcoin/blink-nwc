import { randomUUID } from "crypto"

import {
  createNwcConnection,
  updateNwcConnection,
  softDeleteNwcConnection,
  deleteNwcConnection,
  getNwcConnectionById,
  nwcConnectionsByUserId,
  nwcConnectionsByWalletId,
} from "@/app/manage-connections"
import { NwcConnection } from "@/domain/connection"
import { Nip47Method } from "@/domain/nostr"
import { Account, UserId, WalletId } from "@/domain/core/index.types"
import { AccountId, ApiKey, NwcAppPubkey, NwcConnectionId } from "@/domain/index.types"
import {
  InvalidWalletId,
  InvalidPermissions,
  InvalidNwcAlias,
  InvalidApiKey,
  InvalidNwcConnectionId,
  InvalidUserId,
  CouldNotFindNwcConnectionFromIdError,
} from "@/domain/errors"

const mockConnectionsRepository = {
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findByUserId: jest.fn(),
  findByWalletId: jest.fn(),
  softDelete: jest.fn(),
  delete: jest.fn(),
}

jest.mock("@/services/db/connections", () => ({
  ConnectionsRepository: () => mockConnectionsRepository,
}))

describe("manage-connections", () => {
  const mockAccount: Account = {
    id: randomUUID() as AccountId,
    kratosUserId: randomUUID() as UserId,
    username: undefined,
  }

  const mockWalletId = randomUUID()
  const mockApiKey = randomUUID()
  const mockPermissions = [Nip47Method.GetInfo, Nip47Method.GetBalance]
  const mockAlias = "TestWallet"

  const mockConnection: NwcConnection = {
    id: randomUUID() as NwcConnectionId,
    userId: mockAccount.kratosUserId,
    accountId: mockAccount.id,
    walletId: mockWalletId as WalletId,
    walletCurrency: "BTC",
    apiKey: mockApiKey as ApiKey,
    apiKeyId: null,
    connectionSecret: "test-secret" as any,
    appPubkey: "a".repeat(64) as NwcAppPubkey,
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

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("createNwcConnection", () => {
    it("should create a new NWC connection successfully", async () => {
      mockConnectionsRepository.create.mockResolvedValue(mockConnection)

      const result = await createNwcConnection(
        mockAccount,
        mockWalletId,
        mockApiKey,
        mockPermissions,
        mockAlias,
      )

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return

      expect(result.connectionObj).toEqual(mockConnection)
      expect(result.connectionUri).toContain("nostr+walletconnect://")
      expect(result.connectionUri).toContain("relay=")
      expect(result.connectionUri).toContain("secret=")

      expect(mockConnectionsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockAccount.kratosUserId,
          accountId: mockAccount.id,
          walletId: mockWalletId,
          apiKey: mockApiKey,
          permissions: mockPermissions,
          alias: mockAlias,
          notificationsEnabled: false,
        }),
      )
    })

    it("should create connection without alias", async () => {
      mockConnectionsRepository.create.mockResolvedValue(mockConnection)

      const result = await createNwcConnection(
        mockAccount,
        mockWalletId,
        mockApiKey,
        mockPermissions,
      )

      expect(result).not.toBeInstanceOf(Error)
      expect(mockConnectionsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          alias: null,
        }),
      )
    })

    it("should return error for invalid walletId", async () => {
      const result = await createNwcConnection(
        mockAccount,
        "invalid-wallet-id",
        mockApiKey,
        mockPermissions,
      )

      expect(result).toBeInstanceOf(InvalidWalletId)
      expect(mockConnectionsRepository.create).not.toHaveBeenCalled()
    })

    it("should return error for invalid permissions", async () => {
      const result = await createNwcConnection(mockAccount, mockWalletId, mockApiKey, [
        "invalid_permission",
      ])

      expect(result).toBeInstanceOf(InvalidPermissions)
      expect(mockConnectionsRepository.create).not.toHaveBeenCalled()
    })

    it("should return error for invalid alias (too long)", async () => {
      const tooLongAlias = "a".repeat(33) // max is 32

      const result = await createNwcConnection(
        mockAccount,
        mockWalletId,
        mockApiKey,
        mockPermissions,
        tooLongAlias,
      )

      expect(result).toBeInstanceOf(InvalidNwcAlias)
      expect(mockConnectionsRepository.create).not.toHaveBeenCalled()
    })

    it("should return error for empty API key", async () => {
      const result = await createNwcConnection(
        mockAccount,
        mockWalletId,
        "",
        mockPermissions,
      )

      expect(result).toBeInstanceOf(InvalidApiKey)
      expect(mockConnectionsRepository.create).not.toHaveBeenCalled()
    })

    it("should propagate repository errors", async () => {
      const repoError = new Error("Database error")
      mockConnectionsRepository.create.mockResolvedValue(repoError)

      const result = await createNwcConnection(
        mockAccount,
        mockWalletId,
        mockApiKey,
        mockPermissions,
      )

      expect(result).toBe(repoError)
    })
  })

  describe("updateNwcConnection", () => {
    it("should update connection alias", async () => {
      mockConnectionsRepository.findById.mockResolvedValue(mockConnection)
      mockConnectionsRepository.update.mockResolvedValue({
        ...mockConnection,
        alias: "NewAlias",
      })

      const result = await updateNwcConnection(mockAccount, mockConnection.id, {
        alias: "NewAlias",
      })

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return

      expect(result.alias).toBe("NewAlias")
      expect(result.permissions).toBe(mockConnection.permissions)
      expect(mockConnectionsRepository.update).toHaveBeenCalledWith(mockConnection.id, {
        alias: "NewAlias",
      })
    })

    it("should update connection permissions", async () => {
      const newPermissions = [Nip47Method.PayInvoice]
      mockConnectionsRepository.findById.mockResolvedValue(mockConnection)
      mockConnectionsRepository.update.mockResolvedValue({
        ...mockConnection,
        permissions: newPermissions,
      })

      const result = await updateNwcConnection(mockAccount, mockConnection.id, {
        permissions: newPermissions,
      })

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return

      expect(result.permissions).toEqual(newPermissions)
    })

    it("should return error for invalid connectionId", async () => {
      const result = await updateNwcConnection(mockAccount, "invalid-id", {
        alias: "New Alias",
      })

      expect(result).toBeInstanceOf(InvalidNwcConnectionId)
      expect(mockConnectionsRepository.findById).not.toHaveBeenCalled()
    })

    it("should return error when connection not found", async () => {
      mockConnectionsRepository.findById.mockResolvedValue(
        new CouldNotFindNwcConnectionFromIdError(),
      )

      const result = await updateNwcConnection(mockAccount, randomUUID(), {
        alias: "NewAlias",
      })

      expect(result).toBeInstanceOf(CouldNotFindNwcConnectionFromIdError)
    })

    it("should clear alias when set to null", async () => {
      mockConnectionsRepository.findById.mockResolvedValue(mockConnection)
      mockConnectionsRepository.update.mockResolvedValue({
        ...mockConnection,
        alias: null,
      })

      const result = await updateNwcConnection(mockAccount, mockConnection.id, {
        alias: null,
      })

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return

      expect(result.alias).toBeNull()
    })
  })

  describe("softDeleteNwcConnection", () => {
    it("should soft delete connection successfully", async () => {
      mockConnectionsRepository.findById.mockResolvedValue(mockConnection)
      mockConnectionsRepository.softDelete.mockResolvedValue(true)

      const result = await softDeleteNwcConnection(mockAccount, mockConnection.id)

      expect(result).toBe(true)
      expect(mockConnectionsRepository.softDelete).toHaveBeenCalledWith(mockConnection.id)
    })

    it("should return error for invalid connectionId", async () => {
      const result = await softDeleteNwcConnection(mockAccount, "invalid-id")

      expect(result).toBeInstanceOf(InvalidNwcConnectionId)
      expect(mockConnectionsRepository.findById).not.toHaveBeenCalled()
    })

    it("should return error when connection not found", async () => {
      mockConnectionsRepository.findById.mockResolvedValue(
        new CouldNotFindNwcConnectionFromIdError(),
      )

      const result = await softDeleteNwcConnection(mockAccount, randomUUID())

      expect(result).toBeInstanceOf(CouldNotFindNwcConnectionFromIdError)
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

  describe("nwcConnectionsByUserId", () => {
    it("should return connections by userId", async () => {
      const connections = [mockConnection]
      mockConnectionsRepository.findByUserId.mockResolvedValue(connections)

      const result = await nwcConnectionsByUserId(mockAccount.kratosUserId)

      expect(result).toEqual(connections)
      expect(mockConnectionsRepository.findByUserId).toHaveBeenCalledWith(
        mockAccount.kratosUserId,
      )
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
