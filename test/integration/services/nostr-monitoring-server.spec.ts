import { startNostrMonitoringServer } from "@/server/nostr-monitoring-server"
import { NwcMonitoringService } from "@/services/nwc-monitoring"

const getFreePort = async (): Promise<number> => {
  const { createServer } = await import("http")

  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("Failed to allocate free port"))
        return
      }

      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve(address.port)
      })
    })
    server.on("error", reject)
  })
}

describe("nostr monitoring server", () => {
  it("serves health and metrics for the Nostr worker", async () => {
    let nowMs = 1_710_000_000_000
    const monitoring = NwcMonitoringService({
      now: () => nowMs,
    })
    const port = await getFreePort()
    const stop = await startNostrMonitoringServer({
      monitoring,
      port,
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      } as any,
    })

    monitoring.markTransactionStreamConnected()
    monitoring.recordTransactionStreamReconnect()
    monitoring.recordTransactionStreamReplayLag(12)

    const healthResponse = await fetch(`http://127.0.0.1:${port}/healthz`)
    expect(healthResponse.status).toBe(200)
    await expect(healthResponse.json()).resolves.toEqual({
      status: "ok",
      streamConnected: true,
      streamDisconnectedForMs: 0,
    })

    const metricsResponse = await fetch(`http://127.0.0.1:${port}/metrics`)
    expect(metricsResponse.status).toBe(200)
    await expect(metricsResponse.text()).resolves.toContain(
      "transaction_stream_connected 1",
    )

    monitoring.markTransactionStreamDisconnected()
    nowMs += 60_000

    const unhealthyResponse = await fetch(`http://127.0.0.1:${port}/healthz`)
    expect(unhealthyResponse.status).toBe(503)
    await expect(unhealthyResponse.json()).resolves.toEqual({
      status: "error",
      streamConnected: false,
      streamDisconnectedForMs: 60_000,
    })

    await stop()
  })
})
