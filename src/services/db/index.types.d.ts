export interface NwcConnectionRecord {
  id: string
  alias: string | null
  user_id: string
  account_id: string
  wallet_id: string
  wallet_currency: string
  app_pubkey: string
  permissions: string[]
  api_key_encrypted: string
  api_key_id: string | null
  connection_secret_encrypted: string

  notifications_enabled: boolean
  revoked: boolean
  expires_at: Date | null
  revoked_at: Date | null
  last_used_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface NwcAuditLogRecord {
  id: string
  connection_id: string | null
  user_id: string | null
  action: string
  method: string | null
  status: string
  metadata: Record<string, unknown> | null
  created_at: Date
}

export interface StreamCursorRecord {
  stream_name: string
  cursor_value: string
  updated_at: Date
}
