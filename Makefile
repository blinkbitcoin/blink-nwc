generate-gql-types:
	pnpm generate-gql-types

generate-supergraph:
	pnpm generate-supergraph

check-code:
	pnpm tsc-check
	pnpm eslint-check
	pnpm build
	pnpm check-sdl

unit-test:
	pnpm run unit

integration-test:
	pnpm run integration

bats-test: build
	bats -t test/bats

build:
	pnpm build

# 16 is exit code for critical https://classic.yarnpkg.com/lang/en/docs/cli/audit
audit:
	bash -c 'pnpm audit --audit-level critical; [[ $$? -ge 16 ]] && exit 1 || exit 0'

clean-deps:
	docker compose -p blink-nwc -f vendor/blink-quickstart/docker-compose.yml -f docker-compose.yml -f docker-compose.override.yml down -t 3

reset-deps: clean-deps start-supergraph

start-deps: start-supergraph

start-supergraph:
	docker compose -p blink-nwc \
		-f vendor/blink-quickstart/docker-compose.yml -f docker-compose.yml \
		-f docker-compose.override.yml up -d

start-subgraph:
	pnpm dev

start: start-supergraph
	make start-subgraph

update-vendor:
	vendir sync
