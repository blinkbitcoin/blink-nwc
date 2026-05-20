import WebSocket from "ws"
Object.assign(globalThis, { WebSocket })

import { EventTemplate, Relay, finalizeEvent } from "nostr-tools"

import { getServerKeypair } from "@/domain/connection"
import { PaymentState } from "@/domain/core/payment-state"
import {
  CoreServiceTx,
  Nip47Notification,
  NwcAppPubkey,
  NwcConnectionId,
  PaymentDirection,
  PaymentHash,
  Satoshis,
  WalletId,
} from "@/domain/index.types"
import { encrypt, hexToBytes } from "@/domain/nostr"
import {
  NwcNotificationType,
  type NwcNotificationTypeValue,
  toNotificationPermission,
} from "@/domain/nostr/notification-type"
import { toMilliSatoshis, toUnixSeconds } from "@/domain/units"
import {
  parseErrorFromUnknown,
  RepositoryError,
  UniqueConstraintViolationError,
} from "@/domain/errors"
import { BlinkCoreService } from "@/services/core"
import { BlinkServiceError } from "@/services/core/errors"
import {
  TransactionEvent,
  TransactionType,
} from "@/services/core/grpc/proto/transactions_pb"
import {
  ConnectionsRepository,
  NOTIFICATION_ONCE_INDEX,
  NotificationAuditRepository,
  type INotificationAuditRepository,
} from "@/services/db"
import { baseLogger } from "@/services/logger"
import { type NwcMonitoringServiceLike } from "@/services/nwc-monitoring"
import { recordExceptionInCurrentSpan } from "@/services/tracing"
import { NOSTR_RELAY_URL } from "@/config"

export const NotificationService = (relay: Relay) => {
  const serverKeypair = getServerKeypair()

  const sendNotification = async (
    notification: Nip47Notification,
    appPubkey: NwcAppPubkey,
  ): Promise<boolean> => {
    try {
      // todo add legacy nip04 support
      const notificationEventTemplate: EventTemplate = {
        kind: 23197,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["p", appPubkey]],
        content: encrypt(
          serverKeypair,
          appPubkey,
          JSON.stringify(notification),
          "nip44_v2",
        ),
      }

      const notificationEvent = finalizeEvent(
        notificationEventTemplate,
        hexToBytes(serverKeypair.privkey),
      )

      await relay.publish(notificationEvent)
      return true
    } catch (error) {
      recordExceptionInCurrentSpan({
        error: parseErrorFromUnknown(error),
      })
      return false
    }
  }

  return { sendNotification }
}

type NotificationContext = {
  readonly direction: PaymentDirection
  readonly notificationType: NwcNotificationTypeValue
}

type NotificationServiceLike = ReturnType<typeof NotificationService>

type NwcNotificationPublisherConfig = {
  relay?: Relay
  notificationService?: NotificationServiceLike
  connectionsRepository?: ReturnType<typeof ConnectionsRepository>
  notificationAuditRepository?: INotificationAuditRepository
  coreService?: ReturnType<typeof BlinkCoreService>
  logger?: Logger
  monitoring?: NwcMonitoringServiceLike
  enrichmentTimeoutMs?: number
}

const isMeaningfulString = (value: string | undefined): value is string =>
  typeof value === "string" && value.length > 0

const notificationContextFromEvent = (
  event: TransactionEvent,
): NotificationContext | undefined => {
  switch (event.getType()) {
    case TransactionType.RECEIVED:
      return {
        direction: "incoming" as PaymentDirection,
        notificationType: NwcNotificationType.PaymentReceived,
      }
    case TransactionType.SENT:
      return {
        direction: "outgoing" as PaymentDirection,
        notificationType: NwcNotificationType.PaymentSent,
      }
    default:
      return undefined
  }
}

const buildNotificationFromTransactionEvent = (
  event: TransactionEvent,
  enrichedTx?: CoreServiceTx,
): Nip47Notification | undefined => {
  const context = notificationContextFromEvent(event)
  if (!context) {
    return undefined
  }

  const paymentHash = event.getPaymentHash()
  if (!paymentHash) {
    return undefined
  }

  const settledAt =
    toUnixSeconds(event.getTimestamp()) ?? toUnixSeconds(Date.now() / 1000)
  if (!settledAt) {
    return undefined
  }

  const amount = toMilliSatoshis(
    Math.abs(enrichedTx?.amount ?? event.getSatsAmount()) as Satoshis,
  )
  const feesPaid = toMilliSatoshis((enrichedTx?.feesPaid ?? 0) as Satoshis)
  const createdAt = enrichedTx?.createdAt ?? settledAt
  const preimage = enrichedTx?.preimage

  const notification = {
    type: context.direction,
    state: PaymentState.PAID,
    payment_hash: paymentHash as PaymentHash,
    amount,
    fees_paid: feesPaid,
    created_at: createdAt,
    settled_at: enrichedTx?.settledAt ?? settledAt,
    ...(isMeaningfulString(enrichedTx?.invoice) ? { invoice: enrichedTx.invoice } : {}),
    ...(isMeaningfulString(enrichedTx?.description)
      ? { description: enrichedTx.description }
      : {}),
    ...(isMeaningfulString(enrichedTx?.descriptionHash)
      ? { description_hash: enrichedTx.descriptionHash }
      : {}),
    ...(isMeaningfulString(preimage) ? { preimage } : {}),
    ...(enrichedTx?.expiresAt ? { expires_at: enrichedTx.expiresAt } : {}),
  }

  return {
    notification_type: context.notificationType,
    notification,
  } as Nip47Notification
}

export const NwcNotificationPublisher = ({
  relay = new Relay(NOSTR_RELAY_URL),
  notificationService = NotificationService(relay),
  connectionsRepository = ConnectionsRepository(),
  notificationAuditRepository = NotificationAuditRepository(),
  coreService = BlinkCoreService(),
  logger = baseLogger.child({ module: "nwc-notification-publisher" }),
  monitoring,
  enrichmentTimeoutMs = 200,
}: NwcNotificationPublisherConfig = {}) => {
  const ensureRelayConnected = async () => {
    if (!relay.connected) {
      await relay.connect()
    }
  }

  const stop = async () => {
    relay.close()
  }

  const lookupInvoiceWithTimeout = async (
    apiKey: Parameters<typeof coreService.lookupInvoice>[0],
    walletId: WalletId,
    paymentHash: PaymentHash,
  ) => {
    let timer: NodeJS.Timeout | undefined

    try {
      return await Promise.race([
        coreService.lookupInvoice(apiKey, walletId, paymentHash),
        new Promise<BlinkServiceError>((resolve) => {
          timer = setTimeout(
            () => resolve(new BlinkServiceError("invoice enrichment timed out")),
            enrichmentTimeoutMs,
          )
        }),
      ])
    } finally {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }

  const publishTransactionEvent = async (event: TransactionEvent): Promise<void> => {
    if (event.getPending()) {
      logger.info(
        { ledgerTransactionId: event.getLedgerTransactionId() },
        "ignoring pending transaction event",
      )
      return
    }

    const ledgerTransactionId = event.getLedgerTransactionId()
    if (!ledgerTransactionId) {
      throw new Error("Missing ledger transaction id in transaction event")
    }

    if (event.getCurrency() !== "BTC") {
      logger.info(
        {
          ledgerTransactionId: event.getLedgerTransactionId(),
          currency: event.getCurrency(),
        },
        "ignoring non-BTC transaction event",
      )
      return
    }

    const context = notificationContextFromEvent(event)
    if (!context) {
      logger.info(
        {
          ledgerTransactionId: event.getLedgerTransactionId(),
          type: event.getType(),
        },
        "ignoring transaction event with unsupported type",
      )
      return
    }

    if (!event.getPaymentHash()) {
      logger.info(
        {
          ledgerTransactionId: event.getLedgerTransactionId(),
          walletId: event.getWalletId(),
        },
        "ignoring transaction event without payment hash",
      )
      return
    }

    const connections = await connectionsRepository.findByWalletIdWithNotificationPerm(
      event.getWalletId() as WalletId,
      toNotificationPermission(context.notificationType),
    )

    if (connections instanceof RepositoryError) {
      throw connections
    }

    if (connections.length === 0) {
      return
    }

    const [primaryConnection] = connections
    let enrichedTx: CoreServiceTx | undefined

    const lookupResult = await lookupInvoiceWithTimeout(
      primaryConnection.apiKey,
      primaryConnection.walletId,
      event.getPaymentHash() as PaymentHash,
    )

    if (!(lookupResult instanceof BlinkServiceError)) {
      enrichedTx = lookupResult
    } else {
      logger.warn(
        {
          err: lookupResult,
          ledgerTransactionId: event.getLedgerTransactionId(),
          paymentHash: event.getPaymentHash(),
        },
        "failed to enrich transaction event from Blink Core, falling back to stream data",
      )
    }

    const notification = buildNotificationFromTransactionEvent(event, enrichedTx)
    if (!notification) {
      logger.info(
        {
          ledgerTransactionId: event.getLedgerTransactionId(),
          paymentHash: event.getPaymentHash(),
        },
        "ignoring transaction event that could not be mapped to an NWC notification",
      )
      return
    }

    const getPublishTarget = async (connection: (typeof connections)[number]) => {
      const auditKey = {
        connectionId: connection.id as NwcConnectionId,
        notificationType: notification.notification_type,
        ledgerTransactionId,
      }
      const alreadyPublished =
        await notificationAuditRepository.hasPublishedNotification(auditKey)

      if (alreadyPublished instanceof RepositoryError) {
        throw alreadyPublished
      }

      if (alreadyPublished) {
        return { status: "skipped" as const }
      }

      return { status: "pending" as const, connection, auditKey }
    }

    const auditResults = await Promise.allSettled(connections.map(getPublishTarget))
    const auditFailures = auditResults.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    )

    if (auditFailures.length > 0) {
      if (auditFailures.length === 1) {
        throw auditFailures[0].reason
      }

      throw new AggregateError(
        auditFailures.map((failure) => failure.reason),
        `Failed to check notification audit for ${auditFailures.length} connection(s)`,
      )
    }

    const skippedCount = auditResults.filter(
      (result) => result.status === "fulfilled" && result.value.status === "skipped",
    ).length
    const publishTargets = auditResults.flatMap((result) => {
      if (result.status === "fulfilled" && result.value.status === "pending") {
        return [result.value]
      }

      return []
    })

    if (publishTargets.length > 0) {
      try {
        await ensureRelayConnected()
      } catch (error) {
        monitoring?.recordNotificationPublishError(notification.notification_type)
        throw error
      }
    }

    const publishForConnection = async ({
      connection,
      auditKey,
    }: (typeof publishTargets)[number]): Promise<"published"> => {
      const startedAt = Date.now()
      let published = false

      try {
        published = await notificationService.sendNotification(
          notification,
          connection.appPubkey,
        )
      } catch (error) {
        monitoring?.recordNotificationPublishError(notification.notification_type)
        throw error
      } finally {
        monitoring?.recordNotificationPublishDuration(
          notification.notification_type,
          Date.now() - startedAt,
        )
      }

      if (!published) {
        monitoring?.recordNotificationPublishError(notification.notification_type)
        throw new Error(
          `Failed to publish ${notification.notification_type} for connection ${connection.id}`,
        )
      }

      const auditResult = await notificationAuditRepository.recordPublishedNotification({
        ...auditKey,
        userId: connection.userId ?? null,
        paymentHash: event.getPaymentHash() as PaymentHash,
      })

      if (auditResult instanceof RepositoryError) {
        if (
          auditResult instanceof UniqueConstraintViolationError &&
          auditResult.message === NOTIFICATION_ONCE_INDEX
        ) {
          logger.info(
            {
              connectionId: connection.id,
              ledgerTransactionId,
              notificationType: notification.notification_type,
            },
            "notification publish audit already exists after successful publish",
          )
          monitoring?.recordNotificationPublished(notification.notification_type)
          return "published"
        }

        monitoring?.recordNotificationPublishError(notification.notification_type)
        throw auditResult
      }

      monitoring?.recordNotificationPublished(notification.notification_type)

      return "published"
    }

    const publishResults = await Promise.allSettled(
      publishTargets.map(publishForConnection),
    )
    const failures = publishResults.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    )

    if (failures.length > 0) {
      if (failures.length === 1) {
        throw failures[0].reason
      }

      throw new AggregateError(
        failures.map((failure) => failure.reason),
        `Failed to publish ${notification.notification_type} for ${failures.length} connection(s)`,
      )
    }

    const publishedCount = publishResults.filter(
      (result) => result.status === "fulfilled" && result.value === "published",
    ).length
    logger.info(
      {
        ledgerTransactionId: event.getLedgerTransactionId(),
        notificationType: notification.notification_type,
        walletId: event.getWalletId(),
        count: connections.length,
        publishedCount,
        skippedCount,
      },
      "published transaction notifications",
    )
  }

  return {
    publishTransactionEvent,
    stop,
  }
}

export { buildNotificationFromTransactionEvent }
