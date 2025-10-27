export interface NwcConnectionRecord {
    id: string
    alias: string | null
    user_id: string
    account_id: string
    wallet_id: string
    app_pubkey: string
    permissions: string[]
    api_key: string
    budget: {
        total: number
        spent: number
        resetInterval: "daily" | "weekly" | "monthly" | "yearly" | "never"
        lastReset: Date
    } | null
    revoked: boolean
    created_at: Date
    updated_at: Date
}
