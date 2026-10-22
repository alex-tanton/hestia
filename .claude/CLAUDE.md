<!-- GSD:project-start source:PROJECT.md -->

## Project

**Hearth — Cleanup and Hardening**

Hearth is a household-management PWA (shopping lists, chores, bills, meals/recipes, deals, notifications) for a single household, built as a React + Vite PWA and a Fastify service over Postgres/Supabase with RLS as the isolation boundary. The application was built largely with an LLM. This milestone is a cleanup pass: remove dead code, generated and leftover files, and redundancy, and make the repo, CI, and code healthier and more robust before the owner does a manual review.

**Core Value:** The owner can start a manual review from a lean, trustworthy base: no dead code or stray generated files, a CI suite that passes repeatably regardless of day or timezone, and the known bugs fixed with regression tests.

### Constraints

- **Behavior**: Existing application behavior must not change except where fixing a documented bug — cleanup must be safe
- **Evidence**: Dead-code removal requires tooling or test proof; ambiguous cases are reported, not deleted
- **Verification**: Every bug fix ships with a regression test; full suite and CI must remain green
- **Tech stack**: Existing stack (pnpm, TypeScript, Fastify, React/Vite, Postgres/Supabase, Playwright) — no framework migrations
- **Git**: `main` is curated and published (Phase 1, `origin/main` from d3da748), and every push to it runs CI and a deploy (only `docs/` is exempt). Work on branches or worktrees and land changes through pull requests per `CONTRIBUTING.md`; never force-push or rewrite published history without the owner's approval
- **Docs**: Specs in `docs/` are the only source of truth; no review, decision-log, or ADR files are added there

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 6.0.3 (`typescript` devDependency in the root and every workspace) - all application code: `apps/service/src/`, `apps/web/src/`, `packages/*/src/`, `e2e/`, `supabase/seed/`
- TSX - React screens and components in `apps/web/src/components/`, `apps/web/src/screens/`, `apps/web/src/pillars/`
- SQL (PostgreSQL dialect) - schema, RLS, and functions in `supabase/migrations/*.sql` (8 files, applied in filename order)
- HTML and CSS - `apps/web/index.html`, `apps/web/src/index.css` (Tailwind CSS v4)
- POSIX shell - `scripts/deploy.sh`, `scripts/generate-secrets.sh`, `scripts/ci-prepull-images.sh`, `docker/caddy-entrypoint.sh`, `docker/kong-entrypoint.sh`, and the CLI wrapper `apps/service/bin/hearth-admin` (a hand-written `sh` script that `exec`s `node dist/cli.js`; it is not a build output)
- Node ESM `.mjs` - `apps/web/scripts/check-build.mjs`, `apps/web/scripts/generate-icons.mjs`, `test/clock-setup.mjs`, `test/global-tz.mjs`, `scripts/test-sweep.mjs`, `scripts/knip-summary.mjs`

## Runtime

- Node.js 24 - `.nvmrc` contains `24`; root `package.json` `engines` is `>=24 <25`
- Container base image: `node:24.21.0-bookworm-slim` in `docker/service.Dockerfile` (all stages) and in the build stage of `docker/caddy.Dockerfile`
- Browser target: evergreen browsers, installed as a PWA (`apps/web/vite.config.ts`, `vite-plugin-pwa`)
- pnpm 10.34.5 - pinned by the `packageManager` field in `package.json`; activated with `corepack enable` in the Dockerfiles and `pnpm/action-setup@v6` in CI (`.github/actions/setup/action.yml`)
- Workspace definition: `pnpm-workspace.yaml` (packages `apps/*`, `packages/*`, `e2e`, `supabase/seed`); `saveExact: true`; `onlyBuiltDependencies: [esbuild]`
- Lockfile: present - `pnpm-lock.yaml`. CI and Docker builds use `--frozen-lockfile`.
- Dependency override: `esbuild` forced to `0.28.2` in root `package.json` `pnpm.overrides`
- Peer-dependency exception: `allowedVersions` in `pnpm-workspace.yaml` permits `eslint-plugin-jsx-a11y` to peer on ESLint 10

## Frameworks

- Fastify 5.12.5 - HTTP server; app factory `apps/service/src/app.ts`, entry point `apps/service/src/main.ts`
- `@fastify/rate-limit` 11.2.0 - per-IP limit on `/api/*`; default 300 per minute from `apps/service/src/env.ts` (`HEARTH_RATE_LIMIT_PER_MINUTE`)
- Zod 4.6.5 - environment and request validation (`apps/service/src/env.ts`)
- Kysely 0.29.6 over `pg` 8.23.0 - typed query builder; pool in `apps/service/src/db.ts`; generated types in `apps/service/src/db/types.ts`
- node-cron 4.6.0 - in-process scheduler (`apps/service/src/jobs/scheduler.ts`)
- cheerio 1.2.0 - HTML parsing for recipe import (`apps/service/src/recipes/json-ld.ts`, `apps/service/src/recipes/fetch-recipe.ts`)
- parse-ingredient 3.0.0 - recipe ingredient parsing (`apps/service/src/recipes/ingredient-parser.ts`)
- web-push 3.6.7 - VAPID-signed Web Push delivery (`apps/service/src/push/web-push-transport.ts`, typed in `apps/service/src/push/web-push.d.ts`)
- React 19.3.0 and react-dom 19.3.0; `@types/react` and `@types/react-dom` 19.3.0
- React Router 8.4.0 (`react-router`) - routes in `apps/web/src/routes.tsx`
- TanStack Query 5.103.1 (`@tanstack/react-query`), with `@tanstack/react-query-persist-client` and `@tanstack/query-async-storage-persister` 5.103.1 for the offline cache (`apps/web/src/lib/offline/persist.ts`)
- idb-keyval 6.2.2 - IndexedDB storage behind the persisted query cache
- Radix UI 1.6.7 (`radix-ui`) - primitives wrapped in `apps/web/src/components/ui/`
- lucide-react 1.47.0 - icons
- Tailwind CSS 4.3.3 with `@tailwindcss/vite` 4.3.3 - styling (`apps/web/src/index.css`)
- Vite 8.3.0 with `@vitejs/plugin-react` 6.1.1 - dev server and bundler (`apps/web/vite.config.ts`)
- `vite-plugin-pwa` 1.3.0 - `injectManifest` strategy; the service worker is authored in `apps/web/src/sw.ts`; `registerType: 'prompt'`. Workbox 7.4.1 packages (`workbox-precaching`, `workbox-routing`, `workbox-strategies`, `workbox-expiration`, `workbox-cacheable-response`, `workbox-window`) are direct devDependencies of `apps/web`
- `@supabase/supabase-js` 2.116.0 - browser auth and Realtime client, loaded with a dynamic `import()` (`apps/web/src/lib/auth/auth-client.ts`)
- `@hearth/shared` (`packages/shared`) - Zod 4.6.5 request and response schemas
- `@hearth/recurrence` (`packages/recurrence`) - `@date-fns/tz` 1.5.0 and date-fns 4.4.0
- `@hearth/matching` (`packages/matching`) - fastest-levenshtein 1.0.16
- `@hearth/seed` (`supabase/seed`) - `@hearth/matching` and `pg` 8.23.0
- tsup 8.5.1 - bundles the service to `apps/service/dist/` (`apps/service/tsup.config.ts`); `apps/service/src/write-openapi.ts` runs after it in `build`
- tsx 4.23.13 - runs TypeScript directly for `dev`, the seed tooling, and fixture scripts
- Vitest 5.0.1 - unit and integration tests in every workspace (`apps/service/vitest.config.ts`, `vitest.integration.config.ts`, `vitest.coverage.config.ts`; `apps/web/vite.config.ts` test block)
- `@vitest/coverage-v8` 5.0.1 - coverage in `apps/service`, `apps/web`, and `packages/*`
- jsdom 30.1.0 - DOM environment for `apps/web`
- @testing-library/react 16.3.3, @testing-library/dom 10.4.2, @testing-library/jest-dom 7.0.1, @testing-library/user-event 14.6.7 - component tests
- `@playwright/test` 1.63.0 and `@axe-core/playwright` 4.13.0 - E2E and accessibility (`e2e/playwright.config.ts`)
- Test harness uses `node --test` for the root harness tests (`package.json` `test:harness`)
- ESLint 10.11.0 with `typescript-eslint` 8.70.0, `@eslint/js` 10.0.1, `eslint-plugin-react-hooks` 7.1.1, `eslint-plugin-jsx-a11y` 6.10.2, `eslint-config-prettier` 10.1.8, `globals` 17.12.0 - config in `eslint.config.js`
- Prettier 3.9.8 - `.prettierrc.json`, ignores in `.prettierignore`
- Husky 9.1.7 and lint-staged 17.5.1 - hooks in `.husky/` and `.lintstagedrc.json`
- `@commitlint/cli` and `@commitlint/config-conventional` 21.2.2 - `commitlint.config.js`
- knip 6.41.0 - report-only unused-code scan; config `knip.json`; run with `pnpm knip` (CI does not run it)
- kysely-codegen 0.20.0 - `pnpm db:types` regenerates `apps/service/src/db/types.ts` against a running local database
- `yaml` 2.9.1 - devDependency of `apps/service`

## Key Dependencies

- `fastify` 5.12.5 - the entire HTTP API surface; routes in `apps/service/src/routes/`
- `kysely` 0.29.6 and `pg` 8.23.0 - all application database access, always inside a user- or service-scoped transaction (`apps/service/src/db/user-db.ts`)
- `zod` 4.6.5 - validation shared by service, web, and `packages/shared`
- `web-push` 3.6.7 - Web Push; the VAPID key pair is required at startup (`apps/service/src/env.ts`)
- `node-cron` 4.6.0 - scheduled jobs (`apps/service/src/jobs/index.ts`)
- `@supabase/supabase-js` 2.116.0 - browser sign-in, token refresh, and Realtime channels (`apps/web/src/lib/realtime/supabase-realtime.ts`)
- `@tanstack/react-query` 5.103.1 - server state and offline persistence
- `cheerio` 1.2.0 and `parse-ingredient` 3.0.0 - recipe import

## Configuration

- Required: `DATABASE_URL`, `HEARTH_ORIGIN`, `GOTRUE_URL`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- Optional with defaults: `HOST` (`0.0.0.0`), `PORT` (`3000`), `LOG_LEVEL` (`info`), `HEARTH_TRUSTED_PROXIES`, `HEARTH_OWNER_EMAIL`, `HEARTH_RATE_LIMIT_PER_MINUTE` (`300`), `HEARTH_PUSH_TRANSPORT` (`web-push`)
- Optional: `BACKUP_DIR`, `VAPID_SUBJECT`
- E2E-only overrides (set only by the E2E Compose overlay): `HEARTH_FLIPP_FIXTURE_DIR`, `HEARTH_FLIPP_FIXTURE_NOW`, `HEARTH_RECIPE_FIXTURE_DIR`, `HEARTH_PUSH_TRANSPORT=test-double`
- The owner CLI reads only `HEARTH_ORIGIN`, `GOTRUE_URL`, and `SERVICE_ROLE_KEY` (`parseCliEnv` in `apps/service/src/env.ts`)
- `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VITE_MAGIC_LINK_ENABLED`
- Injected as Docker build args in `docker/caddy.Dockerfile`; changing them requires a rebuild
- Dev and preview proxies read `HEARTH_DEV_API` (default `http://127.0.0.1:3000`) and `HEARTH_DEV_SUPABASE` (default `http://127.0.0.1:54321`) from `apps/web/vite.config.ts`
- The production env file lives outside the checkout at `/srv/hearth/.env`, passed to Compose with `--env-file`. `.env.example` at the repo root documents every key by name; `.gitignore` excludes `.env*` except `.env.example`.
- `scripts/generate-secrets.sh` writes that file once and refuses to overwrite it.
- `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json` with per-package `tsconfig.json`
- `apps/service/tsup.config.ts`, `apps/web/vite.config.ts`, `apps/service/vitest*.config.ts`, `e2e/playwright.config.ts`
- `eslint.config.js`, `.prettierrc.json`, `commitlint.config.js`, `.lintstagedrc.json`, `knip.json`
- `supabase/config.toml` - local Supabase CLI stack (Postgres major version 17, Realtime enabled, GoTrue auth with `site_url` `http://127.0.0.1:5173`, API gateway disabled)
- `.github/dependabot.yml` - weekly updates for npm, GitHub Actions, and Docker images

## Platform Requirements

- Node.js 24 and pnpm 10.34.5 (via corepack)
- Supabase CLI 2.117.0 for `supabase start` and `supabase db reset` (CI pins the same version)
- `psql` on PATH for `pnpm db:seed`
- Docker with the Compose plugin for the full stack and the E2E overlay `e2e/docker-compose.e2e.yml`
- Playwright Chromium: `pnpm --filter @hearth/e2e exec playwright install --with-deps chromium`
- Single Linux host running the Compose stack in `docker/docker-compose.yml`
- Only the `caddy` service publishes a port, bound to `127.0.0.1:8080`; public ingress is Tailscale Funnel
- A second disk mounted at `BACKUP_DIR`
- Self-hosted GitHub Actions runner with labels `self-hosted, hearth` (`.github/workflows/deploy.yml`)

## Container Images

| Service | Image | Source |
|---------|-------|--------|
| `db` | `public.ecr.aws/supabase/postgres:17.6.1.167` | `docker/docker-compose.yml` |
| `auth` | `public.ecr.aws/supabase/gotrue:v2.196.0` | `docker/docker-compose.yml` |
| `realtime` | `public.ecr.aws/supabase/realtime:v2.130.0` | `docker/docker-compose.yml` |
| `kong` | `kong/kong:3.9.3` | `docker/docker-compose.yml`, config `docker/kong.yml` |
| `hearth-service` | `hearth-service:${HEARTH_TAG}` | built from `docker/service.Dockerfile` |
| `caddy` | `hearth-caddy:${HEARTH_TAG}` | built from `docker/caddy.Dockerfile`, final stage `caddy:2.11.7-alpine`, config `docker/Caddyfile` |
| `backup` | `prodrigestivill/postgres-backup-local:17-debian-d257e5d` | `docker/docker-compose.yml` |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Service and package modules are kebab-case `.ts`: `apps/service/src/services/bills.ts`, `apps/service/src/deals/flipp/request-queue.ts`, `packages/recurrence/src/bills.ts`.
- React components are PascalCase `.tsx` named after the component: `apps/web/src/components/ui/Button.tsx`, `apps/web/src/screens/bills/BillDetailScreen.tsx`.
- Other web modules are kebab-case `.ts`: `apps/web/src/lib/format.ts`, `apps/web/src/lib/offline/write-queue.ts`.
- Web hooks are `use-*.ts(x)` (`apps/web/src/lib/use-online-status.ts`). The API hook modules are `*-hooks.ts` (`apps/web/src/lib/api/bills-hooks.ts`).
- Copy catalogs sit next to their feature as `*-copy.ts` (`apps/web/src/components/bills/bills-copy.ts`).
- Screens are `*Screen.tsx` under `apps/web/src/screens/<feature>/`. Route wrappers are `*Route.tsx` (`apps/web/src/screens/settings/SettingsRoute.tsx`).
- Route plugins: one file per resource in `apps/service/src/routes/` (`bills.ts`, `chores.ts`, `meal-plan.ts`).
- Migrations: `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`.
- Tests: `<name>.test.ts(x)` co-located with the module, or `<name>.integration.test.ts` for database and route tests against `supabase start`. Test helpers live in `apps/service/src/test/` and `apps/web/src/test/`.
- camelCase. Service and domain functions are verbs: `listBills`, `createHouseholdBill`, `payBill`, `archiveBill` in `apps/service/src/services/bills.ts`.
- Pure planners return a plan object: `planBillMove` in `packages/recurrence/src/bills.ts`.
- React components are PascalCase function declarations with an explicit return type: `export function Button({...}: ButtonProps): ReactElement` in `apps/web/src/components/ui/Button.tsx`.
- camelCase locals.
- Module-level constants are SCREAMING_SNAKE_CASE: `PROBLEM_CONTENT_TYPE` (`packages/shared/src/problem.ts`), `DATABASE_PROBLEMS` (a non-exported table in `apps/service/src/problem.ts`), `VARIANT_CLASSES` (`apps/web/src/components/ui/Button.tsx`).
- Lookup tables are typed `Readonly<Record<...>>`.
- Zod schemas are camelCase with a `Schema` suffix; the type is the inferred PascalCase name: `billSchema` and `type Bill = z.infer<typeof billSchema>` in `packages/shared/src/api/bills.ts`.
- Request and path-param schemas follow the same pair: `createBillRequestSchema`, `billIdParamsSchema`.
- Props interfaces are `<Component>Props` (`ButtonProps`), exported when tests or siblings need them.
- Use string-union types over enums: `export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';` in `apps/web/src/components/ui/Button.tsx`. Zod enums are `z.enum([...])`, then inferred.
- Database columns and raw rows are snake_case (`recurrence_unit`, `anchor_date`). API and shared-layer fields are camelCase (`recurrenceUnit`, `anchorDate`). The mapping happens in one layer.
- `apps/service/src/db/types.ts` is generated by kysely-codegen (`pnpm db:types`). It is excluded from ESLint and must not be hand-edited.

## Code Style

- Prettier 3 with `.prettierrc.json`: `"singleQuote": true`, `"printWidth": 100`. Trailing commas, semicolons, and 2-space indent are Prettier defaults.
- `.prettierignore` lists the non-source paths. CI enforces formatting with `pnpm format:check` (`.github/workflows/ci.yml`, `lint` job).
- Long union types and call arguments wrap one item per line. JSX props wrap one per line.
- ESLint flat config at `eslint.config.js`: `js.configs.recommended`, `tseslint.configs.strictTypeChecked`, and `stylisticTypeChecked`, plus `eslint-config-prettier` last.
- Web files (`apps/web/**/*.{ts,tsx}`) add `eslint-plugin-jsx-a11y` (strict) and `eslint-plugin-react-hooks` (recommended).
- Rules set explicitly: `@typescript-eslint/explicit-module-boundary-types` (error) and `@typescript-eslint/no-non-null-assertion` (error, off in test files).
- `pnpm lint` runs `eslint --max-warnings=0 .`. Warnings fail the run. It runs in CI and in the pre-commit hook.
- Custom fences in `eslint.config.js`:
- `tsconfig.base.json` is strict: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `useUnknownInCatchVariables`, `verbatimModuleSyntax`, `erasableSyntaxOnly`.
- Run with `pnpm typecheck` (`pnpm -r --parallel typecheck`).
- Optional props use `?` with `exactOptionalPropertyTypes` in mind: `disabledReason?: string | undefined` in `apps/web/src/components/ui/Button.tsx`.
- Lint suppression directives in source, tests, and E2E: five real `eslint-disable-next-line` comments. `apps/service/src/cli.test.ts:65` (`prefer-promise-reject-errors`); `apps/service/src/test/zone-dates.ts:15`, `apps/service/src/deals/flipp/request-queue.test.ts` (two, lines 27 and 174), and `e2e/support/clock.ts:12` (all `no-restricted-syntax`, clock reads). Four carry a `-- reason`; the `cli.test.ts` one states its reason in the comment line above it.
- `as any` does not appear in `apps/*/src` or `packages/*/src`. `strictTypeChecked` forbids explicit `any`.
- Double casts (`as unknown as`) appear in production code only in `apps/service/src/services/deals/storage.ts` (two uses of `as unknown as DealRow[]`). Test code uses more of them, mostly to hand a stub to a typed port (`apps/web/src/lib/realtime/supabase-realtime.test.ts`). Prefer a narrowed type or a Zod `parse()` over `as`.
- Do not add new `as` casts to production code without a reason in the review.
- ESM everywhere (`"type": "module"`).
- Service and packages use NodeNext resolution: relative imports end in `.js` even though the source is `.ts`. Example: `import { ProblemError } from '../problem.js';` in `apps/service/src/services/bills.test.ts`.
- Web uses Bundler resolution with explicit `.ts` and `.tsx` extensions: `import { useApi } from './api-context.tsx';` in `apps/web/src/lib/api/bills-hooks.ts`, enabled by `allowImportingTsExtensions`. Example: `apps/web/src/test/harness.tsx` imports `../App.tsx`.
- Type-only imports use `import type`. Mixed imports inline the modifier: `import { x, type Y }` (`apps/web/src/components/ui/Button.tsx`).

## Import Organization

## Error Handling

- Errors are RFC 9457 problem details, never bare strings. `problem(status, detail?)` builds the body and `fail(status, detail?)` throws a `ProblemError`. Both are in `apps/service/src/problem.ts`.
- The global error handler in `apps/service/src/app.ts` sends a `ProblemError` unchanged. For 5xx responses it logs the error with `scrubErrorName` and `scrubErrorText` (from `@hearth/shared`) applied to the name and message, not the raw values.
- Validate at the route boundary with `parse(schema, value)` from `apps/service/src/http/context.ts`. It throws a 400 `fail` with detail `"<path>: <message>"`.
- Database errors map by SQLSTATE in the `DATABASE_PROBLEMS` table in `apps/service/src/problem.ts` (for example `42501` to 403, `23505` to 409). Add new membership or constraint messages there, not in route code. `problemFromDatabaseError` performs the lookup.
- Route handlers stay thin: authenticate, `parse`, call a service function inside `ctx.inHousehold(...)` or `ctx.asUser(...)`, then return or `reply.code(201).send(...)`. Route files call `parse(` about 119 times across `apps/service/src/routes/`.
- Business-rule violations throw `ProblemError` or `fail` with a caller-facing message. Example: `apps/service/src/services/bills.test.ts` asserts `ProblemError` for an invalid visibility move.
- Server errors are recorded with `buildErrorRecord` and `recordAppError` (`apps/service/src/services/errors.ts`). Names, messages, and routes are scrubbed first (`scrubErrorReport` in `packages/shared/src/scrub.ts`).
- The API client in `apps/web/src/lib/api/client.ts` throws `ApiError` (status 0 for network failures).
- Problem bodies are parsed by `apps/web/src/lib/api/problem.ts`. Show them through `FormMessage` (`apps/web/src/components/ui/FormMessage.tsx`) or `Toast` (`apps/web/src/components/ui/Toast.tsx`).
- Field-level validation uses `apps/web/src/lib/use-field-errors.ts` and `apps/web/src/lib/validation.ts`.
- Render-time crashes are caught by `apps/web/src/components/states/ErrorBoundary.tsx` and the router's error element.
- Offline-queueable writes (list items, chore and errand writes) go through `apps/web/src/lib/offline/write-queue.ts`. Other writes are ordinary online mutations that disable their controls while offline.

## Logging

- Service logging uses the Fastify request logger: `request.log.error(...)` in the global error handler in `apps/service/src/app.ts`. Do not log raw request bodies or secrets.
- `console.*` does not appear in `apps/*/src`, `packages/*/src`, or `e2e/`. Verified by search. Only tooling scripts (`scripts/`, `test/`, `apps/*/scripts/`, `supabase/seed/`) use `console`, including the test clock hook `test/global-tz.mjs`. Do not add `console.*` to shipped code.
- The test app in `apps/service/src/test/fake-app.ts` is built with `logger: false`.

## Comments

- Explain why, not what. Do not cite sections of retired spec documents; state the rule itself. Comments state the invariant or the non-obvious constraint behind the code.
- Module-level block comments (`/* ... */` or `/** ... */`) open files that carry a rule set or a contract, such as `apps/web/src/test/harness.tsx` and `apps/service/src/services/bills.test.ts`.
- Document invariants with the reason, for example the opacity floors in `apps/web/src/components/ui/Button.tsx` (the 95% and 97% values exist because of measured WCAG AA contrast).
- JSDoc (`/** */`) goes on exported functions and types whose contract is not obvious from the signature, for example `errorFingerprint` in `apps/service/src/services/errors.ts` and `ProblemError` in `apps/service/src/problem.ts`. It is not required on every export.
- A single-line `//` comment that exists to suppress a lint rule must carry a reason after `--`: `// eslint-disable-next-line no-restricted-syntax -- reason`.

## Function Design

- Service functions take the scoped database handle first, then IDs, then a validated body: `createHouseholdBill(db, id, user.id, body)` in `apps/service/src/services/bills.ts`.
- Components take one typed props object: `<DashboardCard pillar="bills" title="Bills" state={state} />`.
- Exported functions have explicit return types. Async service functions return `Promise<T>`.
- Prefer returning a value to mutating an argument. Pure planners return a plan object.

## Module Design

- Named exports only. Outside declaration files, `export default` appears only where a runner requires it: `e2e/playwright.config.ts`, `e2e/global-setup.ts`, and `e2e/global-teardown.ts`. The one declaration file that uses it is `apps/service/src/push/web-push.d.ts`.
- Route plugins are `FastifyPluginAsync<{ ctx: RouteContext }>` values named `billRoutes`, `choreRoutes`, and so on, wired in `apps/service/src/app.ts`.
- Server state is in TanStack Query hooks under `apps/web/src/lib/api/` (`useBills`, `useBill`), keyed by `queryKeys` from `apps/web/src/lib/api/keys.ts`.
- Ambient state is in React context providers (`apps/web/src/lib/api/api-context.tsx`, `apps/web/src/lib/section-context.tsx`). Dependencies such as the auth client and realtime port are injected through interfaces (`AuthClient`, `RealtimePort`, `PushPort`).
- Styling is Tailwind CSS 4 utilities composed with `cn()` from `apps/web/src/lib/cn.ts`. Variant maps are `Record<Variant, string>` constants. Touch targets use `min-h-11 min-w-11` in shared primitives.

## Patterns for New Code

- New service endpoint: add the request and response schemas in `packages/shared/src/api/`, a service function in `apps/service/src/services/`, and a route in `apps/service/src/routes/` that calls `parse` and the service inside `ctx.inHousehold` or `ctx.asUser`. Register the plugin in `apps/service/src/app.ts`.
- New database error message: add it to `DATABASE_PROBLEMS` in `apps/service/src/problem.ts`.
- Never import from `apps/service/src/privileged/` in routes, services, or jobs.
- New test: co-located, Vitest, `it.each` for table cases. Read time only from the pinned clock or an explicit instant (see TESTING.md).

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Pattern Overview

- Every data-bearing request is authenticated in the service, then runs inside one Postgres transaction that sets `role authenticated` and the caller's JWT claims (`apps/service/src/db/user-db.ts`). Row-level security decides what is visible; application code does not re-implement it.
- Route plugins are thin: authenticate, `parse` input with a shared Zod schema, call a service function on the scoped transaction, shape the reply (`apps/service/src/routes/bills.ts`).
- Service-role access is fenced. Only `apps/service/src/main.ts` and `apps/service/src/cli.ts` import modules from `apps/service/src/privileged/`; the fence is an ESLint rule (`eslint.config.js`, `no-restricted-imports` and an `ImportExpression` selector for dynamic imports). Jobs and routes receive narrow injected functions instead.
- Background work runs in-process via `node-cron` in a single service process, guarded by Postgres advisory locks (`apps/service/src/jobs/advisory-lock.ts`).
- The web app is a route-split SPA: pillar tabs, Settings, and onboarding are lazy chunks (`apps/web/src/routes.tsx`).
- Shared contract: request and response Zod schemas live once in `packages/shared/src/api/*.ts` and are imported by both the service and the web client.

## Layers

- Purpose: Render routes and interactions.
- Location: `apps/web/src/screens/`, `apps/web/src/pillars/`, `apps/web/src/components/`
- Contains: `*Screen.tsx`, `*Route.tsx` wrappers, feature components, primitives under `apps/web/src/components/ui/`, shell under `apps/web/src/components/shell/`.
- Depends on: `apps/web/src/lib/` hooks, `@hearth/shared`, `@hearth/recurrence` (due-date display).
- Used by: `apps/web/src/routes.tsx`.
- Purpose: Talk to the API and Supabase, manage cache, offline writes, and realtime.
- Location: `apps/web/src/lib/api/`, `apps/web/src/lib/auth/`, `apps/web/src/lib/offline/`, `apps/web/src/lib/realtime/`, `apps/web/src/lib/push/`
- Contains: `client.ts` (fetch wrapper, one refresh retry, problem parsing), `api-context.tsx` (providers and `useApi`, `useAuthState`), `keys.ts` (household-scoped query keys), `*-hooks.ts` (TanStack Query hooks), `write-queue.ts` and `chore-errand-writes.ts` (queued mutations), `persist.ts` (IndexedDB persistence), `supabase-realtime.ts` (realtime port).
- Depends on: `@hearth/shared`, `@supabase/supabase-js` (lazy-loaded), TanStack Query.
- Used by: screens and `apps/web/src/main.tsx`.
- Purpose: Map HTTP to domain calls.
- Location: `apps/service/src/routes/`
- Contains: One `FastifyPluginAsync<{ ctx: RouteContext }>` per resource (`auth.ts`, `users.ts`, `households.ts`, `lists.ts`, `bills.ts`, `chores.ts`, `errands.ts`, `meal-plan.ts`, `recipes.ts`, `deals.ts`, `match-overrides.ts`, `system.ts`, `health.ts`).
- Depends on: `apps/service/src/http/context.ts`, domain modules, `@hearth/shared`.
- Used by: `apps/service/src/app.ts`, which registers each plugin.
- Purpose: Authentication, input validation helper, and the only sanctioned path to the database for handlers.
- Location: `apps/service/src/http/context.ts`, `apps/service/src/db/user-db.ts`, `apps/service/src/db.ts`
- Contains: `createRouteContext` (`authenticate`, `asUser`, `inHousehold`, `isOwner`), `parse(schema, value)`, `withUserDb`, `withAnonDb`, the Kysely `Database` type from `apps/service/src/db/types.ts`.
- Depends on: `apps/service/src/auth/jwt.ts` (token verification), `apps/service/src/services/households.ts` (`markHouseholdActive`).
- Purpose: Business rules and the queries that implement them.
- Location: `apps/service/src/services/` (flat, plus `services/deals/`), and two sibling domain folders: `apps/service/src/chores/` (chores, errands, occurrence logic) and `apps/service/src/notifications/` (copy and planners).
- Contains: functions such as `listBills(db, householdId, userId)`, `createHouseholdBill`, `payBill`, `repriceExpiredItems`, `recomputeReadinessForHousehold`, `createMatchOverride`, `markHouseholdActive`. Each takes a Kysely handle already bound to the caller's transaction.
- Depends on: `@hearth/recurrence`, `@hearth/matching`, `@hearth/shared`, the generated DB types.
- Used by: route plugins and scheduled jobs (through the scheduler's injected functions).
- Purpose: The few cross-household operations.
- Location: `apps/service/src/privileged/`
- Contains: `service-role-db.ts` (`withServiceRoleDb`, `readSystemHealth`), `notification-outbox.ts` (outbox claim and send), `scheduled-reminders.ts`, `gotrue-admin.ts` (email change, recovery links), `job-database.ts` (builds the `JobDatabase` handed to jobs).
- Depends on: Postgres as the service role, GoTrue admin API.
- Used by: `apps/service/src/main.ts` and `apps/service/src/cli.ts` only, plus the type-only `SystemHealthRow` import in `apps/service/src/http/context.ts`.
- Purpose: Scheduled and on-demand background work.
- Location: `apps/service/src/jobs/`
- Contains: `scheduler.ts` (registers cron tasks, runs and tracks jobs, `stop()` waits for in-flight runs), `advisory-lock.ts`, `refresh-deals.ts`, `log-autopay.ts`, `dispatch-notifications.ts`, `prune-cache.ts`, and `refresh-plan.ts`, which is a pure planner used by `refresh-deals.ts` and is not scheduled itself. `types.ts` defines the narrow `JobDatabase`, `DispatchOutbox`, and `JobLogger` interfaces.
- Depends on: `JobDatabase` injected from `apps/service/src/privileged/job-database.ts`, services.
- Used by: `apps/service/src/main.ts` (`createScheduler`, `scheduler.start()`), plus `queueBackgroundRefresh` injected into the deals service.
- Purpose: Isolate third-party protocols.
- Location: `apps/service/src/gotrue/` (GoTrue HTTP client), `apps/service/src/auth/jwt.ts` (JWT verification against JWKS), `apps/service/src/deals/flipp/` (Flipp HTTP through one rate-limited queue, fixture transport for E2E), `apps/service/src/deals/price/` (price parsing), `apps/service/src/recipes/` (recipe fetch, JSON-LD, host rate limiter, private-address guard), `apps/service/src/push/` (Web Push transport, recording transport, E2E test seam).
- Used by: `apps/service/src/main.ts`, which injects them into `buildApp` and the scheduler.
- Purpose: One contract and one set of rules for both sides of the API.
- Location: `packages/shared/src/` (Zod request/response schemas in `api/`, problem details, scrubbing, password rules; subpath export `@hearth/shared/common-passwords`), `packages/recurrence/src/` (bill and chore occurrence and rotation), `packages/matching/src/` (ingredient normalization, similarity, matcher).
- Depends on: Zod, date-fns and `@date-fns/tz` (recurrence), `fastest-levenshtein` (matching). No I/O.
- Used by: `apps/web`, `apps/service`, and `supabase/seed` (matching).

## Data Flow

### Primary Request Path (authenticated household write)

### Error Path

### Offline Write Path (list items, chore and errand writes)

### Realtime Sync Path

### Scheduled Job Path

### Notification Pipeline

### Deals and Recipe Import Paths

- Deals: `apps/service/src/routes/deals.ts` calls `DealsService` (`apps/service/src/services/deals/deals.ts`), which reads through caches in `services/deals/cache.ts` and `services/deals/storage.ts`. Fetches to Flipp go through the single `FlippRequestQueue` (`apps/service/src/deals/flipp/request-queue.ts`) shared by requests and the refresh job.
- Recipes: `apps/service/src/routes/recipes.ts` calls `parseRecipeUrl` (`apps/service/src/recipes/parse-recipe-url.ts`), which fetches through `fetch-recipe.ts` and `host-rate-limiter.ts`, and extracts JSON-LD with `json-ld.ts`.
- Server state: Postgres, read through the service, cached in TanStack Query and persisted to IndexedDB (`apps/web/src/lib/api/query-client.ts`, `apps/web/src/lib/offline/persist.ts`).
- Session: Supabase auth client (`apps/web/src/lib/auth/auth-client.ts`), exposed through `useAuthState`; `RequireSession` and `SignedOutOnly` in `apps/web/src/screens/AuthenticatedLayout.tsx` act as route guards.
- Active household: stored on the profile and stamped by `markHouseholdActive` (`apps/service/src/services/households.ts`) on each household-scoped request.
- In-memory service state: skip-rate registry (`apps/service/src/services/skip-rates.ts`), Flipp request queue, recipe host rate limiter.

## Key Abstractions

- Purpose: The only sanctioned way for a request to reach the database as a user.
- Examples: `apps/service/src/http/context.ts`, `apps/service/src/db/user-db.ts`
- Pattern: Transaction-local role switch and claims. `inHousehold` also returns 404 to non-members.
- Purpose: Each feature is one Fastify plugin receiving `{ ctx }`.
- Examples: `apps/service/src/routes/bills.ts`, `apps/service/src/routes/lists.ts`
- Pattern: `export const billRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => { app.get(...) }`
- Purpose: One definition for request validation, response parsing on the client, and OpenAPI.
- Examples: `packages/shared/src/api/bills.ts`, `packages/shared/src/api/lists.ts`, `apps/service/src/openapi.ts`
- Pattern: Schema exported from `@hearth/shared`, used by `parse(...)` on the server and by `api.request({ schema })` on the client.
- Purpose: Give jobs and routes only the privilege they need.
- Examples: `apps/service/src/jobs/types.ts` (`JobDatabase`, `DispatchOutbox`), `apps/service/src/privileged/job-database.ts`
- Pattern: Dependency injection from `main.ts` into `createScheduler({ database, dispatch, refresh })` and `buildApp(deps, options)`.
- Purpose: Declares each top-level area and whether it is released.
- Examples: `apps/web/src/lib/sections.ts` (`PILLARS`, `RELEASED_PILLARS`), `apps/web/src/pillars/*/*Route.tsx`
- Pattern: Unreleased pillars render `ComingSoon` through `PillarScreen` (`apps/web/src/screens/PillarScreen.tsx`).
- Purpose: Uniform error contract across service and client.
- Examples: `apps/service/src/problem.ts`, `packages/shared/src/problem.ts`, `apps/web/src/lib/api/problem.ts`
- Pattern: `fail(status, detail)` throws a `ProblemError`; the error handler sends `application/problem+json`. Client `ApiError` has status 0 for network failures.

## Entry Points

- Location: `apps/service/src/main.ts`
- Triggers: `node dist/main.js` in the `hearth-service` container (`docker/service.Dockerfile`, `CMD ["node", "dist/main.js"]`); `pnpm --filter @hearth/service dev` runs `tsx watch src/main.ts`.
- Responsibilities: Parse env (`apps/service/src/env.ts`), build the pool, GoTrue, Flipp, recipe, and push clients, call `buildApp`, start the scheduler, handle SIGTERM and SIGINT, listen on the configured host and port.
- Location: `apps/service/src/cli.ts`, built to `apps/service/dist/cli.js`. The hand-written POSIX shell wrapper `apps/service/bin/hearth-admin` resolves its own path and runs `node dist/cli.js`.
- Triggers: `docker compose exec hearth-service hearth-admin reset-password <email>`.
- Responsibilities: Creates a one-time GoTrue recovery link through the admin API. The only CLI command is `reset-password`.
- Location: `apps/web/src/main.tsx`
- Triggers: Browser load of the PWA.
- Responsibilities: Install error reporting, create the Supabase client, auth client, query client, and write-queue defaults, then render `<App>` with the realtime port and persisters.
- Location: `apps/web/src/routes.tsx`
- Triggers: Every navigation.
- Responsibilities: Map paths to lazily loaded screens. Public routes are `/sign-in`, `/sign-up`, `/forgot-password`, `/set-password`. `/onboarding` and `/join` require a session. Pillar routes and Settings sit under `AuthenticatedLayout`. Magic-link routes exist only when `VITE_MAGIC_LINK_ENABLED` is `'true'` at build time.
- Location: `apps/web/src/sw.ts` (built with `injectManifest` by `vite-plugin-pwa`, `apps/web/vite.config.ts`)
- Triggers: Browser service worker lifecycle.
- Responsibilities: Precache, navigation fallback, offline caching strategies, push display.
- Location: `supabase/migrations/*.sql` (applied in filename order; eight files from `20260919060000_hearth_service_role.sql` to `20261004090100_depart_clears_notification_preferences.sql`).
- Triggers: `supabase db reset`, `supabase start`, and the database container's init scripts (`docker/docker-compose.yml`).
- `apps/service/src/write-openapi.ts` runs at the end of the service `build` script and emits the OpenAPI document.
- `.github/workflows/deploy.yml` runs on `workflow_run` after a successful push-triggered CI run on `main`, on the self-hosted runner, and executes `scripts/deploy.sh`.

## Architectural Constraints

- **Threading:** Single-threaded Node event loop for the service; async I/O only. No worker threads.
- **Process count:** One service process is assumed. Cron jobs and in-memory state (Flipp queue, recipe rate limiter, skip rates) are per process. Advisory locks prevent overlap of the same job, and only through the database.
- **Global state:** Module-level singletons are created in `apps/service/src/main.ts` (`wiring`, `skipRates`, `flippQueue`, `recipeFetchLimiter`, `recordingTransport`). The web client creates its singletons in `apps/web/src/main.tsx`.
- **Build-time configuration:** `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`, and `VITE_MAGIC_LINK_ENABLED` are fixed at build time; a change requires a rebuild.
- **Test-only seams:** Fixture transports (`HEARTH_FLIPP_FIXTURE_DIR`, `HEARTH_RECIPE_FIXTURE_DIR`), the push double (`HEARTH_PUSH_TRANSPORT=test-double`), and the `POST /api/test/push/dispatch` and `GET /api/test/push/deliveries` routes in `apps/service/src/push/test-seam.ts`. The seam is registered only when `main.ts` passes it, which happens only for the test-double transport.
- **Pinned origin:** The public origin is part of installed PWAs and push subscriptions. `HEARTH_ORIGIN` is used for invite links and the user agent; changing the host is a breaking change.
- **Public unauthenticated routes:** `/api/health`, `/api/signup`, `/api/client-error` (rate limited per IP, `apps/service/src/routes/system.ts`), `/api/openapi.json`. All others call `ctx.authenticate`.

## Layering Deviations (observed)

- **Chores and errands** do not live under `services/`. `apps/service/src/routes/chores.ts` and `routes/errands.ts` import from the domain folder `apps/service/src/chores/`. Searching only `services/` misses this logic.
- **Deals** span two folders: the orchestrator `apps/service/src/services/deals/deals.ts` and the Flipp adapter in `apps/service/src/deals/flipp/`.
- **Deals route opens its own transaction:** `apps/service/src/routes/deals.ts` calls `withUserDb` directly (the `claimForUser` helper) so a dormant postal-code claim commits independently of the request. This is the only route file that imports `withUserDb`.
- **Type-only privileged import:** `apps/service/src/http/context.ts` imports `SystemHealthRow` from `apps/service/src/privileged/service-role-db.ts`. The lint fence allows type imports.
- **Shadowed sub-route:** `apps/web/src/routes.tsx` maps `lists/deals` and `lists/flyers` before the `lists/*` pillar wrapper, so the `deals` branch inside `apps/web/src/pillars/lists/ListsRoute.tsx` (which renders `SubSectionComingSoon`) is not reached through the router.

## Error Handling

- Route code throws `fail(status, detail)` or a service-level error (`apps/service/src/services/errors.ts`).
- Postgres errors map by SQLSTATE through `DATABASE_PROBLEMS` in `apps/service/src/problem.ts`.
- Server errors are recorded through `recordAppError`, which writes as `anon` through `public.record_app_error`.
- The client throws `ApiError`; the query layer decides on retry (`apps/web/src/lib/api/client.ts`, `apps/web/src/lib/offline/write-queue.ts`).
- Render-time crashes are caught by `apps/web/src/components/states/ErrorBoundary.tsx` and the router's `errorElement` (`RouteError` in `apps/web/src/routes.tsx`).

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

## Running E2E in the Claude cloud sandbox

This section is hand-maintained and sits outside the `GSD:*` managed blocks, so GSD regeneration leaves it alone.

`pnpm test:e2e` builds the `hearth-service` and `hearth-caddy` images with Docker. In the cloud sandbox, build containers reach the network through a TLS-intercepting proxy whose CA they do not trust, so corepack's pnpm download fails with `SELF_SIGNED_CERT_IN_CHAIN` (`pnpm fetch` exits 1 in both Dockerfiles). Apply this workaround before running, and revert it afterwards. It is local-only: never commit it, and never disable TLS verification.

1. `cp /root/.ccr/ca-bundle.crt docker/ca.crt`
2. In `docker/service.Dockerfile` (the `source` stage) and `docker/caddy.Dockerfile` (the `build` stage), add these two lines directly after the `FROM node:...` line. Do not add them to the final runtime stage.

   ```dockerfile
   COPY docker/ca.crt /ca.crt
   ENV NODE_EXTRA_CA_CERTS=/ca.crt
   ```

3. Append `!docker/ca.crt` to `.dockerignore` (the `docker` directory is otherwise excluded from the build context).
4. Run `pnpm test:e2e`. It takes about 9 minutes; the expected result is 104 passed.
5. Revert: `git checkout docker/service.Dockerfile docker/caddy.Dockerfile .dockerignore && rm docker/ca.crt`, then confirm `git status` is clean.

Retagging a local `node:24.21.0-bookworm-slim` image with the CA does not work: BuildKit resolves the `FROM` by registry digest and ignores local tags.
