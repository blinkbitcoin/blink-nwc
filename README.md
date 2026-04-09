# Nostr Wallet Connect

Nostr Wallet Connect GraphQL subgraph for Blink wallet. Built with Apollo Federation, Buck2, and Tilt. Includes Nix for dependency management and Galoy quickstart for local development infrastructure.

## Features

- 🚀 Apollo Federation v2 support
- 🛠️ Buck2 and Tilt for development workflow
- ❄️ Nix flakes for reproducible development environment
- 📦 Galoy quickstart with docker-compose
- 🔍 GraphQL codegen for type safety
- 🎯 OpenTelemetry tracing built-in
- ⚡ Nostr Wallet Connect protocol implementation

## Prerequisites

- [Nix with flakes enabled](https://nixos.org/download.html)
- [direnv](https://direnv.net/) (optional but recommended)

## Quick Start

1. Install dependencies:
```bash
pnpm install
```

2. Sync vendor dependencies:
```bash
vendir sync
```

3. Generate GraphQL types:
```bash
pnpm generate-gql-types
```

4. Start the local development environment:
```bash
nix develop -c make start
```

This starts the Tilt-driven workflow for Blink NWC. Tilt will orchestrate the local containers, codegen, database setup, and the NWC dev server.

Useful endpoints:

- GraphQL playground: http://localhost:4010/graphql
- Apollo Router: http://localhost:4004/graphql
- Tilt UI: http://localhost:10350

## Running with Supergraph

For normal local development, use Tilt:

```bash
nix develop -c make start
```

For dependency-only workflows, keep using the compose path:

1. Start shared dependencies and Apollo Router:
```bash
make start-deps
```

2. Start only the NWC subgraph process:
```bash
pnpm dev
```

This split path is still useful for CI and for cases where you do not want Tilt managing the full session.

## Development

### Available Scripts

- `make start` - Start the full Tilt-based local development environment
- `make tilt-up` - Run `tilt up` explicitly
- `make tilt-down` - Stop the Tilt session
- `make start-deps` - Start only docker-compose dependencies and Apollo Router
- `pnpm dev` - Start only the NWC subgraph server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm generate-gql-types` - Generate TypeScript types from GraphQL schema
- `pnpm generate-supergraph` - Generate supergraph schema for federation
- `pnpm tsc-check` - Type check TypeScript
- `pnpm eslint-check` - Lint code
- `pnpm eslint-fix` - Fix linting issues

### Project Structure

```
.
├── src/
│   ├── config/          # Configuration
│   ├── graphql/         # GraphQL schema and resolvers
│   │   ├── schema.graphql
│   │   └── resolvers.ts
│   ├── server/          # Server setup
│   └── services/        # Service layer (logger, tracing)
├── dev/                 # Development configuration
│   └── apollo-federation/
├── vendor/              # Vendored dependencies (galoy-quickstart)
├── flake.nix           # Nix flake for development environment
├── vendir.yml          # Vendor dependency configuration
└── docker-compose.yml  # Docker compose for local services
```

### Customizing the Schema

1. Edit `src/graphql/schema.graphql` to define your schema
2. Update `src/graphql/resolvers.ts` to implement your resolvers
3. Run `pnpm generate-gql-types` to generate TypeScript types
4. Implement your business logic

### Environment Variables

- `SUBGRAPH_PORT` - Port for the subgraph server (default: 4010)
- `NODE_ENV` - Node environment (default: development)
- `APOLLO_PLAYGROUND_ENABLED` - Enable GraphQL playground (default: true)

## Nix Development Environment

This project uses Nix flakes for a reproducible development environment. The flake provides:

- Node.js 20
- pnpm
- Docker Compose
- Various development tools (vendir, jq, ytt, buf, etc.)

To enter the development environment:

```bash
nix develop
```

Or with direnv:
```bash
direnv allow
```

## Updating Vendor Dependencies

This project uses `vendir` to manage vendor dependencies from the Galoy repository.

To update:
```bash
make update-vendor
```

## Docker Compose

The project includes docker-compose configuration for:
- Apollo Router (for federation)
- Dependencies from galoy-quickstart (MongoDB, Redis, etc.)

## License

MIT
