---
last_mapped_commit: b96ca32ac1130c09f8aa3066d715181ddf3fb31a
last_mapped_at: 2026-10-11
---
# Codebase Concerns

**Analysis Date:** 2026-10-11

## Tech Debt

**Date-dependent end-to-end and unit tests:**
- Issue: Tests read the wall clock directly (about 28 `new Date()` / `Date.now()` call sites across `e2e/` and `apps/*/src/**/*.test.*`). The most recent commit `b96ca32` fixed an E2E helper, `firstMealOn()` in `e2e/tests/19-notifications.spec.ts`, that threw on any day without a seeded dinner (Saturdays), aborting the journey and leaking state into later tests. Other date-keyed fixtures may share the weakness; this was not audited test by test.
- Files: `e2e/tests/19-notifications.spec.ts`, `apps/web/src/screens/chores/household-timezone.test.tsx`, `apps/web/src/screens/bills/household-timezone.test.tsx`
- Impact: Failures that depend on the day of the week or the household timezone appear and disappear with the calendar, which makes CI flaky and hides real regressions.
- Fix approach: Pin "now" with fake timers or a fixed clock seed in unit and component tests. In E2E, derive expected days from the seeded data rather than assuming a weekday, and add a test that runs the suite under a non-default clock.

**Cloned schema defaults in shared API contracts:**
- Issue: Zod `.default(...)` on a field pulls the default in whenever a key is absent. Combined with `.partial()`, this silently rewrites stored values. The bug fixed in `1030b35` made any partial `PATCH /bills/:id` reset six bill fields to their create-time defaults. The fix builds the update schema from `billFieldsSchema.shape` with the defaults unwrapped.
- Files: `packages/shared/src/api/bills.ts` (lines 77-84 define the defaults, 97-118 the workaround), `packages/shared/src/api/membership.ts:39`, `packages/shared/src/api/deals.ts:82-148`, `apps/service/src/services/bills.ts`
- Impact: Any new PATCH schema built with `.partial()` on a schema that has defaults reproduces the data-loss bug, and the failure is silent.
- Fix approach: Add a rule to the shared package: PATCH/update schemas must be derived from unwrapped field shapes, never from `.partial()` on a create schema. Cover each new PATCH schema with a test that sends `{ name }` alone and asserts other columns are unchanged, which is the pattern in `95b0bd2`.

**Remaining known transitive vulnerability:**
- Issue: `braces` is still present as a transitive dev dependency. Commit `b96ca32` says it "has no upstream patch yet and remains, confirmed against the live advisory." The other three findings were cleared by bumping dependencies and adding `pnpm.overrides` for `esbuild` 0.28.2 in `package.json`.
- Files: `pnpm-lock.yaml`, `package.json` (`pnpm.overrides`)
- Impact: Build-time and dev-tool exposure only. It is not in the production runtime path as far as the repo shows.
- Fix approach: Re-run `pnpm audit` on a schedule and add a pnpm override once a patched `braces` release exists. Record the accepted risk in this file until then.

**Accessibility suppression:**
- Issue: One ESLint rule is disabled inline for `jsx-a11y/no-noninteractive-element-interactions`.
- Files: `apps/web/src/components/chores/RotationEditor.tsx:132`
- Impact: The suppressed element may be unreachable by keyboard or screen reader.
- Fix approach: Replace the interactive handler on a non-interactive element with a real `button` or `role` plus keyboard handling, then remove the suppression.

**Large files:**
- Issue: Several integration test files exceed 800 lines, and the service composition files are large.
- Files: `apps/service/src/api.integration.test.ts` (1165 lines), `apps/service/src/lists.integration.test.ts` (1087), `apps/service/src/jobs.integration.test.ts` (956), `apps/service/src/db/policies.integration.test.ts` (929), `apps/service/src/services/bills.ts` (533), `apps/service/src/privileged/scheduled-reminders.ts` (495)
- Impact: Harder to review and slower to change safely. Not a correctness issue by itself.
- Fix approach: Split by domain when next touched. Keep shared fixtures in `apps/service/src/test/`.

## Known Bugs

**Offline list writes can duplicate on replay:**
- Symptoms: A queued add-item mutation that replays after a reload or a dropped response could create a second item.
- Files: `apps/web/src/lib/offline/write-queue.ts`, `apps/web/src/lib/offline/use-write-queue.ts`, `apps/web/src/lib/offline/list-cache.ts`
- Trigger: The write is sent, the response is lost (network drop, tab closed), and the paused mutation is retried. The write-queue module header states "no server-side dedupe", so nothing on the server recognises the second request.
- Workaround: None in code. Users can delete the duplicate row.

**Recipe and deal behaviour depends on unofficial Flipp endpoints:**
- Symptoms: Deal search and flyers stop returning data if the upstream changes its response shape or host.
- Files: `apps/service/src/deals/flipp/flipp-deal-source.ts`, `apps/service/src/deals/flipp/normalized-fixtures.ts`, `apps/service/src/deals/flipp/request-queue.ts`, CSP image hosts in `docker/Caddyfile`
- Trigger: Upstream schema change or throttling. Fixtures under `e2e/fixtures/flipp/` cover the shape as captured, so drift is detected only by re-capture.
- Workaround: `HEARTH_FLIPP_FIXTURE_DIR` swaps in captured fixtures, used only by the E2E overlay.

## Security Considerations

**Public auth endpoints reachable through the gateway:**
- Risk: Caddy refuses `POST /auth/v1/signup*` and `PUT /auth/v1/user*` at the proxy. Every other GoTrue path under `/auth/v1/*` is proxied to Kong, which only checks the `apikey` (anon or service-role key). The anon key is public by design in the web bundle, so any GoTrue route Kong allows for `anon` is reachable from the internet through Funnel. Enforcement of "signup and password change go only through hearth-service" depends on the Caddy path matcher, which must keep matching the refused routes after any Caddy or Kong change.
- Files: `docker/Caddyfile` (`@refused_signup`, `@refused_user`, `@kong`), `docker/kong.yml` (`auth-v1-all`, ACL `allow: [admin, anon]`)
- Current mitigation: Refusal rules in Caddy, the ACL, and an E2E test that asserts the refusal (`e2e/tests/08-caddy-refuses-gotrue-endpoints.spec.ts`), plus magic-link disabled (`e2e/tests/07-magic-link-disabled.spec.ts`).
- Recommendations: Enumerate which GoTrue paths the `anon` ACL actually needs, and deny the rest in Kong, not only in Caddy. Extend `08-caddy-refuses-gotrue-endpoints.spec.ts` to cover the full list of refused paths.

**Content-Security-Policy allows inline styles:**
- Risk: `style-src 'unsafe-inline'` weakens CSP against style injection. Script execution is still restricted by `script-src 'self'`.
- Files: `docker/Caddyfile` (`header` block)
- Current mitigation: `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`.
- Recommendations: Move inline styles to hashed or nonce'd style, or accept the risk explicitly and document it in `docs/architecture.md`.

**Service-role key scope:**
- Risk: The service-role key bypasses RLS. Its use is meant to be limited to the privileged modules, but it also appears outside them.
- Files: `apps/service/src/routes/users.ts`, `apps/service/src/http/context.ts`, `apps/service/src/cli.ts`, `apps/service/src/main.ts`, `apps/service/src/privileged/*.ts`
- Current mitigation: The `privileged/` directory and `jwt.ts` verification gate the access; `docker/db/hearth-service-login.sql` limits the database role `hearth_service`.
- Recommendations: Audit each import of the service-role client against the RLS rule in `docs/architecture.md`, and add a lint rule or test that restricts it to `apps/service/src/privileged/`.

**Deploy runs on the production host from `main`:**
- Risk: The `deploy.yml` job runs on a self-hosted runner on the production box, checking out the commit that passed CI. It runs migrations against the live database and restarts containers. Image rollback does not reverse migrations.
- Files: `.github/workflows/deploy.yml`, `scripts/deploy.sh`, `docker/db/hearth-service-login.sql`
- Current mitigation: Trigger limited to successful `push` to `main`; the job re-checks the CI run event; a backup runs before migrations; health gate with automatic image rollback.
- Recommendations: Require that every migration be backward compatible with the previous image, or document the manual restore procedure in `docs/deploy.md`. The database password is passed on the `supabase migration up --db-url` command line, so it appears in process listings and in any `set -x` trace; prefer an environment variable or a `.pgpass` file.

**Backups stay on the host:**
- Risk: The backup container writes to `BACKUP_DIR` on the same machine as the database, so a disk or host loss removes both.
- Files: `docker/docker-compose.yml`, `apps/service/src/env.ts` (`BACKUP_DIR`), `apps/service/src/services/backups.ts`
- Current mitigation: System health reports the newest backup time.
- Recommendations: Confirm an off-host copy exists (not visible in the repo) and document its location and restore test in `docs/deploy.md`.

## Performance Bottlenecks

**Deal refresh fan-out:**
- Problem: Refreshing deals issues upstream Flipp requests that scale with the number of stores and searches.
- Files: `apps/service/src/jobs/refresh-deals.ts`, `apps/service/src/deals/flipp/request-queue.ts`, `apps/service/src/services/deals/cache.ts`
- Cause: Requests are throttled by a queue with a fixed gap, so a larger store list means a longer refresh.
- Improvement path: Batch by store, and keep the request queue's rate gap. Measure with the existing fixtures before changing the schedule.

**Recipe host rate limiting is per host, in memory:**
- Problem: `HostRateLimiter` keeps state in process memory, so it resets on restart and does not apply across multiple service instances.
- Files: `apps/service/src/recipes/host-rate-limiter.ts`
- Cause: Single-process design, consistent with the single-box deployment.
- Improvement path: Acceptable while the service is a single container. Move to a shared store only if the service is scaled out.

## Fragile Areas

**Trusted-proxy and client-IP resolution:**
- Files: `docker/Caddyfile` (`trusted_proxies static`, `trusted_proxies_strict`, `client_ip_headers X-Forwarded-For`), `apps/service/src/env.ts` (`HEARTH_TRUSTED_PROXIES`), `apps/service/src/app.ts` (rate limit keyed by IP)
- Why fragile: The trusted gateway address comes from `HEARTH_HOST_GATEWAY`. If it is wrong after a Compose network change, clients can spoof `X-Forwarded-For`, which defeats the per-IP rate limit, 300 per minute by default. The E2E overlay raises the limit because every loopback request shares one address.
- Safe modification: Change the Compose subnet and `HEARTH_HOST_GATEWAY` together, and confirm with `e2e/tests/` that rate limiting still works through Caddy.
- Test coverage: The E2E overlay bypasses the per-IP limit, so production-level rate limiting is not exercised end to end.

**Offline list queue and cache:**
- Files: `apps/web/src/lib/offline/write-queue.ts`, `apps/web/src/lib/offline/list-cache.ts`, `apps/web/src/lib/offline/persist.ts`, `apps/web/src/lib/offline/chore-errand-writes.ts`
- Why fragile: Correctness depends on TanStack Query paused-mutation persistence and on the `setMutationDefaults` registration happening before rehydration. The order of registration and scope IDs (`list:<id>`) are implicit contracts.
- Safe modification: Keep registration in one module, and extend `apps/web/src/lib/offline/write-queue.test.tsx` for each new mutation kind.
- Test coverage: Unit and component tests exist (`write-queue.test.tsx`, `chores-offline-queue.test.tsx`, `errands-offline-queue.test.tsx`). No test covers a reload between a sent write and its response.

**Anchored recurrence logic:**
- Files: `packages/recurrence/src/bills.ts`, `packages/recurrence/src/chores.ts`, `packages/recurrence/src/rotation.ts`, `apps/service/src/chores/occurrence.ts`
- Why fragile: Dates are computed in the household timezone, and the same rules run in the web client and the service. A change in one place without the other shows different due dates on the dashboard and in reminders.
- Safe modification: Change only in `packages/recurrence`, and run both `recurrence` and the service's `chores.integration.test.ts` and `bills.integration.test.ts`.
- Test coverage: Good unit coverage in `packages/recurrence/src/*.test.ts`. Timezone edge cases around DST are the gap to check.

## Scaling Limits

**Single-host deployment:**
- Current capacity: One Compose stack on one machine (`docker/docker-compose.yml`), with Postgres, GoTrue, Realtime, Kong, Caddy, the service, and backup.
- Limit: Host CPU, memory, and disk, plus the single database. There is no failover.
- Scaling path: Acceptable for a household-scale app (documented in `docs/architecture.md`). Any multi-household growth beyond that needs a managed database and a second service instance, which also requires moving the in-memory rate limiter and the job scheduler lock (`apps/service/src/jobs/advisory-lock.ts`) into shared storage.

## Dependencies at Risk

**Unofficial Flipp API:**
- Risk: Deal data comes from undocumented Flipp endpoints with no contract.
- Impact: Deal search and flyers stop working on an upstream change.
- Migration plan: Keep the `DealSource` seam in `apps/service/src/deals/deal-source.ts` as the only entry point, so a replacement source needs no changes in routes or the web app.

**Transitive `braces` dependency:** see Tech Debt above.

## Missing Critical Features

**Off-host backup verification:**
- Problem: The repo does not show an off-host copy or a scheduled restore test.
- Blocks: Confident recovery after host loss.

## Test Coverage Gaps

**Production-level rate limiting:**
- What's not tested: Per-IP limits through the real Caddy and trusted-proxy chain, since the E2E overlay raises the limit.
- Files: `apps/service/src/env.ts`, `docker/Caddyfile`, `e2e/docker-compose.e2e.yml`
- Risk: A proxy misconfiguration would not be caught before deploy.
- Priority: Medium

**Offline replay after a lost response:**
- What's not tested: A queued list write that reaches the server but whose response is lost, then replays.
- Files: `apps/web/src/lib/offline/write-queue.ts`, `e2e/tests/11-offline-list-sync.spec.ts`
- Risk: Duplicate list items, as described under Known Bugs.
- Priority: High

**Date and timezone edges:**
- What's not tested: Weekday-dependent and DST-boundary behaviour in E2E, given the `firstMealOn()` failure fixed in `b96ca32`.
- Files: `e2e/tests/19-notifications.spec.ts`, `packages/recurrence/src/*.test.ts`
- Risk: Calendar-dependent flakiness and missed regressions.
- Priority: Medium

---

*Concerns audit: 2026-10-11*
