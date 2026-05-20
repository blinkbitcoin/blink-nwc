#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-bats}"
TILT_LOG_FILE="${TILT_LOG_FILE:-${REPO_ROOT}/dev/.e2e-tilt.log}"
TILT_PID_FILE="${TILT_PID_FILE:-${REPO_ROOT}/dev/.e2e-tilt_pid}"
TILT_WAIT_TIMEOUT_SECONDS="${TILT_WAIT_TIMEOUT_SECONDS:-720}"
TILT_PID=""
CLEANED_UP=false

if [[ "$MODE" == "integration" || "$MODE" == "bats" ]]; then
  shift || true
else
  MODE="bats"
fi

cd "$REPO_ROOT"

print_tilt_tail() {
  if [[ -f "$TILT_LOG_FILE" ]]; then
    echo "Last 200 lines from $TILT_LOG_FILE:"
    tail -n 200 "$TILT_LOG_FILE" || true
  fi
}

cleanup() {
  if [[ "$CLEANED_UP" == "true" ]]; then
    return
  fi

  CLEANED_UP=true
  echo "Stopping Tilt environment..."
  make tilt-down || true
}

finish() {
  local status=$?
  trap - EXIT INT TERM
  cleanup
  exit "$status"
}

finish_interrupted() {
  local status=$1
  trap - EXIT INT TERM
  cleanup
  exit "$status"
}

trap finish EXIT
trap 'finish_interrupted 130' INT
trap 'finish_interrupted 143' TERM

tilt_is_running() {
  [[ -z "$TILT_PID" ]] || kill -0 "$TILT_PID" >/dev/null 2>&1
}

wait_until() {
  local description="$1"
  shift
  local started_at
  started_at="$(date +%s)"

  until "$@"; do
    if ! tilt_is_running; then
      echo "Tilt exited before ${description} became ready."
      print_tilt_tail
      exit 1
    fi

    if (( "$(date +%s)" - started_at >= TILT_WAIT_TIMEOUT_SECONDS )); then
      echo "Timed out waiting for ${description}."
      print_tilt_tail
      exit 1
    fi

    sleep 2
  done

  echo "${description} is ready."
}

nwc_postgres_up() {
  pg_isready -h localhost -p 5435 -U blink-nwc-usr >/dev/null 2>&1
}

if [[ "$MODE" == "bats" ]]; then
  if [[ $# -gt 0 ]]; then
    BATS_TARGETS=("$@")
  else
    BATS_TARGETS=("test/bats")
  fi

  USE_RUNNING_NWC_DEV=true bats \
    --setup-suite-file test/bats/ci_setup_suite.bash \
    -t "${BATS_TARGETS[@]}"
  exit
fi

mkdir -p "$(dirname "$TILT_LOG_FILE")"
rm -f "$TILT_LOG_FILE" "$TILT_PID_FILE"

make tilt-down >/dev/null 2>&1 || true
tilt --file "${REPO_ROOT}/Tiltfile" up nwc-pg > "$TILT_LOG_FILE" 2>&1 &
TILT_PID=$!
echo "$TILT_PID" > "$TILT_PID_FILE"

wait_until "NWC Postgres" nwc_postgres_up
pnpm generate-gql-types
make integration-test
