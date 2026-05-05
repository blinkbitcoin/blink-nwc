is_ci = sys.argv[1] == "ci" if len(sys.argv) > 1 else False

nwc_local_env = {
  "DB_HOST": "localhost",
  "DB_PORT": "5435",
  "DB_USER": "blink-nwc-usr",
  "DB_PWD": "blink-nwc-pwd",
  "DB_DB": "blink-nwc",
  "DATA_ENCRYPTION_KEY": "0" * 64,
  "NOSTR_PRIVATE_KEY": "1" * 64,
  "OATHKEEPER_DECISION_ENDPOINT": "http://localhost:4456",
  "ROUTER_URL": "http://localhost:4004/graphql",
  "BLINK_CORE_GRPC_HOST": "localhost",
  "BLINK_CORE_GRPC_PORT": "50053",
  "NWC_NOSTR_MONITORING_PORT": "4011",
  "NOSTR_RELAY_URL": "ws://localhost:7777",
  "NOSTR_RELAY_PUBLIC_URL": "ws://localhost:7777",
}

local_resource(
  name='setup-nwc-db',
  labels = ['dev-setup'],
  cmd='pnpm db:migrate',
  env = nwc_local_env,
  resource_deps = [
    "nwc-pg",
  ]
)

local_resource(
  name='seed-nwc-db',
  labels = ['dev-setup'],
  cmd='pnpm db:seed',
  env = nwc_local_env,
  resource_deps = [
    "setup-nwc-db",
  ]
)

local_resource(
  name='generate-types',
  labels = ['dev-setup'],
  cmd='pnpm generate-gql-types',
)

local_resource(
  name='nwc-dev',
  labels = ['nwc'],
  cmd='pnpm build',
  serve_cmd='pnpm dev',
  env = nwc_local_env,
  serve_env = nwc_local_env,
  links = [
    link("http://localhost:4010/graphql", "graphql-playground"),
    link("http://localhost:4011/metrics", "nwc-nostr-metrics"),
  ],
  readiness_probe = probe(
    period_secs = 5,
    http_get = http_get_action(
      path = "/graphql?query=%7B__typename%7D",
      port = 4010,
    ),
  ),
  resource_deps = [
    "setup-nwc-db",
    "generate-types",
    "strfry",
  ],
)

local_resource(
  name='unit-tests',
  labels = ['test'],
  auto_init = is_ci,
  cmd='pnpm unit',
  resource_deps = [
    "generate-types",
  ],
)

local_resource(
  name='integration-tests',
  labels = ['test'],
  auto_init = is_ci,
  cmd='pnpm integration',
  resource_deps = [
    "setup-nwc-db",
    "generate-types",
  ],
)

docker_compose(['vendor/blink-quickstart/docker-compose.yml', 'docker-compose.yml', 'docker-compose.override.yml'])

galoy_services = ["apollo-router", "galoy", "trigger", "redis", "mongodb", "mongodb-migrate", "price", "price-history", "price-history-migrate", "price-history-pg", "svix", "svix-pg", "notifications", "notifications-pg", "stablesats", "api-keys", "api-keys-pg"]
auth_services = ["oathkeeper", "kratos", "kratos-pg", "hydra", "hydra-pg", "hydra-migrate"]
bitcoin_services = ["bitcoind", "bitcoind-signer", "lnd1", "lnd-outside-1", "bria", "bria-pg", "fulcrum"]
nwc_services = ["nwc-pg", "strfry", "strfry-policy-builder"]

for service in galoy_services:
    dc_resource(service, labels = ["galoy"])
for service in auth_services:
    dc_resource(service, labels = ["auth"])
for service in bitcoin_services:
    dc_resource(service, labels = ["bitcoin"])
for service in nwc_services:
    dc_resource(service, labels = ["nwc"])

dc_resource('otel-agent', labels = ["otel"])
dc_resource('quickstart-test', labels = ['quickstart'], auto_init=False)
