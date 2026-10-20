---
gsd_state_version: "1.0"
current_phase: 4
current_phase_name: Bug Fixes With Regression Tests
status: executing
stopped_at: Completed 04-03-PLAN.md
last_updated: "2026-10-20T13:59:53.959Z"
last_activity: 2026-10-20
last_activity_desc: Phase 4 execution started
state_head: c4e76a028355a7366f509204b4f31590d8b8c888
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 31
  completed_plans: 25
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-19)

**Core value:** The owner can start a manual review from a lean, trustworthy base: no dead code or stray generated files, a CI suite that passes repeatably regardless of day or timezone, and the known bugs fixed with regression tests.
**Current focus:** Phase 4 — Bug Fixes With Regression Tests

## Current Position

Phase: 4 (Bug Fixes With Regression Tests) — EXECUTING
Plan: 3 of 8
Status: Ready to execute
Last activity: 2026-10-20 — Phase 4 execution started

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 23
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | - | - |
| 02 | 9 | - | - |
| 3 | 9 | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 11min | 3 tasks | 15 files |
| Phase 01 P02 | 11min | 2 tasks | 2 files |
| Phase 01 P03 | 14min | 2 tasks | 2 files |
| Phase 01 P04 | 15min | 3 tasks | 1 files |
| Phase 01 P05 | ~35min | 3 tasks | 2 files |
| Phase 03 P03 | 1h | 3 tasks | 6 files |
| Phase 3 P04 | 30min | 2 tasks | 3 files |
| Phase 03 P05 | 25min | 3 tasks | 12 files |
| Phase 03 P06 | 30min | 2 tasks | 3 files |
| Phase 03 P07 | resumed | 3 tasks | 1 files |
| Phase 03 P08 | resumed session | 3 tasks | 1 files |
| Phase 03 P09 | 2 sessions | 2 tasks | 5 files |
| Phase 04 P01 | 12min | 3 tasks | 6 files |
| Phase 04 P03 | 10min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Git curation and push come first because every merge to `main` deploys (only `docs/` is exempt)
- [Roadmap]: Determinism precedes removal so failures are attributable; enforcement is last so `main` is never red
- [Roadmap]: Never rename the `CI` workflow or its job ids; `deploy.yml` fires on the workflow named `CI`
- [Phase 01]: Gate 1 approved (approve-personal): 43 product commits + 1 policy commit; publish alex.c.tanton@gmail.com as author/committer email via identity-rewrite pass in plan 01-02; stale spec references kept
- [Phase 01]: bee9a62 stays a plain pick: multi-scope header test(shared,matching) passes commitlint, scope-enum negative control fails
- [Phase 01]: Plan 01-02: curated-main rebuilt (43 commits, tip 9dd6668) plus policy commit 83eae2c; identity rewritten to alex.c.tanton@gmail.com; use curated-main/83eae2c, not pre-identity 3c1dcea
- [Phase 01]: Plan 01-03: curated tip 83eae2c841ab8de096d52990f8f3be3f4379c448 proven (43 PASS + 1 SKIP via rebase --exec, mode/CRLF/secret scans clean); plans 01-04 and 01-05 push only this SHA
- [Phase 01]: Plan 01-04: Gate 2 approved (approve-gate-2); 83eae2c pushed to origin/curated-main only (new branch, no force); origin/main still 7da55e3; PR #1 opened (not merged), CI results recorded (see next entry)
- [Phase 01]: Plan 01-04: PR #1 CI on tip 83eae2c: lint, typecheck, build, test-integration pass; test-unit fails (favorites.test.tsx as-of 4:00 AM vs 8:00 AM, 4h offset, analyst reading: UTC vs America/New_York, Phase 2 class) and test-e2e fails (registry toomanyrequests, no Playwright test ran); both in content identical to b96ca32; owner decides at Gate 3 (accept or re-run e2e first)

- [Phase 01]: Plan 01-05: candidate tip changed after Gate 2 to d3da748223fb85432fc06defaa25ac00ac4ed258 (83eae2c plus a ci.yml-only pre-pull commit); pushed fast-forward to origin/curated-main; PR #1 CI: lint, typecheck, test-integration, test-e2e (102/102), build pass; test-unit fails on the one known timezone web test (Phase 2 TIME-01 class, unproven)
- [Phase 01]: Plan 01-05: Gate 3 recorded as push-main-accept-red for d3da748 (owner reply approve-gate-3, 2026-10-12, red job test-unit). First push rejected by ruleset "Main PR Enforcement" (GH013); owner changed the ruleset and re-confirmed ("A done, re-confirm gate 3"); second plain push succeeded: origin/main 7da55e3..d3da748, PR #1 marked MERGED by GitHub; local main moved without disturbing .planning/ and .claude/; GIT-01..04 complete
- [Phase 2]: Development moved to Claude Code cloud sessions. `.planning/` and `.claude/CLAUDE.md` are tracked on `main` (`commit_docs: true`); the plans run on Linux against `.planning/environment/cloud-setup.sh`, with Docker optional (no Docker: integration and E2E evidence comes from PR CI). Work branches `test/deterministic-clock` and `chore/knip-config` are backup-pushed after each plan with no PR; PRs open only at 02-08's gate (or 02-04's early-CI draft). Raw logs under `.planning/cleanup/logs/` are gitignored and never committed.
- [Phase 2]: Clock pin is a subclass-safe `Date`, not `vi.setSystemTime` (it breaks `@date-fns/tz` in negative-offset zones); PR #8 later made suite-level overrides survive and covered the pin with 167 harness tests run by `pnpm test`
- [Phase 2]: Owner decisions after verification (D-13 to D-18 in 02-CONTEXT.md): Phase 5 uses the test-inclusive jscpd baseline; weekend E2E run deferred; vitest declared at the root; fuzzy benchmark deleted; packages are internal; the jobs barrel keeps its test
- [Phase 03]: A2=remove honored: 18 unused z.infer aliases removed from packages/shared, schemas kept
- [Phase 03]: Plan 03-07: gate-pr2=approve; PR 2 (#13) opened at head 5f5b090 with six green CI jobs (test-e2e passed on attempt 3 after two ECR toomanyrequests re-runs); awaiting the owner's squash merge
- [Phase 03]: Plan 03-09: final-tree proof on 9819e7c (knip default 1, production 28, nonode 1); knip-summary kept reported; DEAD-05 complete per OQ1=accept and local db:types evidence (permanent check Phase 6 CI-03); main test-e2e red on 51c077e and aefe63a (registry flake, owner-accepted, not re-run), green on 9819e7c after one re-run
- [Phase 04]: Plan 04-01: FIX-01 held-id map keyed by list and deal (d4b01b2); FIX-04 drag handle as a draggable button with a role=presentation drop row, no eslint-disable (f1e16fd); FIX-02 tests on fix/list-adds-rotation (1571f07), per-list advisory lock one commit ahead on fix/list-adds-lock (2e357e5). Red/green in FIX-LEDGER-WEB.md; FIX-02 red/green pending PR 1 CI (04-02)
- [Phase 04]: Plan 04-03: test/guard-tests (72b0668) holds the FIX-05 28-probe fence test (audit 0 violations, 4 mutations killed with 15/10/2/17 failures) and the FIX-03 registry-driven PATCH guard (autopay mutation killed); tests, harness wiring and docs only, no PR yet (04-04)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 3]: Main CI gap: `test-e2e` is red on the main runs for 51c077e (PR 1) and aefe63a (PR 2) from the registry pre-pull flake; the owner chose not to re-run them so Deploy does not pick up superseded commits (each PR's own CI was green on an identical tree). 9819e7c is green after one re-run; `17-accessibility-states.spec.ts:527` and `19-notifications.spec.ts:141` flaked once there (look at them in Phase 6)
- [Phase 3]: DEAD-05 is marked complete on the owner-authorized local Docker run (`pnpm db:types` twice, both equal to the committed file; `pnpm db:seed` exit 0), not CI; the permanent drift check is Phase 6 CI-03
- [Phase 3]: `knip:production` reports `scripts/knip-summary.mjs` as a files line (owner decision keep-reported); revisit with Phase 6 CI-01, together with the `**/test/**` hidden-entry blind spot of the committed knip config
- [Phase 1]: The "Main PR Enforcement" ruleset (id 23693495) was changed by the owner to permit the main push (the API now returns 404 for it, so it appears deleted rather than disabled). Nothing is enforced on main now; if it is re-created, a required check plus the red test-unit (favorites.test.tsx timezone test, Phase 2 TIME-01 class) will block PRs. CONTRIBUTING.md says branch protection is not configured; reconcile in Phase 6. Owner may cancel a queued Deploy run and delete origin/curated-main.
- [Phase 3]: Three of the six proven-dead rows in `.planning/cleanup/TRIAGE.md` (`currentWeekFixture`, `emptyWeekFixture`, `previousWeekFixture` in `apps/web/src/test/meal-fixtures.ts`) no longer appear in a fresh `pnpm knip` run: the root `test:harness` script (PR #8) makes knip's Node plugin treat `test/**` files as entries, so a fresh default run gives 54 findings (recorded: 59) and 79 production (recorded: 80). Re-establish the tool evidence for those three before deleting anything; decide whether `knip.json` should stop that side effect
- [Phase 3]: `../hearth-aside/bin/knip-summary.mjs` (outside the repo) normalizes the knip reports and is cited by TRIAGE.md; it is lost with the cloud container unless committed
- [Phase 2]: TIME-03's weekend E2E confirmation is deferred by the owner; CI `test-e2e` has run on one calendar day only
- [Phase 2]: The second code review (02-REVIEW-FIXES.md, of PR #8's code) has 0 critical, 6 warnings and 6 infos, all open; the owner has not yet decided whether to fix them
- [Phase 6]: `main` has no branch protection and the Deploy job waits on an unregistered self-hosted runner; Dependabot PR #9 (29 npm updates) failed CI on 2026-10-16 and security alert dependabot/1 is unexamined
- [Phase 4]: The offline-duplicate root cause is unproven; reproduce `useAddDealToList` (client id minted inside `mutationFn`) before fixing.
- [Phase 6]: `db:types` determinism is unverified (run twice before gating); `braces` advisory has no upstream patch; web coverage thresholds need an enforce-or-remove decision.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-20T13:59:53.873Z
Stopped at: Completed 04-03-PLAN.md
Resume file: None
