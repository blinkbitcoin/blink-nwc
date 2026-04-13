#!/usr/bin/env bash
set -euo pipefail

node --input-type=module <<'EOF'
import WebSocket from "ws"
import { Relay, finalizeEvent, getPublicKey, nip04 } from "nostr-tools"

globalThis.WebSocket = WebSocket

const EVENT_KIND = {
  request: 23194,
  response: 23195,
}

const timeoutMs = Number.parseInt(process.env.NWC_TIMEOUT_MS ?? "10000", 10)

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

const waitForEvent = async ({ relay, filters, matches }) =>
  withTimeout(
    new Promise((resolve) => {
      const sub = relay.subscribe(filters, {})

      sub.onevent = (event) => {
        if (!matches || matches(event)) {
          sub.close()
          resolve(event)
        }
      }
    }),
    "timed out waiting for relay event",
  )

const connectionUri = requireEnv("CONNECTION_URI")
const requestJson = requireEnv("NWC_REQUEST_JSON")

const parsedUri = new URL(connectionUri)
const serverPubkey = parsedUri.host
const relayUrl = parsedUri.searchParams.get("relay")
const appSecret = parsedUri.searchParams.get("secret")

if (!relayUrl || !appSecret) {
  throw new Error("connection URI must include relay and secret parameters")
}

const requestContent = JSON.parse(requestJson)
const appPubkey = getPublicKey(hexToBytes(appSecret))
const relay = new Relay(relayUrl)

try {
  await relay.connect()

  const encryptedRequest = await nip04.encrypt(
    appSecret,
    serverPubkey,
    JSON.stringify(requestContent),
  )

  const requestEvent = finalizeEvent(
    {
      kind: EVENT_KIND.request,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["p", serverPubkey],
        ["encryption", "nip04"],
      ],
      content: encryptedRequest,
    },
    hexToBytes(appSecret),
  )

  const responseEventPromise = waitForEvent({
    relay,
    filters: [
      {
        kinds: [EVENT_KIND.response],
        "#e": [requestEvent.id],
        "#p": [appPubkey],
        limit: 1,
      },
    ],
    matches: (event) =>
      event.pubkey === serverPubkey &&
      getTagValue(event, "e") === requestEvent.id &&
      getTagValue(event, "p") === appPubkey,
  })

  await relay.publish(requestEvent)
  const responseEvent = await responseEventPromise
  const decryptedResponse = await nip04.decrypt(
    appSecret,
    serverPubkey,
    responseEvent.content,
  )

  process.stdout.write(decryptedResponse)
} finally {
  relay.close()
}
EOF
