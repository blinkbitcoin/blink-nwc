import * as process from "node:process"

import { NwcSubscriber } from "@/services"
import NwcEventHandler from "@/app/nwc-event-handler"

const nwc = NwcSubscriber()
console.log("starting nwc")
nwc.subscribe(NwcEventHandler().handle)

process.on("SIGTERM", () => {
  nwc.stop()
})
