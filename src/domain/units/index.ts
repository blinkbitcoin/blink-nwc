export const toMilliSatoshis = (value?: number | null): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value * 1000) : 0

export const toUnixSeconds = (value?: number | null): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : undefined

export const ensureUnixSeconds = (value?: number | null): number =>
  toUnixSeconds(value) ?? Math.floor(Date.now() / 1000)
