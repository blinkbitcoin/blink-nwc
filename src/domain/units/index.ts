import {
  MilliSatoshis,
  Minutes,
  Satoshis,
  Seconds,
  UnixTimestamp,
} from "@/domain/units/index.types"
import { Cursor } from "@/domain/index.types"

export const toMilliSatoshis = (value?: Satoshis | null): MilliSatoshis => {
  return typeof value === "number" && Number.isFinite(value)
    ? (Math.round(value * 1000) as MilliSatoshis)
    : (0 as MilliSatoshis)
}

export const toSatoshis = (value?: MilliSatoshis | null): Satoshis => {
  return typeof value === "number" && Number.isFinite(value)
    ? (Math.round(value / 1000) as Satoshis)
    : (0 as Satoshis)
}

export const toUnixSeconds = (value?: number | null): UnixTimestamp | undefined =>
  typeof value === "number" && Number.isFinite(value)
    ? (Math.floor(value) as UnixTimestamp)
    : undefined

export const ensureUnixSeconds = (value?: number | null): UnixTimestamp =>
  toUnixSeconds(value) ?? (Math.floor(Date.now() / 1000) as UnixTimestamp)

export const toMinutes = (value?: Seconds | null): Minutes | undefined => {
  if (!value) {
    return undefined
  }
  return (value / 60) as Minutes
}

export const toCursor = (value: UnixTimestamp): Cursor | undefined => {
  if (!value) {
    return
  }
  const bytes = Buffer.alloc(12)
  bytes.writeUInt8(Math.floor(value), 0)
  return bytes.toString("hex") as Cursor
}

export const fromCursor = (value: Cursor | undefined): UnixTimestamp | undefined => {
  if (!value) {
    return
  }
  const tsHex = value.slice(0, 8)
  return parseInt(tsHex, 16) as UnixTimestamp
}
