import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

import { env } from "@/config/env"

const ENCRYPTION_PREFIX = "enc"
const ENCRYPTION_VERSION = "v1"
const ENCRYPTION_ALGORITHM = "aes-256-gcm"
const IV_LENGTH_BYTES = 12

const key = Buffer.from(env.DATA_ENCRYPTION_KEY, "hex")

export const encryptSecret = (plaintext: string): string => {
  const iv = randomBytes(IV_LENGTH_BYTES)
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    ENCRYPTION_PREFIX,
    ENCRYPTION_VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":")
}

export const decryptSecret = (encryptedValue: string): string => {
  const [prefix, version, iv, authTag, ciphertext] = encryptedValue.split(":")
  if (!prefix || !version || !iv || !authTag || !ciphertext) {
    throw new Error("Invalid encrypted secret format")
  }

  if (prefix !== ENCRYPTION_PREFIX || version !== ENCRYPTION_VERSION) {
    throw new Error("Unsupported encrypted secret format")
  }

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(iv, "base64"))
  decipher.setAuthTag(Buffer.from(authTag, "base64"))

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8")
}
