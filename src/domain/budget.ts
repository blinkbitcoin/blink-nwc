import { NwcBudget, NwcBudgetAmount } from "./index.types"

import { Nip47QuotaExceededError } from "@/domain/nwc-errors"

export function maybeResetBudget(
  budget: NwcBudget | null,
  now: Date = new Date(),
): NwcBudget | null {
  if (!budget) {
    return budget
  }
  if (!budget.resetInterval) return budget

  const periodMs = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
    yearly: 365 * 24 * 60 * 60 * 1000,
    never: 100 * 365 * 24 * 60 * 60 * 1000,
  }[budget.resetInterval]

  if (now.getTime() - budget.lastReset.getTime() >= periodMs) {
    return {
      ...budget,
      spent: 0 as NwcBudgetAmount,
      lastReset: now,
    }
  }

  return budget
}

export function spendFromBudget(
  budget: NwcBudget,
  amount: number,
): { budget: NwcBudget } | Nip47QuotaExceededError {
  const updated = { ...budget, spent: (budget.spent + amount) as NwcBudgetAmount }
  if (updated.spent > budget.total) {
    return new Nip47QuotaExceededError("")
  }
  return { budget: updated }
}
