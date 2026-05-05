import NwcEventHandler from "@/app/nwc-event-handler"
import { startNostrMonitoringServer } from "@/server/nostr-monitoring-server"
import { NwcMonitoringService } from "@/services/nwc-monitoring"
import {
  NwcNotificationPublisher,
  NwcSubscriber,
  TransactionSubscriber,
} from "@/services"
import { baseLogger } from "@/services/logger"

const logger = baseLogger.child({ module: "nostr" })

const start = async () => {
  const monitoring = NwcMonitoringService()
  let stopMonitoringServer: () => Promise<void> = () => Promise.resolve()

  try {
    stopMonitoringServer = await startNostrMonitoringServer({ monitoring })

    const nwc = NwcSubscriber()
    const notificationPublisher = NwcNotificationPublisher({ monitoring })
    const transactionSubscriber = TransactionSubscriber({ monitoring })

    logger.info("starting nwc subscriber")
    const stopNwc = nwc.subscribe(NwcEventHandler().handle)

    logger.info("starting transaction subscriber")
    const stopTransactionSubscriber = await transactionSubscriber.subscribe(
      notificationPublisher.publishTransactionEvent,
    )

    const stop = async () => {
      await Promise.allSettled([
        stopNwc(),
        stopTransactionSubscriber(),
        notificationPublisher.stop(),
        stopMonitoringServer(),
      ])
    }

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
  } catch (error) {
    await stopMonitoringServer().catch((monitoringError) => {
      logger.warn({ err: monitoringError }, "failed to stop monitoring server cleanly")
    })
    throw error
  }
}

start().catch((err) => {
  logger.error({ err }, "failed to start Nostr services")
  process.exit(1)
})
