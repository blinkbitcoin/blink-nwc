import { nip04, nip44 } from "nostr-tools"

import { ServerNostrKeypair, NwcAppPubkey, Nip47EncryptionType } from "./index.types"

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
const decrypt = async (
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
  if (encryptionType === "nip04") {
    return nip04.encrypt(serverKeypair.privkey, appPubkey, content)
  }
  const key = nip44.getConversationKey(hexToBytes(serverKeypair.privkey), appPubkey)
  return nip44.encrypt(content, key)
}

export { hexToBytes, decrypt, encrypt }
