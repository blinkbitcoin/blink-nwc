import { SUPPORTED_NWC_NOTIFICATIONS } from "@/config"
import { NwcNotificationTypeValue } from "@/domain/nostr/notification-type"

const STREAM_DISCONNECT_ALERT_THRESHOLD_MS = 60_000
const NOTIFICATION_PUBLISH_DURATION_BUCKETS_MS = [
  25, 50, 100, 250, 500, 1000, 2500, 5000,
] as const

type NotificationMetricRecord = {
  publishedTotal: number
  publishErrorsTotal: number
  publishDurationCount: number
  publishDurationSum: number
  publishDurationBuckets: Map<number, number>
}

type NwcMonitoringServiceConfig = {
  now?: () => number
}

type HealthSnapshot = {
  healthy: boolean
  connected: boolean
  disconnectedForMs: number
}

const escapeLabelValue = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')

const formatLabels = (labels: Record<string, string>) =>
  `{${Object.entries(labels)
    .map(([key, value]) => `${key}="${escapeLabelValue(value)}"`)
    .join(",")}}`

const createNotificationMetricRecord = (): NotificationMetricRecord => ({
  publishedTotal: 0,
  publishErrorsTotal: 0,
  publishDurationCount: 0,
  publishDurationSum: 0,
  publishDurationBuckets: new Map(
    NOTIFICATION_PUBLISH_DURATION_BUCKETS_MS.map((bucket) => [bucket, 0]),
  ),
})

export type NwcMonitoringServiceLike = ReturnType<typeof NwcMonitoringService>

export const NwcMonitoringService = ({
  now = () => Date.now(),
}: NwcMonitoringServiceConfig = {}) => {
  let transactionStreamConnected = 0
  let transactionStreamReconnectTotal = 0
  let transactionStreamReplayLag = 0
  let disconnectedAtMs: number | null = now()

  const notificationMetrics = new Map<NwcNotificationTypeValue, NotificationMetricRecord>(
    SUPPORTED_NWC_NOTIFICATIONS.map((notificationType) => [
      notificationType,
      createNotificationMetricRecord(),
    ]),
  )

  const getNotificationMetrics = (notificationType: NwcNotificationTypeValue) => {
    const existing = notificationMetrics.get(notificationType)
    if (existing) {
      return existing
    }

    const created = createNotificationMetricRecord()
    notificationMetrics.set(notificationType, created)
    return created
  }

  const markTransactionStreamConnected = () => {
    transactionStreamConnected = 1
    disconnectedAtMs = null
  }

  const markTransactionStreamDisconnected = () => {
    transactionStreamConnected = 0
    disconnectedAtMs ??= now()
  }

  const recordTransactionStreamReconnect = () => {
    transactionStreamReconnectTotal += 1
  }

  const recordTransactionStreamReplayLag = (lagSeconds: number) => {
    if (!Number.isFinite(lagSeconds)) {
      return
    }

    transactionStreamReplayLag = Math.max(0, lagSeconds)
  }

  const recordTransactionStreamReplayLagFromTimestamp = (
    settledAtSeconds: number | undefined | null,
  ) => {
    if (typeof settledAtSeconds !== "number" || !Number.isFinite(settledAtSeconds)) {
      return
    }

    recordTransactionStreamReplayLag(now() / 1000 - settledAtSeconds)
  }

  const recordNotificationPublished = (notificationType: NwcNotificationTypeValue) => {
    getNotificationMetrics(notificationType).publishedTotal += 1
  }

  const recordNotificationPublishDuration = (
    notificationType: NwcNotificationTypeValue,
    durationMs: number,
  ) => {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      return
    }

    const metrics = getNotificationMetrics(notificationType)
    metrics.publishDurationCount += 1
    metrics.publishDurationSum += durationMs

    for (const bucket of NOTIFICATION_PUBLISH_DURATION_BUCKETS_MS) {
      if (durationMs <= bucket) {
        metrics.publishDurationBuckets.set(
          bucket,
          (metrics.publishDurationBuckets.get(bucket) ?? 0) + 1,
        )
      }
    }
  }

  const recordNotificationPublishError = (notificationType: NwcNotificationTypeValue) => {
    getNotificationMetrics(notificationType).publishErrorsTotal += 1
  }

  const getHealthSnapshot = (): HealthSnapshot => {
    const connected = transactionStreamConnected === 1
    const disconnectedForMs =
      connected || disconnectedAtMs === null ? 0 : Math.max(0, now() - disconnectedAtMs)

    return {
      healthy: connected || disconnectedForMs < STREAM_DISCONNECT_ALERT_THRESHOLD_MS,
      connected,
      disconnectedForMs,
    }
  }

  const renderMetrics = () => {
    const lines = [
      "# HELP transaction_stream_connected Whether the Blink Core transaction stream is currently connected.",
      "# TYPE transaction_stream_connected gauge",
      `transaction_stream_connected ${transactionStreamConnected}`,
      "# HELP transaction_stream_reconnect_total Total transaction stream reconnect attempts.",
      "# TYPE transaction_stream_reconnect_total counter",
      `transaction_stream_reconnect_total ${transactionStreamReconnectTotal}`,
      "# HELP transaction_stream_replay_lag The current replay lag for the Blink Core transaction stream in seconds.",
      "# TYPE transaction_stream_replay_lag gauge",
      `transaction_stream_replay_lag ${transactionStreamReplayLag}`,
      "# HELP notification_published_total Total successfully published NWC notifications.",
      "# TYPE notification_published_total counter",
    ]

    for (const notificationType of SUPPORTED_NWC_NOTIFICATIONS) {
      const metrics = getNotificationMetrics(notificationType)
      const notificationLabels = formatLabels({ notification_type: notificationType })

      lines.push(
        `notification_published_total${notificationLabels} ${metrics.publishedTotal}`,
      )
    }

    lines.push(
      "# HELP notification_publish_duration_ms Notification publish duration in milliseconds.",
      "# TYPE notification_publish_duration_ms histogram",
    )

    for (const notificationType of SUPPORTED_NWC_NOTIFICATIONS) {
      const metrics = getNotificationMetrics(notificationType)
      const notificationLabels = { notification_type: notificationType }

      for (const bucket of NOTIFICATION_PUBLISH_DURATION_BUCKETS_MS) {
        lines.push(
          `notification_publish_duration_ms_bucket${formatLabels({
            ...notificationLabels,
            le: bucket.toString(),
          })} ${metrics.publishDurationBuckets.get(bucket) ?? 0}`,
        )
      }

      lines.push(
        `notification_publish_duration_ms_bucket${formatLabels({
          ...notificationLabels,
          le: "+Inf",
        })} ${metrics.publishDurationCount}`,
        `notification_publish_duration_ms_sum${formatLabels(notificationLabels)} ${metrics.publishDurationSum}`,
        `notification_publish_duration_ms_count${formatLabels(notificationLabels)} ${metrics.publishDurationCount}`,
      )
    }

    lines.push(
      "# HELP notification_publish_errors_total Total failed NWC notification publish attempts.",
      "# TYPE notification_publish_errors_total counter",
    )

    for (const notificationType of SUPPORTED_NWC_NOTIFICATIONS) {
      const metrics = getNotificationMetrics(notificationType)
      lines.push(
        `notification_publish_errors_total${formatLabels({
          notification_type: notificationType,
        })} ${metrics.publishErrorsTotal}`,
      )
    }

    return `${lines.join("\n")}\n`
  }

  return {
    renderMetrics,
    getHealthSnapshot,
    markTransactionStreamConnected,
    markTransactionStreamDisconnected,
    recordTransactionStreamReconnect,
    recordTransactionStreamReplayLag,
    recordTransactionStreamReplayLagFromTimestamp,
    recordNotificationPublished,
    recordNotificationPublishDuration,
    recordNotificationPublishError,
  }
}

export { STREAM_DISCONNECT_ALERT_THRESHOLD_MS }
