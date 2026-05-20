#!/usr/bin/env bats

load "helpers/setup-and-teardown"

ALICE_NOTIFICATION_URI_CACHE_KEY="alice_nwc_notification_connection_uri"
BOB_NOTIFICATION_URI_CACHE_KEY="bob_nwc_notification_connection_uri"
ALICE_NOTIFICATION_CONNECTION_ID_CACHE_KEY="alice_nwc_notification_connection_id"
BOB_NOTIFICATION_CONNECTION_ID_CACHE_KEY="bob_nwc_notification_connection_id"
ALICE_BTC_WALLET_ID_CACHE_KEY="alice_btc_wallet_id"
BOB_BTC_WALLET_ID_CACHE_KEY="bob_btc_wallet_id"

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
  alice_btc_wallet_id="$(
    graphql_output '.data.me.defaultAccount.wallets[] | select(.walletCurrency == "BTC") | .id'
  )"
  [[ -n "${alice_btc_wallet_id}" && "${alice_btc_wallet_id}" != "null" ]] || exit 1
  cache_value "$ALICE_BTC_WALLET_ID_CACHE_KEY" "$alice_btc_wallet_id"

  exec_graphql "$BOB_TOKEN_NAME" "me-for-nwc-bootstrap" "{}"
  bob_btc_wallet_id="$(
    graphql_output '.data.me.defaultAccount.wallets[] | select(.walletCurrency == "BTC") | .id'
  )"
  [[ -n "${bob_btc_wallet_id}" && "${bob_btc_wallet_id}" != "null" ]] || exit 1
  cache_value "$BOB_BTC_WALLET_ID_CACHE_KEY" "$bob_btc_wallet_id"

  exec_graphql "$ALICE_TOKEN_NAME" "nwc-service-info" "{}"
  server_pubkey="$(graphql_output '.data.nwcServiceInfo.serverPubkey')"
  relay_url="$(graphql_output '.data.nwcServiceInfo.relayUrl')"
  [[ -n "${server_pubkey}" && "${server_pubkey}" != "null" ]] || exit 1
  [[ -n "${relay_url}" && "${relay_url}" != "null" ]] || exit 1

  create_notification_connection() {
    local token_name=$1
    local wallet_id=$2
    local permission=$3
    local cache_key=$4
    local id_cache_key=$5
    local app_secret
    local connection_uri
    local create_variables

    app_secret="$(openssl rand -hex 32)"
    connection_uri="nostr+walletconnect://${server_pubkey}?relay=$(printf '%s' "$relay_url" | jq -sRr @uri)&secret=${app_secret}"

    create_variables="$(
      jq -n \
        --arg nwcUri "$connection_uri" \
        --arg walletId "$wallet_id" \
        --arg permission "$permission" \
        '{
          input: {
            nwcUri: $nwcUri,
            walletId: $walletId,
            permissions: [$permission]
          }
        }'
    )"

    exec_graphql "$token_name" "nwc-connection-create" "$create_variables"
    [[ "$(graphql_output '.data.nwcConnectionCreate.errors | length')" == "0" ]] || exit 1

    cache_value "$cache_key" "$(graphql_output '.data.nwcConnectionCreate.connectionUri')"
    cache_value "$id_cache_key" "$(graphql_output '.data.nwcConnectionCreate.connection.id')"
  }

  create_notification_connection \
    "$ALICE_TOKEN_NAME" \
    "$alice_btc_wallet_id" \
    "NOTIFICATIONS_PAYMENT_RECEIVED" \
    "$ALICE_NOTIFICATION_URI_CACHE_KEY" \
    "$ALICE_NOTIFICATION_CONNECTION_ID_CACHE_KEY"
  create_notification_connection \
    "$BOB_TOKEN_NAME" \
    "$bob_btc_wallet_id" \
    "NOTIFICATIONS_PAYMENT_SENT" \
    "$BOB_NOTIFICATION_URI_CACHE_KEY" \
    "$BOB_NOTIFICATION_CONNECTION_ID_CACHE_KEY"

  fund_bob_btc_wallet
}

teardown_file() {
  stop_nostr_subscriber
  stop_server
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

create_invoice_for_alice() {
  local amount=$1
  local memo=$2
  local alice_btc_wallet_id
  alice_btc_wallet_id="$(read_value "$ALICE_BTC_WALLET_ID_CACHE_KEY")"

  local create_variables
  create_variables="$(
    jq -n \
      --arg walletId "$alice_btc_wallet_id" \
      --arg memo "$memo" \
      --argjson amount "$amount" \
      '{
        input: {
          amount: $amount,
          recipientWalletId: $walletId,
          memo: $memo
        }
      }'
  )"

  exec_graphql "$ALICE_TOKEN_NAME" "ln-invoice-create-on-behalf-of-recipient" "$create_variables"
  [[ "$(graphql_output '.data.lnInvoiceCreateOnBehalfOfRecipient.errors | length')" == "0" ]] || exit 1
}

pay_invoice_as_bob() {
  local invoice=$1
  local bob_btc_wallet_id
  bob_btc_wallet_id="$(read_value "$BOB_BTC_WALLET_ID_CACHE_KEY")"

  local pay_variables
  pay_variables="$(
    jq -n \
      --arg walletId "$bob_btc_wallet_id" \
      --arg paymentRequest "$invoice" \
      '{
        input: {
          paymentRequest: $paymentRequest,
          walletId: $walletId
        }
      }'
  )"

  exec_graphql "$BOB_TOKEN_NAME" "ln-invoice-payment-send" "$pay_variables"
  [[ "$(graphql_output '.data.lnInvoicePaymentSend.errors | length')" == "0" ]] || exit 1
  local payment_status
  payment_status="$(graphql_output '.data.lnInvoicePaymentSend.status')"
  [[ "${payment_status}" == "SUCCESS" || "${payment_status}" == "null" ]] || exit 1
}

@test "nwc notifications flow: payment_received notification is published for the recipient connection" {
  local memo="bats-payment-received-$(date +%s)"
  local since
  since="$(( $(date +%s) - 1 ))"

  create_invoice_for_alice 1200 "$memo"
  local invoice payment_hash
  invoice="$(graphql_output '.data.lnInvoiceCreateOnBehalfOfRecipient.invoice.paymentRequest')"
  payment_hash="$(graphql_output '.data.lnInvoiceCreateOnBehalfOfRecipient.invoice.paymentHash')"
  [[ -n "${invoice}" && "${invoice}" != "null" ]] || exit 1
  [[ -n "${payment_hash}" && "${payment_hash}" != "null" ]] || exit 1

  pay_invoice_as_bob "$invoice"

  retry 5 2 env \
    CONNECTION_URI="$(read_value "$ALICE_NOTIFICATION_URI_CACHE_KEY")" \
    NWC_SINCE="$since" \
    NWC_EXPECT_NOTIFICATION_TYPE="payment_received" \
    NWC_EXPECT_PAYMENT_HASH="$payment_hash" \
    NWC_TIMEOUT_MS="20000" \
    "$REPO_ROOT/test/bats/helpers/nwc-notification.sh"

  [[ "$(echo "$output" | jq -r '.notification_type')" == "payment_received" ]] || exit 1
  [[ "$(echo "$output" | jq -r '.notification.type')" == "incoming" ]] || exit 1
  [[ "$(echo "$output" | jq -r '.notification.payment_hash')" == "$payment_hash" ]] || exit 1
  [[ "$(echo "$output" | jq -r '.notification.amount')" -gt 0 ]] || exit 1
  [[ "$(echo "$output" | jq -r '.notification.settled_at')" -gt 0 ]] || exit 1
  local alice_connection_id
  alice_connection_id="$(read_value "$ALICE_NOTIFICATION_CONNECTION_ID_CACHE_KEY")"
  [[ "$(notification_audit_count "payment_received" "$payment_hash" "$alice_connection_id")" == "1" ]] || exit 1
}

@test "nwc notifications flow: payment_sent notification is published for the payer connection" {
  local memo="bats-payment-sent-$(date +%s)"
  local since
  since="$(( $(date +%s) - 1 ))"

  create_invoice_for_alice 1300 "$memo"
  local invoice payment_hash
  invoice="$(graphql_output '.data.lnInvoiceCreateOnBehalfOfRecipient.invoice.paymentRequest')"
  payment_hash="$(graphql_output '.data.lnInvoiceCreateOnBehalfOfRecipient.invoice.paymentHash')"
  [[ -n "${invoice}" && "${invoice}" != "null" ]] || exit 1
  [[ -n "${payment_hash}" && "${payment_hash}" != "null" ]] || exit 1

  pay_invoice_as_bob "$invoice"

  retry 5 2 env \
    CONNECTION_URI="$(read_value "$BOB_NOTIFICATION_URI_CACHE_KEY")" \
    NWC_SINCE="$since" \
    NWC_EXPECT_NOTIFICATION_TYPE="payment_sent" \
    NWC_EXPECT_PAYMENT_HASH="$payment_hash" \
    NWC_TIMEOUT_MS="20000" \
    "$REPO_ROOT/test/bats/helpers/nwc-notification.sh"

  [[ "$(echo "$output" | jq -r '.notification_type')" == "payment_sent" ]] || exit 1
  [[ "$(echo "$output" | jq -r '.notification.type')" == "outgoing" ]] || exit 1
  [[ "$(echo "$output" | jq -r '.notification.payment_hash')" == "$payment_hash" ]] || exit 1
  [[ "$(echo "$output" | jq -r '.notification.amount')" -gt 0 ]] || exit 1
  [[ "$(echo "$output" | jq -r '.notification.settled_at')" -gt 0 ]] || exit 1
  local bob_connection_id
  bob_connection_id="$(read_value "$BOB_NOTIFICATION_CONNECTION_ID_CACHE_KEY")"
  [[ "$(notification_audit_count "payment_sent" "$payment_hash" "$bob_connection_id")" == "1" ]] || exit 1
}

@test "nwc notifications flow: replay does not republish an already audited notification" {
  if [[ "$USE_RUNNING_NWC_DEV" == "true" ]]; then
    skip "requires a subscriber managed by this BATS process"
  fi

  local memo="bats-replay-dedupe-$(date +%s)"
  local since
  since="$(( $(date +%s) - 1 ))"

  create_invoice_for_alice 1400 "$memo"
  local invoice payment_hash
  invoice="$(graphql_output '.data.lnInvoiceCreateOnBehalfOfRecipient.invoice.paymentRequest')"
  payment_hash="$(graphql_output '.data.lnInvoiceCreateOnBehalfOfRecipient.invoice.paymentHash')"
  [[ -n "${invoice}" && "${invoice}" != "null" ]] || exit 1
  [[ -n "${payment_hash}" && "${payment_hash}" != "null" ]] || exit 1

  pay_invoice_as_bob "$invoice"

  retry 5 2 env \
    CONNECTION_URI="$(read_value "$ALICE_NOTIFICATION_URI_CACHE_KEY")" \
    NWC_SINCE="$since" \
    NWC_EXPECT_NOTIFICATION_TYPE="payment_received" \
    NWC_EXPECT_PAYMENT_HASH="$payment_hash" \
    NWC_TIMEOUT_MS="20000" \
    "$REPO_ROOT/test/bats/helpers/nwc-notification.sh"

  local alice_connection_id
  alice_connection_id="$(read_value "$ALICE_NOTIFICATION_CONNECTION_ID_CACHE_KEY")"
  [[ "$(notification_audit_count "payment_received" "$payment_hash" "$alice_connection_id")" == "1" ]] || exit 1

  local replay_since
  replay_since="$(date +%s)"
  rewind_transaction_stream_cursor
  stop_nostr_subscriber
  start_nostr_subscriber

  run env \
    CONNECTION_URI="$(read_value "$ALICE_NOTIFICATION_URI_CACHE_KEY")" \
    NWC_SINCE="$replay_since" \
    NWC_EXPECT_NOTIFICATION_TYPE="payment_received" \
    NWC_EXPECT_PAYMENT_HASH="$payment_hash" \
    NWC_TIMEOUT_MS="10000" \
    "$REPO_ROOT/test/bats/helpers/nwc-notification.sh"

  [[ "$status" -ne 0 ]] || exit 1
  [[ "$output" == *"timed out waiting for relay notification"* ]] || exit 1
  [[ "$(notification_audit_count "payment_received" "$payment_hash" "$alice_connection_id")" == "1" ]] || exit 1
}
