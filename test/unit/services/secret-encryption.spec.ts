import { decryptSecret, encryptSecret } from "@/services/secret-encryption"

describe("secret encryption", () => {
  it("round-trips encrypted secrets", () => {
    const plaintext = "secret-value"

    const encrypted = encryptSecret(plaintext)
    const decrypted = decryptSecret(encrypted)

    expect(encrypted).not.toBe(plaintext)
    expect(decrypted).toBe(plaintext)
  })

  it("uses a versioned encrypted payload format", () => {
    const encrypted = encryptSecret("secret-value")

    expect(encrypted.startsWith("enc:v1:")).toBe(true)
  })

  it("rejects invalid encrypted payloads", () => {
    expect(() => decryptSecret("plain-text")).toThrow("Invalid encrypted secret format")
  })
})
