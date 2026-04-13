import NwcEventHandler from "@/app/nwc-event-handler"
import { NwcSubscriber } from "@/services"
import { baseLogger } from "@/services/logger"

const logger = baseLogger.child({ module: "nostr" })

const nwc = NwcSubscriber()
logger.info("starting nwc subscriber")

const stop = nwc.subscribe(NwcEventHandler().handle)

process.on("SIGTERM", async () => {
  logger.info("received SIGTERM, stopping")
  await stop()
  process.exit(0)
})

process.on("SIGINT", async () => {
  logger.info("received SIGINT, stopping")
  await stop()
  process.exit(0)
})
