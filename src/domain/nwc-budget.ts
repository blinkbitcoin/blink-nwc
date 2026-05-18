export const NwcBudgetPeriod = {
  Daily: "DAILY",
  Weekly: "WEEKLY",
  Monthly: "MONTHLY",
  Never: "NEVER",
} as const

export type NwcBudgetPeriodType = (typeof NwcBudgetPeriod)[keyof typeof NwcBudgetPeriod]

export type NwcBudgetInput = {
  amountSats: number
  period: NwcBudgetPeriodType
}

export type NwcBudget = {
  amountSats: number
  period: NwcBudgetPeriodType
  usedSats: number
  remainingSats: number
  resetsAt: number | null
}

type ApiKeyLimitsLike = {
  dailyLimitSats?: number | null
  dailySpentSats: number
  weeklyLimitSats?: number | null
  weeklySpentSats: number
  monthlyLimitSats?: number | null
  monthlySpentSats: number
  annualLimitSats?: number | null
  annualSpentSats: number
}

export const isNwcBudgetPeriod = (value: unknown): value is NwcBudgetPeriodType =>
  typeof value === "string" && Object.values(NwcBudgetPeriod).includes(value as never)

export const toNwcBudgetFromApiKeyLimits = (
  limits: ApiKeyLimitsLike,
): NwcBudget | null => {
  return toNwcBudgetsFromApiKeyLimits(limits)[0] ?? null
}

export const toNwcBudgetsFromApiKeyLimits = (limits: ApiKeyLimitsLike): NwcBudget[] => {
  const budgets: NwcBudget[] = []

  if (limits.dailyLimitSats != null) {
    budgets.push({
      amountSats: limits.dailyLimitSats,
      period: NwcBudgetPeriod.Daily,
      usedSats: limits.dailySpentSats,
      remainingSats: Math.max(limits.dailyLimitSats - limits.dailySpentSats, 0),
      resetsAt: null,
    })
  }

  if (limits.weeklyLimitSats != null) {
    budgets.push({
      amountSats: limits.weeklyLimitSats,
      period: NwcBudgetPeriod.Weekly,
      usedSats: limits.weeklySpentSats,
      remainingSats: Math.max(limits.weeklyLimitSats - limits.weeklySpentSats, 0),
      resetsAt: null,
    })
  }

  if (limits.monthlyLimitSats != null) {
    budgets.push({
      amountSats: limits.monthlyLimitSats,
      period: NwcBudgetPeriod.Monthly,
      usedSats: limits.monthlySpentSats,
      remainingSats: Math.max(limits.monthlyLimitSats - limits.monthlySpentSats, 0),
      resetsAt: null,
    })
  }

  if (limits.annualLimitSats != null) {
    budgets.push({
      amountSats: limits.annualLimitSats,
      period: NwcBudgetPeriod.Never,
      usedSats: limits.annualSpentSats,
      remainingSats: Math.max(limits.annualLimitSats - limits.annualSpentSats, 0),
      resetsAt: null,
    })
  }

  return budgets
}
