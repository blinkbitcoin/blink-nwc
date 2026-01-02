import { CoreServiceTx } from "@/domain/core/index.types"

export const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function mergeField<T>(a: T | undefined, b: T | undefined): T | undefined {
  return a !== undefined && a !== null ? a : b
}

/**
 * merges invoices and transactions by payment_hash.
 *
 * for incoming payments: `created_at` comes from invoice (when invoice was created),
 * `settled_at` comes from transaction (tx was created == payment was received)
 * for outgoing payments: `created_at = settled_at` (user paid, not created the invoice, so this is quite the same)
 *
 */
export function mergeTxs(
  invoices: CoreServiceTx[],
  transactions: CoreServiceTx[],
): CoreServiceTx[] {
  const map = new Map<string, CoreServiceTx>()

  // add all invoices - they have the real created_at
  for (const inv of invoices) {
    map.set(inv.payment_hash, inv)
  }

  // then merge with transactions
  for (const tx of transactions) {
    const invoice = map.get(tx.payment_hash)
    if (invoice) {
      map.set(tx.payment_hash, {
        type: tx.type,
        payment_hash: tx.payment_hash,
        invoice: mergeField(tx.invoice, invoice.invoice),
        description: mergeField(tx.description, invoice.description),
        description_hash: mergeField(tx.description_hash, invoice.description_hash),
        preimage: mergeField(tx.preimage, invoice.preimage),
        amount: tx.amount || invoice.amount,
        fees_paid: tx.fees_paid || invoice.fees_paid,
        created_at: invoice.created_at,
        expires_at: mergeField(tx.expires_at, invoice.expires_at),
        settled_at: tx.settled_at,
      })
    } else {
      // outgoing tx or incoming without invoice - use tx as-is
      map.set(tx.payment_hash, tx)
    }
  }

  return Array.from(map.values()).sort((a, b) => b.created_at - a.created_at)
}
