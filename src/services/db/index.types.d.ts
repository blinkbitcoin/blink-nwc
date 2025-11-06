export interface NwcConnectionRecord {
  id: string
  alias: string | null
  user_id: string
  account_id: string
  wallet_id: string
  app_pubkey: string
  permissions: string[]
  api_key: string

  revoked: boolean
  created_at: Date
  updated_at: Date
}
