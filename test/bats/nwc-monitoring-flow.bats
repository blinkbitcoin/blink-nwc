#!/usr/bin/env bats

load helpers/setup-and-teardown

setup_file() {
  migrate_nwc_db
  wait_for_blink_core_grpc
  start_nostr_subscriber
}

teardown_file() {
  stop_nostr_subscriber
}

@test "nwc monitoring flow: nostr metrics expose connected transaction stream" {
  run curl -sf "http://localhost:${NWC_NOSTR_MONITORING_PORT}/healthz"
  [ "$status" -eq 0 ]
  [[ "$(echo "$output" | jq -r '.status')" == "ok" ]] || exit 1
  [[ "$(echo "$output" | jq -r '.streamConnected')" == "true" ]] || exit 1

  run curl -sf "http://localhost:${NWC_NOSTR_MONITORING_PORT}/metrics"
  [ "$status" -eq 0 ]
  [[ "$output" == *"transaction_stream_connected 1"* ]] || exit 1
  [[ "$output" == *"notification_published_total{notification_type=\"payment_sent\"}"* ]] || exit 1
  [[ "$output" == *"notification_published_total{notification_type=\"payment_received\"}"* ]] || exit 1
}
