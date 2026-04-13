export const NwcNotificationType = {
  PaymentSent: "payment_sent",
  PaymentReceived: "payment_received",
} as const

export type NwcNotificationTypeValue =
  (typeof NwcNotificationType)[keyof typeof NwcNotificationType]

export type NwcNotificationPermissionType = `notifications:${NwcNotificationTypeValue}`

export const toNotificationPermission = (
  notificationType: NwcNotificationTypeValue,
): NwcNotificationPermissionType =>
  `notifications:${notificationType}` as NwcNotificationPermissionType

export const SUPPORTED_NWC_NOTIFICATION_PERMISSIONS: NwcNotificationPermissionType[] =
  Object.values(NwcNotificationType).map((notificationType) =>
    toNotificationPermission(notificationType),
  )

export const toNotificationTypeFromPermission = (
  permission: string,
): NwcNotificationTypeValue | undefined => {
  if (!permission.startsWith("notifications:")) {
    return undefined
  }

  const notificationType = permission.slice("notifications:".length)
  return Object.values(NwcNotificationType).find((value) => value === notificationType)
}
