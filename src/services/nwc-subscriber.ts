import WebSocket from "ws"

import { Event, EventTemplate, finalizeEvent, Relay, verifyEvent } from "nostr-tools"
import { Subscription } from "nostr-tools/lib/types/abstract-relay"

import {
  NOSTR_RELAY_URL,
  SUPPORTED_NWC_METHODS,
  SUPPORTED_NWC_NOTIFICATIONS,
} from "@/config"
import {
  getServerKeypair,
  hasPermission,
  isConnectionExpired,
  NwcConnection,
} from "@/domain/connection"
import { parseErrorFromUnknown } from "@/domain/errors"
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
  Nip47RestrictedError,
  Nip47UnsupportedEncryptionError,
  parseNip47Response,
} from "@/domain/nostr"
import { ConnectionsRepository, ProcessedNwcRequestsRepository } from "@/services/db"
import { baseLogger } from "@/services/logger"
import { sleep } from "@/domain/utils"

class RetryableEventProcessingError extends Error {
  originalError: Error

  constructor(message: string, error: unknown) {
    const originalError = parseErrorFromUnknown(error)
    super(`${message}: ${originalError.message}`)
    this.name = this.constructor.name
    this.originalError = originalError
  }
}

type GlobalWithWebSocket = typeof globalThis & {
  WebSocket?: typeof WebSocket
}

const ensureWebSocketGlobal = () => {
  const globalWithWebSocket = globalThis as GlobalWithWebSocket
  if (globalWithWebSocket.WebSocket === undefined) {
    globalWithWebSocket.WebSocket =
      WebSocket as unknown as GlobalWithWebSocket["WebSocket"]
  }
}

export const NwcSubscriber = () => {
  const logger = baseLogger.child({ module: "nwc-subscriber" })
  ensureWebSocketGlobal()
  const relay = new Relay(NOSTR_RELAY_URL)
  const serverKeypair = getServerKeypair()
  const connectionsRepository = ConnectionsRepository()
  const processedNwcRequestsRepository = ProcessedNwcRequestsRepository()
  const processedEventIds = new Map<string, number>()
  const inFlightEventIds = new Set<string>()

  const REQUEST_EVENT_TTL_MS = 10 * 60 * 1000
  const PROCESSED_EVENT_PRUNE_INTERVAL_MS = 60 * 1000
  let lastProcessedEventPruneAt = 0

  const pruneTrackedEventIds = () => {
    const now = Date.now()
    for (const [eventId, processedAt] of processedEventIds.entries()) {
      if (now - processedAt > REQUEST_EVENT_TTL_MS) {
        processedEventIds.delete(eventId)
      }
    }
  }

  const getProcessedEventExpiry = (expirationTimestamp?: number) => {
    const defaultExpiry = Date.now() + REQUEST_EVENT_TTL_MS
    const expirationMs =
      typeof expirationTimestamp === "number" ? expirationTimestamp * 1000 : 0

    return new Date(Math.max(defaultExpiry, expirationMs))
  }

  const pruneExpiredProcessedEvents = async () => {
    const now = Date.now()
    if (now - lastProcessedEventPruneAt < PROCESSED_EVENT_PRUNE_INTERVAL_MS) {
      return
    }

    lastProcessedEventPruneAt = now
    const result = await processedNwcRequestsRepository.pruneExpired()
    if (result instanceof Error) {
      logger.warn({ err: result }, "failed to prune expired processed NWC requests")
    }
  }

  const markEventProcessed = async (eventId: string, expirationTimestamp?: number) => {
    processedEventIds.set(eventId, Date.now())

    const result = await processedNwcRequestsRepository.markProcessed(
      eventId,
      getProcessedEventExpiry(expirationTimestamp),
    )
    if (result instanceof Error) {
      logger.warn({ err: result, eventId }, "failed to persist processed NWC request")
    }
  }

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
    let requestSince = Math.floor(Date.now() / 1000)

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
          sub = relay.subscribe(
            [
              {
                "kinds": [EventKind.Request],
                "#p": [serverKeypair.pubkey],
                "since": requestSince,
              },
            ],
            {},
          )
          logger.info("subscribed to relay")
          retries = 0

          sub.onevent = (event) => {
            if (typeof event.created_at === "number") {
              requestSince = Math.max(requestSince, event.created_at)
            }
            handleEvent(event, handle).catch((err) => {
              logger.error({ err, eventId: event.id }, "failed to handle event")
            })
          }

          await new Promise<void>((resolve) => {
            relay.onclose = () => {
              logger.warn("relay disconnected")
              resolve()
            }
          })

          relay.onclose = null
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
    const isRetryableEventProcessingError = (
      error: unknown,
    ): error is RetryableEventProcessingError =>
      error instanceof RetryableEventProcessingError

    const handleEvent = async (
      event: Event,
      handle: (
        request: { method: Nip47MethodType; params: unknown },
        connection: NwcConnection,
      ) => Promise<Nip47Result>,
      attempt = 0,
    ) => {
      try {
        await processEvent(event, handle)
      } catch (err) {
        if (isRetryableEventProcessingError(err) && attempt < MAX_EVENT_RETRIES) {
          logger.warn(
            {
              err: err.originalError,
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
          {
            err: err instanceof RetryableEventProcessingError ? err.originalError : err,
            eventId: event.id,
            attempts: attempt + 1,
            retryable: isRetryableEventProcessingError(err),
          },
          isRetryableEventProcessingError(err)
            ? "failed to process event after retries"
            : "failed to process event without retry",
        )
      }
    }

    const processEvent = async (
      event: Event,
      handle: (
        request: { method: Nip47MethodType; params: unknown },
        connection: NwcConnection,
      ) => Promise<Nip47Result>,
    ) => {
      pruneTrackedEventIds()
      await pruneExpiredProcessedEvents()

      if (!verifyEvent(event)) {
        logger.warn({ eventId: event.id }, "rejected event with invalid signature")
        return
      }

      if (processedEventIds.has(event.id) || inFlightEventIds.has(event.id)) {
        logger.info({ eventId: event.id }, "ignoring duplicate NWC request")
        return
      }

      inFlightEventIds.add(event.id)

      try {
        const wasProcessed = await processedNwcRequestsRepository.isProcessed(event.id)
        if (wasProcessed instanceof Error) {
          throw new RetryableEventProcessingError(
            "Failed to check processed NWC request state",
            wasProcessed,
          )
        }
        if (wasProcessed) {
          processedEventIds.set(event.id, Date.now())
          logger.info({ eventId: event.id }, "ignoring persistently tracked NWC request")
          return
        }

        const eventLogger = logger.child({
          eventId: event.id,
          appPubkey: event.pubkey,
        })

        const encryptionType = (event.tags.find(
          (t: string[]) => t[0] === "encryption",
        )?.[1] || "nip04") as string

        if (!isSupportedEncryptionType(encryptionType)) {
          eventLogger.warn({ encryptionType }, "unsupported request encryption type")
          await sendNwcResponse(
            event.id,
            event.pubkey as NwcAppPubkey,
            undefined,
            "nip04",
            parseNip47Response(
              new Nip47UnsupportedEncryptionError(
                `Unsupported encryption type: ${encryptionType}`,
              ),
            ),
          )
          await markEventProcessed(event.id)
          return
        }

        const expiration = event.tags.find((tag) => tag[0] === "expiration")?.[1]
        const expirationTimestamp =
          expiration !== undefined ? Number.parseInt(expiration, 10) : undefined
        if (
          typeof expirationTimestamp === "number" &&
          Number.isFinite(expirationTimestamp)
        ) {
          if (Math.floor(Date.now() / 1000) > expirationTimestamp) {
            eventLogger.info(
              { expiration: expirationTimestamp },
              "ignoring expired NWC request",
            )
            await markEventProcessed(event.id, expirationTimestamp)
            return
          }
        }

        let decryptedContent: string
        try {
          decryptedContent = decrypt(
            serverKeypair,
            event.pubkey as NwcAppPubkey,
            event.content,
            encryptionType as Nip47EncryptionType,
          )
        } catch (err) {
          eventLogger.error({ err }, "failed to decrypt event")
          await sendNwcResponse(
            event.id,
            event.pubkey as NwcAppPubkey,
            undefined,
            encryptionType as Nip47EncryptionType,
            parseNip47Response(new Nip47InternalError("Decryption failed")),
          )
          await markEventProcessed(event.id, expirationTimestamp)
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
            undefined,
            encryptionType as Nip47EncryptionType,
            parseNip47Response(new Nip47InternalError("Invalid request format")),
          )
          await markEventProcessed(event.id, expirationTimestamp)
          return
        }

        eventLogger.info({ method: request.method }, "processing NWC request")

        const userConnection = await connectionsRepository.findByPubkey(
          event.pubkey as NwcAppPubkey,
        )

        if (userConnection instanceof Error || userConnection.revoked) {
          eventLogger.warn("no active connection found for pubkey")
          await sendNwcResponse(
            event.id,
            event.pubkey as NwcAppPubkey,
            request.method,
            encryptionType as Nip47EncryptionType,
            parseNip47Response(
              new Nip47UnauthorizedError("No connection found with provided pubkey"),
            ),
          )
          await markEventProcessed(event.id, expirationTimestamp)
          return
        }

        if (isConnectionExpired(userConnection)) {
          eventLogger.warn({ connectionId: userConnection.id }, "connection has expired")
          await sendNwcResponse(
            event.id,
            event.pubkey as NwcAppPubkey,
            request.method,
            encryptionType as Nip47EncryptionType,
            parseNip47Response(new Nip47UnauthorizedError("Connection has expired")),
          )
          await markEventProcessed(event.id, expirationTimestamp)
          return
        }

        if (!hasPermission(request.method, userConnection)) {
          eventLogger.warn(
            { connectionId: userConnection.id, method: request.method },
            "connection is not permitted to use method",
          )
          await sendNwcResponse(
            event.id,
            event.pubkey as NwcAppPubkey,
            request.method,
            encryptionType as Nip47EncryptionType,
            parseNip47Response(
              new Nip47RestrictedError(
                "Connection does not have permission for this method",
              ),
            ),
          )
          await markEventProcessed(event.id, expirationTimestamp)
          return
        }

        connectionsRepository.updateLastUsed(userConnection.id).catch((err) => {
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
          encryptionType as Nip47EncryptionType,
          parseNip47Response(response),
        )
        await markEventProcessed(event.id, expirationTimestamp)
      } finally {
        inFlightEventIds.delete(event.id)
      }
    }

    const stop = async () => {
      logger.info("stopping subscriber")
      isRunning = false

      if (sub) {
        sub.close()
        sub = undefined
      }

      relay.close()
      logger.info("subscriber stopped")
    }

    run().catch((err) => {
      logger.error({ err }, "fatal error in subscriber run loop")
    })

    return stop
  }

  const checkConnected = async () => {
    try {
      if (!relay.connected) {
        await relay.connect()
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
      tags: [
        // NIP-47 advertises preferred-to-fallback encryption in this order.
        // We prefer nip44_v2 for new clients, but still accept nip04 requests
        // so older clients can interoperate with the same relay connection.
        ["encryption", "nip44_v2 nip04"],
        ["notifications", SUPPORTED_NWC_NOTIFICATIONS.join(" ")],
      ],
      content: [...SUPPORTED_NWC_METHODS, "notifications"].join(" "),
    }

    const infoEvent = finalizeEvent(infoEventTemplate, hexToBytes(serverKeypair.privkey))
    await relay.publish(infoEvent)
    logger.info("published info event to relay")
  }

  const sendNwcResponse = async (
    eventId: string,
    appPk: NwcAppPubkey,
    resultType: Nip47MethodType | undefined,
    encryptionType: Nip47EncryptionType,
    response: Nip47Response,
  ) => {
    const payload =
      resultType === undefined
        ? response
        : {
            result_type: resultType,
            ...response,
          }
    const encryptedContent = encrypt(
      serverKeypair,
      appPk,
      JSON.stringify(payload),
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
    try {
      await relay.publish(responseEvent)
    } catch (err) {
      throw new RetryableEventProcessingError("Failed to publish NWC response", err)
    }
  }

  const backoff = async (retries: number) => {
    const SECOND = 1000
    const MAX_BACKOFF_MS = SECOND * 60 * 5
    const delay = Math.min(SECOND * Math.pow(2, retries), MAX_BACKOFF_MS)
    const jitter = (Math.random() - 0.5) * delay * 0.2
    logger.info(
      { delaySec: Math.round((delay + jitter) / 1000), retry: retries },
      "backing off before retry",
    )
    await sleep(Math.round(delay + jitter))
  }

  return { subscribe }
}

const isSupportedEncryptionType = (
  encryptionType: string,
): encryptionType is Nip47EncryptionType => {
  return encryptionType === "nip04" || encryptionType === "nip44_v2"
}
