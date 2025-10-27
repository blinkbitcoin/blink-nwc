import {
  ApiKey,
  Nip47Method,
  NwcBudget,
  NwcBudgetResetInterval,
  NwcConnectionAlias,
  NwcConnectionId,
} from "@/domain/index.types"

import {InvalidApiKey, InvalidUserId, InvalidWalletId, ValidationError} from "@/domain/errors"
import {UserId, WalletId} from "@/domain/core/index.types";

export const UuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const checkedToUserId = (userId: string): UserId | ValidationError => {
  if (userId.match(UuidRegex)) {
    return userId as UserId
  }
  return new InvalidUserId(userId)
}

export const checkedToWalletId = (walletId: string): WalletId | InvalidWalletId => {
  if (!walletId.match(UuidRegex)) {
    return new InvalidWalletId(walletId)
  }
  return walletId as WalletId
}

export const checkedToApiKey = (apiKey: string): ApiKey | InvalidApiKey => {
  if(!apiKey.match(UuidRegex)) {
    return new InvalidApiKey(apiKey)
  }
  return apiKey as ApiKey
}


export const checkedToBudget = (
  budget: NwcBudget | null,
): NwcBudget | null | ValidationError => {
  if (budget == null) {
    return null
  }
  if (typeof budget !== "object") {
    return new ValidationError("Budget must be an object or null")
  }
  if (
    typeof budget.spent !== "number" ||
    !Number.isFinite(budget.spent) ||
    budget.spent < 0
  ) {
    return new ValidationError("Invalid spent amount")
  }

  if (
    typeof budget.total !== "number" ||
    !Number.isFinite(budget.total) ||
    budget.total < 0
  ) {
    return new ValidationError("Invalid total amount")
  }

  if (budget.spent > budget.total) {
    return new ValidationError("Spent cannot exceed total")
  }

  const lastReset = new Date(budget.lastReset)
  if (isNaN(lastReset.getTime())) {
    return new ValidationError("Invalid date for lastReset")
  }
  if (lastReset > new Date()) {
    return new ValidationError("Last reset cannot be in the future")
  }

  const allowedResetIntervals: NwcBudgetResetInterval[] = [
    "daily",
    "weekly",
    "monthly",
    "yearly",
    "never",
  ]

  if (!allowedResetIntervals.includes(budget.resetInterval)) {
    return new ValidationError("Invalid reset interval")
  }

  return {
    spent: budget.spent,
    total: budget.total,
    lastReset,
    resetInterval: budget.resetInterval as NwcBudgetResetInterval,
  }
}

export const checkedToPermissions = (
  permissions: string[],
): Nip47Method[] | ValidationError => {
  const validMethods: Nip47Method[] = [
    "get_info",
    "get_balance",
    "make_invoice",
    "pay_invoice",
    "lookup_invoice",
    "list_transactions",
  ]

  if (!Array.isArray(permissions)) {
    return new ValidationError("Permissions must be an array")
  }

  for (const permission of permissions) {
    if (!validMethods.includes(permission as Nip47Method)) {
      return new ValidationError(`Invalid permission: ${permission}`)
    }
  }

  return permissions as Nip47Method[]
}

export const checkedToConnectionId = (
  connectionId: string,
): NwcConnectionId | ValidationError => {
  if (typeof connectionId !== "string") {
    return new ValidationError("Connection ID must be a string")
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(connectionId)) {
    return new ValidationError("Connection ID must be a valid UUID")
  }
  return connectionId as NwcConnectionId
}

export const checkedToNwcUpdates = (updates: {
  alias?: NwcConnectionAlias
  permissions?: Nip47Method[]
  budget?: NwcBudget | null
}) => {
  const checkedUpdates: Partial<{
    alias: NwcConnectionAlias | null
    permissions: Nip47Method[]
    budget: NwcBudget | null
  }> = {}

  if ("alias" in updates) {
    if (updates.alias !== undefined) {
      const checkedAlias = checkedToNwcAlias(updates.alias)
      if (checkedAlias instanceof Error) return checkedAlias
      checkedUpdates.alias = checkedAlias
    } else {
      checkedUpdates.alias = undefined
    }
  }

  if ("permissions" in updates) {
    if (updates.permissions !== undefined) {
      const checkedPermissions = checkedToPermissions(updates.permissions)
      if (checkedPermissions instanceof Error) return checkedPermissions
      checkedUpdates.permissions = checkedPermissions
    } else {
      checkedUpdates.permissions = undefined
    }
  }

  if ("budget" in updates) {
    if (updates.budget !== undefined) {
      const checkedBudget = checkedToBudget(updates.budget)
      if (checkedBudget instanceof Error) return checkedBudget
      checkedUpdates.budget = checkedBudget
    } else {
      checkedUpdates.budget = undefined
    }
  }

  return checkedUpdates
}

export const checkedToNwcAlias = (
  alias?: unknown,
): NwcConnectionAlias | null | ValidationError => {
  if (alias == null || alias === "") {
    return null
  }

  if (typeof alias !== "string") {
    return new ValidationError("Alias must be a string")
  }

  if (alias.length > 32) {
    return new ValidationError("Alias must be under 32 characters")
  }

  const regex = /^[a-zA-Z0-9_-]+$/
  if (!regex.test(alias)) {
    return new ValidationError("Alias contains invalid characters")
  }

  return alias as NwcConnectionAlias
}
