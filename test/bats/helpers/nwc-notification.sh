#!/usr/bin/env bash
set -euo pipefail

node --input-type=module <<'EOF'
import WebSocket from "ws"
import { Relay, getPublicKey, nip44 } from "nostr-tools"

globalThis.WebSocket = WebSocket

const EVENT_KIND = {
  notification: 23197,
}

const timeoutMs = Number.parseInt(process.env.NWC_TIMEOUT_MS ?? "20000", 10)
const since = Number.parseInt(process.env.NWC_SINCE ?? "0", 10)
const expectedNotificationType = process.env.NWC_EXPECT_NOTIFICATION_TYPE
const expectedPaymentHash = process.env.NWC_EXPECT_PAYMENT_HASH

const requireEnv = (name) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`missing required environment variable: ${name}`)
  }
  return value
}

const hexToBytes = (hex) => {
  if (!hex || hex.length % 2 !== 0) {
    throw new Error("invalid hex string length")
  }

  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16)
  }
  return bytes
}

const getTagValue = (event, tagName) => {
  const tag = event.tags.find(([name]) => name === tagName)
  return tag?.[1]
}

const withTimeout = (promise, message) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs)
    promise
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })

const connectionUri = requireEnv("CONNECTION_URI")
const parsedUri = new URL(connectionUri)
const serverPubkey = parsedUri.host
const relayUrl = parsedUri.searchParams.get("relay")
const appSecret = parsedUri.searchParams.get("secret")

if (!relayUrl || !appSecret) {
  throw new Error("connection URI must include relay and secret parameters")
}

const appPubkey = getPublicKey(hexToBytes(appSecret))
const relay = new Relay(relayUrl)
const conversationKey = nip44.getConversationKey(hexToBytes(appSecret), serverPubkey)

const matchesExpectedNotification = (notification) => {
  if (expectedNotificationType && notification.notification_type !== expectedNotificationType) {
    return false
  }

  if (
    expectedPaymentHash &&
    notification?.notification?.payment_hash !== expectedPaymentHash
  ) {
    return false
  }

  return true
}

try {
  await relay.connect()

  const event = await withTimeout(
    new Promise((resolve) => {
      const sub = relay.subscribe(
        [
          {
            kinds: [EVENT_KIND.notification],
            "#p": [appPubkey],
            since,
          },
        ],
        {},
      )

      sub.onevent = (candidate) => {
        if (candidate.pubkey !== serverPubkey) {
          return
        }

        if (getTagValue(candidate, "p") !== appPubkey) {
          return
        }

        try {
          const decrypted = nip44.decrypt(candidate.content, conversationKey)
          const parsed = JSON.parse(decrypted)
          if (!matchesExpectedNotification(parsed)) {
            return
          }

          sub.close()
          resolve(parsed)
        } catch {
          // Ignore unrelated or malformed events while waiting for the expected notification.
        }
      }
    }),
    "timed out waiting for relay notification",
  )

  process.stdout.write(JSON.stringify(event))
} finally {
  relay.close()
}
EOF
