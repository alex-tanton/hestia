---
last_mapped_commit: 283f15dbb2b5ed8ded0ba14e04d5015e5d0d367c
last_mapped_at: 2026-10-22
---
# Codebase Concerns

**Analysis Date:** 2026-10-22

## Tech Debt

**Stale "not built yet" readiness seam exported from the production jobs barrel:**
- Issue: `readinessNotBuiltYet` is a no-op that the code comment describes as a placeholder until "Phase 3 builds `recipe_readiness`". Production wiring in `apps/service/src/main.ts` (around line 155) already passes the real `recomputeReadinessForHousehold`. The no-op survives only as a test helper, but it is exported from the production barrel `apps/service/src/jobs/index.ts` and is referenced by at least six test files (`apps/service/src/jobs.integration.test.ts`, `apps/service/src/jobs/scheduler.test.ts`, `apps/service/src/jobs/scheduler-stop.test.ts`, `apps/service/src/dispatch-notifications.integration.test.ts`, `apps/service/src/jobs/index.test.ts`).
- Files: `apps/service/src/jobs/refresh-deals.ts` (lines 48-50, 75-76), `apps/service/src/jobs/index.ts` (line 5)
- Impact: A future reader can mistake the no-op for live behavior. Any production code that imports it from the barrel silently skips readiness recomputation. The comment also names a delivery phase that no longer describes the code.
- Fix approach: Move the no-op into a test helper module (for example `apps/service/src/test/`), remove the export from `jobs/index.ts`, and rewrite the comment as a statement of the current contract.

**Temporal and phase-referencing comments:**
- Issue: Several comments describe delivery sequence rather than current behavior. Examples are `apps/service/src/services/skip-rates.ts` ("The Phase 2 refresh job fills it; until then it is empty"), which is wrong now that `apps/service/src/main.ts` (around line 152) wires `skipRates.replace`. Also `apps/service/src/chores/chores.ts` (around line 371, "Phase 5's offline queue") and `apps/service/src/jobs/refresh-deals.ts`. About 21 `Phase N` references remain across `apps/`, `packages/`, and `e2e/`.
- Files: `apps/service/src/services/skip-rates.ts`, `apps/service/src/chores/chores.ts`, `apps/service/src/chores/occurrence.ts`, `apps/service/src/jobs/refresh-deals.ts`
- Impact: Comments drift from the code and mislead reviewers about whether a path is live.
- Fix approach: Rewrite each comment to state the current invariant and remove phase numbers.

**Double casts on database rows:**
- Issue: `apps/service/src/services/deals/storage.ts` uses `as unknown as DealRow[]` at two call sites (around lines 180 and 197), which bypasses the Kysely type checker for the deal query results.
- Files: `apps/service/src/services/deals/storage.ts`
- Impact: A column rename or type change in the query will not be caught at compile time for these rows.
- Fix approach: Select explicit column aliases in the query so Kysely infers `DealRow`, or parse rows through a Zod schema at the boundary.

**Large modules with mixed responsibilities:**
- Issue: `packages/shared/src/api/contract.ts` (878 lines), `apps/service/src/services/bills.ts` (531 lines), and `apps/service/src/chores/chores.ts` (502 lines) each hold many unrelated rules. The largest integration test files (`apps/service/src/api.integration.test.ts` at 1148 lines, `apps/service/src/lists.integration.test.ts` at 1067 lines, `apps/service/src/jobs.integration.test.ts` at 947 lines) are similarly broad.
- Files: as listed above
- Impact: Changes are harder to review, and the suites are slow to diagnose when they fail.
- Fix approach: Split by resource along the boundaries the routes already use (`apps/service/src/routes/*.ts`), keeping the public exports stable.

**Silently swallowed promise rejections in the web client:**
- Issue: Several promises are discarded with `.catch(() => undefined)`: `apps/web/src/lib/error-reporting.ts` (line 29), `apps/web/src/lib/offline/chore-errand-writes.ts` (lines 139 and 152), and `apps/web/src/screens/settings/NotificationTypes.tsx` (line 95). The error-reporting case is a reasonable best-effort choice. The offline writes and the notification enable call are not obviously so.
- Files: as listed above
- Impact: A failed queued write or a failed push enable leaves no trace for the user or for diagnostics beyond the immediate UI state.
- Fix approach: Confirm each call site's intended outcome. For the notification enable path, surface the failure through `FormMessage` or a toast. Add a regression test for the chosen behavior.

**Service code reads the application clock for writes:**
- Issue: Some service writes use `new Date()` for stored timestamps, for example `apps/service/src/services/bills.ts` (around lines 396 and 476, `archived_at` and `last_used_confirmed_at`) and `apps/service/src/services/invites.ts` (around line 65, an expiry comparison). Other paths let the database set times with `now()`.
- Files: `apps/service/src/services/bills.ts`, `apps/service/src/services/invites.ts`, `apps/service/src/services/add-to-list.ts`
- Impact: Timestamps can come from two clocks, which matters for the tests that pin `Date` and for the timezone sweep in `scripts/test-sweep.mjs`.
- Fix approach: Pick one source (preferably the database clock for stored timestamps) and document it in `docs/testing.md`.

## Known Bugs

No open bugs were confirmed by static inspection in this pass. Regression coverage for previously fixed bugs lives in the co-located `*.test.ts` and `*.integration.test.ts` files.

## Security Considerations

**Owner CLI and service run with a privileged service-role key:**
- Risk: `SERVICE_ROLE_KEY` is read by `apps/service/src/main.ts` and `apps/service/src/cli.ts`. It bypasses RLS and authenticates GoTrue admin calls. Compromise of the service process or the container gives full database and auth access.
- Files: `apps/service/src/env.ts` (line 50), `apps/service/src/privileged/service-role-db.ts`, `apps/service/src/privileged/gotrue-admin.ts`, `apps/service/src/main.ts` (lines 43 and 121), `apps/service/src/cli.ts` (line 65)
- Current mitigation: Access is fenced into `apps/service/src/privileged/` and enforced by an ESLint `no-restricted-imports` rule (`eslint.config.js`). Jobs receive narrow capabilities rather than the key.
- Recommendations: Keep the lint fence in CI (it runs through `pnpm lint`). Add a test asserting that `apps/service/src/http/` and `apps/service/src/routes/` never reference `SERVICE_ROLE_KEY`.

**Deploy runner has host-level Docker access:**
- Risk: `.github/workflows/deploy.yml` runs on `runs-on: [self-hosted, hearth]` on the production host. The runner is in the `docker` group (per project docs), which is effectively root on that host. A workflow that runs on this runner executes with that access.
- Files: `.github/workflows/deploy.yml` (line 25), `scripts/deploy.sh`
- Current mitigation: The deploy triggers only on a successful `push` to `main` with head branch `main` (`workflow_run` conditions, lines 21-24). CI for pull requests runs on GitHub-hosted `ubuntu-latest` only, so untrusted PR code does not reach the self-hosted runner.
- Recommendations: Keep the self-hosted runner off any path that runs pull request code. Pin `HEARTH_DEPLOY_SHA` to the verified `workflow_run` head as the workflow already does.

**Test-only seams are compiled into the production image:**
- Risk: `HEARTH_PUSH_TRANSPORT=test-double`, `HEARTH_FLIPP_FIXTURE_DIR`, and `HEARTH_RECIPE_FIXTURE_DIR` are accepted by `apps/service/src/env.ts` (lines 60, 72, 90) in every build. The push test route is registered only for `test-double` (`apps/service/src/app.ts`, around line 51). Production Compose (`docker/docker-compose.yml`) does not set them, but a misconfigured `.env` would enable fixture data or a recording push transport.
- Files: `apps/service/src/env.ts`, `apps/service/src/app.ts`, `apps/service/src/push/test-seam.ts`, `e2e/docker-compose.e2e.yml`
- Current mitigation: Only the E2E Compose overlay sets these variables. No production file does.
- Recommendations: Reject these variables when `NODE_ENV` or a production marker is set, or gate them behind a build-time flag so the production bundle cannot select them.

**Rate limiting depends on a correct trusted-proxy list:**
- Risk: `apps/service/src/app.ts` (line 95) sets `trustProxy` only when `HEARTH_TRUSTED_PROXIES` is non-empty. If the list is empty or wrong in a deployment that sits behind Caddy, every client shares the proxy's address for the `/api/*` per-minute limit (`HEARTH_RATE_LIMIT_PER_MINUTE`, default 300). Conversely, a broad trusted range would let a client spoof `X-Forwarded-For`.
- Files: `apps/service/src/app.ts`, `apps/service/src/env.ts` (line 33), `docker/Caddyfile` (lines 16 and 52-56), `docker/docker-compose.yml` (line 200)
- Current mitigation: Caddy overwrites `X-Forwarded-For` with `{client_ip}`, and Compose sets `HEARTH_TRUSTED_PROXIES` to the internal subnet.
- Recommendations: Add a startup check that logs the effective trusted-proxy list, and a test that a spoofed `X-Forwarded-For` from an untrusted peer does not change the rate-limit key.

**Seed data publishes known passwords:**
- Risk: `supabase/seed/seed.sql` (around line 99) seeds households whose passwords are published in the repository. Harmless locally, dangerous if the seed is ever loaded into the production database.
- Files: `supabase/seed/seed.sql`, `package.json` (`db:seed` script)
- Current mitigation: The seed is a separate workspace (`@hearth/seed`) and is not in `supabase/migrations/`.
- Recommendations: Have the seed script refuse to run unless `DATABASE_URL` points at a local host.

**Content Security Policy allows inline styles:**
- Risk: `docker/Caddyfile` sets `style-src 'self' 'unsafe-inline'`. `script-src` is strict, so the impact is limited to CSS injection.
- Files: `docker/Caddyfile` (line 24)
- Current mitigation: `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, and `form-action 'self'`.
- Recommendations: Remove `'unsafe-inline'` once Tailwind output is confirmed to need no inline style attributes.

## Performance Bottlenecks

**Per-process in-memory state limits scaling:**
- Problem: Several components hold state in process memory: the skip-rate registry (`apps/service/src/services/skip-rates.ts`), the Flipp request queue (`apps/service/src/deals/flipp/request-queue.ts`), the recipe host rate limiter (`apps/service/src/recipes/host-rate-limiter.ts`, which holds a `Map` of last-request times), and the cron schedule in `apps/service/src/jobs/scheduler.ts`.
- Files: as listed above
- Cause: The design assumes one service process. Advisory locks in `apps/service/src/jobs/advisory-lock.ts` prevent overlapping job runs in the database but do not coordinate the in-memory limiters.
- Improvement path: Keep the single-process assumption explicit in `docs/architecture.md`. If a second replica is ever needed, move the Flipp and recipe rate limits to Postgres or Redis and make the scheduler leader-only.

**Serial E2E suite:**
- Problem: `e2e/playwright.config.ts` runs one worker with zero retries, and the suite takes about nine minutes.
- Files: `e2e/playwright.config.ts` (lines 21-24)
- Cause: The journeys share one database and mutate seeded households in order. The config comment states that retries are disabled on purpose.
- Improvement path: Split the journeys into independent households with their own seed fixtures so they can run in parallel. Keep zero retries.

**Heavy CI integration job:**
- Problem: The integration job starts the full Supabase CLI stack and pulls several public images. It has a 40-minute timeout (`.github/workflows/ci.yml`, line 60).
- Files: `.github/workflows/ci.yml`
- Cause: Pull failures from ECR and GHCR are a recurring source of latency. The workflow has pre-pull retries and optional Docker Hub login (`continue-on-error: true` on the login steps, lines 80 and 92).
- Improvement path: Cache the Supabase image set between runs, or pin images by digest.

## Fragile Areas

**Migration ordering and SECURITY DEFINER functions:**
- Files: `supabase/migrations/20260919070000_schema.sql`, `supabase/migrations/20260919070100_rls.sql`, `supabase/migrations/20260919070200_functions.sql`, `supabase/migrations/20261004090000_notification_producers.sql`, `supabase/migrations/20261004090100_depart_clears_notification_preferences.sql`
- Why fragile: Migrations are applied in filename order. Security-definer functions run with the owner's privileges, and the policies depend on helper functions defined in earlier files. The migration count in each file's function and `security definer` lines is close to matched (for example, `functions.sql` has 13 function definitions and 14 `search_path` lines), which indicates `set search_path = ''` is applied, but this was checked by counting rather than by parsing SQL.
- Safe modification: Add a new migration file rather than editing an applied one. After each change, run `supabase db reset` and the policy suite in `apps/service/src/db/policies.integration.test.ts`.
- Test coverage: RLS policies are covered by `apps/service/src/db/policies.integration.test.ts` and `apps/service/src/db/membership.integration.test.ts`. Coverage of the security-definer functions themselves depends on the integration suite running against a real Supabase stack, which CI does in the integration job.

**Job locking and cron timezones:**
- Files: `apps/service/src/jobs/scheduler.ts`, `apps/service/src/jobs/advisory-lock.ts`, `apps/service/src/jobs/dispatch-notifications.ts`
- Why fragile: Each job takes a session advisory lock on a dedicated connection, and dispatch rows are claimed then released (`dispatch-notifications.ts`). A crash between claim and send can leave rows claimed until the next run. Cron expressions are interpreted in a single `TIMEZONE`, so DST boundaries affect schedules.
- Safe modification: Change one job at a time and extend the job integration test in `apps/service/src/jobs.integration.test.ts`. Run `pnpm test:sweep:integration` across the time-zone matrix.
- Test coverage: Covered by `apps/service/src/jobs.integration.test.ts`, `apps/service/src/dispatch-notifications.integration.test.ts`, and `apps/service/src/jobs/scheduler.test.ts`.

**Offline write queue depends on error classification:**
- Files: `apps/web/src/lib/offline/write-queue.ts`, `apps/web/src/lib/offline/persist.ts`, `apps/web/src/lib/api/client.ts`
- Why fragile: `retryQueuedWrite` retries only when `ApiError.isOffline` or the status is 5xx, and at most three times (`apps/web/src/lib/offline/write-queue.ts`, lines 107-115). Any change to how `ApiError` classifies responses changes what is retried or silently dropped. Persisted mutations survive reloads through IndexedDB, so a bad queued payload persists too.
- Safe modification: Add a regression test in `apps/web/src/lib/offline/write-queue.test.tsx` for each new error class before changing the classification.
- Test coverage: Unit coverage in `apps/web/src/lib/offline/write-queue.test.tsx` and `apps/web/src/lib/offline/chore-errand-writes.test.ts`.

**Timezone and clock pinning in tests:**
- Files: `test/clock-setup.mjs`, `test/global-tz.mjs`, `scripts/test-sweep.mjs`, `apps/service/src/test/zone-dates.ts`, `e2e/support/clock.ts`
- Why fragile: Unit tests pin `Date`, integration tests use the real clock, and E2E reads the real clock because "there is no seam to pin" (`e2e/support/clock.ts`). Two `eslint-disable no-restricted-syntax` opt-outs exist in `apps/service/src/deals/flipp/request-queue.test.ts`. A test that mixes pinned and real time can pass one day and fail another.
- Safe modification: Put any new time-dependent logic behind an injected clock, as `request-queue.ts` does with its `now` option.
- Test coverage: `pnpm test:sweep` and `pnpm test:sweep:integration` run the suites across a fixed date and time-zone matrix.

**Large generated and hand-maintained type surfaces:**
- Files: `apps/service/src/db/types.ts` (generated by `pnpm db:types`), `packages/shared/src/data/common-passwords.ts` (10,011 lines), `packages/shared/src/api/contract.ts`
- Why fragile: `types.ts` must be regenerated after every migration, and the generated file is committed. A forgotten regeneration produces drift that only the typecheck reveals. `contract.ts` is the request and response contract shared by the service, the web client, and OpenAPI generation (`apps/service/src/write-openapi.ts`).
- Safe modification: Regenerate with `pnpm db:types` after a migration. Do not hand-edit `types.ts`.
- Test coverage: `apps/service/src/openapi.test.ts` and `packages/shared` tests.

## Scaling Limits

**Single service instance:**
- Current capacity: One Fastify process and one Postgres connection pool (`apps/service/src/db.ts`) on a single Linux host (`docker/docker-compose.yml`).
- Limit: Two replicas would run the cron jobs twice (advisory locks prevent overlap but not duplicate scheduling of the in-memory work), and each would have its own skip-rate and rate-limit state.
- Scaling path: See the in-memory state entry under Performance Bottlenecks.

**Backups on a single host:**
- Current capacity: A `prodrigestivill/postgres-backup-local` container dumps daily at `0 2 * * *` to `BACKUP_DIR` on a second disk, retaining 14 daily, 8 weekly, and 6 monthly copies (`docker/docker-compose.yml`, around line 259).
- Limit: Backups and the database share one host, so a host loss removes both.
- Scaling path: Replicate `BACKUP_DIR` off-host. The README and `docs/deploy.md` should state the recovery point objective.

## Dependencies at Risk

**Pre-release and fast-moving pins:**
- Risk: `@tanstack/react-query` 5.103.1, `react-router` 8.4.0, `vite` 8.3.0, `zod` 4.6.5, and `typescript` 6.0.3 are all recent major or minor lines pinned exactly (`saveExact: true`). Dependabot opens weekly updates (`.github/dependabot.yml`).
- Impact: A breaking change in a transitive or peer dependency can break the Vite PWA build or the Zod contract at once across `apps/service`, `apps/web`, and `packages/shared`.
- Migration plan: Keep updates in separate PRs per package family, gated by the full CI suite including the E2E job.

**Overridden esbuild version:**
- Risk: Root `package.json` forces `esbuild` to `0.28.2` through `pnpm.overrides`, and `pnpm-workspace.yaml` lists `onlyBuiltDependencies: [esbuild]`.
- Impact: Upstream tooling (`tsup`, `vite`) may assume a different esbuild API.
- Migration plan: Drop the override once `tsup` and `vite` declare a compatible range.

**Unverified dead code and dependencies:**
- Risk: `knip` (`knip.json`, run through `pnpm knip` and `pnpm knip:production`) is report-only and is not run in CI (`.github/workflows/ci.yml` does not reference it), so unused files, exports, and dependencies can accumulate unnoticed.
- Impact: The jobs barrel already exports a test-only helper (see Tech Debt). Dead exports will keep accumulating.
- Migration plan: Add `pnpm knip:production` to CI as a non-blocking report step, then make it blocking once the current findings are triaged.

## Missing Critical Features

**No automatic dependency-vulnerability gate in CI:**
- Problem: The CI workflow (`.github/workflows/ci.yml`) runs lint, typecheck, unit, integration, E2E, and build, but no `pnpm audit` or equivalent scan.
- Blocks: Dependency advisories are caught only through Dependabot alerts, not in the merge gate.

**No application-level observability backend:**
- Problem: Errors are recorded through `recordAppError` into `public.record_app_error` (`apps/service/src/services/errors.ts`, `apps/service/src/db/user-db.ts`), and logs go to the container's stdout through Fastify's logger. No alerting or tracing exists.
- Blocks: Detecting a failing scheduled job before the owner notices a missing notification.

## Test Coverage Gaps

**Browser-level behavior outside the E2E journeys:**
- What's not tested: Service worker update flow and offline reload paths beyond the unit test in `apps/web/src/sw.test.ts`, which mocks Workbox `registerRoute` and inspects its call arguments.
- Files: `apps/web/src/sw.ts`, `apps/web/src/sw.test.ts`, `apps/web/src/components/shell/UpdatePrompt.tsx`
- Risk: A broken precache manifest or update prompt could ship while the unit tests still pass.
- Priority: Medium

**Dead-code and unused-export detection:**
- What's not tested: Nothing in CI checks for unused exports or files (see Dependencies at Risk).
- Files: `knip.json`, `apps/service/src/jobs/index.ts`
- Risk: Test-only helpers leak into production barrels.
- Priority: Low

**Concurrency under the advisory lock:**
- What's not tested: Two real service processes racing for the same job lock. `apps/service/src/jobs/advisory-lock.ts` is exercised through single-process integration tests.
- Files: `apps/service/src/jobs/advisory-lock.ts`, `apps/service/src/jobs.integration.test.ts`
- Risk: A regression in lock release on error could let a job stay locked until the connection closes.
- Priority: Medium

**Migration rollback:**
- What's not tested: Migrations are forward-only. No down migration or rollback rehearsal exists in `supabase/migrations/`.
- Files: `supabase/migrations/`
- Risk: A bad migration in `scripts/deploy.sh` must be fixed forward on the production database.
- Priority: Medium

---

*Concerns audit: 2026-10-22*
