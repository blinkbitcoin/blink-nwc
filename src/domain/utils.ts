import { CoreServiceTx, PaymentStateType } from "@/domain/core/index.types"
import { Nip47Transaction } from "@/domain/nostr/index.types"
import { ensureUnixSeconds, toMilliSatoshis } from "@/domain/units"
import { PaymentState } from "@/domain/core/payment-state"
import { InvoicePaymentStatus, TxStatus } from "@/graphql/internal-client/generated"
import { NwcConnection } from "@/domain/connection"

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
    map.set(inv.paymentHash, inv)
  }

  // then merge with transactions
  for (const tx of transactions) {
    const invoice = map.get(tx.paymentHash)
    if (invoice) {
      map.set(tx.paymentHash, {
        type: tx.type,
        paymentHash: tx.paymentHash,
        state: mergeField(tx.state, invoice.state),
        invoice: mergeField(tx.invoice, invoice.invoice),
        description: mergeField(tx.description, invoice.description),
        descriptionHash: mergeField(tx.descriptionHash, invoice.descriptionHash),
        preimage: mergeField(tx.preimage, invoice.preimage),
        amount: tx.amount || invoice.amount,
        feesPaid: tx.feesPaid || invoice.feesPaid,
        createdAt: invoice.createdAt,
        expiresAt: mergeField(tx.expiresAt, invoice.expiresAt),
        settledAt: tx.settledAt,
      })
    } else {
      // outgoing tx or incoming without invoice - use tx as-is
      map.set(tx.paymentHash, tx)
    }
  }

  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt)
}

export const toNwcTx = (tx: CoreServiceTx): Nip47Transaction => {
  const {
    amount: satoshis,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    settledAt,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    expiresAt,
    paymentHash,
    createdAt,
    descriptionHash,
    feesPaid,
    ...rest
  } = tx

  return {
    ...rest,
    amount: toMilliSatoshis(satoshis),
    created_at: ensureUnixSeconds(createdAt),
    fees_paid: toMilliSatoshis(feesPaid),
    metadata: undefined,
    payment_hash: paymentHash,
    description_hash: descriptionHash,
  }
}

export const translateStatus = (
  status?: TxStatus | InvoicePaymentStatus,
): PaymentStateType => {
  switch (status) {
    case "SUCCESS":
    case "PAID":
      return PaymentState.PAID
    case "PENDING":
      return PaymentState.PENDING
    case "EXPIRED":
      return PaymentState.EXPIRED
    case "FAILURE":
      return PaymentState.FAILED
    default:
      return PaymentState.UNKNOWN
  }
}

export const stripSensitiveFields = (
  connectionObj: NwcConnection,
): Omit<NwcConnection, "apiKey" | "connectionSecret"> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { apiKey: _key, connectionSecret: _secret, ...rest } = connectionObj
  return rest
}
