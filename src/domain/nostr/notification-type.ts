export const NwcNotificationType = {
  PaymentSent: "payment_sent",
  PaymentReceived: "payment_received",
} as const

export type NwcNotificationTypeValue =
  (typeof NwcNotificationType)[keyof typeof NwcNotificationType]
