import { nip04, nip44 } from "nostr-tools"

import { decrypt, encrypt, hexToBytes } from "@/domain/nostr/encryption"
import {
  Nip47EncryptionType,
  NwcAppPubkey,
  ServerNostrKeypair,
  ServerNostrPrivkey,
  ServerNostrPubkey,
} from "@/domain/index.types"

jest.mock("nostr-tools", () => ({
  nip04: {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  },
  nip44: {
    getConversationKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  },
}))

describe("Encryption Functions", () => {
  const serverKeypair: ServerNostrKeypair = {
    pubkey: "a".repeat(64) as ServerNostrPubkey,
    privkey: "b".repeat(64) as ServerNostrPrivkey,
  }
  const appPubkey: NwcAppPubkey = "c".repeat(64) as NwcAppPubkey
  const testContent = "test message"
  const encryptedContent = "encrypted_test_message"

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("hexToBytes", () => {
    it("should convert valid hex string to Uint8Array", () => {
      const hex = "48656c6c6f" // "Hello" in hex
      const result = hexToBytes(hex)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBe(5)
      expect(Array.from(result)).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f])
    })

    it("should convert empty hex string to empty Uint8Array", () => {
      const result = hexToBytes("")
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBe(0)
    })

    it("should handle lowercase hex", () => {
      const hex = "abcdef"
      const result = hexToBytes(hex)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBe(3)
      expect(Array.from(result)).toEqual([0xab, 0xcd, 0xef])
    })

    it("should handle uppercase hex", () => {
      const hex = "ABCDEF"
      const result = hexToBytes(hex)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBe(3)
      expect(Array.from(result)).toEqual([0xab, 0xcd, 0xef])
    })

    it("should handle mixed case hex", () => {
      const hex = "AaBbCc"
      const result = hexToBytes(hex)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBe(3)
      expect(Array.from(result)).toEqual([0xaa, 0xbb, 0xcc])
    })

    it("should handle all zeros", () => {
      const hex = "000000"
      const result = hexToBytes(hex)
      expect(Array.from(result)).toEqual([0, 0, 0])
    })

    it("should handle all ones (ff)", () => {
      const hex = "ffffff"
      const result = hexToBytes(hex)
      expect(Array.from(result)).toEqual([255, 255, 255])
    })

    it("should throw error for odd length hex string", () => {
      const hex = "abc"
      expect(() => hexToBytes(hex)).toThrow("invalid hex string length")
    })

    it("should throw error for single character", () => {
      const hex = "a"
      expect(() => hexToBytes(hex)).toThrow("invalid hex string length")
    })

    it("should convert 64-char hex (keypair length)", () => {
      const hex = "a".repeat(64)
      const result = hexToBytes(hex)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBe(32)
    })
  })

  describe("encrypt", () => {
    describe("with nip04 encryption", () => {
      const encryptionType: Nip47EncryptionType = "nip04"

      it("should call nip04.encrypt with correct parameters", () => {
        ;(nip04.encrypt as jest.Mock).mockReturnValue(encryptedContent)

        const result = encrypt(serverKeypair, appPubkey, testContent, encryptionType)

        expect(nip04.encrypt).toHaveBeenCalledTimes(1)
        expect(nip04.encrypt).toHaveBeenCalledWith(
          serverKeypair.privkey,
          appPubkey,
          testContent,
        )
        expect(result).toBe(encryptedContent)
      })

      it("should not call nip44 functions when using nip04", () => {
        ;(nip04.encrypt as jest.Mock).mockReturnValue(encryptedContent)

        encrypt(serverKeypair, appPubkey, testContent, encryptionType)

        expect(nip44.getConversationKey).not.toHaveBeenCalled()
        expect(nip44.encrypt).not.toHaveBeenCalled()
      })

      it("should handle empty content", () => {
        ;(nip04.encrypt as jest.Mock).mockReturnValue("")

        const result = encrypt(serverKeypair, appPubkey, "", encryptionType)

        expect(nip04.encrypt).toHaveBeenCalledWith(serverKeypair.privkey, appPubkey, "")
        expect(result).toBe("")
      })

      it("should handle long content", () => {
        const longContent = "a".repeat(10000)
        ;(nip04.encrypt as jest.Mock).mockReturnValue("encrypted_long")

        const result = encrypt(serverKeypair, appPubkey, longContent, encryptionType)

        expect(nip04.encrypt).toHaveBeenCalledWith(
          serverKeypair.privkey,
          appPubkey,
          longContent,
        )
        expect(result).toBe("encrypted_long")
      })

      it("should handle special characters in content", () => {
        const specialContent = '{"test": "value", "emoji": "🎉"}'
        ;(nip04.encrypt as jest.Mock).mockReturnValue("encrypted_special")

        const result = encrypt(serverKeypair, appPubkey, specialContent, encryptionType)

        expect(nip04.encrypt).toHaveBeenCalledWith(
          serverKeypair.privkey,
          appPubkey,
          specialContent,
        )
        expect(result).toBe("encrypted_special")
      })
    })

    describe("with nip44 encryption", () => {
      const encryptionType: Nip47EncryptionType = "nip44_v2"
      const mockConversationKey = new Uint8Array(32)

      beforeEach(() => {
        ;(nip44.getConversationKey as jest.Mock).mockReturnValue(mockConversationKey)
        ;(nip44.encrypt as jest.Mock).mockReturnValue(encryptedContent)
      })

      it("should call nip44 functions with correct parameters", () => {
        const result = encrypt(serverKeypair, appPubkey, testContent, encryptionType)

        expect(nip44.getConversationKey).toHaveBeenCalledTimes(1)
        expect(nip44.getConversationKey).toHaveBeenCalledWith(
          expect.any(Uint8Array),
          appPubkey,
        )
        expect(nip44.encrypt).toHaveBeenCalledTimes(1)
        expect(nip44.encrypt).toHaveBeenCalledWith(testContent, mockConversationKey)
        expect(result).toBe(encryptedContent)
      })

      it("should convert privkey to Uint8Array", () => {
        encrypt(serverKeypair, appPubkey, testContent, encryptionType)

        const callArgs = (nip44.getConversationKey as jest.Mock).mock.calls[0][0]
        expect(callArgs).toBeInstanceOf(Uint8Array)
        expect(callArgs.length).toBe(32)
      })

      it("should not call nip04 functions when using nip44", () => {
        encrypt(serverKeypair, appPubkey, testContent, encryptionType)

        expect(nip04.encrypt).not.toHaveBeenCalled()
        expect(nip04.decrypt).not.toHaveBeenCalled()
      })

      it("should handle empty content", () => {
        ;(nip44.encrypt as jest.Mock).mockReturnValue("")

        const result = encrypt(serverKeypair, appPubkey, "", encryptionType)

        expect(nip44.encrypt).toHaveBeenCalledWith("", mockConversationKey)
        expect(result).toBe("")
      })

      it("should handle long content", () => {
        const longContent = "a".repeat(10000)
        ;(nip44.encrypt as jest.Mock).mockReturnValue("encrypted_long")

        const result = encrypt(serverKeypair, appPubkey, longContent, encryptionType)

        expect(nip44.encrypt).toHaveBeenCalledWith(longContent, mockConversationKey)
        expect(result).toBe("encrypted_long")
      })

      it("should handle JSON content", () => {
        const jsonContent = JSON.stringify({ method: "get_balance", params: {} })
        ;(nip44.encrypt as jest.Mock).mockReturnValue("encrypted_json")

        const result = encrypt(serverKeypair, appPubkey, jsonContent, encryptionType)

        expect(nip44.encrypt).toHaveBeenCalledWith(jsonContent, mockConversationKey)
        expect(result).toBe("encrypted_json")
      })
    })
  })

  describe("decrypt", () => {
    describe("with nip04 encryption", () => {
      const encryptionType: Nip47EncryptionType = "nip04"

      it("should call nip04.decrypt with correct parameters", async () => {
        ;(nip04.decrypt as jest.Mock).mockResolvedValue(testContent)

        const result = await decrypt(
          serverKeypair,
          appPubkey,
          encryptedContent,
          encryptionType,
        )

        expect(nip04.decrypt).toHaveBeenCalledTimes(1)
        expect(nip04.decrypt).toHaveBeenCalledWith(
          serverKeypair.privkey,
          appPubkey,
          encryptedContent,
        )
        expect(result).toBe(testContent)
      })

      it("should not call nip44 functions when using nip04", async () => {
        ;(nip04.decrypt as jest.Mock).mockResolvedValue(testContent)

        await decrypt(serverKeypair, appPubkey, encryptedContent, encryptionType)

        expect(nip44.getConversationKey).not.toHaveBeenCalled()
        expect(nip44.decrypt).not.toHaveBeenCalled()
      })

      it("should handle empty decrypted content", async () => {
        ;(nip04.decrypt as jest.Mock).mockResolvedValue("")

        const result = await decrypt(
          serverKeypair,
          appPubkey,
          encryptedContent,
          encryptionType,
        )

        expect(result).toBe("")
      })

      it("should handle long decrypted content", async () => {
        const longContent = "a".repeat(10000)
        ;(nip04.decrypt as jest.Mock).mockResolvedValue(longContent)

        const result = await decrypt(
          serverKeypair,
          appPubkey,
          encryptedContent,
          encryptionType,
        )

        expect(result).toBe(longContent)
      })

      it("should handle JSON decrypted content", async () => {
        const jsonContent = '{"method":"get_balance"}'
        ;(nip04.decrypt as jest.Mock).mockResolvedValue(jsonContent)

        const result = await decrypt(
          serverKeypair,
          appPubkey,
          encryptedContent,
          encryptionType,
        )

        expect(result).toBe(jsonContent)
      })

      it("should propagate nip04.decrypt errors", async () => {
        const error = new Error("Decryption failed")
        ;(nip04.decrypt as jest.Mock).mockRejectedValue(error)

        await expect(
          decrypt(serverKeypair, appPubkey, encryptedContent, encryptionType),
        ).rejects.toThrow("Decryption failed")
      })
    })

    describe("with nip44 encryption", () => {
      const encryptionType: Nip47EncryptionType = "nip44_v2"
      const mockConversationKey = new Uint8Array(32)

      beforeEach(() => {
        ;(nip44.getConversationKey as jest.Mock).mockReturnValue(mockConversationKey)
        ;(nip44.decrypt as jest.Mock).mockReturnValue(testContent)
      })

      it("should call nip44 functions with correct parameters", async () => {
        const result = await decrypt(
          serverKeypair,
          appPubkey,
          encryptedContent,
          encryptionType,
        )

        expect(nip44.getConversationKey).toHaveBeenCalledTimes(1)
        expect(nip44.getConversationKey).toHaveBeenCalledWith(
          expect.any(Uint8Array),
          appPubkey,
        )
        expect(nip44.decrypt).toHaveBeenCalledTimes(1)
        expect(nip44.decrypt).toHaveBeenCalledWith(encryptedContent, mockConversationKey)
        expect(result).toBe(testContent)
      })

      it("should convert privkey to Uint8Array", async () => {
        await decrypt(serverKeypair, appPubkey, encryptedContent, encryptionType)

        const callArgs = (nip44.getConversationKey as jest.Mock).mock.calls[0][0]
        expect(callArgs).toBeInstanceOf(Uint8Array)
        expect(callArgs.length).toBe(32)
      })

      it("should not call nip04 functions when using nip44", async () => {
        await decrypt(serverKeypair, appPubkey, encryptedContent, encryptionType)

        expect(nip04.encrypt).not.toHaveBeenCalled()
        expect(nip04.decrypt).not.toHaveBeenCalled()
      })

      it("should handle empty decrypted content", async () => {
        ;(nip44.decrypt as jest.Mock).mockReturnValue("")

        const result = await decrypt(
          serverKeypair,
          appPubkey,
          encryptedContent,
          encryptionType,
        )

        expect(result).toBe("")
      })

      it("should handle long decrypted content", async () => {
        const longContent = "a".repeat(10000)
        ;(nip44.decrypt as jest.Mock).mockReturnValue(longContent)

        const result = await decrypt(
          serverKeypair,
          appPubkey,
          encryptedContent,
          encryptionType,
        )

        expect(result).toBe(longContent)
      })

      it("should handle JSON decrypted content", async () => {
        const jsonContent = '{"result":{"balance":1000000}}'
        ;(nip44.decrypt as jest.Mock).mockReturnValue(jsonContent)

        const result = await decrypt(
          serverKeypair,
          appPubkey,
          encryptedContent,
          encryptionType,
        )

        expect(result).toBe(jsonContent)
      })

      it("should propagate nip44.decrypt errors", async () => {
        const error = new Error("Decryption failed")
        ;(nip44.decrypt as jest.Mock).mockImplementation(() => {
          throw error
        })

        await expect(
          decrypt(serverKeypair, appPubkey, encryptedContent, encryptionType),
        ).rejects.toThrow("Decryption failed")
      })

      it("should propagate nip44.getConversationKey errors", async () => {
        const error = new Error("Invalid keypair")
        ;(nip44.getConversationKey as jest.Mock).mockImplementation(() => {
          throw error
        })

        await expect(
          decrypt(serverKeypair, appPubkey, encryptedContent, encryptionType),
        ).rejects.toThrow("Invalid keypair")
      })
    })
  })

  describe("encrypt/decrypt round-trip", () => {
    it("should successfully round-trip with nip04", async () => {
      const originalContent = "test message for round trip"
      const encrypted = "encrypted_data"

      ;(nip04.encrypt as jest.Mock).mockReturnValue(encrypted)
      ;(nip04.decrypt as jest.Mock).mockResolvedValue(originalContent)

      const encryptedResult = encrypt(serverKeypair, appPubkey, originalContent, "nip04")
      expect(encryptedResult).toBe(encrypted)

      const decryptedResult = await decrypt(serverKeypair, appPubkey, encrypted, "nip04")
      expect(decryptedResult).toBe(originalContent)
    })

    it("should successfully round-trip with nip44", async () => {
      const originalContent = '{"method":"pay_invoice","params":{"invoice":"lnbc..."}}'
      const encrypted = "encrypted_data_nip44"
      const mockKey = new Uint8Array(32)

      ;(nip44.getConversationKey as jest.Mock).mockReturnValue(mockKey)
      ;(nip44.encrypt as jest.Mock).mockReturnValue(encrypted)
      ;(nip44.decrypt as jest.Mock).mockReturnValue(originalContent)

      const encryptedResult = encrypt(
        serverKeypair,
        appPubkey,
        originalContent,
        "nip44_v2",
      )
      expect(encryptedResult).toBe(encrypted)

      const decryptedResult = await decrypt(
        serverKeypair,
        appPubkey,
        encrypted,
        "nip44_v2",
      )
      expect(decryptedResult).toBe(originalContent)
    })
  })

  describe("edge cases", () => {
    it("should handle different keypair formats", () => {
      const shortKeypair: ServerNostrKeypair = {
        pubkey: "1234567890abcdef".repeat(4) as ServerNostrPubkey,
        privkey: "fedcba0987654321".repeat(4) as ServerNostrPrivkey,
      }
      const mockKey = new Uint8Array(32)
      ;(nip44.getConversationKey as jest.Mock).mockReturnValue(mockKey)
      ;(nip44.encrypt as jest.Mock).mockReturnValue("encrypted")

      const result = encrypt(shortKeypair, appPubkey, testContent, "nip44_v2")

      expect(result).toBe("encrypted")
      expect(nip44.getConversationKey).toHaveBeenCalled()
    })

    it("should handle Unicode content in nip04", () => {
      const unicodeContent = "Hello 世界 🌍 émojis"
      ;(nip04.encrypt as jest.Mock).mockReturnValue("encrypted_unicode")

      const result = encrypt(serverKeypair, appPubkey, unicodeContent, "nip04")

      expect(nip04.encrypt).toHaveBeenCalledWith(
        serverKeypair.privkey,
        appPubkey,
        unicodeContent,
      )
      expect(result).toBe("encrypted_unicode")
    })

    it("should handle Unicode content in nip44", () => {
      const unicodeContent = "Payment: 1000 sats ⚡️"
      const mockKey = new Uint8Array(32)
      ;(nip44.getConversationKey as jest.Mock).mockReturnValue(mockKey)
      ;(nip44.encrypt as jest.Mock).mockReturnValue("encrypted_unicode")

      const result = encrypt(serverKeypair, appPubkey, unicodeContent, "nip44_v2")

      expect(nip44.encrypt).toHaveBeenCalledWith(unicodeContent, mockKey)
      expect(result).toBe("encrypted_unicode")
    })
  })
})
