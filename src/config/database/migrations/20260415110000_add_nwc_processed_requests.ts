import type { Knex } from "knex"

const TABLE_NAME = "nwc_processed_requests"

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE_NAME, (table) => {
    table.string("event_id").primary()
    table.timestamp("processed_at").notNullable().defaultTo(knex.fn.now())
    table.timestamp("expires_at").notNullable()

    table.index(["expires_at"])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE_NAME)
}
