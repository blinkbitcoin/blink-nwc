import { randomUUID } from "crypto"

import { NwcConnection } from "@/domain/connection"
import { UserId, WalletId } from "@/domain/core/index.types"
import { ApiKey } from "@/domain/index.types"

const GALOY_GRAPHQL_URL = process.env.GALOY_GRAPHQL_URL || "http://localhost:4455/graphql"
const GALOY_AUTH_URL =
  process.env.GALOY_AUTH_URL || "http://localhost:4455/auth/phone/login"
const DEFAULT_PHONE_CODE = "000000"

type GraphQlError = {
  message: string
}

type GraphQlResponse<T> = {
  data?: T
  errors?: GraphQlError[]
}

type WalletSummary = {
  id: WalletId
  walletCurrency: "BTC" | "USD"
  balance: number
  pendingIncomingBalance: number
}

type PhoneLoginResponse = {
  authToken?: string
}

export const TEST_USERS = {
  alice: "+16505554328",
  bob: "+16505554350",
  charlie: "+16505554354",
} as const

const postJson = async <TResponse>(
  url: string,
  body: object,
  headers?: Record<string, string>,
): Promise<TResponse> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(
      `Request failed (${response.status} ${response.statusText}) for ${url}`,
    )
  }

  return (await response.json()) as TResponse
}

export const loginTestUser = async (phone: string): Promise<string> => {
  const response = await postJson<PhoneLoginResponse>(GALOY_AUTH_URL, {
    phone,
    code: DEFAULT_PHONE_CODE,
  })

  if (!response.authToken) {
    throw new Error(`Missing auth token for phone ${phone}`)
  }

  return response.authToken
}

export const execGaloyGraphql = async <TData>(
  authToken: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<TData> => {
  const response = await postJson<GraphQlResponse<TData>>(
    GALOY_GRAPHQL_URL,
    { query, variables },
    { Authorization: `Bearer ${authToken}` },
  )

  if (response.errors && response.errors.length > 0) {
    throw new Error(
      `GraphQL request failed: ${response.errors.map((error) => error.message).join("; ")}`,
    )
  }

  if (!response.data) {
    throw new Error("GraphQL request returned no data")
  }

  return response.data
}

export const getWalletByCurrency = async (
  authToken: string,
  walletCurrency: "BTC" | "USD" = "BTC",
): Promise<WalletSummary> => {
  const data = await execGaloyGraphql<{
    me: {
      defaultAccount: {
        wallets: WalletSummary[]
      }
    }
  }>(
    authToken,
    `
      query WalletsForAccount {
        me {
          defaultAccount {
            wallets {
              id
              walletCurrency
              balance
              pendingIncomingBalance
            }
          }
        }
      }
    `,
  )

  const wallet = data.me.defaultAccount.wallets.find(
    (candidate) => candidate.walletCurrency === walletCurrency,
  )

  if (!wallet) {
    throw new Error(`Could not find ${walletCurrency} wallet`)
  }

  return wallet
}

export const createApiKey = async (
  authToken: string,
  {
    name = `blink-nwc-test-${randomUUID()}`,
    scopes = ["READ", "WRITE", "RECEIVE"],
  }: {
    name?: string
    scopes?: string[]
  } = {},
): Promise<ApiKey> => {
  const data = await execGaloyGraphql<{
    apiKeyCreate: {
      apiKeySecret: string
    }
  }>(
    authToken,
    `
      mutation ApiKeyCreate($input: ApiKeyCreateInput!) {
        apiKeyCreate(input: $input) {
          apiKeySecret
        }
      }
    `,
    {
      input: {
        name,
        scopes,
      },
    },
  )

  return data.apiKeyCreate.apiKeySecret as ApiKey
}

export const createRuntimeConnection = ({
  apiKey,
  walletId,
  permissions,
  notificationsEnabled = true,
}: {
  apiKey: ApiKey
  walletId: WalletId
  permissions: NwcConnection["permissions"]
  notificationsEnabled?: boolean
}): NwcConnection => ({
  id: randomUUID() as NwcConnection["id"],
  userId: randomUUID() as UserId,
  accountId: randomUUID() as NwcConnection["accountId"],
  walletId,
  walletCurrency: "BTC",
  apiKey,
  apiKeyId: null,
  connectionSecret:
    `integration-secret-${randomUUID()}` as NwcConnection["connectionSecret"],
  alias: `integration-${randomUUID().slice(0, 8)}` as NwcConnection["alias"],
  appPubkey: `${"0".repeat(63)}1` as NwcConnection["appPubkey"],
  permissions,
  notificationsEnabled,
  revoked: false,
  expiresAt: null,
  revokedAt: null,
  lastUsedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
})

export const retryAsync = async <T>(
  fn: () => Promise<T>,
  {
    attempts = 10,
    delayMs = 500,
  }: {
    attempts?: number
    delayMs?: number
  } = {},
): Promise<T> => {
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === attempts - 1) {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Retry failed")
}
