#!/usr/bin/env bash

export REPO_ROOT
REPO_ROOT="$(git rev-parse --show-toplevel)"

source "${REPO_ROOT}/test/bats/helpers/common.bash"
source "${REPO_ROOT}/test/bats/helpers/setup-and-teardown.bash"

setup_suite() {
  make tilt-down > /dev/null 2>&1 || true
  make tilt-up-bg

  await_public_graphql_is_up
  await_nwc_dev_is_up
  wait_for_blink_core_grpc
  await_nwc_nostr_stream_connected
}

teardown_suite() {
  make tilt-down
}

await_public_graphql_is_up() {
  public_graphql_is_up() {
    curl -fsS \
      -X POST \
      -H "content-type: application/json" \
      --data '{"query":"{__typename}"}' \
      http://localhost:4455/graphql \
      | grep -q '"__typename":"Query"'
  }

  retry 360 2 public_graphql_is_up
}

await_nwc_dev_is_up() {
  retry 360 2 is_running_nwc_dev_up
}

await_nwc_nostr_stream_connected() {
  retry 360 2 is_nwc_nostr_stream_connected
}
