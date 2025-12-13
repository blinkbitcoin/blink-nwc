import { CoreServiceTx } from "@/domain/core/index.types"
import { UnixTimestamp } from "@/domain/units/index.types"

export const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function mergeField<T>(a: T | undefined, b: T | undefined): T | undefined {
  return a !== undefined && a !== null ? a : b
}

export function mergeTxs(
  first: CoreServiceTx[],
  second: CoreServiceTx[],
): CoreServiceTx[] {
  const map = new Map<string, CoreServiceTx>()

  for (const tx of first) {
    map.set(tx.payment_hash, tx)
  }

  for (const tx of second) {
    const existing = map.get(tx.payment_hash)
    if (existing) {
      map.set(tx.payment_hash, {
        type: existing.type,
        payment_hash: existing.payment_hash,
        invoice: mergeField(existing.invoice, tx.invoice),
        description: mergeField(existing.description, tx.description),
        description_hash: mergeField(existing.description_hash, tx.description_hash),
        preimage: mergeField(existing.preimage, tx.preimage),
        amount: existing.amount || tx.amount,
        fees_paid: existing.fees_paid || tx.fees_paid,
        created_at: Math.min(existing.created_at, tx.created_at) as UnixTimestamp,
        expires_at: mergeField(existing.expires_at, tx.expires_at),
        settled_at: mergeField(existing.settled_at, tx.settled_at),
      })
    } else {
      map.set(tx.payment_hash, tx)
    }
  }

  return Array.from(map.values()).sort((a, b) => b.created_at - a.created_at)
}
