import { NwcSubscriber } from "@/services"
import NwcEventHandler from "@/app/nwc-event-handler"


const nwc = NwcSubscriber()
console.log("starting nwc")

const stop = nwc.subscribe(NwcEventHandler().handle)

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, stopping...")
  await stop()
  process.exit(0)
})

process.on("SIGINT", async () => {
  console.log("Received SIGINT, stopping...")
  await stop()
  process.exit(0)
})
