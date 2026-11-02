# Hestia

A self-hosted household-admin PWA: grocery deals and shopping lists, meal planning, bills, and
chores for one household (or a few), running on a single home server. The specifications in
[`docs/`](docs/) are the source of truth for behaviour, architecture, and design.

## Prerequisites

- Node 24 (`nvm use` reads `.nvmrc`)
- pnpm 10 (`corepack enable` picks up the version pinned in `package.json`)
- Docker with Compose
- Supabase CLI
- `psql` on the path, which seeding and the end-to-end suite need

## Quickstart

```sh
pnpm install
pnpm --filter @hestia/web dev        # PWA dev server
pnpm --filter @hestia/service dev    # API (needs DATABASE_URL)
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

The API needs a local database and environment: see
[docs/development.md](docs/development.md#running-the-service-locally). Every command is listed
under [Commands](docs/development.md#commands).

## Architecture

Hestia is a pnpm monorepo: a Fastify API service and a React PWA, over a self-hosted Supabase stack
(Postgres, GoTrue, Realtime, and Kong) behind Caddy as a single origin. The service is the only HTTP
path to application data, and it runs every request in a Postgres transaction as the caller, so
row-level security isolates households. Zod schemas in `packages/shared` define the contract for both
sides of the API, and background jobs run on `node-cron` inside the service. See
[docs/architecture.md](docs/architecture.md).

Production is one Linux host running `docker/docker-compose.yml`; see
[docs/deployment.md](docs/deployment.md).

### Layout

| Path                  | Contents                                            |
| --------------------- | --------------------------------------------------- |
| `apps/web`            | React PWA (Vite, Tailwind, Workbox)                 |
| `apps/service`        | Fastify API, jobs, and the `hestia-admin` CLI       |
| `packages/shared`     | Zod schemas, domain types, shared constants         |
| `packages/recurrence` | Anchored recurrence logic (pure, dependency-free)   |
| `packages/matching`   | Ingredient normalization and matching (pure)        |
| `e2e`                 | Playwright journeys and Flipp fixtures              |
| `supabase`            | Supabase CLI config, SQL migrations, and seed       |
| `docker`              | Compose file, Caddyfile, Kong config, Dockerfiles   |
| `scripts`             | Deploy, secrets, and repository health gate scripts |

## Documentation

| Document                                     | Purpose                                                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [docs/development.md](docs/development.md)   | Local setup, dev servers and commands, running the API locally, database and seed commands, commit hooks. |
| [docs/deployment.md](docs/deployment.md)     | The production runbook: first-time setup, deploys and rollback, backups and restore, troubleshooting.     |
| [docs/testing.md](docs/testing.md)           | How unit, integration, frontend, and end-to-end tests are structured and how to add more.                 |
| [docs/architecture.md](docs/architecture.md) | Request authorization and RLS, data model, API surface, background jobs, realtime, and notifications.     |
| [CONTRIBUTING.md](CONTRIBUTING.md)           | Development workflow, quality gates, and commit guidelines.                                               |
