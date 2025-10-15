#!/usr/bin/env bats

load "helpers/setup-and-teardown"

setup_file() {
  start_server
}

teardown_file() {
  stop_server
}

@test "subgraph: hello query returns greeting" {
  exec_graphql "anon" "hello" "{}" "$NWC_ENDPOINT"

  hello_response="$(graphql_output '.data.hello')"
  [[ "${hello_response}" != "null" ]] || exit 1
}


