import { RepositoryError } from "@/domain/errors"
import type { NwcConnectionId, PaymentHash } from "@/domain/index.types"
import type { NwcNotificationTypeValue } from "@/domain/nostr/notification-type"
import { queryBuilder } from "@/services/db/query-builder"
import type { NwcAuditLogRecord } from "@/services/db/index.types"
import { parseRepositoryError } from "@/services/db/index"
import { wrapAsyncFunctionsToRunInSpan } from "@/services/tracing"

const TABLE_NAME = "nwc_audit_log"
const NOTIFICATION_PUBLISHED_ACTION = "notification_published"
const SUCCESS_STATUS = "success"
const NOTIFICATION_ONCE_INDEX = "idx_nwc_audit_log_notification_once"

type PublishedNotificationKey = {
  readonly connectionId: NwcConnectionId
  readonly userId: string | null
  readonly notificationType: NwcNotificationTypeValue
  readonly ledgerTransactionId: string
  readonly paymentHash: PaymentHash
}

export interface INotificationAuditRepository {
  hasPublishedNotification(
    key: Pick<
      PublishedNotificationKey,
      "connectionId" | "notificationType" | "ledgerTransactionId"
    >,
  ): Promise<boolean | RepositoryError>
  recordPublishedNotification(
    key: PublishedNotificationKey,
  ): Promise<void | RepositoryError>
}

export const NotificationAuditRepository = (): INotificationAuditRepository =>
  wrapAsyncFunctionsToRunInSpan({
    namespace: "services.db.notification-audit",
    fns: {
      hasPublishedNotification: async ({
        connectionId,
        notificationType,
        ledgerTransactionId,
      }: Pick<
        PublishedNotificationKey,
        "connectionId" | "notificationType" | "ledgerTransactionId"
      >): Promise<boolean | RepositoryError> => {
        try {
          const record = await queryBuilder<NwcAuditLogRecord>(TABLE_NAME)
            .where({
              connection_id: connectionId,
              action: NOTIFICATION_PUBLISHED_ACTION,
              method: notificationType,
              status: SUCCESS_STATUS,
            })
            .whereRaw("metadata->>'ledger_transaction_id' = ?", [ledgerTransactionId])
            .first("id")

          return Boolean(record)
        } catch (err) {
          return parseRepositoryError(err)
        }
      },

      recordPublishedNotification: async ({
        connectionId,
        userId,
        notificationType,
        ledgerTransactionId,
        paymentHash,
      }: PublishedNotificationKey): Promise<void | RepositoryError> => {
        try {
          await queryBuilder<NwcAuditLogRecord>(TABLE_NAME).insert({
            connection_id: connectionId,
            user_id: userId,
            action: NOTIFICATION_PUBLISHED_ACTION,
            method: notificationType,
            status: SUCCESS_STATUS,
            metadata: {
              connection_id: connectionId,
              ledger_transaction_id: ledgerTransactionId,
              notification_type: notificationType,
              payment_hash: paymentHash,
            },
            created_at: queryBuilder.fn.now(),
          })
        } catch (err) {
          return parseRepositoryError(err)
        }
      },
    },
  })

export { NOTIFICATION_ONCE_INDEX, NOTIFICATION_PUBLISHED_ACTION }
