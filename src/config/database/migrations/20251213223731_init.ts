import type { Knex } from "knex"

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("nwc_connections", (table) => {
    table.uuid("id").primary().defaultTo(knex.fn.uuid())
    table.string("alias").nullable()
    table.uuid("user_id").notNullable()
    table.uuid("account_id").notNullable()
    table.uuid("wallet_id").notNullable()
    table.string("wallet_currency", 3).notNullable().defaultTo("BTC")
    table.string("app_pubkey").unique().notNullable()
    table
      .specificType("permissions", "text[]")
      .notNullable()
      .defaultTo(knex.raw("ARRAY[]::text[]"))
    table.text("api_key_encrypted").notNullable()
    table.uuid("api_key_id").nullable()
    table.text("connection_secret_encrypted").notNullable()
    table.boolean("notifications_enabled").notNullable().defaultTo(false)
    table.boolean("revoked").notNullable().defaultTo(false)
    table.timestamp("expires_at").nullable()
    table.timestamp("revoked_at").nullable()
    table.timestamp("last_used_at").nullable()
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now())
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now())

    table.index(["app_pubkey"])
    table.index(["user_id"])
    table.index(["wallet_id"])
    table.index(["revoked"])
    table.index(["api_key_id"])
  })

  await knex.schema.createTable("nwc_audit_log", (table) => {
    table.uuid("id").primary().defaultTo(knex.fn.uuid())
    table.uuid("connection_id").nullable()
    table.uuid("user_id").nullable()
    table.string("action").notNullable()
    table.string("method").nullable()
    table.string("status").notNullable()
    table.jsonb("metadata").nullable()
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now())

    table.index(["connection_id"])
    table.index(["user_id"])
    table.index(["action"])
    table.index(["created_at"])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("nwc_audit_log")
  await knex.schema.dropTableIfExists("nwc_connections")
}
