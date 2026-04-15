#!/usr/bin/env bats

load "helpers/setup-and-teardown"

setup_file() {
  start_server
}

teardown_file() {
  stop_server
}

@test "subgraph: nwcServiceInfo returns supported methods" {
  exec_graphql "anon" "nwc-service-info" "{}" "$NWC_ENDPOINT"

  methods="$(graphql_output '.data.nwcServiceInfo.supportedMethods')"
  [[ "${methods}" != "null" ]] || exit 1
  [[ "${methods}" == *"GET_INFO"* ]] || exit 1
  [[ "${methods}" == *"PAY_INVOICE"* ]] || exit 1
}

@test "subgraph: nwcServiceInfo returns relay URL" {
  exec_graphql "anon" "nwc-service-info" "{}" "$NWC_ENDPOINT"

  relay_url="$(graphql_output '.data.nwcServiceInfo.relayUrl')"
  [[ "${relay_url}" != "null" ]] || exit 1
  [[ "${relay_url}" == ws://* ]] || exit 1
}

@test "subgraph: nwcServiceInfo returns supported notifications" {
  exec_graphql "anon" "nwc-service-info" "{}" "$NWC_ENDPOINT"

  notifications="$(graphql_output '.data.nwcServiceInfo.supportedNotifications')"
  [[ "${notifications}" != "null" ]] || exit 1
  [[ "${notifications}" == *"PAYMENT_SENT"* ]] || exit 1
  [[ "${notifications}" == *"PAYMENT_RECEIVED"* ]] || exit 1
}
