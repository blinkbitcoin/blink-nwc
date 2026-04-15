import { NwcSubscriber } from "@/services"
import { Nip47InternalError } from "@/domain/nostr"
import { baseLogger } from "@/services/logger"

const logger = baseLogger.child({ module: "nostr" })

const nwc = NwcSubscriber()
logger.info("starting nwc subscriber")

// Event handler will be wired in E2 (NIP-47 Method Implementation)
const stop = nwc.subscribe(async () => new Nip47InternalError("Not implemented"))

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
