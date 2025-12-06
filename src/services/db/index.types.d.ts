export interface NwcConnectionRecord {
  id: string
  alias: string | null
  user_id: string
  account_id: string
  wallet_id: string
  app_pubkey: string
  permissions: string[]
  api_key: string

  notifications: boolean
  revoked: boolean
  created_at: Date
  updated_at: Date
}

export interface WebhookRecord {
  id: string
  webhook_id: string
  wallet_id: string
}
