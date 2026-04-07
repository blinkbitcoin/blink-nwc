import { randomUUID } from "crypto"

import {
  clearAllTables,
  closeTestDb,
  createTestConnection,
  getAllConnections,
  getConnectionByAppPubkey,
  getConnectionById,
  insertMultipleTestConnections,
  insertTestConnection,
  randomPubkey,
  runMigrations,
} from "../helpers"

import { ConnectionsRepository } from "@/services/db/connections"
import { closeDbConnections } from "@/services/db/query-builder"
import { NwcConnectionAlias, NwcConnectionId } from "@/domain/index.types"
import { UserId, WalletId } from "@/domain/core/index.types"
import {
  CouldNotFindNwcConnectionFromAppPubkeyError,
  CouldNotFindNwcConnectionFromIdError,
  CouldNotFindNwcConnectionFromUserIdError,
  CouldNotFindNwcConnectionFromWalletIdError,
  UniqueConstraintViolationError,
} from "@/domain/errors"
import { Nip47Method } from "@/domain/nostr"

describe("ConnectionsRepository", () => {
  beforeAll(async () => {
    await runMigrations()
  })

  beforeEach(async () => {
    await clearAllTables()
  })

  afterAll(async () => {
    await closeTestDb()
    await closeDbConnections()
  })

  describe("findByPubkey", () => {
    it("should find connection by app pubkey", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection()
      await insertTestConnection(testConn)

      const result = await repo.findByPubkey(testConn.appPubkey)

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.appPubkey).toBe(testConn.appPubkey)
      expect(result.userId).toBe(testConn.userId)
      expect(result.walletId).toBe(testConn.walletId)
      expect(result.permissions).toEqual(testConn.permissions)
    })

    it("should return error when connection not found", async () => {
      const repo = ConnectionsRepository()
      const nonExistentPubkey = randomPubkey()

      const result = await repo.findByPubkey(nonExistentPubkey)

      expect(result).toBeInstanceOf(CouldNotFindNwcConnectionFromAppPubkeyError)
    })

    it("should find connection with null alias", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection({ alias: null })
      await insertTestConnection(testConn)

      const result = await repo.findByPubkey(testConn.appPubkey)

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.alias).toBeNull()
    })

    it("should find connection with all permissions", async () => {
      const repo = ConnectionsRepository()
      const allPermissions = [
        Nip47Method.GetInfo,
        Nip47Method.GetBalance,
        Nip47Method.MakeInvoice,
        Nip47Method.PayInvoice,
        Nip47Method.LookupInvoice,
        Nip47Method.ListTransactions,
      ]
      const testConn = createTestConnection({ permissions: allPermissions })
      await insertTestConnection(testConn)

      const result = await repo.findByPubkey(testConn.appPubkey)

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.permissions).toHaveLength(6)
      expect(result.permissions).toEqual(allPermissions)
    })

    it("should find connection with no permissions", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection({ permissions: [] })
      await insertTestConnection(testConn)

      const result = await repo.findByPubkey(testConn.appPubkey)

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.permissions).toHaveLength(0)
    })

    it("should find revoked connection", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection({ revoked: true })
      await insertTestConnection(testConn)

      const result = await repo.findByPubkey(testConn.appPubkey)

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.revoked).toBe(true)
    })
  })

  describe("findById", () => {
    it("should find connection by id", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection()
      const inserted = await insertTestConnection(testConn)

      const result = await repo.findById(inserted.id as NwcConnectionId)
      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.id).toBe(inserted.id)
      expect(result.appPubkey).toBe(testConn.appPubkey)
    })

    it("should return error when id not found", async () => {
      const repo = ConnectionsRepository()
      const nonExistentId = randomUUID() as NwcConnectionId

      const result = await repo.findById(nonExistentId)

      expect(result).toBeInstanceOf(CouldNotFindNwcConnectionFromIdError)
    })

    it("should include timestamps", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection()
      const inserted = await insertTestConnection(testConn)

      const result = await repo.findById(inserted.id as NwcConnectionId)
      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)
    })
  })

  describe("create", () => {
    it("should create new connection", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection()

      const result = await repo.create(testConn)

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.id).toBeDefined()
      expect(result.appPubkey).toBe(testConn.appPubkey)
      expect(result.userId).toBe(testConn.userId)
      expect(result.walletId).toBe(testConn.walletId)
      expect(result.permissions).toEqual(testConn.permissions)
      expect(result.revoked).toBe(false)
      expect(result.notificationsEnabled).toBe(false)
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)

      const dbConn = await getConnectionByAppPubkey(testConn.appPubkey)
      expect(dbConn).toBeDefined()
    })
    it("should create connection with alias", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection({
        alias: "My Test Wallet" as NwcConnectionAlias,
      })

      const result = await repo.create(testConn)

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.alias).toBe("My Test Wallet")
    })
    it("should create connection with empty permissions", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection({ permissions: [] })

      const result = await repo.create(testConn)

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.permissions).toEqual([])
    })
    it("should create connection with notifications disabled", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection({ notificationsEnabled: false })

      const result = await repo.create(testConn)

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.notificationsEnabled).toBe(false)
    })
    it("should create connection with notifications disabled by default", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection()

      const result = await repo.create(testConn)

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.notificationsEnabled).toBe(false)
    })
    it("should create connection with notifications enabled", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection({ notificationsEnabled: true })

      const result = await repo.create(testConn)

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.notificationsEnabled).toBe(true)
    })
    it("should fail to create duplicate app_pubkey", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection()

      await repo.create(testConn)
      const result = await repo.create(testConn)
      expect(result).toBeInstanceOf(UniqueConstraintViolationError)
    })
  })

  describe("update", () => {
    it("should update alias", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection({ alias: "Old Alias" as NwcConnectionAlias })
      const inserted = await insertTestConnection(testConn)

      const result = await repo.update(inserted.id as NwcConnectionId, {
        alias: "New Alias" as NwcConnectionAlias,
      })

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.alias).toBe("New Alias")
      expect(result.id).toBe(inserted.id)
    })

    it("should update permissions", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection({
        permissions: [Nip47Method.GetInfo],
      })
      const inserted = await insertTestConnection(testConn)

      const newPermissions = [Nip47Method.GetInfo, Nip47Method.PayInvoice]
      const result = await repo.update(inserted.id as NwcConnectionId, {
        permissions: newPermissions,
      })

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.permissions).toEqual(newPermissions)
    })

    it("should update both alias and permissions", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection()
      const inserted = await insertTestConnection(testConn)

      const result = await repo.update(inserted.id as NwcConnectionId, {
        alias: "Updated" as NwcConnectionAlias,
        permissions: [Nip47Method.GetBalance],
      })

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.alias).toBe("Updated")
      expect(result.permissions).toEqual([Nip47Method.GetBalance])
    })

    it("should set alias to null", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection({ alias: "Has Alias" as NwcConnectionAlias })
      const inserted = await insertTestConnection(testConn)

      const result = await repo.update(inserted.id as NwcConnectionId, { alias: null })

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.alias).toBeNull()
    })

    it("should update notifications", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection()
      const inserted = await insertTestConnection(testConn)
      expect(inserted.notifications_enabled).toBe(false)

      const result = await repo.update(inserted.id as NwcConnectionId, {
        notificationsEnabled: true,
      })

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.notificationsEnabled).toBe(true)
    })

    it("should return error when updating non-existent connection", async () => {
      const repo = ConnectionsRepository()
      const nonExistentId = randomUUID() as NwcConnectionId

      const result = await repo.update(nonExistentId, {
        alias: "Test" as NwcConnectionAlias,
      })

      expect(result).toBeInstanceOf(Error)
    })

    it("should not allow updating immutable fields", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection()
      const inserted = await insertTestConnection(testConn)

      const result = await repo.update(inserted.id as NwcConnectionId, {
        alias: "Updated" as NwcConnectionAlias,
      })

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.userId).toBe(testConn.userId)
      expect(result.walletId).toBe(testConn.walletId)
      expect(result.apiKey).toBe(testConn.apiKey)
      expect(result.appPubkey).toBe(testConn.appPubkey)
    })
  })

  describe("delete", () => {
    it("should hard delete connection", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection()
      const inserted = await insertTestConnection(testConn)

      const result = await repo.delete(inserted.id as NwcConnectionId)

      expect(result).toBe(true)

      const dbConn = await getConnectionById(inserted.id as NwcConnectionId)
      expect(dbConn).toBeUndefined()
    })

    it("should return false when deleting non-existent connection", async () => {
      const repo = ConnectionsRepository()
      const nonExistentId = randomUUID() as NwcConnectionId

      const result = await repo.delete(nonExistentId)

      expect(result).toBe(false)
    })

    it("should actually remove from database", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection()
      const inserted = await insertTestConnection(testConn)

      await repo.delete(inserted.id as NwcConnectionId)

      const allConnections = await getAllConnections()
      expect(allConnections).toHaveLength(0)
    })
  })

  describe("softDelete", () => {
    it("should soft delete connection (set revoked=true)", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection()
      const inserted = await insertTestConnection(testConn)

      const result = await repo.softDelete(inserted.id as NwcConnectionId)

      expect(result).toBe(true)

      const dbConn = await getConnectionById(inserted.id as NwcConnectionId)
      expect(dbConn).toBeDefined()
      expect(dbConn?.revoked).toBe(true)
    })

    it("should return false when soft deleting non-existent connection", async () => {
      const repo = ConnectionsRepository()
      const nonExistentId = randomUUID() as NwcConnectionId

      const result = await repo.softDelete(nonExistentId)

      expect(result).toBe(false)
    })

    it("should not actually delete from database", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection()
      const inserted = await insertTestConnection(testConn)

      await repo.softDelete(inserted.id as NwcConnectionId)

      const allConnections = await getAllConnections()
      expect(allConnections).toHaveLength(1)
      expect(allConnections[0].revoked).toBe(true)
    })

    it("should be idempotent", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection()
      const inserted = await insertTestConnection(testConn)

      const result1 = await repo.softDelete(inserted.id as NwcConnectionId)
      const result2 = await repo.softDelete(inserted.id as NwcConnectionId)

      expect(result1).toBe(true)
      expect(result2).toBe(true)

      const dbConn = await getConnectionById(inserted.id as NwcConnectionId)
      expect(dbConn?.revoked).toBe(true)
    })
  })

  describe("findByWalletId", () => {
    it("should find all connections for wallet", async () => {
      const repo = ConnectionsRepository()
      const walletId = randomUUID() as WalletId
      const walletId2 = randomUUID() as WalletId

      await insertMultipleTestConnections(3, { walletId })
      await insertMultipleTestConnections(2, { walletId: walletId2 })

      const result = await repo.findByWalletId(walletId)
      const result2 = await repo.findByWalletId(walletId2)
      expect(result).not.toBeInstanceOf(Error)
      expect(result2).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      if (result2 instanceof Error) {
        return
      }
      expect(result).toHaveLength(3)
      result.forEach((conn) => {
        expect(conn.walletId).toBe(walletId)
      })
      expect(result2).toHaveLength(2)
      result2.forEach((conn2) => {
        expect(conn2.walletId).toBe(walletId2)
      })
    })

    it("should return error when no connections found", async () => {
      const repo = ConnectionsRepository()
      const walletId = randomUUID() as WalletId

      const result = await repo.findByWalletId(walletId)

      expect(result).toBeInstanceOf(CouldNotFindNwcConnectionFromWalletIdError)
    })

    it("should include revoked connections", async () => {
      const repo = ConnectionsRepository()
      const walletId = randomUUID() as WalletId

      await insertTestConnection(createTestConnection({ walletId, revoked: false }))
      await insertTestConnection(createTestConnection({ walletId, revoked: true }))

      const result = await repo.findByWalletId(walletId)

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result).toHaveLength(2)
      expect(result.some((c) => c.revoked)).toBe(true)
      expect(result.some((c) => !c.revoked)).toBe(true)
    })
  })

  describe("countActiveByWalletId", () => {
    it("should count only non-revoked connections", async () => {
      const repo = ConnectionsRepository()
      const walletId = randomUUID() as WalletId

      await insertTestConnection(createTestConnection({ walletId, revoked: false }))
      await insertTestConnection(createTestConnection({ walletId, revoked: false }))
      await insertTestConnection(createTestConnection({ walletId, revoked: true }))

      const result = await repo.countActiveByWalletId(walletId)

      expect(result).not.toBeInstanceOf(Error)
      expect(result).toBe(2)
    })

    it("should return 0 when no active connections", async () => {
      const repo = ConnectionsRepository()
      const walletId = randomUUID() as WalletId

      await insertTestConnection(createTestConnection({ walletId, revoked: true }))

      const result = await repo.countActiveByWalletId(walletId)

      expect(result).not.toBeInstanceOf(Error)
      expect(result).toBe(0)
    })

    it("should return 0 when wallet has no connections", async () => {
      const repo = ConnectionsRepository()
      const walletId = randomUUID() as WalletId

      const result = await repo.countActiveByWalletId(walletId)

      expect(result).not.toBeInstanceOf(Error)
      expect(result).toBe(0)
    })
  })

  describe("findByUserId", () => {
    it("should find all connections for user", async () => {
      const repo = ConnectionsRepository()
      const userId = randomUUID() as UserId
      const userId2 = randomUUID() as UserId

      await insertMultipleTestConnections(4, { userId })
      await insertMultipleTestConnections(2, { userId: userId2 })

      const result = await repo.findByUserId(userId)

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result).toHaveLength(4)
      result.forEach((conn) => {
        expect(conn.userId).toBe(userId)
      })
    })

    it("should return error when no connections found", async () => {
      const repo = ConnectionsRepository()
      const userId = randomUUID() as UserId

      const result = await repo.findByUserId(userId)

      expect(result).toBeInstanceOf(CouldNotFindNwcConnectionFromUserIdError)
    })

    it("should find connections across multiple wallets", async () => {
      const repo = ConnectionsRepository()
      const userId = randomUUID() as UserId

      const wallet1 = randomUUID() as WalletId
      const wallet2 = randomUUID() as WalletId
      await insertTestConnection(
        createTestConnection({
          userId,
          walletId: wallet1,
        }),
      )
      await insertTestConnection(
        createTestConnection({
          userId,
          walletId: wallet2,
        }),
      )

      const result = await repo.findByUserId(userId)

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result).toHaveLength(2)
      const walletIds = result.map((c) => c.walletId)
      expect(walletIds).toContain(wallet1)
      expect(walletIds).toContain(wallet2)
    })
  })

  describe("deleteByWalletId", () => {
    it("should delete all connections for wallet", async () => {
      const repo = ConnectionsRepository()
      const walletId = randomUUID() as WalletId
      const walletId2 = randomUUID() as WalletId

      await insertMultipleTestConnections(3, { walletId })
      await insertMultipleTestConnections(2, {
        walletId: walletId2,
      })

      const result = await repo.deleteByWalletId(walletId)

      expect(result).not.toBeInstanceOf(Error)
      expect(result).toBe(3)

      const remaining = await getAllConnections()
      expect(remaining).toHaveLength(2)
    })

    it("should return 0 when no connections to delete", async () => {
      const repo = ConnectionsRepository()
      const walletId = randomUUID() as WalletId

      const result = await repo.deleteByWalletId(walletId)

      expect(result).not.toBeInstanceOf(Error)
      expect(result).toBe(0)
    })

    it("should delete both revoked and active connections", async () => {
      const repo = ConnectionsRepository()
      const walletId = randomUUID() as WalletId

      await insertTestConnection(createTestConnection({ walletId, revoked: false }))
      await insertTestConnection(createTestConnection({ walletId, revoked: true }))

      const result = await repo.deleteByWalletId(walletId)

      expect(result).not.toBeInstanceOf(Error)
      expect(result).toBe(2)

      const remaining = await getAllConnections()
      expect(remaining).toHaveLength(0)
    })
  })

  describe("updatePermissions", () => {
    it("should update permissions", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection({
        permissions: [Nip47Method.GetInfo],
      })
      const inserted = await insertTestConnection(testConn)

      const newPermissions = [Nip47Method.PayInvoice, Nip47Method.MakeInvoice]
      const result = await repo.updatePermissions(
        inserted.id as NwcConnectionId,
        newPermissions,
      )

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.permissions).toEqual(newPermissions)
      expect(result.id).toBe(inserted.id)
    })

    it("should clear all permissions", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection({
        permissions: [Nip47Method.GetInfo, Nip47Method.GetBalance],
      })
      const inserted = await insertTestConnection(testConn)

      const result = await repo.updatePermissions(inserted.id as NwcConnectionId, [])

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.permissions).toEqual([])
    })

    it("should set all available permissions", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection()
      const inserted = await insertTestConnection(testConn)

      const allPermissions = [
        Nip47Method.GetInfo,
        Nip47Method.GetBalance,
        Nip47Method.MakeInvoice,
        Nip47Method.PayInvoice,
        Nip47Method.LookupInvoice,
        Nip47Method.ListTransactions,
      ]
      const result = await repo.updatePermissions(
        inserted.id as NwcConnectionId,
        allPermissions,
      )

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.permissions).toEqual(allPermissions)
    })

    it("should return error when updating non-existent connection", async () => {
      const repo = ConnectionsRepository()
      const nonExistentId = randomUUID() as NwcConnectionId

      const result = await repo.updatePermissions(nonExistentId, [Nip47Method.GetInfo])

      expect(result).toBeInstanceOf(Error)
    })

    it("should update updated_at timestamp", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection()
      const inserted = await insertTestConnection(testConn)

      await new Promise((resolve) => setTimeout(resolve, 100))

      const result = await repo.updatePermissions(inserted.id as NwcConnectionId, [
        Nip47Method.PayInvoice,
      ])

      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) {
        return
      }
      expect(result.updatedAt.getTime()).toBeGreaterThan(inserted.updated_at.getTime())
    })
  })

  describe("Edge Cases & Integration", () => {
    it("should handle multiple operations on same connection", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection()

      const created = await repo.create(testConn)
      expect(created).not.toBeInstanceOf(Error)

      if (created instanceof Error) {
        return
      }
      const updated = await repo.update(created.id, {
        alias: "Updated" as NwcConnectionAlias,
      })
      expect(updated).not.toBeInstanceOf(Error)

      const foundByPubkey = await repo.findByPubkey(created.appPubkey)
      expect(foundByPubkey).not.toBeInstanceOf(Error)

      const foundById = await repo.findById(created.id)
      expect(foundById).not.toBeInstanceOf(Error)

      const softDeleted = await repo.softDelete(created.id)
      expect(softDeleted).toBe(true)

      const foundAfterSoftDelete = await repo.findById(created.id)
      expect(foundAfterSoftDelete).not.toBeInstanceOf(Error)
      if (foundAfterSoftDelete instanceof Error) {
        return
      }

      expect(foundAfterSoftDelete.revoked).toBe(true)

      const hardDeleted = await repo.delete(created.id)
      expect(hardDeleted).toBe(true)

      const foundAfterHardDelete = await repo.findById(created.id)
      expect(foundAfterHardDelete).toBeInstanceOf(Error)
    })

    it("should handle concurrent operations", async () => {
      const repo = ConnectionsRepository()
      const walletId = randomUUID() as WalletId

      const createPromises = Array.from({ length: 5 }, (_, i) =>
        repo.create(
          createTestConnection({
            walletId,
            appPubkey: randomPubkey(),
            alias: `Concurrent ${i}` as NwcConnectionAlias,
          }),
        ),
      )

      const results = await Promise.all(createPromises)

      results.forEach((result) => {
        expect(result).not.toBeInstanceOf(Error)
      })

      const found = await repo.findByWalletId(walletId)
      expect(found).not.toBeInstanceOf(Error)
      if (found instanceof Error) {
        return
      }
      expect(found).toHaveLength(5)
    })

    it("should maintain data integrity across operations", async () => {
      const repo = ConnectionsRepository()
      const testConn = createTestConnection({
        alias: "Original" as NwcConnectionAlias,
        permissions: [Nip47Method.GetInfo],
      })

      const created = await repo.create(testConn)
      expect(created).not.toBeInstanceOf(Error)

      if (created instanceof Error) {
        return
      }

      await repo.update(created.id, { alias: "Updated Alias" as NwcConnectionAlias })

      await repo.updatePermissions(created.id, [Nip47Method.PayInvoice])

      const final = await repo.findById(created.id)
      expect(final).not.toBeInstanceOf(Error)
      if (final instanceof Error) {
        return
      }
      expect(final.alias).toBe("Updated Alias")
      expect(final.permissions).toEqual([Nip47Method.PayInvoice])
      expect(final.userId).toBe(testConn.userId)
      expect(final.walletId).toBe(testConn.walletId)
      expect(final.appPubkey).toBe(testConn.appPubkey)
    })
  })
})
