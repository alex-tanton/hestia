# Phase 2: Baseline, Net Stabilization, and Analysis - Context

**Gathered:** 2026-10-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the unit, component, integration, and E2E tests pass deterministically on any weekday and household timezone (TIME-01..TIME-05), record a baseline of typecheck/lint/test/build on untouched `main` (BASE-01), and produce a calibrated knip analysis plus a jscpd duplication scan, triaged into proven-dead / config-gap / test-only / uncertain (BASE-02..BASE-04). Report-only: nothing is deleted (Phase 3), no bug fixes (Phase 4), no CI enforcement or date/TZ CI matrix (Phase 6, TIME-06).

</domain>

<decisions>
## Implementation Decisions

### Clock pin and date lint ban
- **D-01:** Global pin. A web/service/package setup file (plus a `globalSetup` `TZ` hook) pins one fixed instant for every unit/component test via `vi.setSystemTime`. Tests needing a different instant override locally. Never blanket `useFakeTimers()`, never a global `TZ=UTC` in CI (research constraint).
- **D-02:** Sweep is parameterized by env vars (`HEARTH_TEST_NOW`, `TZ`) read by the setup. A root sweep script loops a fixed matrix over all workspaces: a weekday and a weekend day, a UTC-negative zone and a UTC-positive zone. Phase 6 (TIME-06) reuses the same env vars for the CI matrix.
- **D-03:** Default pinned instant is a mid-week, midday-UTC instant away from midnight and month/DST boundaries (e.g. a Wednesday ~12:00Z). The sweep covers weekend, boundary-adjacent, and zone variants explicitly. Exact value is Claude's discretion.
- **D-04:** TIME-04 lint ban on bare `new Date()` / `Date.now()` in test files and `e2e/`. Sanctioned alternative: a shared test clock helper (e.g. `testNow()`) or `new Date(arg)`. Legitimate real-clock uses (integration tests against the DB clock, rate-limiter timing) opt out with `eslint-disable-next-line` plus a reason, matching the repo's existing disable convention. Not a per-file override block.

### Real-clock suites (E2E and integration)
- **D-05:** E2E expectations are derived from seed data and the household-zone "today" read at runtime. No weekday literals, and NO server clock seam: no production-code or app behavior change (honors the "no behavior change" constraint). If a spec proves it cannot be made weekday-independent, report it for the owner rather than adding a seam.
- **D-06:** TIME-05: fix the `dateIn`/`householdToday`-style helpers in `apps/service/src/bills.integration.test.ts` (UTC vs household-zone mixup around lines 55 and 575-599), share zone-correct helpers via `apps/service/src/test/`, and add a regression guard that runs the file under a TZ where the UTC date and household date differ (red before, green after).
- **D-07:** DB-backed integration tests join the date/TZ sweep (they cannot be pinned against Postgres `now()`, so they run under the TZ matrix). The ~10 integration files using `new Date()` are audited and any UTC/household mixups fixed. Requires `supabase start`.

### knip scope and calibration
- **D-08:** `knip.json` at the repo root and knip as an exact-pinned root devDependency are committed this phase (via PR per CONTRIBUTING.md). A report-only script; NOT wired into CI yet (Phase 6, CI-01). Never `knip --fix`, never zero-config knip as a gate, run default and `--production` modes.
- **D-09:** Calibration uses throwaway canaries on a scratch branch: plant known-dead (orphan file, unused export, unused dependency) and known-live (`sw.ts`, seed, e2e global setup, package export) items, record that dead is reported and live is not, then discard. Nothing permanent in the tree.
- **D-10:** Declare only reachability knip can model (`sw.ts`, seed, e2e global setup, package exports, the `hearth-admin` bin shim). Anything reachable only via Docker/Compose/Kong/Caddy config, SQL, or string-built fixture paths is never auto-triaged dead; it goes to the "uncertain" owner list with evidence. No broad ignore globs that would hide candidates.

### Baseline and findings output
- **D-11:** Baseline runs in a throwaway worktree at `d3da748` (untouched main) on Node 24 (`.nvmrc`; local default is Node 26), twice. Record typecheck, lint, test, build, and integration pass/fail counts with failing test names; failures that differ between runs are marked flaky. The 7 known failing time-dependent web test files must appear explicitly.
- **D-12:** Outputs in `.planning/cleanup/`: `BASELINE.md`, `TRIAGE.md` (table: item, bucket, tool evidence, text-search evidence), raw knip and jscpd JSON reports, and a short `OWNER-CANDIDATES.md` for uncertain items. Phase 3 consumes `TRIAGE.md` item by item. The jscpd scan is source-only and recorded as the Phase 5 (RED-03) baseline clone count.

### Claude's Discretion
- Exact pinned instant and TZ values in the matrix (D-03), as long as weekday, weekend, UTC-negative, and UTC-positive are covered.
- Name and location of the test clock helper and sweep script.
- Whether the baseline records extra tools beyond the four required commands.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` "Phase 2" - goal, success criteria, mode
- `.planning/REQUIREMENTS.md` "Baseline and analysis", "Test determinism" - BASE-01..04, TIME-01..05
- `.planning/PROJECT.md` - constraints (behavior must not change, evidence for removal, regression test per fix)
- `.claude/CLAUDE.md` Constraints - no review/decision-log/ADR files under `docs/`

### Research
- `.planning/research/SUMMARY.md` - recommended stack (knip 6.41.0, jscpd 5.4.1, vi.setSystemTime plus globalSetup TZ), anti-features
- `.planning/research/PITFALLS.md` - timezone and analyzer pitfalls
- `.planning/research/STACK.md` - tool versions and configuration notes

### Project state
- `.planning/STATE.md` "Blockers/Concerns" - only web suite swept so far; Node 26 probes vs Node 24 CI; E2E weekday strategy (now decided D-05)
- `.planning/phases/01-git-history-curation-and-branch-policy/01-CONTEXT.md` - D-07/D-08 branch and PR policy that this phase's changes follow
- `CONTRIBUTING.md` - how work lands (PR with squash vs direct to main)

### Code and docs
- `docs/testing.md` - as-built testing reference ("Tests never depend on the wall clock")
- `.planning/codebase/TESTING.md`, `.planning/codebase/CONCERNS.md` - test patterns and known concerns
- `apps/web/vite.config.ts` (test block), `apps/web/src/test-setup.ts` - web test setup
- `apps/service/vitest.config.ts`, `vitest.integration.config.ts`, `vitest.coverage.config.ts` - service test configs
- `eslint.config.js` - where the TIME-04 rule and the existing `eslint-disable` convention live
- `.github/workflows/ci.yml` - `CI` workflow name and job ids must not change

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `vi.setSystemTime` already used ad hoc in 7+ web test files (`apps/web/src/screens/*/household-timezone.test.tsx`, `chores*.test.tsx`, `errands*.test.tsx`) - candidates to fold under the global pin.
- `apps/service/src/test/` and `apps/web/src/test/` are the shared test helper homes.
- Fixture seams (`HEARTH_FLIPP_FIXTURE_NOW`) show the existing pattern for env-driven test clocks, E2E-only.

### Established Patterns
- Tests fix dates explicitly (`today: '2026-01-20'`); the offenders are component tests and integration/E2E tests using the real clock.
- `eslint-disable` appears only with a reason; non-null assertions allowed in tests only.
- Time-dependent files using `new Date()`/`Date.now()`: `apps/service/src/*.integration.test.ts` (api, bills, chores, deals, errands, jobs, log-autopay, meal-plan), `cli.test.ts`, `routes/routes.test.ts`, `request-queue.test.ts`, `host-rate-limiter.test.ts`, `packages/shared/src/api/schemas.test.ts`, `e2e/tests/16-*.spec.ts`, `e2e/tests/19-*.spec.ts`.

### Integration Points
- Setup files hook into `apps/web/vite.config.ts` `setupFiles` and each service/package vitest config.
- Lint rule goes in `eslint.config.js` scoped to `**/*.test.{ts,tsx}` and `e2e/**`.
- No `knip.json`, jscpd config, or `.planning/cleanup/` exists yet.

</code_context>

<specifics>
## Specific Ideas

- The failing PR #1 test is `favorites.test.tsx` (as-of 4:00 AM vs 8:00 AM, 4h offset, UTC vs America/New_York) - first fix target and the TIME-01 proof.
- Baseline must show which of the 7 failing web files pre-exist on untouched `main`, so later phases attribute failures correctly.

</specifics>

<deferred>
## Deferred Ideas

- CI date/timezone matrix on `main` and nightly: Phase 6 (TIME-06).
- Making knip and jscpd blocking in CI: Phase 6 (CI-01, CI-02).
- DST-boundary cases in `packages/recurrence`: v2 (TEST-02).
- A server clock seam for E2E: rejected for this milestone; revisit only if specs prove unfixable.

</deferred>

---

*Phase: 2-Baseline, Net Stabilization, and Analysis*
*Context gathered: 2026-10-12*
