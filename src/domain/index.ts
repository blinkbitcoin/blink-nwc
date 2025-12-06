import { Nip47LookupInvoiceResult } from "@/domain/index.types"

/**
 * binary search to find the first index where created_at <= target
 * data is sorted DESC (newest first), so we look for upper bound of time range
 */
export const findUntilIndex = (
  txs: Nip47LookupInvoiceResult[],
  until: number,
): number => {
  let lo = 0
  let hi = txs.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (txs[mid].created_at > until) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

/**
 * binary search to find the last index where created_at >= target
 * data is sorted DESC, so we look for lower bound of time range
 */
export const findFromIndex = (txs: Nip47LookupInvoiceResult[], from: number): number => {
  let lo = 0
  let hi = txs.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (txs[mid].created_at >= from) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}
