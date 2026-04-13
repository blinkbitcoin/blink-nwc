import { nip04, nip44 } from "nostr-tools"

import {
  Nip47EncryptionType,
  NwcAppPubkey,
  ServerNostrKeypair,
} from "@/domain/index.types"

const hexToBytes = (hex: string): Uint8Array => {
  if (hex.length % 2 !== 0) {
    throw new Error("invalid hex string length")
  }
  const bytesArr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytesArr[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytesArr
}
const decrypt = (
  serverKeypair: ServerNostrKeypair,
  appPubkey: NwcAppPubkey,
  content: string,
  encryptionType: Nip47EncryptionType,
) => {
  if (encryptionType === "nip04") {
    return nip04.decrypt(serverKeypair.privkey, appPubkey, content)
  }
  const key = nip44.getConversationKey(hexToBytes(serverKeypair.privkey), appPubkey)
  return nip44.decrypt(content, key)
}

const encrypt = (
  serverKeypair: ServerNostrKeypair,
  appPubkey: NwcAppPubkey,
  content: string,
  encryptionType: Nip47EncryptionType,
) => {
  // legacy compatibility for nip04. nip44 should be used always when possible
  if (encryptionType === "nip04") {
    return nip04.encrypt(serverKeypair.privkey, appPubkey, content)
  }
  const key = nip44.getConversationKey(hexToBytes(serverKeypair.privkey), appPubkey)
  return nip44.encrypt(content, key)
}

export { hexToBytes, decrypt, encrypt }
