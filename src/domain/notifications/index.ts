// import { Nip47Notification } from "@/domain/nostr/index.types"
//
// export * from "./queue"
//
// export const parseCallbackMessage = (message: string): Nip47Notification | null => {
//   const parsedMessage = JSON.parse(message) as CallbackPayload
//
//   const { eventType, transaction } = parsedMessage
//   if (parsedMessage.eventType.endsWith("onchain")) {
//     return null // we don't care about the onchain txs. only Lightning and Intraledger (initiatedWithLn)
//   }
//   return {
//     notification_type: eventType.startsWith("send") ? "payment_sent" : "payment_received",
//     notification: {
//       type: eventType.startsWith("send") ? "outgoing" : "incoming",
//       state: transaction.status, // optional
//       invoice: "", // encoded invoice
//       description: transaction.memo, // invoice's description, optional
//       description_hash: "", // invoice's description hash, optional
//       preimage: "", // payment's preimage
//       payment_hash: "", // Payment hash for the payment
//       amount: 0, // value in msats
//       fees_paid: 0, // value in msats
//       created_at: 0, // invoice/payment creation time
//       expires_at: 0, // invoice expiration time, optional if not applicable
//       settled_at: 0, // invoice/payment settlement time
//     },
//   }
// }
