#!/usr/bin/env bats

load "helpers/setup-and-teardown"

ALICE_FULL_URI_CACHE_KEY="alice_nwc_e2e_full_connection_uri"
BOB_FULL_URI_CACHE_KEY="bob_nwc_e2e_full_connection_uri"
ALICE_READ_ONLY_URI_CACHE_KEY="alice_nwc_e2e_read_only_connection_uri"
ALICE_BTC_WALLET_ID_CACHE_KEY="alice_nwc_e2e_btc_wallet_id"
BOB_BTC_WALLET_ID_CACHE_KEY="bob_nwc_e2e_btc_wallet_id"
ALICE_USERNAME_CACHE_KEY="alice_nwc_e2e_username"
BOB_USERNAME_CACHE_KEY="bob_nwc_e2e_username"
FULL_PERMISSIONS_JSON='["GET_INFO","GET_BALANCE","MAKE_INVOICE","PAY_INVOICE","LOOKUP_INVOICE","LIST_TRANSACTIONS","NOTIFICATIONS_PAYMENT_SENT","NOTIFICATIONS_PAYMENT_RECEIVED"]'
READ_ONLY_PERMISSIONS_JSON='["GET_INFO"]'
NWC_DEFAULT_ALIAS="Blink"

setup_file() {
  start_server
  wait_for_galoy_server
  wait_for_blink_core_grpc
  start_nostr_subscriber

  login_user \
    "$ALICE_TOKEN_NAME" \
    "$ALICE_PHONE" \
    "$CODE"
  login_user \
    "$BOB_TOKEN_NAME" \
    "$BOB_PHONE" \
    "$CODE"

  exec_graphql "$ALICE_TOKEN_NAME" "me-for-nwc-bootstrap" "{}"
  alice_username="$(graphql_output '.data.me.username')"
  alice_btc_wallet_id="$(
    graphql_output '.data.me.defaultAccount.wallets[] | select(.walletCurrency == "BTC") | .id'
  )"
  [[ -n "${alice_btc_wallet_id}" && "${alice_btc_wallet_id}" != "null" ]] || exit 1
  cache_value "$ALICE_USERNAME_CACHE_KEY" "${alice_username}"
  cache_value "$ALICE_BTC_WALLET_ID_CACHE_KEY" "${alice_btc_wallet_id}"

  exec_graphql "$BOB_TOKEN_NAME" "me-for-nwc-bootstrap" "{}"
  bob_username="$(graphql_output '.data.me.username')"
  bob_btc_wallet_id="$(
    graphql_output '.data.me.defaultAccount.wallets[] | select(.walletCurrency == "BTC") | .id'
  )"
  [[ -n "${bob_btc_wallet_id}" && "${bob_btc_wallet_id}" != "null" ]] || exit 1
  cache_value "$BOB_USERNAME_CACHE_KEY" "${bob_username}"
  cache_value "$BOB_BTC_WALLET_ID_CACHE_KEY" "${bob_btc_wallet_id}"

  exec_graphql "$ALICE_TOKEN_NAME" "nwc-service-info" "{}"
  server_pubkey="$(graphql_output '.data.nwcServiceInfo.serverPubkey')"
  relay_url="$(graphql_output '.data.nwcServiceInfo.relayUrl')"
  [[ -n "${server_pubkey}" && "${server_pubkey}" != "null" ]] || exit 1
  [[ -n "${relay_url}" && "${relay_url}" != "null" ]] || exit 1

  create_nwc_connection \
    "$ALICE_TOKEN_NAME" \
    "$alice_btc_wallet_id" \
    "bats-e2e-alice-full" \
    "$FULL_PERMISSIONS_JSON" \
    "$ALICE_FULL_URI_CACHE_KEY"
  create_nwc_connection \
    "$BOB_TOKEN_NAME" \
    "$bob_btc_wallet_id" \
    "bats-e2e-bob-full" \
    "$FULL_PERMISSIONS_JSON" \
    "$BOB_FULL_URI_CACHE_KEY"
  create_nwc_connection \
    "$ALICE_TOKEN_NAME" \
    "$alice_btc_wallet_id" \
    "bats-e2e-alice-read-only" \
    "$READ_ONLY_PERMISSIONS_JSON" \
    "$ALICE_READ_ONLY_URI_CACHE_KEY"

  fund_bob_btc_wallet
}

teardown_file() {
  stop_nostr_subscriber
  stop_server
}

create_nwc_connection() {
  local token_name=$1
  local wallet_id=$2
  local alias_name=$3
  local permissions_json=$4
  local cache_key=$5
  local app_secret connection_uri create_variables

  app_secret="$(openssl rand -hex 32)"
  connection_uri="nostr+walletconnect://${server_pubkey}?relay=$(printf '%s' "$relay_url" | jq -sRr @uri)&secret=${app_secret}"

  create_variables="$(
    jq -n \
      --arg nwcUri "$connection_uri" \
      --arg walletId "$wallet_id" \
      --arg alias "$alias_name" \
      --argjson permissions "$permissions_json" \
      '{
        input: {
          nwcUri: $nwcUri,
          walletId: $walletId,
          alias: $alias,
          permissions: $permissions
        }
      }'
  )"

  exec_graphql "$token_name" "nwc-connection-create" "$create_variables"
  [[ "$(graphql_output '.data.nwcConnectionCreate.errors | length')" == "0" ]] || exit 1

  cache_value "$cache_key" "$(graphql_output '.data.nwcConnectionCreate.connectionUri')"
}

bob_btc_wallet_has_balance() {
  exec_graphql "$BOB_TOKEN_NAME" "wallets-for-account" "{}" > /dev/null
  local balance
  balance="$(
    graphql_output '.data.me.defaultAccount.wallets[] | select(.walletCurrency == "BTC") | .balance'
  )"
  [[ -n "${balance}" && "${balance}" != "null" && "${balance}" -gt 0 ]]
}

fund_bob_btc_wallet() {
  if bob_btc_wallet_has_balance; then
    return
  fi

  local bob_btc_wallet_id
  bob_btc_wallet_id="$(read_value "$BOB_BTC_WALLET_ID_CACHE_KEY")"

  local address_variables
  address_variables="$(
    jq -n \
      --arg walletId "$bob_btc_wallet_id" \
      '{
        input: {
          walletId: $walletId
        }
      }'
  )"

  exec_graphql "$BOB_TOKEN_NAME" "on-chain-address-create" "$address_variables"
  [[ "$(graphql_output '.data.onChainAddressCreate.errors | length')" == "0" ]] || exit 1

  local address
  address="$(graphql_output '.data.onChainAddressCreate.address')"
  [[ -n "${address}" && "${address}" != "null" ]] || exit 1

  bitcoin_cli -regtest generatetoaddress 101 "$address" > /dev/null

  retry 60 1 bob_btc_wallet_has_balance
}

find_transaction_by_payment_hash() {
  local connection_uri=$1
  local request_json=$2
  local payment_hash=$3
  local attempts="${4:-10}"
  local response match attempt

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    run env \
      CONNECTION_URI="$connection_uri" \
      NWC_REQUEST_JSON="$request_json" \
      NWC_TIMEOUT_MS="15000" \
      "$REPO_ROOT/test/bats/helpers/nwc-request.sh"

    [[ "$status" -eq 0 ]] || {
      sleep 1
      continue
    }

    response="$output"
    match="$(echo "$response" | jq -c --arg payment_hash "$payment_hash" '.result.transactions[]? | select(.payment_hash == $payment_hash)')"
    if [[ -n "${match}" ]]; then
      printf '%s\n' "${match}"
      return 0
    fi

    sleep 1
  done

  echo "${output}" >&2
  return 1
}

lookup_invoice_until_state() {
  local connection_uri=$1
  local params_json=$2
  local expected_state=$3
  local attempts="${4:-10}"
  local request_json response attempt state

  request_json="$(
    jq -nc \
      --argjson params "$params_json" \
      '{method: "lookup_invoice", params: $params}'
  )"

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    run env \
      CONNECTION_URI="$connection_uri" \
      NWC_REQUEST_JSON="$request_json" \
      NWC_TIMEOUT_MS="15000" \
      "$REPO_ROOT/test/bats/helpers/nwc-request.sh"

    [[ "$status" -eq 0 ]] || {
      sleep 1
      continue
    }

    response="$output"
    state="$(echo "$response" | jq -r '.result.state // empty')"
    if [[ "${state}" == "${expected_state}" ]]; then
      printf '%s\n' "${response}"
      return 0
    fi

    sleep 1
  done

  echo "${output}" >&2
  return 1
}

@test "nwc end-to-end flow: get_info returns connection-scoped methods and notifications" {
  local connection_uri expected_alias request_json response
  connection_uri="$(read_value "$ALICE_FULL_URI_CACHE_KEY")"
  expected_alias="$(read_value "$ALICE_USERNAME_CACHE_KEY")"
  if [[ -z "${expected_alias}" || "${expected_alias}" == "null" ]]; then
    expected_alias="$NWC_DEFAULT_ALIAS"
  fi

  request_json='{"method":"get_info","params":{}}'

  retry 5 1 env \
    CONNECTION_URI="$connection_uri" \
    NWC_REQUEST_JSON="$request_json" \
    NWC_TIMEOUT_MS="15000" \
    "$REPO_ROOT/test/bats/helpers/nwc-request.sh"

  response="$output"
  [[ "$(echo "$response" | jq -r '.error.code // empty')" == "" ]] || exit 1
  [[ "$(echo "$response" | jq -r '.result_type')" == "get_info" ]] || exit 1
  [[ "$(echo "$response" | jq -r '.result.alias')" == "$expected_alias" ]] || exit 1
  [[ "$(echo "$response" | jq -r '.result.network')" == "regtest" ]] || exit 1
  [[ "$(echo "$response" | jq -r '.result.methods | sort | join(",")')" == "get_balance,get_info,list_transactions,lookup_invoice,make_invoice,pay_invoice" ]] || exit 1
  [[ "$(echo "$response" | jq -r '.result.notifications | sort | join(",")')" == "payment_received,payment_sent" ]] || exit 1
}

@test "nwc end-to-end flow: get_balance returns millisatoshis for a full-permission connection" {
  local connection_uri response
  connection_uri="$(read_value "$BOB_FULL_URI_CACHE_KEY")"

  retry 5 1 env \
    CONNECTION_URI="$connection_uri" \
    NWC_REQUEST_JSON='{"method":"get_balance","params":{}}' \
    NWC_TIMEOUT_MS="15000" \
    "$REPO_ROOT/test/bats/helpers/nwc-request.sh"

  response="$output"
  [[ "$(echo "$response" | jq -r '.error.code // empty')" == "" ]] || exit 1
  [[ "$(echo "$response" | jq -r '.result_type')" == "get_balance" ]] || exit 1
  [[ "$(echo "$response" | jq -r '.result.balance | numbers')" -ge 0 ]] || exit 1
}

@test "nwc end-to-end flow: make_invoice and lookup_invoice return a pending incoming invoice" {
  local alice_uri memo make_request make_response invoice payment_hash lookup_by_hash lookup_by_invoice
  alice_uri="$(read_value "$ALICE_FULL_URI_CACHE_KEY")"
  memo="bats-e2e-pending-$(date +%s)"
  make_request="$(
    jq -nc \
      --arg description "$memo" \
      '{method: "make_invoice", params: { amount: 1200000, description: $description }}'
  )"

  retry 5 1 env \
    CONNECTION_URI="$alice_uri" \
    NWC_REQUEST_JSON="$make_request" \
    NWC_TIMEOUT_MS="15000" \
    "$REPO_ROOT/test/bats/helpers/nwc-request.sh"

  make_response="$output"
  invoice="$(echo "$make_response" | jq -r '.result.invoice')"
  payment_hash="$(echo "$make_response" | jq -r '.result.payment_hash')"

  [[ "$(echo "$make_response" | jq -r '.error.code // empty')" == "" ]] || exit 1
  [[ "$(echo "$make_response" | jq -r '.result_type')" == "make_invoice" ]] || exit 1
  [[ "${invoice}" == ln* ]] || exit 1
  [[ "${#payment_hash}" -eq 64 ]] || exit 1
  [[ "$(echo "$make_response" | jq -r '.result.state')" == "pending" ]] || exit 1
  [[ "$(echo "$make_response" | jq -r '.result.type')" == "incoming" ]] || exit 1

  retry 5 1 env \
    CONNECTION_URI="$alice_uri" \
    NWC_REQUEST_JSON="$(jq -nc --arg payment_hash "$payment_hash" '{method: "lookup_invoice", params: { payment_hash: $payment_hash }}')" \
    NWC_TIMEOUT_MS="15000" \
    "$REPO_ROOT/test/bats/helpers/nwc-request.sh"
  lookup_by_hash="$output"

  retry 5 1 env \
    CONNECTION_URI="$alice_uri" \
    NWC_REQUEST_JSON="$(jq -nc --arg invoice "$invoice" '{method: "lookup_invoice", params: { invoice: $invoice }}')" \
    NWC_TIMEOUT_MS="15000" \
    "$REPO_ROOT/test/bats/helpers/nwc-request.sh"
  lookup_by_invoice="$output"

  [[ "$(echo "$lookup_by_hash" | jq -r '.error.code // empty')" == "" ]] || exit 1
  [[ "$(echo "$lookup_by_hash" | jq -r '.result.state')" == "pending" ]] || exit 1
  [[ "$(echo "$lookup_by_hash" | jq -r '.result.payment_hash')" == "$payment_hash" ]] || exit 1
  [[ "$(echo "$lookup_by_hash" | jq -r '.result.invoice')" == "$invoice" ]] || exit 1
  [[ "$(echo "$lookup_by_invoice" | jq -r '.result.payment_hash')" == "$payment_hash" ]] || exit 1
}

@test "nwc end-to-end flow: list_transactions returns unpaid incoming invoices" {
  local alice_uri memo make_request make_response payment_hash invoice list_request match
  alice_uri="$(read_value "$ALICE_FULL_URI_CACHE_KEY")"
  memo="bats-e2e-list-unpaid-$(date +%s)"
  make_request="$(
    jq -nc \
      --arg description "$memo" \
      '{method: "make_invoice", params: { amount: 1210000, description: $description }}'
  )"

  retry 5 1 env \
    CONNECTION_URI="$alice_uri" \
    NWC_REQUEST_JSON="$make_request" \
    NWC_TIMEOUT_MS="15000" \
    "$REPO_ROOT/test/bats/helpers/nwc-request.sh"

  make_response="$output"
  payment_hash="$(echo "$make_response" | jq -r '.result.payment_hash')"
  invoice="$(echo "$make_response" | jq -r '.result.invoice')"

  list_request='{"method":"list_transactions","params":{"type":"incoming","unpaid":true,"limit":20}}'
  match="$(find_transaction_by_payment_hash "$alice_uri" "$list_request" "$payment_hash")" || exit 1

  [[ "$(echo "$match" | jq -r '.type')" == "incoming" ]] || exit 1
  [[ "$(echo "$match" | jq -r '.state')" == "pending" ]] || exit 1
  [[ "$(echo "$match" | jq -r '.invoice')" == "$invoice" ]] || exit 1
  [[ "$(echo "$match" | jq -r '.amount')" == "1210000" ]] || exit 1
}

@test "nwc end-to-end flow: pay_invoice settles the invoice and appears in both transaction histories" {
  local alice_uri bob_uri memo make_request make_response invoice payment_hash pay_response alice_lookup alice_list_request bob_list_request alice_match bob_match
  alice_uri="$(read_value "$ALICE_FULL_URI_CACHE_KEY")"
  bob_uri="$(read_value "$BOB_FULL_URI_CACHE_KEY")"
  memo="bats-e2e-pay-$(date +%s)"
  make_request="$(
    jq -nc \
      --arg description "$memo" \
      '{method: "make_invoice", params: { amount: 1220000, description: $description }}'
  )"

  retry 5 1 env \
    CONNECTION_URI="$alice_uri" \
    NWC_REQUEST_JSON="$make_request" \
    NWC_TIMEOUT_MS="15000" \
    "$REPO_ROOT/test/bats/helpers/nwc-request.sh"

  make_response="$output"
  invoice="$(echo "$make_response" | jq -r '.result.invoice')"
  payment_hash="$(echo "$make_response" | jq -r '.result.payment_hash')"

  retry 5 1 env \
    CONNECTION_URI="$bob_uri" \
    NWC_REQUEST_JSON="$(jq -nc --arg invoice "$invoice" '{method: "pay_invoice", params: { invoice: $invoice }}')" \
    NWC_TIMEOUT_MS="20000" \
    "$REPO_ROOT/test/bats/helpers/nwc-request.sh"

  pay_response="$output"
  [[ "$(echo "$pay_response" | jq -r '.error.code // empty')" == "" ]] || exit 1
  [[ "$(echo "$pay_response" | jq -r '.result_type')" == "pay_invoice" ]] || exit 1
  [[ "$(echo "$pay_response" | jq -r '.result.preimage | length')" == "64" ]] || exit 1
  [[ "$(echo "$pay_response" | jq -r '.result.fees_paid | numbers')" -ge 0 ]] || exit 1

  alice_lookup="$(
    lookup_invoice_until_state \
      "$alice_uri" \
      "$(jq -nc --arg payment_hash "$payment_hash" '{ payment_hash: $payment_hash }')" \
      "paid" \
      12
  )" || exit 1

  [[ "$(echo "$alice_lookup" | jq -r '.error.code // empty')" == "" ]] || exit 1
  [[ "$(echo "$alice_lookup" | jq -r '.result.state')" == "paid" ]] || exit 1
  [[ "$(echo "$alice_lookup" | jq -r '.result.settled_at | numbers')" -gt 0 ]] || exit 1

  alice_list_request='{"method":"list_transactions","params":{"type":"incoming","limit":20}}'
  bob_list_request='{"method":"list_transactions","params":{"type":"outgoing","limit":20}}'
  alice_match="$(find_transaction_by_payment_hash "$alice_uri" "$alice_list_request" "$payment_hash" 12)" || exit 1
  bob_match="$(find_transaction_by_payment_hash "$bob_uri" "$bob_list_request" "$payment_hash" 12)" || exit 1

  [[ "$(echo "$alice_match" | jq -r '.type')" == "incoming" ]] || exit 1
  [[ "$(echo "$alice_match" | jq -r '.state')" == "paid" ]] || exit 1
  [[ "$(echo "$alice_match" | jq -r '.settled_at | numbers')" -gt 0 ]] || exit 1
  [[ "$(echo "$bob_match" | jq -r '.type')" == "outgoing" ]] || exit 1
  [[ "$(echo "$bob_match" | jq -r '.state')" == "paid" ]] || exit 1
}

@test "nwc end-to-end flow: payment notifications are emitted for NWC-created payments" {
  local alice_uri bob_uri memo since make_request make_response invoice payment_hash
  alice_uri="$(read_value "$ALICE_FULL_URI_CACHE_KEY")"
  bob_uri="$(read_value "$BOB_FULL_URI_CACHE_KEY")"
  memo="bats-e2e-notify-$(date +%s)"
  since="$(( $(date +%s) - 1 ))"
  make_request="$(
    jq -nc \
      --arg description "$memo" \
      '{method: "make_invoice", params: { amount: 1230000, description: $description }}'
  )"

  retry 5 1 env \
    CONNECTION_URI="$alice_uri" \
    NWC_REQUEST_JSON="$make_request" \
    NWC_TIMEOUT_MS="15000" \
    "$REPO_ROOT/test/bats/helpers/nwc-request.sh"

  make_response="$output"
  invoice="$(echo "$make_response" | jq -r '.result.invoice')"
  payment_hash="$(echo "$make_response" | jq -r '.result.payment_hash')"

  retry 5 1 env \
    CONNECTION_URI="$bob_uri" \
    NWC_REQUEST_JSON="$(jq -nc --arg invoice "$invoice" '{method: "pay_invoice", params: { invoice: $invoice }}')" \
    NWC_TIMEOUT_MS="20000" \
    "$REPO_ROOT/test/bats/helpers/nwc-request.sh"

  retry 5 2 env \
    CONNECTION_URI="$alice_uri" \
    NWC_SINCE="$since" \
    NWC_EXPECT_NOTIFICATION_TYPE="payment_received" \
    NWC_EXPECT_PAYMENT_HASH="$payment_hash" \
    NWC_TIMEOUT_MS="20000" \
    "$REPO_ROOT/test/bats/helpers/nwc-notification.sh"
  [[ "$(echo "$output" | jq -r '.notification_type')" == "payment_received" ]] || exit 1

  retry 5 2 env \
    CONNECTION_URI="$bob_uri" \
    NWC_SINCE="$since" \
    NWC_EXPECT_NOTIFICATION_TYPE="payment_sent" \
    NWC_EXPECT_PAYMENT_HASH="$payment_hash" \
    NWC_TIMEOUT_MS="20000" \
    "$REPO_ROOT/test/bats/helpers/nwc-notification.sh"
  [[ "$(echo "$output" | jq -r '.notification_type')" == "payment_sent" ]] || exit 1
}

@test "nwc end-to-end flow: restricted connections reject disallowed methods" {
  local connection_uri response
  connection_uri="$(read_value "$ALICE_READ_ONLY_URI_CACHE_KEY")"

  retry 5 1 env \
    CONNECTION_URI="$connection_uri" \
    NWC_REQUEST_JSON='{"method":"pay_invoice","params":{"invoice":"lnbc1dummy"}}' \
    NWC_TIMEOUT_MS="15000" \
    "$REPO_ROOT/test/bats/helpers/nwc-request.sh"

  response="$output"
  [[ "$(echo "$response" | jq -r '.result_type')" == "pay_invoice" ]] || exit 1
  [[ "$(echo "$response" | jq -r '.error.code')" == "RESTRICTED" ]] || exit 1
  [[ "$(echo "$response" | jq -r '.error.message')" == *"permission"* ]] || exit 1
}

@test "nwc end-to-end flow: validation and unsupported-method errors are returned over the relay" {
  local bob_uri invalid_list_response unsupported_response invalid_invoice_response
  bob_uri="$(read_value "$BOB_FULL_URI_CACHE_KEY")"

  retry 5 1 env \
    CONNECTION_URI="$bob_uri" \
    NWC_REQUEST_JSON='{"method":"list_transactions","params":{"limit":10,"type":"both"}}' \
    NWC_TIMEOUT_MS="15000" \
    "$REPO_ROOT/test/bats/helpers/nwc-request.sh"
  invalid_list_response="$output"

  retry 5 1 env \
    CONNECTION_URI="$bob_uri" \
    NWC_REQUEST_JSON='{"method":"make_me_rich","params":{}}' \
    NWC_TIMEOUT_MS="15000" \
    "$REPO_ROOT/test/bats/helpers/nwc-request.sh"
  unsupported_response="$output"

  retry 5 1 env \
    CONNECTION_URI="$bob_uri" \
    NWC_REQUEST_JSON='{"method":"pay_invoice","params":{"invoice":"lnbc1dummy"}}' \
    NWC_TIMEOUT_MS="15000" \
    "$REPO_ROOT/test/bats/helpers/nwc-request.sh"
  invalid_invoice_response="$output"

  [[ "$(echo "$invalid_list_response" | jq -r '.error.code')" == "OTHER" ]] || exit 1
  [[ "$(echo "$invalid_list_response" | jq -r '.error.message')" == 'Type must be either "incoming", "outgoing" or undefined' ]] || exit 1
  [[ "$(echo "$unsupported_response" | jq -r '.error.code')" == "NOT_IMPLEMENTED" ]] || exit 1
  [[ "$(echo "$unsupported_response" | jq -r '.error.message')" == "Unsupported method: make_me_rich" ]] || exit 1
  [[ "$(echo "$invalid_invoice_response" | jq -r '.error.code')" == "OTHER" ]] || exit 1
}
