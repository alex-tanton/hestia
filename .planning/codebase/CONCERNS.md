---
last_mapped_commit: 431e646ab110c804b7229cecc9e151d343790b3a
last_mapped_at: 2026-10-21
---
# Codebase Concerns

**Analysis Date:** 2026-10-21

## Tech Debt

**Unchecked type casts on Kysely query results:**
- Issue: Two query results are force-cast through `unknown` instead of being typed by the query builder.
- Files: `apps/service/src/services/deals/storage.ts` (lines ~181 and ~198, `as unknown as DealRow[]`)
- Impact: The compiler no longer verifies that the selected `DEAL_COLUMNS` match `DealRow`. A column rename in the schema or the select list would type-check and fail at runtime.
- Fix approach: Use `.$castTo<DealRow>()` or a `selectAll`/explicit `select` typed against `Database`, and add an integration test that round-trips a deal row.

**Dead-code and unused-export scan is not enforced:**
- Issue: `knip` is configured (`knip.json`, `package.json` scripts `knip`, `knip:production`, `knip:summary`) but is report-only and not run in `.github/workflows/ci.yml`.
- Files: `knip.json`, `package.json`, `.github/workflows/ci.yml`
- Impact: Unused files, exports, and dependencies accumulate silently. This is the main vector for the dead-code cleanup the milestone targets.
- Fix approach: Run `pnpm knip` once, triage results into removals versus ambiguous cases, then add a CI step (or a documented pre-merge step) so regressions are caught.

**Swallowed errors in offline write queueing:**
- Issue: The queue helpers resolve to `undefined` on any mutation failure, so callers cannot distinguish "queued and failed" from "succeeded with no data".
- Files: `apps/web/src/lib/offline/chore-errand-writes.ts` (`mutation.execute(variables).catch(() => undefined)`, lines ~139 and ~152), `apps/web/src/lib/error-reporting.ts` (line ~29), `apps/web/src/screens/settings/NotificationTypes.tsx` (line ~96)
- Impact: Failed chore or errand writes can disappear without any user-visible signal or error record. Silent failures are hard to diagnose during manual review.
- Fix approach: Record the failure through the existing error-reporting path and surface a toast or retry state; add a regression test that a rejected online write is reported.

**Coverage and test-harness files in the repo tree:**
- Issue: Generated HTML coverage reports exist under `packages/recurrence/coverage/` (e.g. `rotation.ts.html`, `occurrence.ts.html`). `coverage/` is ignored by `.gitignore`, so they are local artifacts only, but they are present in the working tree of the checkout.
- Files: `packages/recurrence/coverage/`, `.gitignore`
- Impact: Low for git history, but they inflate directory listings and searches (`rg`, Glob) and confuse exploration tooling.
- Fix approach: Delete the local coverage directories before review; consider `pnpm clean` that removes every `coverage/` directory.

**Large data and fixture files in source trees:**
- Issue: `packages/shared/src/data/common-passwords.ts` is ~10,000 lines and `apps/web/src/test/meal-fixtures.ts` is ~560 lines, both inside source directories.
- Files: `packages/shared/src/data/common-passwords.ts`, `apps/web/src/test/meal-fixtures.ts`
- Impact: Inflates diff reviews and bundle analysis if the password list is imported into the client bundle through `@hearth/shared`.
- Fix approach: Confirm the web bundle does not include the password list (tree-shaking through the barrel `packages/shared/src/index.ts`). If it does, move it behind a service-only entry point.

**Large modules with mixed responsibilities:**
- Issue: Several files exceed 400 lines and combine validation, queries, and business rules.
- Files: `apps/service/src/services/bills.ts` (~533 lines), `apps/service/src/chores/chores.ts` (~506), `apps/service/src/privileged/scheduled-reminders.ts` (~495), `apps/service/src/deals/flipp/flipp-deal-source.ts` (~470), `apps/web/src/screens/lists/ListDetailScreen.tsx` (~452), `apps/service/src/services/lists.ts` (~403), `apps/web/src/lib/api/meal-hooks.ts` (~395), `apps/service/src/services/deals/deals.ts` (~391), `apps/web/src/screens/chores/ChoreFormScreen.tsx` (~383)
- Impact: Harder to review and to test in isolation; higher chance of regressions when touched.
- Fix approach: Split along the existing seams (query layer, rules, presentation) only when a bug fix or feature touches the file; do not refactor speculatively.

## Known Bugs

No open bug entries are recorded in the repository at this time. `docs/` is the source of truth for documented bugs; check the milestone plan under `.planning/` before assuming a defect is tracked.

## Security Considerations

**Recipe import fetch: validated DNS, pinned connection:**
- Risk: Recipe import fetches user-supplied URLs server-side (SSRF surface).
- Files: `apps/service/src/recipes/fetch-recipe.ts`, `apps/service/src/recipes/private-address.ts`
- Current mitigation: Only `http`/`https` are accepted (`parseFetchableUrl`); every resolved address is checked against private, loopback, and link-local ranges (including `169.254.0.0/16`); the connection is pinned to the validated address via a custom `lookup` to block DNS rebinding; redirects are refused; per-host rate limiting in `apps/service/src/recipes/host-rate-limiter.ts`.
- Recommendations: Confirm the private-range table covers IPv6 (`::1`, `fc00::/7`, `fe80::/10`, IPv4-mapped `::ffff:` forms) with a unit test in `apps/service/src/recipes/private-address.test.ts`. Add a regression test for an IPv4-mapped IPv6 literal if one is missing.

**Trusted proxy configuration controls client IP:**
- Risk: `trustProxy` decides which address the per-IP rate limiter sees. A misconfigured `HEARTH_TRUSTED_PROXIES` lets clients spoof `X-Forwarded-For` and bypass `/api/*` rate limits, or makes all clients share one bucket.
- Files: `apps/service/src/app.ts` (line ~95, `trustProxy: options.trustedProxies.length > 0 ? ... : false`), `apps/service/src/main.ts` (line ~113), `apps/service/src/env.ts`, `.env.example`
- Current mitigation: Trust is off by default; the value is validated by Zod at startup.
- Recommendations: Document the exact expected value for the Compose topology (Caddy on the Docker network) in `README.md`, and add an env-validation test that rejects `0.0.0.0/0`-style wildcards.

**Test-only seams gated by environment variables:**
- Risk: `HEARTH_FLIPP_FIXTURE_DIR`, `HEARTH_RECIPE_FIXTURE_DIR`, and `HEARTH_PUSH_TRANSPORT=test-double` replace real external transports. If set in production they would serve fixtures and fake push delivery.
- Files: `apps/service/src/main.ts` (lines ~56-90), `apps/service/src/app.ts` (`testSeam` option, line ~50), `apps/service/src/push/test-seam.ts`, `apps/service/src/env.ts`
- Current mitigation: Documented as E2E-only; the push test route is registered only when the switch is `test-double`; the production Compose file does not set them.
- Recommendations: Have `env.ts` refuse these variables when `NODE_ENV=production` or when `HEARTH_ORIGIN` is the public origin, and add a test that asserts the refusal.

**Service-role access surface:**
- Risk: `service_role` bypasses RLS. Any code path that reaches `apps/service/src/privileged/` outside its intended callers widens the blast radius of an injection or logic error.
- Files: `apps/service/src/privileged/service-role-db.ts`, `apps/service/src/privileged/gotrue-admin.ts`, `apps/service/src/privileged/job-database.ts`, `eslint.config.js`
- Current mitigation: ESLint `no-restricted-imports` fences the module to `main.ts`, `cli.ts`, and narrow injected functions.
- Recommendations: Keep the lint rule in CI (it runs under `pnpm lint`); add an integration test that a `service_role` session cannot be obtained from a route handler.

**Error recording writes as `anon`:**
- Risk: `recordAppError` writes through `public.record_app_error` using the `anon` role. Any unauthenticated caller path that can trigger error records can fill the table.
- Files: `apps/service/src/db/user-db.ts` (`withAnonDb`), `apps/service/src/services/errors.ts`, `supabase/migrations/20260919070200_functions.sql`
- Current mitigation: Raw names, messages, and routes are scrubbed (`packages/shared/src/scrub.ts`); 5xx details are not returned to clients.
- Recommendations: Confirm `record_app_error` enforces a row cap or per-fingerprint rate limit in SQL; if not, add one and a test.

**Post-deploy health check and rollback:**
- Risk: Deploy health gating depends on `GET /api/health` through Caddy within 60 seconds; a passing health check on a broken write path would not roll back.
- Files: `scripts/deploy.sh`, `.github/workflows/deploy.yml`
- Current mitigation: The script rolls back both images on health failure and aborts before restart on build, backup, or migration failure. The deploy job re-checks the CI run came from a push to `main`.
- Recommendations: Add a smoke check that exercises an authenticated read after deploy. Note that migrations are applied before the health gate and are not rolled back automatically; the pre-deploy backup in `scripts/deploy.sh` is the only recovery path.

## Performance Bottlenecks

**In-process job scheduling and in-memory queues:**
- Problem: The Flipp request queue, the recipe host rate limiter, and deal skip rates live in process memory.
- Files: `apps/service/src/deals/flipp/request-queue.ts`, `apps/service/src/recipes/host-rate-limiter.ts`, `apps/service/src/services/skip-rates.ts`, `apps/service/src/main.ts`
- Cause: Designed for one service process (`ARCHITECTURE.md` assumption). Advisory locks in `apps/service/src/jobs/advisory-lock.ts` only prevent overlapping job runs, not multi-instance rate-limit sharing.
- Improvement path: Keep the single-instance constraint explicit in `docs/architecture.md`; if horizontal scaling is ever needed, move these limiters to Postgres or Redis.

**Notification dispatch and deal refresh loops:**
- Problem: `apps/service/src/jobs/dispatch-notifications.ts` and `apps/service/src/jobs/refresh-deals.ts` iterate households and items in application code.
- Files: `apps/service/src/jobs/dispatch-notifications.ts`, `apps/service/src/jobs/refresh-deals.ts`, `apps/service/src/privileged/scheduled-reminders.ts`
- Cause: Per-row work inside a loop; no batching visible in these modules at the sampled depth.
- Improvement path: Measure against seeded data (`supabase/seed/`) before changing; batch writes only if measurements show a problem.

**Client persisted query cache:**
- Problem: TanStack Query state is persisted to IndexedDB on every change through `idb-keyval`.
- Files: `apps/web/src/lib/offline/persist.ts`, `apps/web/src/lib/api/query-client.ts`
- Cause: Whole-cache serialization on write.
- Improvement path: Confirm persistence is throttled; limit persisted query keys to those needed offline.

## Fragile Areas

**Time-zone and date-pinned logic:**
- Files: `packages/recurrence/src/bills.ts`, `packages/recurrence/src/chores.ts` (or the rotation module), `apps/service/src/jobs/dispatch-notifications.ts`, `apps/service/src/jobs/refresh-deals.ts`, `apps/service/src/services/bills.ts`, `apps/service/src/services/invites.ts`
- Why fragile: Production code reads `new Date()` and `Date.now()` directly in several services and jobs (for example `apps/service/src/services/bills.ts` `archived_at: new Date()`, `apps/service/src/services/invites.ts` `expires_at > new Date()`). Behavior depends on the process time zone. The test harness pins `Date` and `TZ` (`test/clock-setup.mjs`, `test/global-tz.mjs`), so a bug that appears only in a real time zone is not caught by unit tests.
- Safe modification: Inject a clock (the pattern used by `deps.now` in `apps/service/src/jobs/prune-cache.ts`) into any new time-dependent logic. Run `pnpm test:sweep` before merging recurrence changes.
- Test coverage: The sweep (`scripts/test-sweep.mjs`) covers the matrix; SQL-side `now()` in `supabase/migrations/20260919070200_functions.sql` is not covered by the TypeScript pinning.

**Schema and generated types drift:**
- Files: `apps/service/src/db/types.ts`, `supabase/migrations/*.sql`, `apps/service/src/services/deals/storage.ts`
- Why fragile: `types.ts` is generated by `pnpm db:types` against a live database. A migration without regeneration leaves types stale, and the casts noted above hide the drift.
- Safe modification: Regenerate types after every migration; remove the `as unknown as` casts before changing deal columns.
- Test coverage: Integration tests run against a fresh `supabase start` in CI (`test-integration` job), which catches runtime breaks but not stale types in a PR that does not touch the schema.

**Shared Zod schemas on client and server:**
- Files: `packages/shared/src/api/contract.ts` (~878 lines), `packages/shared/src/api/*.ts`, `apps/web/src/lib/api/*-hooks.ts`
- Why fragile: One contract file governs every request and response. A narrowing change breaks both the service and the web build at once.
- Safe modification: Change schemas additively; run `pnpm typecheck` and both unit suites.
- Test coverage: `packages/shared` coverage is excluded by `packages/*/vitest.config.ts` (barrel exclusion); the contract file itself relies on route tests.

**Offline write queue and realtime:**
- Files: `apps/web/src/lib/offline/write-queue.ts`, `apps/web/src/lib/offline/persist.ts`, `apps/web/src/lib/realtime/supabase-realtime.ts`, `apps/web/src/lib/realtime/use-list-realtime.ts`
- Why fragile: Paused TanStack mutations are persisted and replayed; realtime events can race with replay and cache hydration. Ordering depends on registering mutation defaults before hydration (`apps/web/src/main.tsx`).
- Safe modification: Keep defaults registration before hydrate; add a regression test for any new queueable mutation.
- Test coverage: Unit tests exist (`apps/web/src/lib/offline/chore-errand-writes.test.ts`); no end-to-end test of offline replay was found in the sampled files.

**Service worker:**
- Files: `apps/web/src/sw.ts`, `apps/web/src/sw.test.ts`, `apps/web/src/lib/push/service-worker-handlers.ts`, `apps/web/vite.config.ts`
- Why fragile: `vite-plugin-pwa` with `registerType: 'prompt'` and Workbox routes registered by index (`mock.calls[0]`, `mock.calls[1]` in `sw.test.ts`). Route order matters and is asserted by position.
- Safe modification: Assert routes by matcher identity rather than call index when changing the route list.

## Scaling Limits

**Single service instance:**
- Current capacity: One Fastify process, one Postgres pool (`apps/service/src/db.ts`), in-process cron.
- Limit: Running two instances duplicates cron work (advisory locks only partially protect it) and splits in-memory rate limits.
- Scaling path: Documented constraint; any scale-out requires moving schedulers and limiters out of process.

**Global per-IP rate limit:**
- Current capacity: `HEARTH_RATE_LIMIT_PER_MINUTE`, default 300, on `/api/*` (`apps/service/src/app.ts`).
- Limit: Behind Caddy and Tailscale Funnel, many household members may share an apparent IP unless the proxy trust is correct.
- Scaling path: Verify trust configuration (see Security); tune the default against real traffic.

**Database backups and retention:**
- Current capacity: Daily dump at `0 2 * * *`, retention 14 days, 8 weeks, 6 months (`docker/docker-compose.yml` backup service) on the second disk at `BACKUP_DIR`.
- Limit: Single host and single disk pair; no off-site copy is configured in the repository.
- Scaling path: Add an off-host copy of `BACKUP_DIR` and a restore test to the runbook in `README.md`.

## Dependencies at Risk

**Pre-release or fast-moving pins:**
- Risk: Several dependencies are pinned at very recent major or minor versions (`typescript` 6.0.3, `vitest` 5.0.1, `tailwindcss` 4.3.3, `vite` 8.3.0, `react-router` 8.4.0, `eslint` 10.11.0, `@playwright/test` 1.63.0, `@tanstack/react-query` 5.103.1).
- Files: `package.json`, `apps/*/package.json`, `packages/*/package.json`, `pnpm-lock.yaml`
- Impact: Breaking changes surface as CI failures in minor bumps; the lockfile and `saveExact: true` limit silent drift.
- Migration plan: Keep `pnpm install --frozen-lockfile` in CI; review Dependabot PRs (`.github/dependabot.yml`) weekly; pin Docker base images by digest where the Dockerfiles currently pin tags (`docker/service.Dockerfile`, `docker/caddy.Dockerfile`).

**Forced override of esbuild:**
- Risk: `pnpm.overrides` forces `esbuild` to `0.28.2` in the root `package.json`, which masks transitive version resolution from `vite` and `tsup`.
- Files: `package.json` (`pnpm.overrides`), `pnpm-workspace.yaml`
- Impact: A security or behavior fix in a newer esbuild is not picked up automatically; a transitive peer requirement may be broken.
- Migration plan: Remove the override when the upstream `vite`/`tsup` range allows the patched version; confirm with `pnpm why esbuild`.

**Scraping and parsing libraries:**
- Risk: `cheerio` 1.2.0 and `parse-ingredient` 3.0.0 parse untrusted remote HTML and text.
- Files: `apps/service/src/recipes/json-ld.ts`, `apps/service/src/recipes/ingredient-parser.ts`
- Impact: Parser bugs or pathological inputs affect recipe import latency and availability.
- Migration plan: Add a size cap and timeout on the response body if one is not already applied in `fetch-recipe.ts`; keep parser fixtures in `apps/service/src/recipes/fixtures/`.

## Missing Critical Features

**Bug and regression tracking is outside the code:**
- Problem: No in-repo issue list for documented bugs; the milestone requires each fix to ship with a regression test.
- Blocks: Verifying that every known bug has a test before the manual review.

**Structured error alerting:**
- Problem: Server errors are recorded to Postgres (`public.record_app_error`) but no alerting or notification path to the owner was found in the sampled code.
- Blocks: Learning of production failures without checking the database.

## Test Coverage Gaps

**Real-time-zone behavior:**
- What's not tested: Behavior when the process `TZ` differs from the pinned test zone outside the sweep matrix, and SQL `now()` in migrations.
- Files: `apps/service/src/services/bills.ts`, `apps/service/src/services/invites.ts`, `supabase/migrations/20260919070200_functions.sql`
- Risk: Date-boundary bugs (bill due dates, invite expiry) appear only for users in specific zones.
- Priority: High

**Offline write failure paths:**
- What's not tested: Rejected queued mutations and the silent `catch(() => undefined)` branches.
- Files: `apps/web/src/lib/offline/chore-errand-writes.ts`, `apps/web/src/lib/offline/write-queue.ts`
- Risk: Lost chore or errand completions with no visible error.
- Priority: High

**Recipe private-address edge cases:**
- What's not tested (as far as sampled): IPv6 private ranges and IPv4-mapped IPv6 literals in `apps/service/src/recipes/private-address.ts`.
- Files: `apps/service/src/recipes/private-address.test.ts`, `apps/service/src/recipes/private-address.ts`
- Risk: SSRF to internal addresses via an IPv6 form not in the range table.
- Priority: High

**Environment guard for test seams:**
- What's not tested: A refusal when fixture or push test-double variables are set in a production-like configuration.
- Files: `apps/service/src/env.ts`, `apps/service/src/main.ts`
- Risk: Fixture transports serving production traffic if the Compose overlay leaks into production.
- Priority: Medium

**Scheduler and job failure paths:**
- What's not tested (as far as sampled): Behavior when an advisory lock is held by another process during a long-running job.
- Files: `apps/service/src/jobs/advisory-lock.ts`, `apps/service/src/jobs/scheduler.ts`
- Risk: Duplicate notifications or skipped refreshes.
- Priority: Medium

**Stale-type detection:**
- What's not tested: That `apps/service/src/db/types.ts` matches the migrations at PR time.
- Files: `apps/service/src/db/types.ts`, `package.json` (`db:types`)
- Risk: Type-level drift masked by the casts in `apps/service/src/services/deals/storage.ts`.
- Priority: Medium

---

*Concerns audit: 2026-10-21*
