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

@test "supergraph: hello query returns greeting" {
  exec_graphql "anon" "hello" "{}"

  hello_response="$(graphql_output '.data.hello')"
  [[ "${hello_response}" != "null" ]] || exit 1
}
