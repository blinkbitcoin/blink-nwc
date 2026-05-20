import type { Knex } from "knex"

export async function up(knex: Knex): Promise<void> {
  const hasStreamCursors = await knex.schema.hasTable("stream_cursors")
  if (!hasStreamCursors) {
    await knex.schema.createTable("stream_cursors", (table) => {
      table.string("stream_name").primary()
      table.text("cursor_value").notNullable()
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now())
    })
  }

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_nwc_audit_log_notification_once
      ON nwc_audit_log (
        connection_id,
        method,
        ((metadata->>'ledger_transaction_id'))
      )
      WHERE action = 'notification_published'
        AND status = 'success'
        AND connection_id IS NOT NULL
        AND (metadata->>'ledger_transaction_id') IS NOT NULL
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP INDEX IF EXISTS idx_nwc_audit_log_notification_once")
  await knex.schema.dropTableIfExists("stream_cursors")
}
