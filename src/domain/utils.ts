import { Nip47LookupInvoiceResult } from "@/domain/nostr/index.types"

export const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function mergeField<T>(a: T | undefined, b: T | undefined): T | undefined {
  return a !== undefined && a !== null ? a : b
}

/**
 * Merges two lists of NIP-47 transactions/invoices by payment_hash.
 * When duplicates exist, fields are merged with priority to non-undefined values.
 * Result is sorted by created_at (oldest first).
 */
export function mergeTxs(
  first: Nip47LookupInvoiceResult[],
  second: Nip47LookupInvoiceResult[],
): Nip47LookupInvoiceResult[] {
  const map = new Map<string, Nip47LookupInvoiceResult>()

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
        created_at: Math.min(existing.created_at, tx.created_at),
        metadata: mergeField(existing.metadata, tx.metadata),
        expires_at: mergeField(existing.expires_at, tx.expires_at),
        settled_at: mergeField(existing.settled_at, tx.settled_at),
      })
    } else {
      map.set(tx.payment_hash, tx)
    }
  }

  // Sort by created_at descending (newest first) - more useful for list_transactions
  return Array.from(map.values()).sort((a, b) => b.created_at - a.created_at)
}
