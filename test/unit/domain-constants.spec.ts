import { ScopesOauth2 } from "@/domain/core/scopes"
import {
  NwcNotificationType,
  NwcNotificationTypeValue,
} from "@/domain/nostr/notification-type"

describe("domain constants", () => {
  it("exposes the supported oauth scopes", () => {
    expect(ScopesOauth2).toEqual({
      Read: "read",
      Write: "write",
      Receive: "receive",
    })
  })

  it("exposes the supported NWC notification types", () => {
    const values: NwcNotificationTypeValue[] = [
      NwcNotificationType.PaymentSent,
      NwcNotificationType.PaymentReceived,
    ]

    expect(values).toEqual(["payment_sent", "payment_received"])
  })
})
