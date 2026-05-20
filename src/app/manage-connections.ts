import { NwcUri, NwcConnectionId } from "@/domain/index.types"
import {
  checkedToUserId,
  checkedToWalletId,
  checkedToPermissions,
  checkedToNwcAlias,
  checkedToNwcBudgetInputs,
  checkedToConnectionId,
  checkedToNwcUri,
} from "@/domain/validation"
import {
  getServerKeypair,
  NwcConnection,
  parseNwcUri,
  stringifyNwcUri,
} from "@/domain/connection"
import { ConnectionsRepository } from "@/services/db/connections"
import { NOSTR_RELAY_PUBLIC_URL } from "@/config"
import {
  CouldNotFindNwcConnectionFromIdError,
  InvalidNwcUri,
  InvalidWalletId,
  NwcCreateConnectionError,
} from "@/domain/errors"
import client from "@/graphql/internal-client"
import { getAuthenticatedWallet } from "@/graphql/internal-client/queries/get-authenticated-wallet"
import {
  createApiKeyForNwc,
  type ApiKeyLimitsSnapshot,
} from "@/graphql/internal-client/queries/api-key-create"
import { setApiKeyLimitForNwc } from "@/graphql/internal-client/queries/api-key-set-limit"
import { removeApiKeyLimitForNwc } from "@/graphql/internal-client/queries/api-key-remove-limit"
import { revokeApiKeyForNwc } from "@/graphql/internal-client/queries/api-key-revoke"
import { getApiKeysForNwc } from "@/graphql/internal-client/queries/api-keys"
import { LimitTimeWindow, Scope } from "@/graphql/internal-client/generated"
import {
  NwcBudget,
  NwcBudgetInput,
  NwcBudgetPeriod,
  NwcBudgetPeriodType,
  toNwcBudgetsFromApiKeyLimits,
} from "@/domain/nwc-budget"
import { hasNotificationPermission } from "@/domain/nwc-permission"

const permissionsToApiKeyScopes = (
  permissions: NwcConnection["permissions"],
): Scope[] => {
  const scopes = new Set<Scope>()

  for (const permission of permissions) {
    switch (permission) {
      case "get_info":
      case "get_balance":
      case "lookup_invoice":
      case "list_transactions":
      case "notifications:payment_sent":
      case "notifications:payment_received":
        scopes.add(Scope.Read)
        break
      case "make_invoice":
        scopes.add(Scope.Receive)
        break
      case "pay_invoice":
        scopes.add(Scope.Write)
        break
      default:
        break
    }
  }

  return [...scopes]
}

const toApiKeyLimitTimeWindow = (period: NwcBudgetPeriodType): LimitTimeWindow => {
  switch (period) {
    case NwcBudgetPeriod.Daily:
      return LimitTimeWindow.Daily
    case NwcBudgetPeriod.Weekly:
      return LimitTimeWindow.Weekly
    case NwcBudgetPeriod.Monthly:
      return LimitTimeWindow.Monthly
    case NwcBudgetPeriod.Never:
      return LimitTimeWindow.Annual
  }
}

const apiKeyLimitTimeWindowsFromSnapshot = (
  limits: Pick<
    ApiKeyLimitsSnapshot,
    "dailyLimitSats" | "weeklyLimitSats" | "monthlyLimitSats" | "annualLimitSats"
  >,
): LimitTimeWindow[] => {
  const windows: LimitTimeWindow[] = []
  if (limits.dailyLimitSats != null) windows.push(LimitTimeWindow.Daily)
  if (limits.weeklyLimitSats != null) windows.push(LimitTimeWindow.Weekly)
  if (limits.monthlyLimitSats != null) windows.push(LimitTimeWindow.Monthly)
  if (limits.annualLimitSats != null) windows.push(LimitTimeWindow.Annual)
  return windows
}

const syncApiKeyBudgets = async ({
  authorization,
  apiKeyId,
  budgets,
}: {
  authorization: string
  apiKeyId: NwcConnection["apiKeyId"]
  budgets: NwcBudgetInput[] | null
}): Promise<void> => {
  if (!apiKeyId) {
    return
  }

  const desiredBudgets = budgets ?? []
  const desiredLimitTimeWindows = new Set(
    desiredBudgets.map((budget) => toApiKeyLimitTimeWindow(budget.period)),
  )

  let limitsSnapshot: ApiKeyLimitsSnapshot | null = null
  for (const budget of desiredBudgets) {
    const limitTimeWindow = toApiKeyLimitTimeWindow(budget.period)
    limitsSnapshot = await setApiKeyLimitForNwc(client, authorization, {
      id: apiKeyId,
      limitSats: budget.amountSats,
      limitTimeWindow,
    })
  }

  if (!limitsSnapshot) {
    const apiKeys = await getApiKeysForNwc(client, authorization)
    const apiKey = apiKeys.find((key) => key.id === apiKeyId)
    limitsSnapshot = apiKey?.limits ?? null
  }

  if (!limitsSnapshot) {
    return
  }

  const currentLimitTimeWindows = apiKeyLimitTimeWindowsFromSnapshot(limitsSnapshot)
  for (const limitTimeWindow of currentLimitTimeWindows) {
    if (desiredLimitTimeWindows.has(limitTimeWindow)) {
      continue
    }

    await removeApiKeyLimitForNwc(client, authorization, {
      id: apiKeyId,
      limitTimeWindow,
    })
  }
}

const revokeCreatedApiKey = async ({
  authorization,
  apiKeyId,
}: {
  authorization: string
  apiKeyId: NwcConnection["apiKeyId"]
}): Promise<void> => {
  if (!apiKeyId) {
    return
  }

  try {
    await revokeApiKeyForNwc(client, authorization, apiKeyId)
  } catch {
    // best-effort cleanup only
  }
}

export const createNwcConnection = async (
  userId: string,
  authorization: string,
  {
    nwcUri,
    walletId,
    permissions,
    alias,
    budgets,
    expiresAt,
  }: {
    nwcUri: string
    walletId?: string | null
    permissions: string[]
    alias?: string
    budgets?: NwcBudgetInput[] | null
    expiresAt?: Date | null
  },
): Promise<
  | {
      connectionObj: NwcConnection
      connectionUri: NwcUri
      budgets: NwcBudget[]
    }
  | ApplicationError
> => {
  const checkedPermissions = checkedToPermissions(permissions)
  if (checkedPermissions instanceof Error) {
    return checkedPermissions
  }

  const checkedUserId = checkedToUserId(userId)
  if (checkedUserId instanceof Error) {
    return checkedUserId
  }

  const checkedNwcUri = checkedToNwcUri(nwcUri)
  if (checkedNwcUri instanceof Error) {
    return checkedNwcUri
  }

  const parsedNwcUri = parseNwcUri(checkedNwcUri)
  if (parsedNwcUri instanceof Error) {
    return parsedNwcUri
  }

  const checkedAlias = checkedToNwcAlias(alias)
  if (checkedAlias instanceof Error) {
    return checkedAlias
  }

  const checkedBudgets = checkedToNwcBudgetInputs(budgets)
  if (checkedBudgets instanceof Error) {
    return checkedBudgets
  }

  if (walletId) {
    const checkedWalletId = checkedToWalletId(walletId)
    if (checkedWalletId instanceof Error) {
      return checkedWalletId
    }
  }

  const serverPubkey = getServerKeypair().pubkey
  if (parsedNwcUri.serverPubkey !== serverPubkey) {
    return new InvalidNwcUri("NWC URI does not target this NWC server")
  }

  if (parsedNwcUri.relay !== NOSTR_RELAY_PUBLIC_URL) {
    return new InvalidNwcUri("NWC URI relay does not match the configured relay")
  }

  let selectedWallet
  try {
    selectedWallet = await getAuthenticatedWallet(client, authorization, walletId ?? null)
  } catch (err) {
    return new NwcCreateConnectionError(err)
  }
  if (!selectedWallet) {
    return new InvalidWalletId("Wallet does not belong to the authenticated account")
  }

  const apiKeyName = checkedAlias ?? `nwc-${parsedNwcUri.appPubkey.slice(0, 8)}`
  const scopes = permissionsToApiKeyScopes(checkedPermissions)

  let createdApiKey: Awaited<ReturnType<typeof createApiKeyForNwc>> | null = null

  try {
    createdApiKey = await createApiKeyForNwc(client, authorization, {
      name: apiKeyName,
      scopes,
    })

    const budgetInputs = checkedBudgets ?? []

    let budgetSnapshot: ApiKeyLimitsSnapshot | null = null
    for (const budgetInput of budgetInputs) {
      budgetSnapshot = await setApiKeyLimitForNwc(client, authorization, {
        id: createdApiKey.id,
        limitSats: budgetInput.amountSats,
        limitTimeWindow: toApiKeyLimitTimeWindow(budgetInput.period),
      })
    }

    const connection: Omit<
      NwcConnection,
      "id" | "createdAt" | "updatedAt" | "revoked" | "revokedAt" | "lastUsedAt"
    > = {
      userId: checkedUserId,
      accountId: selectedWallet.accountId,
      walletId: selectedWallet.id,
      walletCurrency: selectedWallet.walletCurrency,
      apiKey: createdApiKey.secret,
      apiKeyId: createdApiKey.id,
      connectionSecret:
        parsedNwcUri.secret as unknown as NwcConnection["connectionSecret"],
      alias: checkedAlias,
      appPubkey: parsedNwcUri.appPubkey,
      permissions: checkedPermissions,
      notificationsEnabled: hasNotificationPermission(checkedPermissions),
      expiresAt: expiresAt ?? null,
    }

    const connectionObj = await ConnectionsRepository().create(connection)
    if (connectionObj instanceof Error) {
      await revokeCreatedApiKey({
        authorization,
        apiKeyId: createdApiKey.id,
      })
      return connectionObj
    }

    const createdBudgets = budgetSnapshot
      ? toNwcBudgetsFromApiKeyLimits(budgetSnapshot)
      : []

    return {
      connectionObj,
      connectionUri: stringifyNwcUri({
        pubkey: parsedNwcUri.serverPubkey,
        relay: parsedNwcUri.relay,
        secret: parsedNwcUri.secret,
      }),
      budgets: createdBudgets,
    }
  } catch (err) {
    await revokeCreatedApiKey({
      authorization,
      apiKeyId: createdApiKey?.id ?? null,
    })
    return new NwcCreateConnectionError(err)
  }
}

export const updateNwcConnection = async (
  userId: string,
  authorization: string,
  connectionId: string,
  updates: {
    alias?: string | null
    budgets?: NwcBudgetInput[] | null
  },
): Promise<NwcConnection | ApplicationError> => {
  const checkedConnectionId = checkedToConnectionId(connectionId)
  if (checkedConnectionId instanceof Error) {
    return checkedConnectionId
  }

  const checkedUserId = checkedToUserId(userId)
  if (checkedUserId instanceof Error) {
    return checkedUserId
  }

  let checkedAlias: NwcConnection["alias"] | undefined
  if ("alias" in updates) {
    const parsedAlias = checkedToNwcAlias(updates.alias)
    if (parsedAlias instanceof Error) {
      return parsedAlias
    }
    checkedAlias = parsedAlias
  }

  let checkedBudgets: NwcBudgetInput[] | null | undefined
  if ("budgets" in updates) {
    const parsedBudgets = checkedToNwcBudgetInputs(updates.budgets)
    if (parsedBudgets instanceof Error) {
      return parsedBudgets
    }
    checkedBudgets = parsedBudgets
  }

  const existingConnection = await ConnectionsRepository().findById(checkedConnectionId)
  if (existingConnection instanceof Error) {
    return existingConnection
  }

  if (existingConnection.userId !== checkedUserId) {
    return new CouldNotFindNwcConnectionFromIdError()
  }

  try {
    if (checkedBudgets !== undefined) {
      await syncApiKeyBudgets({
        authorization,
        apiKeyId: existingConnection.apiKeyId,
        budgets: checkedBudgets,
      })
    }
  } catch (err) {
    return new NwcCreateConnectionError(err)
  }

  return ConnectionsRepository().update(checkedConnectionId, {
    alias: checkedAlias,
  })
}

export const softDeleteNwcConnection = async (
  userId: string,
  connectionId: string,
): Promise<boolean | ApplicationError> => {
  const checkedConnectionId = checkedToConnectionId(connectionId)
  if (checkedConnectionId instanceof Error) {
    return checkedConnectionId
  }

  const checkedUserId = checkedToUserId(userId)
  if (checkedUserId instanceof Error) {
    return checkedUserId
  }

  const existingConnection = await ConnectionsRepository().findById(checkedConnectionId)
  if (existingConnection instanceof Error) {
    return existingConnection
  }
  if (existingConnection.userId !== checkedUserId) {
    return new CouldNotFindNwcConnectionFromIdError()
  }

  return ConnectionsRepository().softDelete(existingConnection.id)
}

export const revokeNwcConnection = async (
  userId: string,
  connectionId: string,
): Promise<NwcConnection | ApplicationError> => {
  const checkedConnectionId = checkedToConnectionId(connectionId)
  if (checkedConnectionId instanceof Error) {
    return checkedConnectionId
  }

  const checkedUserId = checkedToUserId(userId)
  if (checkedUserId instanceof Error) {
    return checkedUserId
  }

  const existingConnection = await ConnectionsRepository().findById(checkedConnectionId)
  if (existingConnection instanceof Error) {
    return existingConnection
  }

  if (existingConnection.userId !== checkedUserId) {
    return new CouldNotFindNwcConnectionFromIdError()
  }

  const revoked = await ConnectionsRepository().softDelete(existingConnection.id)
  if (revoked instanceof Error) {
    return revoked
  }

  if (!revoked) {
    return new CouldNotFindNwcConnectionFromIdError()
  }

  return ConnectionsRepository().findById(existingConnection.id)
}

export const revokeAllNwcConnections = async (
  userId: string,
): Promise<number | ApplicationError> => {
  const checkedUserId = checkedToUserId(userId)
  if (checkedUserId instanceof Error) return checkedUserId

  return ConnectionsRepository().revokeAllByUserId(checkedUserId)
}

export const deleteNwcConnection = async (
  connectionId: NwcConnectionId,
): Promise<boolean | ApplicationError> => {
  const checkedConnectionId = checkedToConnectionId(connectionId)
  if (checkedConnectionId instanceof Error) {
    return checkedConnectionId
  }

  const existingConnection = await ConnectionsRepository().findById(checkedConnectionId)
  if (existingConnection instanceof Error) {
    return existingConnection
  }

  return ConnectionsRepository().delete(existingConnection.id)
}

export const getNwcConnectionById = async (
  connectionId: string,
): Promise<NwcConnection | ApplicationError> => {
  const checkedConnectionId = checkedToConnectionId(connectionId)
  if (checkedConnectionId instanceof Error) {
    return checkedConnectionId
  }
  const connection = await ConnectionsRepository().findById(checkedConnectionId)
  if (connection instanceof Error) {
    return connection
  }
  if (connection.revoked) {
    return new CouldNotFindNwcConnectionFromIdError()
  }
  return connection
}

export const getNwcConnectionByIdForUser = async (
  userId: string,
  connectionId: string,
): Promise<NwcConnection | ApplicationError> => {
  const checkedUserId = checkedToUserId(userId)
  if (checkedUserId instanceof Error) {
    return checkedUserId
  }

  const connection = await getNwcConnectionById(connectionId)
  if (connection instanceof Error) {
    return connection
  }

  if (connection.userId !== checkedUserId) {
    return new CouldNotFindNwcConnectionFromIdError()
  }

  return connection
}

export const nwcConnectionsByUserId = async (
  userId: string,
  includeRevoked = false,
): Promise<NwcConnection[] | ApplicationError> => {
  const checkedUserId = checkedToUserId(userId)
  if (checkedUserId instanceof Error) {
    return checkedUserId
  }
  const connections = await ConnectionsRepository().findByUserId(checkedUserId)
  if (connections instanceof Error) {
    return connections
  }
  return includeRevoked ? connections : connections.filter((c) => !c.revoked)
}

export const nwcConnectionsByWalletId = async (
  walletId: string,
): Promise<NwcConnection[] | ApplicationError> => {
  const checkedWalletId = checkedToWalletId(walletId)
  if (checkedWalletId instanceof Error) {
    return checkedWalletId
  }
  const connections = await ConnectionsRepository().findByWalletId(checkedWalletId)
  if (connections instanceof Error) {
    return connections
  }
  return connections.filter((c) => !c.revoked)
}
