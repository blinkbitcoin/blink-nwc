import { sleep, mergeTxs, toNwcTx, stripSensitiveFields } from "@/domain/utils"
import { NwcConnection } from "@/domain/connection"
import { Nip47Method } from "@/domain/nostr"
import {
  CoreServiceTx,
  Description,
  DescriptionHash,
  PaymentHash,
} from "@/domain/core/index.types"
import { UnixTimestamp } from "@/domain/units/index.types"
import { InvoiceBolt11, MilliSatoshis, Preimage, Satoshis } from "@/domain/index.types"

describe("sleep", () => {
  it("should wait for specified milliseconds", async () => {
    const start = performance.now()
    await sleep(100)
    const elapsed = performance.now() - start

    expect(elapsed).toBeGreaterThanOrEqual(95)
    expect(elapsed).toBeLessThan(105)
  })

  it("should handle zero milliseconds", async () => {
    const start = Date.now()
    await sleep(0)
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(50)
  })

  it("should handle very short delays", async () => {
    const start = Date.now()
    await sleep(1)
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(50)
  })
})

describe("mergeTxs", () => {
  const createTx = (overrides: Partial<CoreServiceTx> = {}): CoreServiceTx => ({
    type: "incoming",
    paymentHash: ("hash_" + Math.random()) as PaymentHash,
    invoice: undefined,
    description: undefined,
    descriptionHash: undefined,
    preimage: undefined,
    amount: 0 as Satoshis,
    feesPaid: 0 as Satoshis,
    createdAt: 1000 as UnixTimestamp,
    expiresAt: undefined,
    settledAt: undefined,
    ...overrides,
  })

  describe("Basic Merging", () => {
    it("should merge two empty arrays", () => {
      const result = mergeTxs([], [])
      expect(result).toEqual([])
    })

    it("should return first array when second is empty", () => {
      const tx1 = createTx({ paymentHash: "hash1" as PaymentHash })
      const result = mergeTxs([tx1], [])

      expect(result).toHaveLength(1)
      expect(result[0].paymentHash).toBe("hash1")
    })

    it("should return second array when first is empty", () => {
      const tx1 = createTx({ paymentHash: "hash1" as PaymentHash })
      const result = mergeTxs([], [tx1])

      expect(result).toHaveLength(1)
      expect(result[0].paymentHash).toBe("hash1")
    })

    it("should combine non-overlapping transactions", () => {
      const tx1 = createTx({ paymentHash: "hash1" as PaymentHash })
      const tx2 = createTx({ paymentHash: "hash2" as PaymentHash })

      const result = mergeTxs([tx1], [tx2])

      expect(result).toHaveLength(2)
      expect(result.map((tx) => tx.paymentHash)).toContain("hash1")
      expect(result.map((tx) => tx.paymentHash)).toContain("hash2")
    })

    it("should deduplicate transactions with same payment_hash", () => {
      const tx1 = createTx({ paymentHash: "same_hash" as PaymentHash })
      const tx2 = createTx({ paymentHash: "same_hash" as PaymentHash })

      const result = mergeTxs([tx1], [tx2])

      expect(result).toHaveLength(1)
      expect(result[0].paymentHash).toBe("same_hash")
    })
  })

  describe("Field Merging Priority", () => {
    it("should use transaction's type field (not invoice)", () => {
      const invoice = createTx({ paymentHash: "hash1" as PaymentHash, type: "incoming" })
      const tx = createTx({ paymentHash: "hash1" as PaymentHash, type: "outgoing" })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].type).toBe("outgoing")
    })

    it("should prefer transaction invoice over invoice's invoice field", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        invoice: "lnbc_from_invoice..." as InvoiceBolt11,
      })
      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        invoice: "lnbc_from_tx..." as InvoiceBolt11,
      })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].invoice).toBe("lnbc_from_tx...")
    })

    it("should fallback to invoice's invoice when tx has undefined", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        invoice: "lnbc_from_invoice..." as InvoiceBolt11,
      })
      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        invoice: undefined,
      })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].invoice).toBe("lnbc_from_invoice...")
    })

    it("should prefer transaction description over invoice's", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        description: "Invoice description" as Description,
      })
      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        description: "Tx description" as Description,
      })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].description).toBe("Tx description")
    })

    it("should prefer transaction description_hash over invoice's", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        descriptionHash: "hash_from_invoice" as DescriptionHash,
      })
      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        descriptionHash: "hash_from_tx" as DescriptionHash,
      })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].descriptionHash).toBe("hash_from_tx")
    })

    it("should prefer transaction preimage over invoice's", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        preimage: "preimage_invoice" as Preimage,
      })
      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        preimage: "preimage_tx" as Preimage,
      })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].preimage).toBe("preimage_tx")
    })

    it("should prefer transaction expires_at over invoice's", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        expiresAt: 5000 as UnixTimestamp,
      })
      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        expiresAt: 6000 as UnixTimestamp,
      })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].expiresAt).toBe(6000)
    })

    it("should use transaction's settled_at", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        settledAt: 3000 as UnixTimestamp,
      })
      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        settledAt: 4000 as UnixTimestamp,
      })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].settledAt).toBe(4000)
    })
  })

  describe("Amount and Fees Merging", () => {
    /**
     * New logic: tx values take precedence, invoice is fallback
     */
    it("should use transaction amount when non-zero", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        amount: 100 as Satoshis,
      })
      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        amount: 200 as Satoshis,
      })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].amount).toBe(200)
    })

    it("should fallback to invoice amount when tx amount is zero", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        amount: 100 as Satoshis,
      })
      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        amount: 0 as Satoshis,
      })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].amount).toBe(100)
    })

    it("should use transaction fees_paid when non-zero", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        feesPaid: 10 as Satoshis,
      })
      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        feesPaid: 20 as Satoshis,
      })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].feesPaid).toBe(20)
    })

    it("should fallback to invoice fees_paid when tx fees is zero", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        feesPaid: 10 as Satoshis,
      })
      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        feesPaid: 0 as Satoshis,
      })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].feesPaid).toBe(10)
    })
  })

  describe("Timestamp Merging", () => {
    /**
     * NIP-47 requires:
     * - created_at = when invoice was created (from invoice)
     * - settled_at = when payment was received (from transaction)
     */

    it("should use invoice's created_at (invoice creation time)", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        createdAt: 1000 as UnixTimestamp,
      })
      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        createdAt: 2000 as UnixTimestamp,
        settledAt: 2000 as UnixTimestamp,
      })

      const result = mergeTxs([invoice], [tx])

      // created_at should come from invoice
      expect(result[0].createdAt).toBe(1000)
      // settled_at should come from transaction
      expect(result[0].settledAt).toBe(2000)
    })

    it("should preserve created_at for non-merged transactions", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        createdAt: 2000 as UnixTimestamp,
      })
      const tx = createTx({
        paymentHash: "hash2" as PaymentHash,
        createdAt: 3000 as UnixTimestamp,
      })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].createdAt).toBe(3000)
      expect(result[1].createdAt).toBe(2000)
    })

    it("should correctly separate invoice creation time from settlement time", () => {
      const invoiceCreatedAt = 1704067200 as UnixTimestamp // 2024-01-01 00:00:00
      const paymentSettledAt = 1704070800 as UnixTimestamp // 2024-01-01 01:00:00

      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        type: "incoming",
        createdAt: invoiceCreatedAt,
        settledAt: undefined,
      })
      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        type: "incoming",
        createdAt: paymentSettledAt,
        settledAt: paymentSettledAt,
      })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].createdAt).toBe(invoiceCreatedAt)
      expect(result[0].settledAt).toBe(paymentSettledAt)
    })
  })

  describe("Sorting", () => {
    it("should sort by created_at DESC (newest first)", () => {
      const inv1 = createTx({
        paymentHash: "hash1" as PaymentHash,
        createdAt: 1000 as UnixTimestamp,
      })
      const inv2 = createTx({
        paymentHash: "hash2" as PaymentHash,
        createdAt: 3000 as UnixTimestamp,
      })
      const tx3 = createTx({
        paymentHash: "hash3" as PaymentHash,
        createdAt: 2000 as UnixTimestamp,
      })

      const result = mergeTxs([inv1, inv2], [tx3])

      expect(result).toHaveLength(3)
      expect(result[0].createdAt).toBe(3000)
      expect(result[1].createdAt).toBe(2000)
      expect(result[2].createdAt).toBe(1000)
    })

    it("should maintain DESC order after merge using invoice's created_at", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        createdAt: 1000 as UnixTimestamp,
      })
      const tx1 = createTx({
        paymentHash: "hash1" as PaymentHash,
        createdAt: 1500 as UnixTimestamp,
        settledAt: 1500 as UnixTimestamp,
      })
      const tx2 = createTx({
        paymentHash: "hash2" as PaymentHash,
        createdAt: 1200 as UnixTimestamp,
      })

      const result = mergeTxs([invoice], [tx1, tx2])

      expect(result).toHaveLength(2)
      expect(result[0].createdAt).toBe(1200)
      expect(result[1].createdAt).toBe(1000)
    })
  })

  describe("Complex Merging Scenarios", () => {
    it("should merge invoice and transaction data correctly", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        invoice: "lnbc1..." as InvoiceBolt11,
        amount: 1000 as Satoshis,
        description: undefined,
        preimage: undefined,
        createdAt: 1000 as UnixTimestamp,
      })

      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        invoice: undefined,
        amount: 0 as Satoshis,
        description: "Payment description" as Description,
        preimage: "preimage123" as Preimage,
        createdAt: 2000 as UnixTimestamp,
        settledAt: 2000 as UnixTimestamp,
      })

      const result = mergeTxs([invoice], [tx])
      console.log(result)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: "incoming",
        paymentHash: "hash1",
        invoice: "lnbc1...",
        amount: 1000,
        description: "Payment description",
        preimage: "preimage123",
        createdAt: 1000,
        settledAt: 2000,
      })
    })

    it("should handle multiple invoices and transactions", () => {
      const inv1 = createTx({
        paymentHash: "hash1" as PaymentHash,
        amount: 100 as Satoshis,
        createdAt: 1000 as UnixTimestamp,
      })
      const inv2 = createTx({
        paymentHash: "hash2" as PaymentHash,
        amount: 200 as Satoshis,
        createdAt: 2000 as UnixTimestamp,
      })
      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        description: "Payment for hash1" as Description,
        settledAt: 1500 as UnixTimestamp,
      })

      const result = mergeTxs([inv1, inv2], [tx])

      expect(result).toHaveLength(2)

      const hash1Result = result.find((r) => r.paymentHash === "hash1")
      expect(hash1Result?.amount).toBe(100)
      expect(hash1Result?.description).toBe("Payment for hash1")
      expect(hash1Result?.createdAt).toBe(1000)
      expect(hash1Result?.settledAt).toBe(1500)
    })

    it("should preserve all fields for non-merged invoices", () => {
      const invoice = createTx({
        paymentHash: "unique" as PaymentHash,
        type: "incoming",
        invoice: "lnbc..." as InvoiceBolt11,
        description: "Test" as Description,
        amount: 500 as Satoshis,
        feesPaid: 5 as Satoshis,
        createdAt: 1234 as UnixTimestamp,
        expiresAt: 5678 as UnixTimestamp,
        settledAt: undefined,
        preimage: undefined,
      })

      const result = mergeTxs([invoice], [])

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(invoice)
    })

    it("should preserve all fields for non-merged transactions (outgoing)", () => {
      const tx = createTx({
        paymentHash: "unique" as PaymentHash,
        type: "outgoing",
        invoice: "lnbc..." as InvoiceBolt11,
        description: "Payment sent" as Description,
        amount: 500 as Satoshis,
        feesPaid: 5 as Satoshis,
        createdAt: 1234 as UnixTimestamp,
        expiresAt: undefined,
        settledAt: 1234 as UnixTimestamp,
        preimage: "pre123" as Preimage,
      })

      const result = mergeTxs([], [tx])

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(tx)
    })
  })

  describe("Edge Cases", () => {
    it("should handle null values in mergeField correctly", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        invoice: null as any,
      })
      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        invoice: "lnbc..." as InvoiceBolt11,
      })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].invoice).toBe("lnbc...")
    })

    it("should handle many invoices and transactions with same hash", () => {
      const invoices = [
        createTx({
          paymentHash: "same" as PaymentHash,
          amount: 100 as Satoshis,
          createdAt: 1000 as UnixTimestamp,
        }),
        createTx({
          paymentHash: "same" as PaymentHash,
          amount: 200 as Satoshis,
          createdAt: 900 as UnixTimestamp,
        }),
      ]

      const txs = [
        createTx({
          paymentHash: "same" as PaymentHash,
          amount: 300 as Satoshis,
          settledAt: 1500 as UnixTimestamp,
        }),
        createTx({
          paymentHash: "same" as PaymentHash,
          amount: 400 as Satoshis,
          settledAt: 1600 as UnixTimestamp,
        }),
      ]

      const result = mergeTxs(invoices, txs)
      expect(result).toHaveLength(1)
      expect(result[0].amount).toBe(400)
      expect(result[0].createdAt).toBe(900)
    })

    it("should handle large arrays efficiently", () => {
      const invoices = Array.from({ length: 100 }, (_, i) =>
        createTx({
          paymentHash: `hash_${i}` as PaymentHash,
          createdAt: (1000 + i) as UnixTimestamp,
        }),
      )

      const txs = Array.from({ length: 100 }, (_, i) =>
        createTx({
          paymentHash: `hash_${i + 50}` as PaymentHash,
          createdAt: (1500 + i) as UnixTimestamp,
          settledAt: (1500 + i) as UnixTimestamp,
        }),
      )

      const result = mergeTxs(invoices, txs)

      expect(result.length).toBe(150)

      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].createdAt).toBeGreaterThanOrEqual(result[i + 1].createdAt)
      }
    })
  })

  describe("Null Safety", () => {
    it("should not treat undefined as a value to merge", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        invoice: undefined,
      })
      const tx = createTx({ paymentHash: "hash1" as PaymentHash, invoice: undefined })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].invoice).toBeUndefined()
    })

    it("should preserve explicit values over null/undefined", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        description: null as any,
      })
      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        description: "Valid" as Description,
      })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].description).toBe("Valid")
    })

    it("should use invoice fallback when tx has null", () => {
      const invoice = createTx({
        paymentHash: "hash1" as PaymentHash,
        description: "From invoice" as Description,
      })
      const tx = createTx({
        paymentHash: "hash1" as PaymentHash,
        description: null as any,
      })

      const result = mergeTxs([invoice], [tx])

      expect(result[0].description).toBe("From invoice")
    })
  })
})

describe("toNwcTx", () => {
  const createTx = (overrides: Partial<CoreServiceTx> = {}): CoreServiceTx => ({
    type: "incoming",
    paymentHash: "abc123" as PaymentHash,
    invoice: "lnbc1..." as InvoiceBolt11,
    description: "Test payment" as Description,
    descriptionHash: "hash123" as DescriptionHash,
    preimage: "preimage123" as Preimage,
    amount: 1000 as Satoshis,
    feesPaid: 10 as Satoshis,
    createdAt: 1704067200 as UnixTimestamp,
    expiresAt: 1704070800 as UnixTimestamp,
    settledAt: 1704068000 as UnixTimestamp,
    ...overrides,
  })

  describe("Unit Conversion (Satoshi to MilliSatoshi)", () => {
    it("should convert amount from satoshis to millisatoshis", () => {
      const tx = createTx({ amount: 1000 as Satoshis })
      const result = toNwcTx(tx)

      expect(result.amount).toBe(1000000 as MilliSatoshis)
    })

    it("should convert fees_paid from satoshis to millisatoshis", () => {
      const tx = createTx({ feesPaid: 10 as Satoshis })
      const result = toNwcTx(tx)

      expect(result.fees_paid).toBe(10000 as MilliSatoshis)
    })

    it("should handle zero amounts", () => {
      const tx = createTx({ amount: 0 as Satoshis, feesPaid: 0 as Satoshis })
      const result = toNwcTx(tx)

      expect(result.amount).toBe(0)
      expect(result.fees_paid).toBe(0)
    })

    it("should handle large amounts", () => {
      const tx = createTx({ amount: 21000000 as Satoshis })
      const result = toNwcTx(tx)

      expect(result.amount).toBe(21000000000 as MilliSatoshis)
    })
  })

  describe("Field Mapping (camelCase to snake_case)", () => {
    it("should map paymentHash to payment_hash", () => {
      const tx = createTx({ paymentHash: "test_hash_123" as PaymentHash })
      const result = toNwcTx(tx)

      expect(result.payment_hash).toBe("test_hash_123")
      expect((result as any).paymentHash).toBeUndefined()
    })

    it("should map descriptionHash to description_hash", () => {
      const tx = createTx({ descriptionHash: "desc_hash_456" as DescriptionHash })
      const result = toNwcTx(tx)

      expect(result.description_hash).toBe("desc_hash_456")
      expect((result as any).descriptionHash).toBeUndefined()
    })

    it("should map createdAt to created_at", () => {
      const tx = createTx({ createdAt: 1704067200 as UnixTimestamp })
      const result = toNwcTx(tx)

      expect(result.created_at).toBe(1704067200)
      expect((result as any).createdAt).toBeUndefined()
    })

    it("should map feesPaid to fees_paid", () => {
      const tx = createTx({ feesPaid: 50 as Satoshis })
      const result = toNwcTx(tx)

      expect(result.fees_paid).toBe(50000) // converted to msats
      expect((result as any).feesPaid).toBeUndefined()
    })
  })

  describe("Field Preservation", () => {
    it("should preserve type field", () => {
      const incomingTx = createTx({ type: "incoming" })
      const outgoingTx = createTx({ type: "outgoing" })

      expect(toNwcTx(incomingTx).type).toBe("incoming")
      expect(toNwcTx(outgoingTx).type).toBe("outgoing")
    })

    it("should preserve invoice field", () => {
      const tx = createTx({ invoice: "lnbc1pvjluezpp5qqqsyqcy..." as InvoiceBolt11 })
      const result = toNwcTx(tx)

      expect(result.invoice).toBe("lnbc1pvjluezpp5qqqsyqcy...")
    })

    it("should preserve description field", () => {
      const tx = createTx({ description: "Coffee payment" as Description })
      const result = toNwcTx(tx)

      expect(result.description).toBe("Coffee payment")
    })

    it("should preserve preimage field", () => {
      const tx = createTx({ preimage: "0000111122223333" as Preimage })
      const result = toNwcTx(tx)

      expect(result.preimage).toBe("0000111122223333")
    })
  })

  describe("Excluded Fields", () => {
    it("should NOT include settledAt in output", () => {
      const tx = createTx({ settledAt: 1704068000 as UnixTimestamp })
      const result = toNwcTx(tx)

      expect((result as any).settledAt).toBeUndefined()
      expect((result as any).settled_at).toBeUndefined()
    })

    it("should NOT include expiresAt in output", () => {
      const tx = createTx({ expiresAt: 1704070800 as UnixTimestamp })
      const result = toNwcTx(tx)

      expect((result as any).expiresAt).toBeUndefined()
      expect((result as any).expires_at).toBeUndefined()
    })
  })

  describe("Metadata Field", () => {
    it("should set metadata to undefined", () => {
      const tx = createTx()
      const result = toNwcTx(tx)

      expect(result.metadata).toBeUndefined()
    })
  })

  describe("Edge Cases", () => {
    it("should handle undefined optional fields", () => {
      const tx = createTx({
        invoice: undefined,
        description: undefined,
        descriptionHash: undefined,
        preimage: undefined,
        expiresAt: undefined,
        settledAt: undefined,
      })

      const result = toNwcTx(tx)

      expect(result.invoice).toBeUndefined()
      expect(result.description).toBeUndefined()
      expect(result.description_hash).toBeUndefined()
      expect(result.preimage).toBeUndefined()
    })

    it("should return valid Nip47Transaction type", () => {
      const tx = createTx()
      const result = toNwcTx(tx)

      expect(result).toHaveProperty("type")
      expect(result).toHaveProperty("payment_hash")
      expect(result).toHaveProperty("amount")
      expect(result).toHaveProperty("fees_paid")
      expect(result).toHaveProperty("created_at")
    })
  })
})

describe("stripSensitiveFields", () => {
  const mockConnection: NwcConnection = {
    id: "conn-1" as any,
    userId: "user-1" as any,
    accountId: "account-1" as any,
    walletId: "wallet-1" as any,
    walletCurrency: "BTC",
    apiKey: "secret-api-key-value" as any,
    apiKeyId: null,
    connectionSecret: "secret-connection-value" as any,
    appPubkey: "a".repeat(64) as any,
    alias: "Test" as any,
    permissions: [Nip47Method.GetInfo],
    notificationsEnabled: false,
    revoked: false,
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it("should remove apiKey from result", () => {
    const result = stripSensitiveFields(mockConnection)
    expect((result as any).apiKey).toBeUndefined()
  })

  it("should remove connectionSecret from result", () => {
    const result = stripSensitiveFields(mockConnection)
    expect((result as any).connectionSecret).toBeUndefined()
  })

  it("should preserve all other fields", () => {
    const result = stripSensitiveFields(mockConnection)
    expect(result.id).toBe(mockConnection.id)
    expect(result.userId).toBe(mockConnection.userId)
    expect(result.walletId).toBe(mockConnection.walletId)
    expect(result.walletCurrency).toBe("BTC")
    expect(result.appPubkey).toBe(mockConnection.appPubkey)
    expect(result.permissions).toEqual(mockConnection.permissions)
    expect(result.alias).toBe(mockConnection.alias)
    expect(result.notificationsEnabled).toBe(false)
    expect(result.revoked).toBe(false)
    expect(result.expiresAt).toBeNull()
    expect(result.apiKeyId).toBeNull()
  })
})
