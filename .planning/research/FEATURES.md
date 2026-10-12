# Feature Research

**Domain:** Cleanup and hardening of an LLM-generated TypeScript pnpm monorepo (Fastify service, React/Vite PWA, Supabase/Postgres, Playwright E2E, GitHub Actions CI)
**Researched:** 2026-10-11
**Confidence:** MEDIUM-HIGH (repo-grounded findings are HIGH; general-practice and tooling claims are MEDIUM, noted per row)

## How to read this document

For a cleanup milestone, the "users" are the repo owner doing the upcoming manual review, and a "feature" is a cleanup activity with a verifiable deliverable. Core Value from PROJECT.md is the test: does this activity make the base leaner, more trustworthy, deterministic, or bug-free for that review without changing behavior?

Three repo facts found while researching change how the work should be scoped. They are called out because they would otherwise be planned wrongly:

1. **The "offline duplicate" bug is not what CONCERNS.md says it is.** CONCERNS cites the write-queue header ("no server-side dedupe") as proof nothing recognises a replay. Reading the code shows the header means "no `client_mutation` table", not "no dedupe". `addListItem` in `apps/service/src/services/lists.ts` inserts with `ON CONFLICT (id) DO NOTHING`, and the web client (`ListDetailScreen.tsx`) mints `crypto.randomUUID()` and sends it as `request.id`. Both the `manual` and `from_deal` request schemas accept `id`. Chores have the same pattern with integration tests for replayed completion ids. So the first deliverable is a reproduction, not a fix: either the bug does not exist (the work becomes a missing regression test, and CONCERNS gets corrected), or it lives on a path not yet traced (reload between send and response, a call site that omits `id`, recipe-to-list merging in `add-to-list.ts`, errand writes). Confidence: HIGH that the server dedupe exists; MEDIUM that no other path leaks, because not every call site was traced.
2. **Service-role import fencing already exists in ESLint.** `eslint.config.js` has `no-restricted-imports` for `**/privileged/*` plus a `no-restricted-syntax` selector for dynamic `import('../privileged/...')`. The CONCERNS recommendation "add a lint rule" is already partly done; the real work is auditing the allowlisted exceptions (`routes/users.ts`, `http/context.ts`, `cli.ts`, `main.ts`) and proving the rule fails when violated.
3. **No dead-code or dependency tooling exists yet** (no knip, depcheck, or ts-prune config; `pnpm audit` is not in CI). The `.gitignore` already covers `dist`, `coverage`, `*.tsbuildinfo`, and report directories, and a scan of `git ls-files` (668 files) found no tracked build artifacts, backups, or logs matching common patterns. "Generated-file hygiene" is therefore likely a small deliverable (verification plus drift guards), not a big purge. The tracked generated file that matters is `apps/service/src/db/types.ts` (kysely-codegen output), which is intentionally committed and needs a drift check, not removal.

## Feature Landscape

### Table Stakes (the owner will not trust the base without these)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Baseline snapshot before any change: full suite green, coverage numbers, lint/typecheck/build status recorded | Every later deletion or refactor is judged against it. A cleanup without a baseline cannot prove "behavior unchanged". | LOW | Run once, record in the phase summary under `.planning/`, not in `docs/`. Includes the coverage thresholds in `apps/service/vitest.coverage.config.ts`. |
| Dead-code and unused-dependency detection run in report-only mode first | Evidence constraint in PROJECT.md: tooling or test proof, not intuition. Knip is workspace-aware and reads `pnpm-workspace.yaml` (official docs, MEDIUM-HIGH). | MEDIUM | Needs per-workspace `entry`/`project` config. A flood of "unused file" results means a workspace is unconfigured, not that the files are dead (knip's own configuration hints). Entry points here include Vite/Vitest/Playwright configs, `scripts/*.sh`, `supabase/seed`, Docker and Caddy references, and `HEARTH_FLIPP_FIXTURE_DIR` fixture loading. |
| Triage of candidates into three buckets: proven-dead (delete), tool false positive (configure and comment), uncertain (list for owner) | The Out of Scope line "aggressive deletion of code tooling cannot prove unused" requires a defined rule for what "proven" means. | MEDIUM | Proven-dead = tool flags it AND `tsc`/tests pass after removal AND repo-wide string search (Dockerfiles, compose, Caddyfile, SQL, scripts, docs, `package.json` scripts) finds no reference. Anything reachable via dynamic import, env var path, or config-by-name goes to the uncertain list. |
| Removal of proven-dead code, exports, files, and unused dependencies in small atomic commits, one category per commit, full suite after each | Atomic commits make `/gsd-undo` and `git revert` safe; mixing categories makes a regression unattributable. | MEDIUM | Order: unused dependencies, unused files, unused exports, unused types, then tests that only exercised deleted code. Re-check coverage thresholds after each step (removing covered dead code can move the percentage). |
| Owner review list for uncertain candidates | PROJECT.md Active item 1 explicitly requires it. | LOW | A single ledger file (candidate, evidence for, evidence against, suggested action). Lives in `.planning/`, never in `docs/` (project rule: no review or decision-log files in `docs/`). |
| Verification that generated and leftover files are not tracked, plus ignore-rule gaps closed | Core Value: "no stray generated files". | LOW | Expected result is mostly "already clean". Check `*.tsbuildinfo`, `dev-dist/`, `playwright-report/`, `shots/`, `.dump`, editor and OS files, and any LLM scratch notes in the tree. Add `.gitattributes`/`.gitignore` entries only where a real gap exists. |
| Docs-match-code pass over `docs/` (especially `docs/file-map.md`, `docs/testing.md`, `docs/deploy.md`) | Stale file maps and command lists are the most common LLM-codebase leftover, and the owner will read them first. | MEDIUM | Mechanical check: every path and `pnpm` script named in docs exists. Fix docs to match code, never the reverse. Update docs only in the same commit that deletes or renames what they describe. |
| Date and timezone determinism in unit and component tests | Core Value: "passes repeatably regardless of day or timezone". About 29 wall-clock call sites in tests; only about 10 files use fake timers. | MEDIUM | Pin "now" with Vitest fake timers or a fixed clock helper; pin `TZ` where a test depends on household timezone. Audit test by test, since CONCERNS states the audit was not done. |
| E2E expectations derived from seeded data, not from the weekday | The `firstMealOn()` failure fixed in `b96ca32` is the template: the test assumed a seeded dinner existed on the current day. | MEDIUM | Important limit: Playwright's `page.clock` (`setFixedTime`, `install`) controls only the browser. The Fastify service, cron jobs, and Postgres still run on real time, so faking the browser clock does not make server-side due dates deterministic. Use `setFixedTime` for client-only assertions and seed-derived expectations for anything crossing the API. |
| No retries or sleeps added to hide flakiness | `e2e/playwright.config.ts` sets `retries: 0`, `workers: 1`, `fullyParallel: false` by design because tests mutate shared household state. | LOW | A constraint to preserve, listed here so cleanup does not "stabilize" by retrying. |
| Each known bug reproduced with a failing test before it is fixed, then fixed, then the test left in place | PROJECT.md Constraint: every bug fix ships a regression test. Red-then-green is the evidence that the test guards the bug. | MEDIUM per bug | See the per-bug rows below. Commit the failing test and the fix separately where practical. |
| Offline replay: reproduction and regression test | Highest-priority gap in CONCERNS (Test Coverage Gaps, High). | MEDIUM | See finding 1 above. Write a service-level test (same `id` posted twice, one row, activity recorded once) and a web-level test (paused mutation persisted, rehydrated, replayed after the first send succeeded server-side). If both pass today, the milestone deliverable is the test plus a corrected CONCERNS entry. Only fix code if a leaking path is actually shown. |
| `RotationEditor` accessibility fix | Inline `eslint-disable` for `jsx-a11y/no-noninteractive-element-interactions` at `RotationEditor.tsx:132` is the only a11y suppression. | LOW | Replace the handler-on-static-element with a real `button` (or role plus keyboard handling), remove the suppression, add a keyboard-interaction component test. Verify the suppression-free file passes `eslint --max-warnings=0`. |
| PATCH-schema safety guard for shared contracts | The `1030b35` data-loss bug class: `.partial()` on a schema with `.default(...)` silently rewrites stored values. Still possible at `membership.ts:39` and `deals.ts:82-148`. | LOW-MEDIUM | Prefer a structural test over a prose rule: for every exported update/patch request schema, `schema.parse({})` must return `{}` (no injected defaults), plus the `{ name }`-only integration pattern from `95b0bd2` for each service PATCH route. A rule that lives only in a doc will be violated by the next LLM edit. |
| Service-role key scope audit with an enforcing test | Risk in CONCERNS (Security). | MEDIUM | Enumerate every import of the privileged client; justify or move each. Add a lint-rule test (a fixture file that must fail lint) so the fence cannot silently regress. Do not move code in ways that alter transaction or RLS behavior. |
| Deploy-script password exposure fix | DB password appears on the `supabase migration up --db-url` command line, visible in process listings and `set -x` traces. | LOW-MEDIUM | Pass via environment variable or `.pgpass`. Regression test: run `scripts/deploy.sh` with a stub `supabase` that records argv and asserts the password is absent. Cannot be exercised against the live host, so the stub test plus review is the evidence. |
| Kong/Caddy GoTrue path coverage | Signup and password-change refusal rests only on Caddy path matchers; Kong allows every `/auth/v1/*` route for `anon`. | MEDIUM | Enumerate the GoTrue paths the anon ACL needs, deny the rest in Kong, extend `e2e/tests/08-caddy-refuses-gotrue-endpoints.spec.ts` to the full refused list. Gateway config is high blast radius: ship behind the existing E2E gateway tests and treat as its own phase. |
| CI enforces the new hygiene checks | PROJECT.md Active item 5. Checks that run only locally decay within weeks in an LLM-assisted repo. | LOW-MEDIUM | Add a dead-code/unused-dependency job (only after the baseline is clean, otherwise it is permanently red), and a dependency-audit job. `braces` has no upstream patch, so the audit step needs an explicit, documented accepted-risk allowance that expires when a patch exists. |
| CI correctness review | Same item. Current `ci.yml` is in decent shape (`permissions: contents: read`, frozen lockfile, concurrency, failure-only artifact upload). | LOW | Concrete gaps seen: only `test-e2e` sets `timeout-minutes`, so a hung job runs to the 6-hour default; `deploy.yml` correctness should be re-read as part of the same pass. |

### Differentiators (go beyond a typical cleanup; align with "trustworthy base")

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Lint rule banning bare `new Date()` / `Date.now()` in test files | Prevents the flake class from returning; turns the one-time audit into a standing guard. | LOW | `no-restricted-syntax` scoped to test globs, with an allowlisted clock helper. MEDIUM confidence it will not over-trigger; run it in report mode first to size the fix. |
| Run the fast suites under a timezone and date matrix | Proves "any weekday and household timezone" instead of asserting it. Unit and component tests are cheap enough to run several times. | MEDIUM | Example matrix: `TZ=UTC`, `America/Los_Angeles`, and a UTC+13/+14 zone, with fixed system times covering a Saturday, a Sunday, month end, and a DST boundary. Add DST edge cases to `packages/recurrence` (flagged as the gap in CONCERNS). Do not apply the matrix to full E2E. |
| Drift checks for committed generated files | Makes `apps/service/src/db/types.ts` (kysely-codegen) and normalized Flipp fixtures verifiably in sync with their sources. | MEDIUM | CI runs `db:types` / `fixtures:normalize` and `git diff --exit-code`. The `test-integration` job already starts Supabase, so the database exists; add a step rather than a new job. |
| CI setup deduplication via a composite action | Six jobs repeat checkout, pnpm, Node, install. Satisfies the Active "redundancy in CI config" item and makes future CI edits one-line. | LOW | `.github/actions/setup/action.yml`. Behavior-neutral and verifiable by CI itself. |
| Workflow linting (actionlint) and action pinning by commit SHA | Catches expression and syntax errors in `ci.yml`/`deploy.yml` without running them; pinning hardens a workflow that deploys to a production host. | LOW | Dependabot already exists, so it can keep SHA pins current. Tool availability and current best practice not verified in this pass: LOW-MEDIUM confidence, confirm during the phase. |
| Duplication report (jscpd or similar) as report-only input to redundancy work | Finds duplicated fixtures, scripts, and test helpers that humans and LLMs miss. | LOW-MEDIUM | Use the report to choose targets; do not gate CI on it. Not verified in this pass: LOW-MEDIUM confidence. |
| Single aggregate "CI OK" job | One required status for branch protection regardless of matrix or job renames. | LOW | Only worthwhile if branch protection is actually configured; check first. |
| Structural test for the privileged-import fence | Makes the service-role boundary self-verifying. | LOW | A lint-fixture test that fails if the rule stops catching a deliberate violation. |
| Characterization tests before touching thinly covered code | Pins current behavior so redundancy reduction is provably behavior-neutral. | MEDIUM | Targets: offline queue reload path, recurrence across DST, errand/chore write paths. Add only where a refactor is actually planned. |
| Accepted-risk register for what is intentionally left (`braces`, CSP `unsafe-inline`, in-memory rate limiter, single-host) | Lets the owner see "known and deliberately deferred" separately from "missed". | LOW | Keep it inside `.planning/` or the existing CONCERNS file; if a durable statement belongs in a spec, put it in `docs/architecture.md` as spec text, not as a log. |
| Splitting oversized integration test files by domain | Easier review of 800 to 1100 line files. | MEDIUM | Behavior-neutral but high diff noise. Only combine with shared-fixture deduplication; do not do as a standalone sweep. |

### Anti-Features (commonly done, and harmful here)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Bulk-deleting everything the dead-code tool flags | "The tool said so"; fastest path to a lean repo | Static analysis cannot see dynamic `import()`, env-driven fixture paths (`HEARTH_FLIPP_FIXTURE_DIR`), Docker/Compose/Caddy/Kong references, SQL, or shell scripts. The privileged-module fence itself uses dynamic-import detection, which shows such imports exist. | Three-bucket triage; delete only proven-dead; list the rest. |
| Deleting or editing applied Supabase migrations that look unused or redundant | Migration history looks like clutter | Rewrites history the live database and deploy script depend on; breaks `supabase migration up` ordering | Leave migrations alone. Any schema cleanup is a new forward migration, and is out of scope here. |
| "While I'm here" refactors that change behavior (renames in API contracts, changed defaults, reordered cron work, tightened validation) | Looks like improvement; LLM edits drift into it | Violates the behavior constraint and makes the diff unreviewable. The `.partial()` default-reset bug is exactly this class of silent change. | Pure moves and deletions only; any intended behavior change must be a named bug fix with its own regression test. |
| Fixing flakes with retries, longer timeouts, or `sleep`/`waitForTimeout` | Fastest way to green | Hides the root cause (calendar and shared-state dependence). Retries are deliberately disabled in this suite. | Pin the clock where client-only, derive expectations from seed data, fix state leakage. |
| Weakening or deleting assertions to make a flaky or failing test pass | Same | Converts a signal into noise | Fix the test's inputs, not its expectations. |
| Running full E2E under multiple faked clocks or timezones in CI | "Prove determinism everywhere" | The service and database do not follow `page.clock`, so it would not test what it claims; and the E2E job is already the slowest (40-minute budget, cold image builds) | Matrix the fast unit and component suites; keep E2E on seed-derived expectations. |
| Disabling lint rules or adding broad knip `ignore` entries to reach a green gate | Gets the enforcement job passing | Makes the gate decorative and recreates the leftover-artifact problem | Fix the finding, or add a narrow commented exception with the reason. |
| Adding review logs, decision logs, ADRs, or cleanup reports under `docs/` | Feels like good documentation | Project rule: specs in `docs/` are the only source of truth; no review, decision-log, or ADR files | Keep process artifacts in `.planning/`; keep `docs/` as current-state spec only. |
| Major dependency upgrades or framework migrations during cleanup | "Hygiene" | Out of the Tech stack constraint; brings behavior changes and new advisories | Patch/minor updates only (as in `b96ca32`); override `braces` when a patched release exists. |
| Patching the `braces` transitive dependency via a fork or hand-written override | Silences the audit | Unreviewed code in the toolchain | Record accepted risk; re-audit on a schedule. |
| Mass reformatting or comment-stripping sweeps | Makes the repo look "clean" | Prettier and ESLint already enforce style, so any residual diff is noise that buries real changes; stripping comments removes the "non-negotiable N" rationale that explains the code | Leave formatting to existing tooling. |
| Coverage-chasing: writing tests to raise percentages | Looks like hardening | Adds tests with no bug evidence and slows the suite | Add tests only for fixed bugs and for characterization before a planned refactor. |
| Touching Flipp integration, backups infrastructure, scaling, or CSP style nonces | Present in CONCERNS | Explicitly out of scope, or behavior-changing (CSP nonce work alters runtime headers and the PWA build) | Leave in the accepted-risk register. |
| Blanket splitting of every large file | Looks tidy | Pure churn; high conflict risk; no correctness gain | Split only files that are being deduplicated anyway. |

## Feature Dependencies

```
Baseline snapshot (green suite, coverage, lint, typecheck, build)
    └──required by──> every other item

Dead-code/dependency tooling configured (report-only)
    └──requires──> Baseline snapshot
    └──produces──> Three-bucket triage ledger
                       └──requires──> Proven-dead removal (atomic commits)
                                          └──requires──> Docs-match-code pass (after deletions)
                                          └──requires──> Redundancy reduction (after deletions, so nothing deduped is later deleted)
                                          └──requires──> CI enforcement of dead-code check (only once baseline is clean)

Date/time determinism (unit + component)
    └──requires──> Baseline snapshot
    └──enhances──> TZ/date matrix in CI
    └──enhances──> Lint ban on bare Date in tests

E2E seed-derived expectations
    └──independent of──> unit determinism; precedes any E2E-based regression test that touches dates

Bug: offline replay
    └──requires──> Reproduction test (server and web)
                       └──requires──> Fix only if reproduction fails; otherwise test + corrected CONCERNS entry

PATCH-schema structural test ──requires──> inventory of update schemas in packages/shared
Service-role scope test ──requires──> audit of privileged imports
Kong deny-list ──requires──> enumeration of needed GoTrue paths ──requires──> extended E2E spec 08 (write test first)
Deploy password fix ──requires──> stub-`supabase` argv test

Drift checks (db:types, fixtures:normalize) ──requires──> Supabase started in the job (already true in test-integration)
CI composite action ──requires──> CI review pass (do together, once)

Retries/timeouts as a "fix" ──conflicts──> deterministic-suite goal and retries:0 design
Bulk deletion ──conflicts──> Evidence constraint
```

### Dependency Notes

- **Baseline precedes everything:** without recorded green status and coverage numbers, "behavior unchanged" cannot be demonstrated.
- **Deletion precedes deduplication and doc sync:** deduplicating code, fixtures, or scripts that are later deleted wastes work, and docs must describe the post-deletion tree.
- **CI enforcement comes last for dead-code checks:** enabling a gate before the baseline is clean makes CI red for every other change in the milestone.
- **Reproduction precedes the replay "fix":** the code already contains client-generated ids and `ON CONFLICT DO NOTHING`, so the bug may be a documentation or coverage gap rather than a defect.
- **Gateway changes are isolated:** Kong/Caddy changes affect the production auth surface and are only validated by the Compose-based E2E suite, so they should not share a phase with refactors.
- **Date determinism is a prerequisite only for date-touching tests:** the replay and PATCH tests do not depend on it and can run in parallel.

## MVP Definition

For this milestone, "MVP" means the smallest set that satisfies Core Value.

### Launch With (milestone must-ship)

- [ ] Baseline snapshot and knip-style report-only analysis with three-bucket ledger: the evidence base for every deletion.
- [ ] Removal of proven-dead code, files, exports, and unused dependencies, plus the owner review list: the "lean" half of Core Value.
- [ ] Generated/leftover-file verification and docs-match-code pass: "no stray generated files, docs match code".
- [ ] Date/timezone determinism in unit, component, and E2E tests: the "passes on any day" half of Core Value.
- [ ] Offline replay reproduction test (fix only if it fails), PATCH-schema structural guard, `RotationEditor` fix, service-role scope audit and test, deploy-script password fix, Kong/Caddy path coverage, each with a regression test.
- [ ] CI additions: dead-code/unused-dependency check, dependency audit with a documented `braces` allowance, job timeouts, correctness review of both workflows.

### Add After Validation (same milestone if time allows)

- [ ] Drift checks for generated types and normalized fixtures: needs Supabase in the job, low risk.
- [ ] Timezone/date matrix for the fast suites, plus DST cases in `packages/recurrence`.
- [ ] Lint ban on bare `Date` in tests.
- [ ] CI composite action, workflow linting, SHA pinning.
- [ ] Duplication report driving fixture/script deduplication.

### Future Consideration (next milestone or owner decision)

- [ ] Splitting oversized test files: only alongside fixture deduplication.
- [ ] Production-level rate-limit E2E through the real trusted-proxy chain: needs an E2E overlay change and has its own risk.
- [ ] CSP `style-src` hardening: behavior-changing.
- [ ] Off-host backups and restore tests, Flipp replacement, multi-host scaling: out of scope per PROJECT.md.

## Feature Prioritization Matrix

| Feature | Owner Value | Implementation Cost | Priority |
|---------|-------------|---------------------|----------|
| Baseline snapshot | HIGH | LOW | P1 |
| Dead-code/dependency report and triage | HIGH | MEDIUM | P1 |
| Proven-dead removal, atomic commits | HIGH | MEDIUM | P1 |
| Owner review list for uncertain candidates | HIGH | LOW | P1 |
| Date/timezone determinism (unit, component, E2E) | HIGH | MEDIUM | P1 |
| Offline replay reproduction and regression test | HIGH | MEDIUM | P1 |
| PATCH-schema structural guard | HIGH | LOW | P1 |
| Docs-match-code pass | MEDIUM | MEDIUM | P1 |
| Generated/leftover file verification | MEDIUM | LOW | P1 |
| CI dead-code and audit jobs, timeouts, review | HIGH | LOW | P1 |
| `RotationEditor` a11y fix | MEDIUM | LOW | P1 |
| Service-role scope audit and test | HIGH | MEDIUM | P1 |
| Deploy-script password fix | MEDIUM | LOW | P2 |
| Kong/Caddy GoTrue deny-list and E2E | HIGH | MEDIUM | P2 |
| Generated-file drift checks | MEDIUM | MEDIUM | P2 |
| TZ/date matrix for fast suites | MEDIUM | MEDIUM | P2 |
| Lint ban on bare `Date` in tests | MEDIUM | LOW | P2 |
| CI composite action | MEDIUM | LOW | P2 |
| actionlint and SHA pinning | LOW-MEDIUM | LOW | P3 |
| Duplication report and fixture dedupe | MEDIUM | MEDIUM | P3 |
| Large test-file splitting | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for the milestone to satisfy Core Value
- P2: Should have, do when its prerequisites land
- P3: Nice to have, drop first if scope pressure appears

## Practice Comparison (how established tooling handles this)

| Activity | Established approach | Source and confidence | Our approach |
|----------|----------------------|-----------------------|--------------|
| Unused files, exports, dependencies | Knip: workspace-aware, reads `pnpm-workspace.yaml`, per-workspace `entry`/`project`; unconfigured workspaces produce false "unused file" floods | Knip docs, MEDIUM-HIGH (WebSearch of official docs; exact current version behavior not verified) | Report-only first, configure each workspace, enforce in CI only once clean |
| Time-dependent tests | Playwright `clock.setFixedTime` recommended for most cases; `install` plus `pauseAt`/`fastForward` only when time must keep moving; call order matters; clock is per browser context | Playwright docs, MEDIUM-HIGH | Use for client-only assertions; server-side dates come from seed data |
| Unit-level time control | Vitest fake timers / `vi.setSystemTime` | General practice; already used in about 10 test files in this repo, HIGH for repo fact | Standardize on one helper; ban bare `Date` in tests |
| Idempotent replay | Client-generated id plus insert `ON CONFLICT DO NOTHING` | Present in repo, HIGH | Keep; prove with tests |
| Duplication, workflow linting | jscpd, actionlint | Not verified this pass, LOW-MEDIUM | Evaluate during the CI phase |

## Sources

- Repo: `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`, `apps/service/src/services/lists.ts` (lines 299-332), `apps/web/src/screens/lists/ListDetailScreen.tsx` (lines 103-147), `apps/web/src/lib/offline/write-queue.ts`, `packages/shared/src/api/lists.ts`, `eslint.config.js`, `.github/workflows/ci.yml`, `e2e/playwright.config.ts`, `pnpm-workspace.yaml`, `.gitignore` (HIGH, read directly)
- Repo scan: `git ls-files` (668 files) for tracked build artifacts and lint configs; grep for `new Date()`/`Date.now()` in tests (29 sites) and fake-timer usage (HIGH)
- Knip documentation on monorepos and workspaces, and configuration hints: https://knip.dev/features/monorepos-and-workspaces and https://knip.dev/reference/configuration-hints (MEDIUM-HIGH)
- Playwright clock documentation: https://playwright.dev/docs/clock (MEDIUM-HIGH)
- General cleanup-practice claims (triage buckets, atomic commits, characterization tests) are standard engineering practice, not tied to one cited source (MEDIUM)

---
*Feature research for: cleanup and hardening of an LLM-generated TypeScript monorepo*
*Researched: 2026-10-11*
