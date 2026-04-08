import { Knex } from "knex"
import { generateSecretKey, getPublicKey } from "nostr-tools"

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex("nwc_connections").del()

  // Inserts seed entries
  await knex("nwc_connections").insert([
    {
      id: knex.fn.uuid(),
      alias: "Test Connection 1",
      user_id: knex.fn.uuid(),
      account_id: knex.fn.uuid(),
      wallet_id: knex.fn.uuid(),
      wallet_currency: "BTC",
      app_pubkey: randomPubkey(),
      permissions: ["get_info", "pay_invoice", "get_balance"],
      api_key: "test_api_key_1",
      connection_secret: "test_secret_1",
      notifications_enabled: true,
      revoked: false,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: knex.fn.uuid(),
      alias: "Test Connection 2",
      user_id: knex.fn.uuid(),
      account_id: knex.fn.uuid(),
      wallet_id: knex.fn.uuid(),
      wallet_currency: "BTC",
      app_pubkey: randomPubkey(),
      permissions: ["get_info"],
      api_key: "test_api_key_2",
      connection_secret: "test_secret_2",
      notifications_enabled: false,
      revoked: false,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      user_id: knex.fn.uuid(),
      account_id: knex.fn.uuid(),
      wallet_id: knex.fn.uuid(),
      app_pubkey: randomPubkey(),
      api_key: "test_api_key_3",
      connection_secret: "test_secret_3",
    },
  ])
}

const randomPubkey = () => {
  const bytes = generateSecretKey()
  return getPublicKey(bytes)
}
