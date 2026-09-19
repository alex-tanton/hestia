# Hearth

A self-hosted household-admin PWA: grocery deals and shopping lists, meal planning, bills, and
chores for one household (or a few), running on a single home server. The specifications in
[`docs/`](docs/) are the source of truth for behaviour, architecture, and design.

## Prerequisites

- Node 24 (`nvm use` reads `.nvmrc`)
- pnpm 10 (`corepack enable` picks up the version pinned in `package.json`)
- Docker with Compose
- Supabase CLI

## Layout

| Path                  | Contents                                          |
| --------------------- | ------------------------------------------------- |
| `apps/web`            | React PWA (Vite, Tailwind, Workbox)               |
| `apps/service`        | Fastify API, jobs, and the `hearth-admin` CLI     |
| `packages/shared`     | Zod schemas, domain types, shared constants       |
| `packages/recurrence` | Anchored recurrence logic (pure, dependency-free) |
| `packages/matching`   | Ingredient normalization and matching (pure)      |
| `e2e`                 | Playwright journeys and Flipp fixtures            |

## Development

```sh
pnpm install
pnpm --filter @hearth/web dev        # PWA dev server
pnpm --filter @hearth/service dev    # API (needs DATABASE_URL)
```

| Command                 | Runs                                            |
| ----------------------- | ----------------------------------------------- |
| `pnpm lint`             | ESLint                                          |
| `pnpm format`           | Prettier (write); `pnpm format:check` to verify |
| `pnpm typecheck`        | `tsc --noEmit` in every workspace               |
| `pnpm test`             | Vitest unit and component tests                 |
| `pnpm test:integration` | Vitest against `supabase start`                 |
| `pnpm test:e2e`         | Playwright (base URL `HEARTH_E2E_BASE_URL`)     |
| `pnpm build`            | Production builds of web and service            |

Commits follow Conventional Commits, checked by commitlint in a Husky hook; the pre-commit hook
lints, formats, and typechecks.
