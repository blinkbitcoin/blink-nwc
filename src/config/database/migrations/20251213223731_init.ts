import type { Knex } from "knex"

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("nwc_connections", (table) => {
    table.uuid("id").primary().defaultTo(knex.fn.uuid())
    table.string("alias").nullable()
    table.uuid("user_id").notNullable()
    table.uuid("account_id").notNullable()
    table.uuid("wallet_id").notNullable()
    table.string("app_pubkey").unique().notNullable()
    table
      .specificType("permissions", "text[]")
      .notNullable()
      .defaultTo(knex.raw("ARRAY[]::text[]"))
    table.string("api_key").notNullable()
    table.boolean("notifications").notNullable().defaultTo(true)
    table.boolean("revoked").notNullable().defaultTo(false)
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now())
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now())

    table.index(["id"])
    table.index(["app_pubkey"])
    table.index(["user_id"])
    table.index(["wallet_id"])
    table.index(["revoked"])
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("nwc_connections")
}
