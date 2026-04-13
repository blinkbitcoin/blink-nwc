import {
  allowedMethods,
  enabledNotifications,
  ensureMethodPermission,
} from "@/app/permission-checker"
import { Nip47Method } from "@/domain/nostr"
import {
  NwcNotificationType,
  toNotificationPermission,
} from "@/domain/nostr/notification-type"

describe("permission-checker", () => {
  const connection = {
    permissions: [
      Nip47Method.GetInfo,
      Nip47Method.GetBalance,
      toNotificationPermission(NwcNotificationType.PaymentSent),
      toNotificationPermission(NwcNotificationType.PaymentSent),
    ],
  } as const

  it("returns only method permissions for allowed methods", () => {
    expect(allowedMethods(connection)).toEqual([
      Nip47Method.GetInfo,
      Nip47Method.GetBalance,
    ])
  })

  it("returns only granted notifications and de-duplicates them", () => {
    expect(enabledNotifications(connection)).toEqual([NwcNotificationType.PaymentSent])
  })

  it("returns a restricted error for disallowed methods", () => {
    const error = ensureMethodPermission(connection, Nip47Method.PayInvoice)

    expect(error).toBeInstanceOf(Error)
    expect(error?.code).toBe("RESTRICTED")
    expect(error?.message).toContain(Nip47Method.PayInvoice)
  })

  it("returns null for allowed methods", () => {
    expect(ensureMethodPermission(connection, Nip47Method.GetInfo)).toBeNull()
  })
})
