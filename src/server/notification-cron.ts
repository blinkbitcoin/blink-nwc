// import { CronJob } from "cron"
//
// import express, { Router } from "express"
//
// import { Relay } from "nostr-tools"
//
// import { NotificationQueue } from "@/domain/notifications"
// import { NotificationService } from "@/services"
// import { NOSTR_RELAY_URL } from "@/config"
//
// const r = new Relay(NOSTR_RELAY_URL)
// const queue = NotificationQueue()
// const notificationService = NotificationService(r)
//
// const job = new CronJob(
//   "*/30 * * * * *", // 30s - todo: verify
//   async () => {
//     const batch = queue.dequeueAll()
//     if (batch.length === 0) return
//
//     console.info(`[Cron] Processing ${batch.length} notifications`)
//
//     for (const item of batch) {
//       try {
//         await notificationService.sendNotification(item.notification, item.appPubkey)
//       } catch (error) {
//         console.error(`[Cron] Failed to send, re-queuing:`, error)
//         queue.requeue(item)
//       }
//     }
//   },
//   null,
//   false, // no autostart
// )
//
// const router = Router()
// router.post("/", express.json(), (req, res) => {
//   res.status(200).send("OK")
// })
//
// export { router, queue }
