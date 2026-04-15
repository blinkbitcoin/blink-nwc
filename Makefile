.PHONY: generate-gql-types generate-supergraph check-code unit-test integration-test bats-test build audit clean-deps reset-deps start-deps start-supergraph start-subgraph start tilt-up tilt-up-bg tilt-down update-vendor

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

bats-test: build
	USE_RUNNING_NWC_DEV=$${USE_RUNNING_NWC_DEV:-false} bats -t test/bats

build:
	pnpm build

tilt-up:
	tilt up

tilt-up-bg:
	tilt up &

tilt-down:
	tilt down

# 16 is exit code for critical https://classic.yarnpkg.com/lang/en/docs/cli/audit
audit:
	bash -c 'pnpm audit --audit-level critical; [[ $$? -ge 16 ]] && exit 1 || exit 0'

clean-deps:
	docker compose -p blink-nwc -f vendor/blink-quickstart/docker-compose.yml -f docker-compose.yml -f docker-compose.override.yml down -t 3

reset-deps: clean-deps start-deps

# CI and dependency-only workflows still use the compose path.
start-deps: start-supergraph

start-supergraph:
	docker compose -p blink-nwc \
		-f vendor/blink-quickstart/docker-compose.yml -f docker-compose.yml \
		-f docker-compose.override.yml up -d

start-subgraph:
	pnpm dev

# Default local development entrypoint.
start: tilt-up

update-vendor:
	vendir sync
