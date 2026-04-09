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
