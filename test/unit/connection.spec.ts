import { getPublicKey } from "nostr-tools"

import {
  getServerKeypair,
  stringifyNwcUri,
  parseNwcUri,
  hasPermission,
} from "@/domain/connection"
import { NwcRelay, NwcSecret } from "@/domain/index.types"
import { Nip47Method } from "@/domain/nostr"
import { NOSTR_PRIVATE_KEY } from "@/config"

describe("connection", () => {
  describe("getServerKeypair", () => {
    it("should generate keypair from NOSTR_PRIVATE_KEY env variable", () => {
      const keypair = getServerKeypair()

      expect(keypair).toHaveProperty("pubkey")
      expect(keypair).toHaveProperty("privkey")
      expect(typeof keypair.pubkey).toBe("string")
      expect(typeof keypair.privkey).toBe("string")
    })

    it("should have hex-encoded pubkey (64 chars)", () => {
      const keypair = getServerKeypair()

      expect(keypair.pubkey).toMatch(/^[0-9a-f]{64}$/i)
    })

    it("should have hex-encoded privkey matching env variable", () => {
      const keypair = getServerKeypair()

      expect(keypair.privkey).toBe(NOSTR_PRIVATE_KEY)
      expect(keypair.privkey).toMatch(/^[0-9a-f]{64}$/i)
    })

    it("should return consistent keypair on multiple calls", () => {
      const keypair1 = getServerKeypair()
      const keypair2 = getServerKeypair()

      expect(keypair1.pubkey).toBe(keypair2.pubkey)
      expect(keypair1.privkey).toBe(keypair2.privkey)
    })

    it("should derive pubkey from privkey correctly", () => {
      const keypair = getServerKeypair()

      expect(keypair.pubkey.length).toBe(64)
      expect(keypair.privkey.length).toBe(64)
    })
  })

  describe("stringifyNwcUri", () => {
    const mockPubkey = "a".repeat(64)
    const mockRelay = "wss://relay.example.com" as NwcRelay
    const mockSecret = "b".repeat(64) as NwcSecret

    it("should format nostr+walletconnect URI correctly", () => {
      const uri = stringifyNwcUri({
        pubkey: mockPubkey as any,
        relay: mockRelay,
        secret: mockSecret,
      })

      expect(uri).toMatch(/^nostr\+walletconnect:\/\//)
    })

    it("should include pubkey in URI path", () => {
      const uri = stringifyNwcUri({
        pubkey: mockPubkey as any,
        relay: mockRelay,
        secret: mockSecret,
      })

      expect(uri).toContain(`nostr+walletconnect://${mockPubkey}`)
    })

    it("should include relay as query parameter", () => {
      const uri = stringifyNwcUri({
        pubkey: mockPubkey as any,
        relay: mockRelay,
        secret: mockSecret,
      })

      expect(uri).toContain("relay=wss%3A%2F%2Frelay.example.com")
    })

    it("should include secret as query parameter", () => {
      const uri = stringifyNwcUri({
        pubkey: mockPubkey as any,
        relay: mockRelay,
        secret: mockSecret,
      })

      expect(uri).toContain(`secret=${"b".repeat(64)}`)
    })

    it("should URL-encode relay parameter", () => {
      const uri = stringifyNwcUri({
        pubkey: mockPubkey as any,
        relay: "wss://relay.test.com/path?query=value" as NwcRelay,
        secret: mockSecret,
      })

      expect(uri).toContain("relay=wss%3A%2F%2Frelay.test.com%2Fpath%3Fquery%3Dvalue")
    })

    it("should produce parseable URI", () => {
      const uri = stringifyNwcUri({
        pubkey: mockPubkey as any,
        relay: mockRelay,
        secret: mockSecret,
      })

      const match = uri.match(/^nostr\+walletconnect:\/\/([^?]+)\?(.+)$/)
      expect(match).not.toBeNull()

      if (!match) {
        return
      }
      const [, pubkey, queryString] = match
      const params = new URLSearchParams(queryString)

      expect(pubkey).toBe(mockPubkey)
      expect(params.get("relay")).toBe(mockRelay)
      expect(params.get("secret")).toBe(mockSecret)
    })

    it("should handle special characters in secret", () => {
      const specialSecret = "secret+with/special=chars" as NwcSecret

      const uri = stringifyNwcUri({
        pubkey: mockPubkey as any,
        relay: mockRelay,
        secret: specialSecret,
      })

      expect(uri).toContain("secret=secret%2Bwith%2Fspecial%3Dchars")
    })

    it("should create unique URIs for different secrets", () => {
      const uri1 = stringifyNwcUri({
        pubkey: mockPubkey as any,
        relay: mockRelay,
        secret: "secret1" as NwcSecret,
      })

      const uri2 = stringifyNwcUri({
        pubkey: mockPubkey as any,
        relay: mockRelay,
        secret: "secret2" as NwcSecret,
      })

      expect(uri1).not.toBe(uri2)
    })

    it("should create unique URIs for different pubkeys", () => {
      const uri1 = stringifyNwcUri({
        pubkey: "a".repeat(64) as any,
        relay: mockRelay,
        secret: mockSecret,
      })

      const uri2 = stringifyNwcUri({
        pubkey: "b".repeat(64) as any,
        relay: mockRelay,
        secret: mockSecret,
      })

      expect(uri1).not.toBe(uri2)
    })

    it("should create unique URIs for different relays", () => {
      const uri1 = stringifyNwcUri({
        pubkey: mockPubkey as any,
        relay: "wss://relay1.com" as NwcRelay,
        secret: mockSecret,
      })

      const uri2 = stringifyNwcUri({
        pubkey: mockPubkey as any,
        relay: "wss://relay2.com" as NwcRelay,
        secret: mockSecret,
      })

      expect(uri1).not.toBe(uri2)
    })
  })

  describe("parseNwcUri", () => {
    const mockPubkey = "a".repeat(64)
    const mockRelay = "ws://relay.example.com" as NwcRelay
    const mockSecret = "b".repeat(64) as NwcSecret

    it("should parse a valid NWC URI", () => {
      const uri = stringifyNwcUri({
        pubkey: mockPubkey as any,
        relay: mockRelay,
        secret: mockSecret,
      })

      const parsed = parseNwcUri(uri)

      expect(parsed).not.toBeInstanceOf(Error)
      if (parsed instanceof Error) return

      expect(parsed.serverPubkey).toBe(mockPubkey)
      expect(parsed.relay).toBe(mockRelay)
      expect(parsed.secret).toBe(mockSecret)
      expect(parsed.appPubkey).toBe(getPublicKey(Buffer.from(mockSecret, "hex")))
    })

    it("should reject non-NWC URI schemes", () => {
      const parsed = parseNwcUri("https://example.com")
      expect(parsed).toBeInstanceOf(Error)
    })

    it("should reject URIs missing a relay", () => {
      const parsed = parseNwcUri(
        `nostr+walletconnect://${mockPubkey}?secret=${mockSecret}`,
      )
      expect(parsed).toBeInstanceOf(Error)
    })

    it("should reject URIs missing a secret", () => {
      const parsed = parseNwcUri(
        `nostr+walletconnect://${mockPubkey}?relay=${encodeURIComponent(mockRelay)}`,
      )
      expect(parsed).toBeInstanceOf(Error)
    })
  })

  describe("hasPermission", () => {
    const mockConnection = {
      permissions: [Nip47Method.GetInfo, Nip47Method.GetBalance, Nip47Method.PayInvoice],
    } as any

    it("should return true for permitted method", () => {
      expect(hasPermission(Nip47Method.GetInfo, mockConnection)).toBe(true)
      expect(hasPermission(Nip47Method.GetBalance, mockConnection)).toBe(true)
      expect(hasPermission(Nip47Method.PayInvoice, mockConnection)).toBe(true)
    })

    it("should return false for non-permitted method", () => {
      expect(hasPermission(Nip47Method.MakeInvoice, mockConnection)).toBe(false)
      expect(hasPermission(Nip47Method.LookupInvoice, mockConnection)).toBe(false)
      expect(hasPermission(Nip47Method.ListTransactions, mockConnection)).toBe(false)
    })

    it("should return false for empty permissions array", () => {
      const emptyConnection = { permissions: [] } as any

      expect(hasPermission(Nip47Method.GetInfo, emptyConnection)).toBe(false)
      expect(hasPermission(Nip47Method.GetBalance, emptyConnection)).toBe(false)
    })

    it("should handle connection with all permissions", () => {
      const fullConnection = {
        permissions: [
          Nip47Method.GetInfo,
          Nip47Method.GetBalance,
          Nip47Method.MakeInvoice,
          Nip47Method.PayInvoice,
          Nip47Method.LookupInvoice,
          Nip47Method.ListTransactions,
        ],
      } as any

      expect(hasPermission(Nip47Method.GetInfo, fullConnection)).toBe(true)
      expect(hasPermission(Nip47Method.GetBalance, fullConnection)).toBe(true)
      expect(hasPermission(Nip47Method.MakeInvoice, fullConnection)).toBe(true)
      expect(hasPermission(Nip47Method.PayInvoice, fullConnection)).toBe(true)
      expect(hasPermission(Nip47Method.LookupInvoice, fullConnection)).toBe(true)
      expect(hasPermission(Nip47Method.ListTransactions, fullConnection)).toBe(true)
    })

    it("should be case-sensitive for method names", () => {
      const connection = {
        permissions: [Nip47Method.GetInfo],
      } as any

      expect(hasPermission(Nip47Method.GetInfo, connection)).toBe(true)

      expect(hasPermission(Nip47Method.GetBalance, connection)).toBe(false)
    })

    it("should handle duplicate permissions gracefully", () => {
      const connection = {
        permissions: [Nip47Method.GetInfo, Nip47Method.GetInfo, Nip47Method.GetBalance],
      } as any

      expect(hasPermission(Nip47Method.GetInfo, connection)).toBe(true)
      expect(hasPermission(Nip47Method.GetBalance, connection)).toBe(true)
    })
  })
})
