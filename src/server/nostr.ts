import { NwcSubscriber } from "@/services"
import { Nip47InternalError } from "@/domain/nostr"

const nwc = NwcSubscriber()
console.log("starting nwc")

// Event handler will be wired in E2 (NIP-47 Method Implementation)
const stop = nwc.subscribe(async () => new Nip47InternalError("Not implemented"))

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
