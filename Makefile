.PHONY: generate-gql-types generate-supergraph check-code unit-test integration-test bats-test build audit start tilt-up tilt-up-bg tilt-down update-vendor

generate-gql-types:
	pnpm generate-gql-types

generate-supergraph:
	pnpm generate-supergraph

check-code:
	pnpm generate-gql-types
	pnpm tsc-check
	pnpm eslint-check
	pnpm build

unit-test:
	pnpm run unit

integration-test:
	pnpm run integration

bats-test:
	USE_RUNNING_NWC_DEV=$${USE_RUNNING_NWC_DEV:-false} bats -t test/bats

build:
	pnpm build

tilt-up:
	tilt up

tilt-up-bg:
	mkdir -p dev
	tilt up > dev/.e2e-tilt.log 2>&1 & echo $$! > dev/.e2e-tilt_pid

tilt-down:
	tilt down
	@if [ -f dev/.e2e-tilt_pid ]; then \
		kill "$$(cat dev/.e2e-tilt_pid)" > /dev/null 2>&1 || true; \
		rm -f dev/.e2e-tilt_pid; \
	fi

audit:
	pnpm audit --audit-level critical

# Default local development entrypoint.
start: tilt-up

update-vendor:
	vendir sync
