BASH_SOURCE=${BASH_SOURCE:-test/bats/helpers/.}
source $(dirname "$BASH_SOURCE")/common.bash

SERVER_PID_FILE=$REPO_ROOT/test/bats/.galoy_server_pid
NOSTR_SUBSCRIBER_PID_FILE=$REPO_ROOT/test/bats/.nwc_subscriber_pid
USE_RUNNING_NWC_DEV="${USE_RUNNING_NWC_DEV:-false}"
NWC_SUBGRAPH_PORT="${SUBGRAPH_PORT:-4010}"
NWC_NOSTR_MONITORING_PORT="${NWC_NOSTR_MONITORING_PORT:-4011}"

NWC_TEST_ENV=(
  DATA_ENCRYPTION_KEY="$DATA_ENCRYPTION_KEY"
  NOSTR_PRIVATE_KEY="$NOSTR_PRIVATE_KEY"
  DB_HOST="$DB_HOST"
  DB_PORT="$DB_PORT"
  DB_USER="$DB_USER"
  DB_PWD="$DB_PWD"
  DB_DB="$DB_DB"
  NWC_NOSTR_MONITORING_PORT="$NWC_NOSTR_MONITORING_PORT"
)

is_blink_core_grpc_up() {
  nc -z "${BLINK_CORE_GRPC_HOST:-localhost}" "${BLINK_CORE_GRPC_PORT:-50053}"
}

wait_for_blink_core_grpc() {
  if retry 30 1 is_blink_core_grpc_up; then
    return
  fi

  echo "Blink Core gRPC stream is not listening on ${BLINK_CORE_GRPC_HOST:-localhost}:${BLINK_CORE_GRPC_PORT:-50053}."
  return 1
}

bitcoin_cli() {
  local container_id
  container_id="$(
    docker ps \
      --filter "label=com.docker.compose.service=bitcoind" \
      --format '{{.ID}}' \
      | head -n 1
  )"
  [[ -n "${container_id}" ]] || return 1

  docker exec "${container_id}" bitcoin-cli "$@"
}

nwc_db_query() {
  local sql=$1
  local container_id
  container_id="$(
    docker ps \
      --filter "label=com.docker.compose.service=nwc-pg" \
      --format '{{.ID}}' \
      | head -n 1
  )"
  [[ -n "${container_id}" ]] || return 1

  docker exec \
    -e PGPASSWORD="${DB_PWD}" \
    "${container_id}" \
    psql \
      -U "${DB_USER}" \
      -d "${DB_DB}" \
      -Atc "${sql}"
}

notification_audit_count() {
  local notification_type=$1
  local payment_hash=$2
  local connection_id=${3:-}
  local connection_filter=""

  if [[ -n "$connection_id" ]]; then
    connection_filter="AND connection_id = '${connection_id}'"
  fi

  nwc_db_query "
    SELECT count(*)
    FROM nwc_audit_log
    WHERE action = 'notification_published'
      AND method = '${notification_type}'
      AND status = 'success'
      AND metadata->>'payment_hash' = '${payment_hash}'
      ${connection_filter};
  " | tr -d '[:space:]'
}

rewind_transaction_stream_cursor() {
  nwc_db_query "
    INSERT INTO stream_cursors (stream_name, cursor_value, updated_at)
    VALUES ('transactions', '000000000000000000000000', NOW())
    ON CONFLICT (stream_name)
    DO UPDATE SET cursor_value = EXCLUDED.cursor_value, updated_at = NOW();
  " > /dev/null
}

is_galoy_block_info_ready() {
  local response
  response="$(
    curl -s \
      -X POST \
      -H "Content-Type: application/json" \
      -d '{"query":"query GetBlockInfo { globals { blockInfo { blockHeight } } }"}' \
      "${GALOY_ENDPOINT}/graphql"
  )"

  local block_height
  block_height="$(echo "$response" | jq -r '.data.globals.blockInfo.blockHeight // empty')"
  [[ -n "${block_height}" && "${block_height}" != "null" ]]
}

ensure_regtest_block_info() {
  if is_galoy_block_info_ready; then
    return
  fi

  bitcoin_cli -regtest createwallet "outside" > /dev/null 2>&1 || true
  bitcoin_cli -regtest loadwallet "outside" > /dev/null 2>&1 || true

  local mining_address
  mining_address="$(
    bitcoin_cli -regtest -rpcwallet=outside getnewaddress | tr -d '\r\n'
  )"
  [[ -n "${mining_address}" ]] || return 1

  bitcoin_cli -regtest generatetoaddress 1 "${mining_address}" > /dev/null
  retry 30 1 is_galoy_block_info_ready
}

migrate_nwc_db() {
  (
    cd "$REPO_ROOT" || exit 1
    env "${NWC_TEST_ENV[@]}" pnpm db:migrate
  )
}

is_running_nwc_dev_up() {
  curl -sf "http://localhost:${NWC_SUBGRAPH_PORT}/healthz" > /dev/null
}

is_running_nwc_nostr_monitoring_up() {
  curl -s "http://localhost:${NWC_NOSTR_MONITORING_PORT}/healthz" > /dev/null
}

is_nwc_nostr_monitoring_port_in_use() {
  nc -z localhost "${NWC_NOSTR_MONITORING_PORT}"
}

is_nwc_nostr_stream_connected() {
  local response
  response="$(curl -s "http://localhost:${NWC_NOSTR_MONITORING_PORT}/healthz")" || return 1

  if [[ "$(echo "$response" | jq -r '.streamConnected')" == "true" ]]; then
    return 0
  fi

  echo "NWC Nostr stream is not connected: ${response}"
  return 1
}

print_bats_mode_hint() {
  echo "Managed BATS needs to own the NWC ports. Stop the dev/Tilt process before running: nix develop -c make bats-test"
  echo "To run against an already-running dev stack, first make sure Core gRPC is listening and NWC streamConnected is true, then run:"
  echo "  USE_RUNNING_NWC_DEV=true nix develop -c bats -t test/bats"
}

start_server() {
  migrate_nwc_db

  if [[ "$USE_RUNNING_NWC_DEV" == "true" ]]; then
    retry 20 1 is_running_nwc_dev_up
    return
  fi

  if is_running_nwc_dev_up; then
    echo "NWC dev is already running on port ${NWC_SUBGRAPH_PORT}."
    print_bats_mode_hint
    return 1
  fi

  rm -f .e2e-server.log
  background env \
    "${NWC_TEST_ENV[@]}" \
    RUN_CRON_IN_GQL_SERVER=true \
    OATHKEEPER_DECISION_ENDPOINT="${OATHKEEPER_DECISION_ENDPOINT:-http://localhost:4456}" \
    ROUTER_URL="${ROUTER_URL:-http://localhost:4004/graphql}" \
    PUBLIC_GRAPHQL_URL="${PUBLIC_GRAPHQL_URL:-http://localhost:4455/graphql}" \
    NOSTR_RELAY_PUBLIC_URL="ws://localhost:7777" \
    SUBGRAPH_PORT="${NWC_SUBGRAPH_PORT}" \
    node \
      -r ts-node/register/transpile-only \
      -r tsconfig-paths/register \
      -r src/services/tracing.ts \
      src/server/graphql-public-api-server.ts > .e2e-server.log
  echo $! > $SERVER_PID_FILE

  server_is_up() {
    grep -q "Server ready at http://localhost:${NWC_SUBGRAPH_PORT}/graphql" .e2e-server.log
  }

  retry 20 1 server_is_up
}

stop_server() {
  if [[ -f "$SERVER_PID_FILE" ]]; then
    pid=$(cat "$SERVER_PID_FILE")
    kill -9 "$pid" > /dev/null 2>&1 || true
    wait "$pid" 2>/dev/null || true
    rm -f "$SERVER_PID_FILE"
  fi
}

start_nostr_subscriber() {
  if [[ "$USE_RUNNING_NWC_DEV" == "true" ]]; then
    retry 20 1 is_running_nwc_nostr_monitoring_up
    retry 20 1 is_nwc_nostr_stream_connected
    return
  fi

  if is_nwc_nostr_monitoring_port_in_use; then
    echo "NWC Nostr monitoring port ${NWC_NOSTR_MONITORING_PORT} is already in use."
    print_bats_mode_hint
    return 1
  fi

  rm -f .e2e-nostr.log
  background env \
    "${NWC_TEST_ENV[@]}" \
    ROUTER_URL="${ROUTER_URL:-http://localhost:4004/graphql}" \
    PUBLIC_GRAPHQL_URL="${PUBLIC_GRAPHQL_URL:-http://localhost:4455/graphql}" \
    NOSTR_RELAY_URL="ws://localhost:7777" \
    NOSTR_RELAY_PUBLIC_URL="ws://localhost:7777" \
    node \
      -r ts-node/register/transpile-only \
      -r tsconfig-paths/register \
      -r src/services/tracing.ts \
      src/server/nostr.ts > .e2e-nostr.log
  echo $! > $NOSTR_SUBSCRIBER_PID_FILE

  subscriber_is_up() {
    grep -q '"msg":"subscribed to relay"' .e2e-nostr.log && \
      is_running_nwc_nostr_monitoring_up && \
      is_nwc_nostr_stream_connected
  }

  retry 20 1 subscriber_is_up
}

stop_nostr_subscriber() {
  if [[ -f "$NOSTR_SUBSCRIBER_PID_FILE" ]]; then
    pid=$(cat "$NOSTR_SUBSCRIBER_PID_FILE")
    kill -9 "$pid" > /dev/null 2>&1 || true
    wait "$pid" 2>/dev/null || true
    rm -f "$NOSTR_SUBSCRIBER_PID_FILE"
  fi
}

is_galoy_server_up() {
  exec_graphql 'anon' 'galoy-up' '{}' "$GALOY_ENDPOINT"
  commitHash="$(graphql_output '.data.globals.buildInformation.commitHash')"
  [[ "${commitHash}" != "null" ]] || exit 1
}

wait_for_galoy_server() {
  retry 60 1 is_galoy_server_up
  ensure_regtest_block_info
}

is_auth_token_valid() {
  local auth_token=$1
  local endpoint=${2:-${GALOY_ENDPOINT}}
  local response=""
  local user_id=""

  response="$(
    curl -s \
      -X POST \
      -H "Authorization: Bearer ${auth_token}" \
      -H "Content-Type: application/json" \
      -d '{"query":"query MeForAuthValidation { me { id } }"}' \
      "${endpoint}/graphql"
  )"
  user_id="$(echo "$response" | jq -r '.data.me.id // empty')"

  [[ -n "${user_id}" ]]
}

login_user() {
  local token_name=$1
  local phone=$2
  local code=$3
  local endpoint=${4:-${GALOY_ENDPOINT}}
  local token_cache_file="${CACHE_DIR}/${token_name}"
  local auth_endpoint="${endpoint}/auth/phone/login"
  local response=""
  local auth_token=""
  local auth_error=""

  if [[ -s "$token_cache_file" ]]; then
    auth_token="$(cat "$token_cache_file")"
    [[ -n "${auth_token}" ]] || return 1

    if is_auth_token_valid "${auth_token}" "${endpoint}"; then
      return 0
    fi

    rm -f "$token_cache_file"
  fi

  for delay in 0 5 10 20; do
    if [[ "$delay" -gt 0 ]]; then
      sleep "$delay"
    fi

    response="$(
      curl -s \
        -X POST \
        -H "Content-Type: application/json" \
        -d "{\"phone\":\"${phone}\",\"code\":\"${code}\"}" \
        "${auth_endpoint}"
    )"
    auth_token="$(echo "$response" | jq -r '.authToken // empty')"

    if [[ -n "${auth_token}" ]]; then
      cache_value "$token_name" "$auth_token"
      return 0
    fi

    auth_error="$(echo "$response" | jq -r '.error // empty')"
    if [[ "$auth_error" != "Too many login attempts, please wait for a while and try again." ]]; then
      echo "Auth login failed for ${phone}: ${response}" >&2
      return 1
    fi
  done

  echo "Auth login rate limited for ${phone}: ${response}" >&2
  return 1
}

seed_accounts() {
  login_user \
    "$CHARLIE_TOKEN_NAME" \
    "$CHARLIE_PHONE" \
    "$CODE"
}
