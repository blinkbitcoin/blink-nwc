import { NwcPermissionType } from "@/domain/nostr/index.types"
import { Nip47Method } from "@/domain/nostr/nip47-method"
import {
  NwcNotificationType,
  toNotificationPermission,
  toNotificationTypeFromPermission,
} from "@/domain/nostr/notification-type"

export const GraphqlNwcPermission = {
  GET_INFO: Nip47Method.GetInfo,
  GET_BALANCE: Nip47Method.GetBalance,
  MAKE_INVOICE: Nip47Method.MakeInvoice,
  PAY_INVOICE: Nip47Method.PayInvoice,
  LOOKUP_INVOICE: Nip47Method.LookupInvoice,
  LIST_TRANSACTIONS: Nip47Method.ListTransactions,
  NOTIFICATIONS_PAYMENT_SENT: toNotificationPermission(NwcNotificationType.PaymentSent),
  NOTIFICATIONS_PAYMENT_RECEIVED: toNotificationPermission(
    NwcNotificationType.PaymentReceived,
  ),
} as const

export const hasNotificationPermission = (
  permissions: readonly NwcPermissionType[],
): boolean =>
  permissions.some(
    (permission) => toNotificationTypeFromPermission(permission) !== undefined,
  )
