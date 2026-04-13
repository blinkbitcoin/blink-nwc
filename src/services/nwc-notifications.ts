import { EventTemplate, Relay, finalizeEvent } from "nostr-tools"

import { getServerKeypair } from "@/domain/connection"
import { Nip47Notification, NwcAppPubkey } from "@/domain/index.types"
import { encrypt, hexToBytes } from "@/domain/nostr"
import { recordExceptionInCurrentSpan } from "@/services/tracing"
import { parseErrorFromUnknown } from "@/domain/errors"

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
