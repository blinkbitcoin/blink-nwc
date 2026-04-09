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
import { baseLogger } from "@/services/logger"
import { sleep } from "@/domain/utils"

export const NwcSubscriber = () => {
  const logger = baseLogger.child({ module: "nwc-subscriber" })
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
          logger.info("checking connection to relay")
          await checkConnected()

          logger.info("publishing info event")
          await publishInfoEvent()

          logger.info("subscribing to relay")
          sub = r.subscribe(
            [
              {
                "kinds": [EventKind.Request],
                "#p": [serverKeypair.pubkey],
              },
            ],
            {},
          )
          logger.info("subscribed to relay")
          retries = 0

          sub.onevent = (event) => {
            handleEvent(event, handle).catch((err) => {
              logger.error({ err, eventId: event.id }, "failed to handle event")
            })
          }

          await new Promise<void>((resolve) => {
            r.onclose = () => {
              logger.warn("relay disconnected")
              resolve()
            }
          })

          r.onclose = null
        } catch (err) {
          logger.error({ err }, "error subscribing to requests")
        }

        if (isRunning) {
          await backoff(retries++)
        }
      }

      logger.info("subscriber loop ended, cleaning up")
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
          logger.warn(
            {
              err,
              eventId: event.id,
              attempt: attempt + 1,
              maxRetries: MAX_EVENT_RETRIES,
            },
            "transient error processing event, retrying",
          )
          await sleep(Math.min(1000 * Math.pow(2, attempt), 5000))
          return handleEvent(event, handle, attempt + 1)
        }
        logger.error(
          { err, eventId: event.id, attempts: MAX_EVENT_RETRIES },
          "failed to process event after retries",
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
      if (!verifyEvent(event)) {
        logger.warn({ eventId: event.id }, "rejected event with invalid signature")
        return
      }

      const eventLogger = logger.child({
        eventId: event.id,
        appPubkey: event.pubkey,
      })

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
        eventLogger.error({ err }, "failed to decrypt event")
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
        eventLogger.error({ err }, "failed to parse decrypted content")
        await sendNwcResponse(
          event.id,
          event.pubkey as NwcAppPubkey,
          "unknown" as Nip47MethodType,
          encryptionType,
          parseNip47Response(new Nip47InternalError("Invalid request format")),
        )
        return
      }

      eventLogger.info({ method: request.method }, "processing NWC request")

      const userConnection = await ConnectionsRepository().findByPubkey(
        event.pubkey as NwcAppPubkey,
      )

      if (userConnection instanceof Error || userConnection.revoked) {
        eventLogger.warn("no active connection found for pubkey")
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

      if (userConnection.expiresAt && userConnection.expiresAt <= new Date()) {
        eventLogger.warn({ connectionId: userConnection.id }, "connection has expired")
        await sendNwcResponse(
          event.id,
          event.pubkey as NwcAppPubkey,
          request.method,
          encryptionType,
          parseNip47Response(new Nip47UnauthorizedError("Connection has expired")),
        )
        return
      }

      ConnectionsRepository()
        .updateLastUsed(userConnection.id)
        .catch((err) => {
          eventLogger.error(
            { err, connectionId: userConnection.id },
            "failed to update last_used_at",
          )
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
      logger.info("stopping subscriber")
      isRunning = false

      if (sub) {
        sub.close()
        sub = undefined
      }

      r.close()
      logger.info("subscriber stopped")
    }

    run().catch((err) => {
      logger.error({ err }, "fatal error in subscriber run loop")
    })

    return stop
  }

  const checkConnected = async () => {
    try {
      if (!r.connected) {
        await r.connect()
      }
    } catch (err) {
      logger.error({ err, relayUrl: NOSTR_RELAY_URL }, "failed to connect to relay")
      throw err
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
    logger.info("published info event to relay")
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

  const backoff = async (retries: number) => {
    const SECOND = 1000
    const MAX_BACKOFF_MS = SECOND * 60 * 5
    const delay = Math.min(SECOND * Math.pow(2, retries), MAX_BACKOFF_MS)
    const jitter = Math.random() * delay * 0.1
    logger.info(
      { delaySec: Math.round((delay + jitter) / 1000), retry: retries },
      "backing off before retry",
    )
    await sleep(Math.round(delay + jitter))
  }

  return { subscribe }
}
