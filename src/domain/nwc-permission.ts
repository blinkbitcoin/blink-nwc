import { Nip47MethodType, NwcPermissionType } from "@/domain/nostr/index.types"
import { Nip47Method } from "@/domain/nostr/nip47-method"
import {
  NwcNotificationType,
  NwcNotificationTypeValue,
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

export const hasMethodPermission = (
  permissions: readonly NwcPermissionType[],
  method: Nip47MethodType,
): boolean => permissions.includes(method)

export const grantedMethodPermissions = (
  permissions: readonly NwcPermissionType[],
): Nip47MethodType[] =>
  [...new Set(permissions)].filter((permission): permission is Nip47MethodType =>
    Object.values(Nip47Method).includes(permission as Nip47MethodType),
  )

export const grantedNotificationTypes = (
  permissions: readonly NwcPermissionType[],
): NwcNotificationTypeValue[] =>
  [...new Set(permissions)]
    .map((permission) => toNotificationTypeFromPermission(permission))
    .filter(
      (notificationType): notificationType is NwcNotificationTypeValue =>
        notificationType !== undefined,
    )
