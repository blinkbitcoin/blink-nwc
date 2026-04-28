import {
  NwcNotificationType,
  NwcNotificationTypeValue,
} from "@/domain/nostr/notification-type"

describe("NwcNotificationType", () => {
  it("exposes the supported NWC notification types", () => {
    const values: NwcNotificationTypeValue[] = [
      NwcNotificationType.PaymentSent,
      NwcNotificationType.PaymentReceived,
    ]

    expect(values).toEqual(["payment_sent", "payment_received"])
  })
})
