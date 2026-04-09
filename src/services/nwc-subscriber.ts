import WebSocket from "ws"
;(global as any).WebSocket = WebSocket

import { EventTemplate, finalizeEvent, Relay, verifyEvent } from "nostr-tools"
import { Subscription } from "nostr-tools/lib/types/abstract-relay"

import { NOSTR_RELAY_URL, SUPPORTED_NWC_METHODS } from "@/config"
import { getServerKeypair, NwcConnection } from "@/domain/connection"
import {
  Nip47EncryptionType,
  Nip47MethodType,
  Nip47Response,
  Nip47Result,
  NwcAppPubkey,
} from "@/domain/index.types"
import {
  decrypt,
  encrypt,
  EventKind,
  hexToBytes,
  Nip47UnauthorizedError,
  Nip47InternalError,
  parseNip47Response,
} from "@/domain/nostr"
import { ConnectionsRepository } from "@/services/db"
import { sleep } from "@/domain/utils"

export const NwcSubscriber = () => {
  const r = new Relay(NOSTR_RELAY_URL)
  const serverKeypair = getServerKeypair()

  const subscribe = (
    handle: (
      request: {
        method: Nip47MethodType
        params: unknown
      },
      connection: NwcConnection,
    ) => Promise<Nip47Result>,
  ) => {
    let isRunning = true
    let sub: Subscription | undefined
    let retries = 0

    const run = async () => {
      while (isRunning) {
        try {
          if (sub) {
            sub.close()
            sub = undefined
          }
          console.info("checking connection to relay")
          await checkConnected()

          console.info("publishing info event")
          await publishInfoEvent()

          console.info("subscribing to relay")
          sub = r.subscribe(
            [
              {
                "kinds": [EventKind.Request],
                "#p": [serverKeypair.pubkey],
              },
            ],
            {},
          )
          console.info("subscribed to relay")
          retries = 0

          // handle
          sub.onevent = (event) => {
            // process event asynchronously, catch errors (nothing should be thrown anyway)
            handleEvent(event, handle).catch((e) => {
              console.error("Failed to handle event", event.id, e)
            })
          }

          // wait for disconnection or manual stop
          await new Promise<void>((resolve) => {
            r.onclose = () => {
              console.error("relay disconnected")
              resolve()
            }
          })

          // clear the handler
          r.onclose = null
        } catch (error) {
          console.error("error subscribing to requests", error || "unknown relay error")
        }

        // backoff before retry
        if (isRunning) {
          await backoff(retries++)
        }
      }

      // cleanup on exit
      console.info("subscriber loop ended, cleaning up")
      if (sub) {
        sub.close()
      }
    }

    const MAX_EVENT_RETRIES = 2

    const handleEvent = async (
      event: any,
      handle: (
        request: { method: Nip47MethodType; params: unknown },
        connection: NwcConnection,
      ) => Promise<Nip47Result>,
      attempt = 0,
    ) => {
      try {
        await processEvent(event, handle)
      } catch (err) {
        if (attempt < MAX_EVENT_RETRIES) {
          console.warn(
            `Transient error processing event ${event.id}, retrying (${attempt + 1}/${MAX_EVENT_RETRIES})`,
            err,
          )
          await sleep(Math.min(1000 * Math.pow(2, attempt), 5000))
          return handleEvent(event, handle, attempt + 1)
        }
        console.error(
          `Failed to process event ${event.id} after ${MAX_EVENT_RETRIES} retries`,
          err,
        )
      }
    }

    const processEvent = async (
      event: any,
      handle: (
        request: { method: Nip47MethodType; params: unknown },
        connection: NwcConnection,
      ) => Promise<Nip47Result>,
    ) => {
      // Verify event signature before processing
      if (!verifyEvent(event)) {
        console.warn("Rejected event with invalid signature", event.id)
        return
      }

      const encryptionType = (event.tags.find(
        (t: string[]) => t[0] === "encryption",
      )?.[1] || "nip04") as Nip47EncryptionType

      let decryptedContent: string
      try {
        decryptedContent = await decrypt(
          serverKeypair,
          event.pubkey as NwcAppPubkey,
          event.content,
          encryptionType,
        )
      } catch (err) {
        console.error("Failed to decrypt event", event.id, err)
        await sendNwcResponse(
          event.id,
          event.pubkey as NwcAppPubkey,
          "unknown" as Nip47MethodType,
          encryptionType,
          parseNip47Response(new Nip47InternalError("Decryption failed")),
        )
        return
      }

      let request: { method: Nip47MethodType; params: unknown }
      try {
        request = JSON.parse(decryptedContent)
      } catch (err) {
        console.error("Failed to parse decrypted content", event.id, err)
        await sendNwcResponse(
          event.id,
          event.pubkey as NwcAppPubkey,
          "unknown" as Nip47MethodType,
          encryptionType,
          parseNip47Response(new Nip47InternalError("Invalid request format")),
        )
        return
      }

      const userConnection = await ConnectionsRepository().findByPubkey(
        event.pubkey as NwcAppPubkey,
      )

      if (userConnection instanceof Error || userConnection.revoked) {
        await sendNwcResponse(
          event.id,
          event.pubkey as NwcAppPubkey,
          request.method,
          encryptionType,
          parseNip47Response(
            new Nip47UnauthorizedError("No connection found with provided pubkey"),
          ),
        )
        return
      }

      // Check if connection has expired
      if (userConnection.expiresAt && userConnection.expiresAt <= new Date()) {
        await sendNwcResponse(
          event.id,
          event.pubkey as NwcAppPubkey,
          request.method,
          encryptionType,
          parseNip47Response(new Nip47UnauthorizedError("Connection has expired")),
        )
        return
      }

      // Update last_used_at (fire-and-forget, don't block the response)
      ConnectionsRepository()
        .updateLastUsed(userConnection.id)
        .catch((err) => {
          console.error("Failed to update last_used_at", err)
        })

      const response = await handle(request, userConnection)
      await sendNwcResponse(
        event.id,
        event.pubkey as NwcAppPubkey,
        request.method,
        encryptionType,
        parseNip47Response(response),
      )
    }

    const stop = async () => {
      console.info("stopping subscriber")
      isRunning = false

      if (sub) {
        sub.close()
        sub = undefined
      }

      // close relay connection
      r.close()

      console.info("subscriber stopped")
    }

    run().catch((e) => {
      console.error("Fatal error in subscriber run loop:", e)
    })

    return stop
  }

  const checkConnected = async () => {
    try {
      if (!r.connected) {
        await r.connect()
      }
    } catch (error) {
      console.error("failed to connect to relay", NOSTR_RELAY_URL, error)
      throw error
    }
  }

  const publishInfoEvent = async () => {
    const infoEventTemplate: EventTemplate = {
      kind: EventKind.InfoEvent,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["encryption", "nip44_v2 nip04"]],
      content: SUPPORTED_NWC_METHODS.join(" "),
    }

    const infoEvent = finalizeEvent(infoEventTemplate, hexToBytes(serverKeypair.privkey))
    await r.publish(infoEvent)
    console.info("Published info event to relay")
  }

  const sendNwcResponse = async (
    eventId: string,
    appPk: NwcAppPubkey,
    resultType: Nip47MethodType,
    encryptionType: Nip47EncryptionType,
    response: Nip47Response,
  ) => {
    const encryptedContent = encrypt(
      serverKeypair,
      appPk,
      JSON.stringify({
        result_type: resultType,
        ...response,
      }),
      encryptionType,
    )

    const responseEventTemplate: EventTemplate = {
      kind: EventKind.Response,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["e", eventId],
        ["p", appPk],
      ],
      content: encryptedContent,
    }

    const responseEvent = finalizeEvent(
      responseEventTemplate,
      hexToBytes(serverKeypair.privkey),
    )
    await r.publish(responseEvent)
  }

  // exponential backoff with ceiling. will reconnect every few minutes
  const backoff = async (retries: number) => {
    const SECOND = 1000
    const MAX_BACKOFF_MS = SECOND * 60 * 5
    const delay = Math.min(SECOND * Math.pow(2, retries), MAX_BACKOFF_MS)

    const jitter = Math.random() * delay * 0.1
    console.info(
      `Backing off for ${Math.round((delay + jitter) / 1000)}s (retry ${retries})`,
    )
    await sleep(Math.round(delay + jitter))
  }

  return { subscribe }
}
