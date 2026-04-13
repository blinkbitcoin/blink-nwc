#!/usr/bin/env bats

load "helpers/setup-and-teardown"

setup_file() {
  start_server
  wait_for_galoy_server
  seed_accounts
}

teardown_file() {
  stop_server
}

@test "supergraph: nwcServiceInfo returns supported methods via federation" {
  exec_graphql "anon" "nwc-service-info" "{}"

  methods="$(graphql_output '.data.nwcServiceInfo.supportedMethods')"
  [[ "${methods}" != "null" ]] || exit 1
  [[ "${methods}" == *"GET_INFO"* ]] || exit 1
}

@test "supergraph: nwcServiceInfo returns relay URL via federation" {
  exec_graphql "anon" "nwc-service-info" "{}"

  relay_url="$(graphql_output '.data.nwcServiceInfo.relayUrl')"
  [[ "${relay_url}" != "null" ]] || exit 1
  [[ "${relay_url}" == ws://* ]] || exit 1
}

@test "supergraph: nwcServiceInfo returns supported notifications via federation" {
  exec_graphql "anon" "nwc-service-info" "{}"

  notifications="$(graphql_output '.data.nwcServiceInfo.supportedNotifications')"
  [[ "${notifications}" != "null" ]] || exit 1
  [[ "${notifications}" == *"PAYMENT_SENT"* ]] || exit 1
  [[ "${notifications}" == *"PAYMENT_RECEIVED"* ]] || exit 1
}
