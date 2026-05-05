import { createServer } from "http"

import { NWC_NOSTR_MONITORING_PORT } from "@/config"
import {
  NwcMonitoringService,
  type NwcMonitoringServiceLike,
} from "@/services/nwc-monitoring"
import { baseLogger } from "@/services/logger"

type NostrMonitoringServerConfig = {
  monitoring?: NwcMonitoringServiceLike
  port?: number
  logger?: Logger
}

export const startNostrMonitoringServer = async ({
  monitoring = NwcMonitoringService(),
  port = NWC_NOSTR_MONITORING_PORT,
  logger = baseLogger.child({ module: "nostr-monitoring-server" }),
}: NostrMonitoringServerConfig = {}): Promise<() => Promise<void>> => {
  const server = createServer((req, res) => {
    const requestUrl = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "127.0.0.1"}`,
    )

    if (requestUrl.pathname === "/healthz") {
      const health = monitoring.getHealthSnapshot()
      res.writeHead(health.healthy ? 200 : 503, {
        "Content-Type": "application/json; charset=utf-8",
      })
      res.end(
        JSON.stringify({
          status: health.healthy ? "ok" : "error",
          streamConnected: health.connected,
          streamDisconnectedForMs: health.disconnectedForMs,
        }),
      )
      return
    }

    if (requestUrl.pathname === "/metrics") {
      res.writeHead(200, {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      })
      res.end(monitoring.renderMetrics())
      return
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("not found")
  })

  await new Promise<void>((resolve, reject) => {
    server.listen(port, () => {
      logger.info({ port }, "nwc monitoring server listening")
      resolve()
    })
    server.on("error", reject)
  })

  let stopped = false

  return async () => {
    if (stopped) {
      return
    }

    stopped = true
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
}
