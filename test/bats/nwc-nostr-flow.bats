#!/usr/bin/env bats

load "helpers/setup-and-teardown"

NWC_CONNECTION_URI_CACHE_KEY="alice_nwc_connection_uri"
NWC_CONNECTION_ALIAS="bats-smoke"
NWC_DEFAULT_ALIAS="Blink"

setup_file() {
  start_server
  wait_for_galoy_server
  start_nostr_subscriber

  login_user \
    "$ALICE_TOKEN_NAME" \
    "$ALICE_PHONE" \
    "$CODE"

  exec_graphql "$ALICE_TOKEN_NAME" "me-for-nwc-bootstrap" "{}"
  alice_username="$(graphql_output '.data.me.username')"
  alice_btc_wallet_id="$(
    graphql_output '.data.me.defaultAccount.wallets[] | select(.walletCurrency == "BTC") | .id'
  )"
  [[ -n "${alice_btc_wallet_id}" && "${alice_btc_wallet_id}" != "null" ]] || exit 1

  exec_graphql "$ALICE_TOKEN_NAME" "nwc-service-info" "{}"
  server_pubkey="$(graphql_output '.data.nwcServiceInfo.serverPubkey')"
  relay_url="$(graphql_output '.data.nwcServiceInfo.relayUrl')"
  [[ -n "${server_pubkey}" && "${server_pubkey}" != "null" ]] || exit 1
  [[ -n "${relay_url}" && "${relay_url}" != "null" ]] || exit 1
  app_secret="$(openssl rand -hex 32)"
  connection_uri="nostr+walletconnect://${server_pubkey}?relay=$(printf '%s' "$relay_url" | jq -sRr @uri)&secret=${app_secret}"

  create_variables="$(
    jq -n \
      --arg nwcUri "$connection_uri" \
      --arg walletId "$alice_btc_wallet_id" \
      --arg alias "$NWC_CONNECTION_ALIAS" \
      '{
        input: {
          nwcUri: $nwcUri,
          walletId: $walletId,
          alias: $alias,
          permissions: ["GET_INFO"]
        }
      }'
  )"
  exec_graphql "$ALICE_TOKEN_NAME" "nwc-connection-create" "$create_variables"
  [[ "$(graphql_output '.data.nwcConnectionCreate.errors | length')" == "0" ]] || exit 1

  connection_uri="$(graphql_output '.data.nwcConnectionCreate.connectionUri')"
  [[ -n "${connection_uri}" && "${connection_uri}" != "null" ]] || exit 1

  cache_value "$NWC_CONNECTION_URI_CACHE_KEY" "$connection_uri"
}

teardown_file() {
  stop_nostr_subscriber
  stop_server
}

@test "nwc nostr flow: permission failures are returned over the relay" {
  connection_uri="$(read_value "$NWC_CONNECTION_URI_CACHE_KEY")"

  retry 5 1 env \
    CONNECTION_URI="$connection_uri" \
    NWC_REQUEST_JSON='{"method":"pay_invoice","params":{"invoice":"lnbc1dummy"}}' \
    "$REPO_ROOT/test/bats/helpers/nwc-request.sh"

  [[ "$(echo "$output" | jq -r '.result_type')" == "pay_invoice" ]] || exit 1
  [[ "$(echo "$output" | jq -r '.error.code')" == "RESTRICTED" ]] || exit 1
  [[ "$(echo "$output" | jq -r '.error.message')" == *"permission"* ]] || exit 1
}

@test "nwc nostr flow: get_info returns a decrypted connection-scoped response when Blink Core is ready" {
  connection_uri="$(read_value "$NWC_CONNECTION_URI_CACHE_KEY")"

  retry 5 1 env \
    CONNECTION_URI="$connection_uri" \
    NWC_REQUEST_JSON='{"method":"get_info","params":{}}' \
    "$REPO_ROOT/test/bats/helpers/nwc-request.sh"

  if [[ "$(echo "$output" | jq -r '.error.code // empty')" == "INTERNAL" ]]; then
    echo "get_info returned INTERNAL: $output" >&2
    false
  fi

  expected_alias="${alice_username}"
  if [[ -z "${expected_alias}" || "${expected_alias}" == "null" ]]; then
    expected_alias="$NWC_DEFAULT_ALIAS"
  fi

  [[ "$(echo "$output" | jq -r '.result_type')" == "get_info" ]] || exit 1
  [[ "$(echo "$output" | jq -r '.result.alias')" == "$expected_alias" ]] || exit 1
  [[ "$(echo "$output" | jq -r '.result.methods | join(",")')" == "get_info" ]] || exit 1
  [[ "$(echo "$output" | jq -r '.result.notifications | length')" == "0" ]] || exit 1
  [[ "$(echo "$output" | jq -r '.result.network')" == "regtest" ]] || exit 1
}
