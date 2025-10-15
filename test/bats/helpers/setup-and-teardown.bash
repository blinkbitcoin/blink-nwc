BASH_SOURCE=${BASH_SOURCE:-test/bats/helpers/.}
source $(dirname "$BASH_SOURCE")/common.bash

SERVER_PID_FILE=$REPO_ROOT/test/bats/.galoy_server_pid

start_server() {
  background env RUN_CRON_IN_GQL_SERVER=true node lib/src/server/subgraph.js > .e2e-server.log
  echo $! > $SERVER_PID_FILE

  server_is_up() {
    exec_graphql 'anon' 'service' '{}' "$NWC_ENDPOINT"
    sdl="$(graphql_output '.data._service.sdl')"
    echo "$sdl"
    [[ -n "$sdl" ]] || exit 1
  }

  retry 20 1 server_is_up
}

stop_server() {
  [[ -f "$SERVER_PID_FILE" ]] && kill -9 $(cat $SERVER_PID_FILE) > /dev/null || true
}

is_galoy_server_up() {
  exec_graphql 'anon' 'galoy-up' '{}' "$GALOY_ENDPOINT"
  commitHash="$(graphql_output '.data.globals.buildInformation.commitHash')"
  [[ "${commitHash}" != "null" ]] || exit 1
}

wait_for_galoy_server() {
  retry 60 1 is_galoy_server_up
}

login_user() {
  local token_name=$1
  local phone=$2
  local code=$3
  local endpoint=${4:-${GALOY_ENDPOINT}}

  local variables=$(
    jq -n \
    --arg phone "$phone" \
    --arg code "$code" \
    '{input: {phone: $phone, code: $code}}'
  )
  exec_graphql 'anon' 'user-login' "$variables" "$endpoint"
  auth_token="$(graphql_output '.data.userLogin.authToken')"
  [[ -n "${auth_token}" && "${auth_token}" != "null" ]]
  cache_value "$token_name" "$auth_token"
}

seed_accounts() {
  login_user \
    "$CHARLIE_TOKEN_NAME" \
    "$CHARLIE_PHONE" \
    "$CODE"
}
