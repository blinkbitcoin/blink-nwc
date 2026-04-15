import { randomUUID } from "crypto"

import knex, { Knex } from "knex"
import { generateSecretKey, getPublicKey } from "nostr-tools"

import databaseConfig from "@/config/db"
import {
  NwcConnectionRecord,
  ProcessedNwcRequestRecord,
} from "@/services/db/index.types"
import { NwcConnection } from "@/domain/connection"
import {
  NwcAppPubkey,
  NwcConnectionId,
  ApiKey,
  ConnectionSecret,
  AccountId,
} from "@/domain/index.types"
import { UserId, WalletId } from "@/domain/core/index.types"
import { Nip47Method } from "@/domain/nostr"
import { encryptSecret } from "@/services/secret-encryption"

let db: Knex | null = null

export const getTestDb = (): Knex => {
  if (!db) {
    db = knex(databaseConfig)
  }
  return db
}

export const closeTestDb = async (): Promise<void> => {
  if (db) {
    await db.destroy()
    db = null
  }
}

export const clearAllTables = async (): Promise<void> => {
  const testDb = getTestDb()
  await testDb("nwc_processed_requests").del()
  await testDb("nwc_connections").del()
}

export const runMigrations = async (): Promise<void> => {
  const testDb = getTestDb()
  await testDb.migrate.rollback(undefined, true)
  await testDb.migrate.latest()
}

export const rollbackMigrations = async (): Promise<void> => {
  const testDb = getTestDb()
  await testDb.migrate.rollback()
}

export const randomPubkey = (): NwcAppPubkey => {
  const bytes = generateSecretKey()
  return getPublicKey(bytes) as NwcAppPubkey
}

type TestConnectionInput = Omit<NwcConnection, "id" | "createdAt" | "updatedAt">

export const createTestConnection = (
  overrides?: Partial<TestConnectionInput>,
): TestConnectionInput => ({
  userId: randomUUID() as UserId,
  accountId: randomUUID() as AccountId,
  walletId: randomUUID() as WalletId,
  walletCurrency: "BTC",
  appPubkey: randomPubkey(),
  permissions: [Nip47Method.GetInfo, Nip47Method.GetBalance],
  apiKey: ("test-api-key-" + Math.random().toString(36).substring(7)) as ApiKey,
  apiKeyId: null,
  connectionSecret: ("test-secret-" +
    Math.random().toString(36).substring(7)) as ConnectionSecret,
  alias: null,
  notificationsEnabled: false,
  revoked: false,
  expiresAt: null,
  revokedAt: null,
  lastUsedAt: null,
  ...overrides,
})

export const insertTestConnection = async (
  connection: TestConnectionInput & { id?: NwcConnectionId; revoked?: boolean },
): Promise<NwcConnectionRecord> => {
  const testDb = getTestDb()
  const [inserted] = await testDb("nwc_connections")
    .insert({
      id: connection.id,
      alias: connection.alias,
      user_id: connection.userId,
      account_id: connection.accountId,
      wallet_id: connection.walletId,
      wallet_currency: connection.walletCurrency,
      app_pubkey: connection.appPubkey,
      permissions: connection.permissions,
      api_key_encrypted: encryptSecret(connection.apiKey),
      api_key_id: connection.apiKeyId,
      connection_secret_encrypted: encryptSecret(connection.connectionSecret),
      notifications_enabled: connection.notificationsEnabled,
      revoked: connection.revoked ?? false,
      expires_at: connection.expiresAt,
    })
    .returning("*")

  return inserted
}

export const insertMultipleTestConnections = async (
  count: number,
  baseOverrides?: Partial<TestConnectionInput & { revoked?: boolean }>,
): Promise<NwcConnectionRecord[]> => {
  const connections: Array<TestConnectionInput & { revoked?: boolean }> = []
  for (let i = 0; i < count; i++) {
    connections.push(
      createTestConnection({
        ...baseOverrides,
        appPubkey: randomPubkey(),
        apiKey: `test-api-key-${i}` as ApiKey,
      }),
    )
  }

  const testDb = getTestDb()
  return testDb("nwc_connections")
    .insert(
      connections.map((c) => ({
        alias: c.alias,
        user_id: c.userId,
        account_id: c.accountId,
        wallet_id: c.walletId,
        wallet_currency: c.walletCurrency,
        app_pubkey: c.appPubkey,
        permissions: c.permissions,
        api_key_encrypted: encryptSecret(c.apiKey),
        api_key_id: c.apiKeyId,
        connection_secret_encrypted: encryptSecret(c.connectionSecret),
        notifications_enabled: c.notificationsEnabled,
        revoked: c.revoked ?? false,
        expires_at: c.expiresAt,
      })),
    )
    .returning("*")
}

export const getConnectionByAppPubkey = async (
  appPubkey: NwcAppPubkey,
): Promise<NwcConnectionRecord | undefined> => {
  const testDb = getTestDb()
  return testDb("nwc_connections").where({ app_pubkey: appPubkey }).first()
}

export const getConnectionById = async (
  id: NwcConnectionId,
): Promise<NwcConnectionRecord | undefined> => {
  const testDb = getTestDb()
  return testDb("nwc_connections").where({ id }).first()
}

export const getAllConnections = async (): Promise<NwcConnectionRecord[]> => {
  const testDb = getTestDb()
  return testDb("nwc_connections").select("*")
}

export const getProcessedRequestByEventId = async (
  eventId: string,
): Promise<ProcessedNwcRequestRecord | undefined> => {
  const testDb = getTestDb()
  return testDb("nwc_processed_requests").where({ event_id: eventId }).first()
}
