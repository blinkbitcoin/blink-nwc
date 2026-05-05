import {
  NwcMonitoringService,
  STREAM_DISCONNECT_ALERT_THRESHOLD_MS,
} from "@/services/nwc-monitoring"

describe("NwcMonitoringService", () => {
  it("renders stream and notification metrics in Prometheus format", () => {
    const nowMs = 1_710_000_000_000
    const monitoring = NwcMonitoringService({
      now: () => nowMs,
    })

    monitoring.markTransactionStreamConnected()
    monitoring.recordTransactionStreamReconnect()
    monitoring.recordTransactionStreamReplayLagFromTimestamp(1_709_999_990)
    monitoring.recordNotificationPublishDuration("payment_received", 120)
    monitoring.recordNotificationPublished("payment_received")
    monitoring.recordNotificationPublishDuration("payment_sent", 900)
    monitoring.recordNotificationPublishError("payment_sent")

    const metrics = monitoring.renderMetrics()

    expect(metrics).toContain("transaction_stream_connected 1")
    expect(metrics).toContain("transaction_stream_reconnect_total 1")
    expect(metrics).toContain("transaction_stream_replay_lag 10")
    expect(metrics).toContain(
      'notification_published_total{notification_type="payment_received"} 1',
    )
    expect(metrics).toContain(
      'notification_publish_errors_total{notification_type="payment_sent"} 1',
    )
    expect(metrics).toContain(
      'notification_publish_duration_ms_bucket{notification_type="payment_received",le="250"} 1',
    )
    expect(metrics).toContain(
      'notification_publish_duration_ms_bucket{notification_type="payment_sent",le="1000"} 1',
    )
  })

  it("turns unhealthy after the disconnect threshold elapses", () => {
    let nowMs = 1_710_000_000_000
    const monitoring = NwcMonitoringService({
      now: () => nowMs,
    })

    monitoring.markTransactionStreamConnected()
    expect(monitoring.getHealthSnapshot()).toEqual({
      healthy: true,
      connected: true,
      disconnectedForMs: 0,
    })

    monitoring.markTransactionStreamDisconnected()
    nowMs += STREAM_DISCONNECT_ALERT_THRESHOLD_MS - 1
    expect(monitoring.getHealthSnapshot()).toEqual({
      healthy: true,
      connected: false,
      disconnectedForMs: STREAM_DISCONNECT_ALERT_THRESHOLD_MS - 1,
    })

    nowMs += 1
    expect(monitoring.getHealthSnapshot()).toEqual({
      healthy: false,
      connected: false,
      disconnectedForMs: STREAM_DISCONNECT_ALERT_THRESHOLD_MS,
    })
  })
})
