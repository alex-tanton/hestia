# Roadmap: Hearth — Cleanup and Hardening

## Overview

This milestone takes an LLM-built household PWA to a base the owner can trust before a manual review. The order is chosen so that every step can be attributed and every merge to `main` (which deploys) is safe: first publish a clean git history and a branch/PR policy, then make the test net deterministic and calibrate the dead-code analyzer, then remove only what is proven dead, then fix the known bugs each behind a red-then-green regression test, then reduce redundancy and sync docs to the final file set, and finally turn on CI enforcement as a ratchet so `main` is never red.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Git History Curation and Branch Policy** - Publish a curated, owner-approved history to `origin` and write down how work lands afterward (completed 2026-10-12)
- [x] **Phase 2: Baseline, Net Stabilization, and Analysis** - Make the test suite deterministic on any day and timezone, and produce a calibrated, triaged dead-code and duplication analysis (completed 2026-10-19)
- [x] **Phase 3: Evidence-Gated Removal** - Remove proven-dead files, exports, dependencies, and stale references; hand uncertain candidates to the owner (completed 2026-10-20)
- [x] **Phase 4: Bug Fixes With Regression Tests** - Fix the known bugs and robustness gaps, each guarded by a test that failed before the fix (completed 2026-10-21)
- [x] **Phase 5: Redundancy Reduction and Text Sync** - Reduce duplicated CI, fixtures, and stale comments, and bring docs in line with the final code (completed 2026-10-22)
- [ ] **Phase 6: CI Enforcement and Lock-in** - Turn on blocking dead-code, duplication, drift, audit, and date/timezone gates without breaking deploys

## Phase Details

### Phase 1: Git History Curation and Branch Policy

**Goal:** The owner has a clean, approved history published to `origin` and a written workflow for how cleanup work lands afterward
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: GIT-01, GIT-02, GIT-03, GIT-04
**Success Criteria** (what must be TRUE):
  1. The ~55 local commits are curated (squashed, reworded, reordered, noise dropped) on top of origin's initial commit `7da55e3`, and running commitlint over the whole range exits clean.
  2. The owner has approved the rewrite plan, including what the first push triggers on deploy, before anything is pushed; `origin/main` then equals the curated history, reached as a fast-forward with no force-push.
  3. A written branch and PR policy exists in the repo (not as an ADR or decision-log file under `docs/`): major functionality goes through PRs from branches or worktrees with squash merge, and docs-only or mechanical changes go straight to `main`.
  4. Every script in the curated history is committed with executable mode `100755` and LF line endings, checkable with `git ls-files -s` and a CRLF scan over `*.sh`.

**Plans:** 5/5 plans complete

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Safety net, local-only planning, curation-pipeline tracer, rewrite proposal, owner Gate 1 (incl. author email)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Rebuild curated-main from the approved todo (tracer: tree identity, commitlint, FF dry run) and add the CONTRIBUTING.md policy commit

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-03-PLAN.md — Per-commit typecheck via git rebase --exec, mode/CRLF/planning-path/secret scans, proof results

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-04-PLAN.md — Owner Gate 2, push staging branch curated-main, owner-opened PR runs CI

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 01-05-PLAN.md — Owner Gate 3, fast-forward push of main, local main move and final proofs

### Phase 2: Baseline, Net Stabilization, and Analysis

**Goal:** The test suite passes deterministically on any weekday and household timezone, and a calibrated analyzer produces a triaged findings list, so removals can be attributed and trusted
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: BASE-01, BASE-02, BASE-03, BASE-04, TIME-01, TIME-02, TIME-03, TIME-04, TIME-05
**Success Criteria** (what must be TRUE):
  1. Typecheck, lint, test, and build results on untouched `main` are recorded in `.planning/cleanup/`, so the owner can see exactly which failures pre-exist (notably the 7 failing time-dependent web test files).
  2. Unit and component tests pass when run under several pinned dates and timezones (a weekday and a weekend day, a UTC-negative and a UTC-positive zone): the 7 formerly failing web test files are green, and the service and package suites pass the same sweep.
  3. E2E expectations are derived from seed data with no weekday assumptions, and `bills.integration.test.ts` passes regardless of whether the UTC date and the household-zone date differ at run time.
  4. Writing a bare `new Date()` or `Date.now()` in a test file or under `e2e/` fails lint.
  5. knip runs with explicit entry points (`sw.ts`, seed, e2e global setup, package exports), planted canaries behave as expected (known-dead is reported, known-live is not), findings are triaged into proven-dead, config-gap, test-only, and uncertain, and a jscpd duplication scan is recorded.

**Plans:** 9/9 plans complete

Plans:
**Wave 1**
- [x] 02-01-PLAN.md — Baseline of untouched main (d3da748) on Node 24, twice, with the seven time-dependent web files across zones; checks the cloud toolchain first, and takes the integration rows from CI when the session has no Docker

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — Shared clock pin, TZ hook and sweep runner (tracer on favorites.test.tsx, literal oracle with a pinned viewer zone), then the seven web files green in all six cells
- [x] 02-06-PLAN.md — Owner package-legitimacy gate, knip 6.41.0 with explicit D-10 entries, canary calibration on a scratch branch

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-03-PLAN.md — Service and package unit suites on the pin; every unit suite green in all six cells

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 02-04-PLAN.md — Zone-correct helpers, bills date fix behind a red-then-green two-zone guard (proven by title, locally or through a draft PR's CI when there is no Docker), integration audit and zone sweep

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 02-05-PLAN.md — E2E household clock helper for specs 16 and 19, and the bare-clock lint ban across tests, e2e and test helpers

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 02-09-PLAN.md — Playwright zone pin, weekday audit ledger over every E2E spec, root sweep scripts and the clock docs

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 02-07-PLAN.md — knip on the combined Phase 2 tree, full triage ledger and owner candidates, jscpd baseline (source-only per D-12 plus a test-inclusive scan at the same thresholds)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 02-08-PLAN.md — Restack knip onto the clock branch, pre-publication proof, owner gate, clock PR into main and knip PR stacked on it, both green

### Phase 3: Evidence-Gated Removal

**Goal:** The repo contains no files, exports, dependencies, or references that tooling and tests prove dead, and everything uncertain is on a list for the owner rather than deleted
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: DEAD-01, DEAD-02, DEAD-03, DEAD-04, DEAD-05, DEAD-06
**Success Criteria** (what must be TRUE):
  1. Each proven-dead file, export, and type is removed only with three-part proof (no importer, a repo-wide text search across all file types finds no reference, and the relevant build or test passes), and re-running knip reports no remaining proven-dead findings.
  2. Unused dependencies (the `fuse.js` benchmark cluster, unused `tsx` in seed) are removed with `pnpm-lock.yaml` updated in the same commit, and `pnpm install --frozen-lockfile` succeeds.
  3. Stale references such as `BUILD_PROMPT.md` in ignore files are gone, `git ls-files -ci --exclude-standard` lists nothing, and regenerating `db/types.ts` produces no diff.
  4. The owner receives a list of candidates tooling could not prove dead (dynamic imports, Docker/Supabase config, string-reachable code) with the evidence for each, and none of them were deleted.
  5. Typecheck, lint, unit, integration, and E2E suites and both Docker builds pass after the removals, with no diff under `supabase/migrations/` and no change in application behavior.

**Plans:** 9/9 plans complete

Plans:
**Wave 1**
- [x] 03-01-PLAN.md — Tracer: commit the knip normalizer and remove the seed `tsx` on `build/unused-deps`; start the removal ledger; DEAD-01 null result; owner decides A1, A2, A8 and OQ1

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03-02-PLAN.md — Owner gate, PR 1 into main with six green jobs, and a throwaway draft for the `db:types` and `db:seed` CI evidence

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03-03-PLAN.md — PR 2 web slice: the six proven-dead items, the bills alias, and the meal-fixture cascade to a fixed point under the throwaway config

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 03-04-PLAN.md — PR 2: unused entries of the jobs, matching and recurrence barrels

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 03-05-PLAN.md — PR 2: the 18 shared `z.infer` aliases per the owner's A2 answer, then a branch-wide green run

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 03-06-PLAN.md — PR 3 content: the stale `BUILD_PROMPT.md` ignore entries, path sweep, leftover audit and orphan-docs re-check

**Wave 7** *(blocked on Wave 6 completion and on the owner's merge of PR 1)*
- [x] 03-07-PLAN.md — PR 2 landing: fixed point proven against the ledger at the tip, owner gate, six green jobs

**Wave 8** *(blocked on Wave 7 completion and on the owner's merge of PR 2)*
- [x] 03-08-PLAN.md — PR 3 landing: sync, owner gate, six green jobs including both image builds

**Wave 9** *(blocked on Wave 8 completion and on the owner's merge of PR 3)*
- [x] 03-09-PLAN.md — Phase close on the final main: the five success criteria, `main` CI, guards, DEAD-05 status, refreshed and checked owner list

### Phase 4: Bug Fixes With Regression Tests

**Goal:** The known bugs and robustness gaps are fixed, and each fix is guarded by a regression test that failed before the fix
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06, FIX-07
**Success Criteria** (what must be TRUE):
  1. Replaying an offline list-add after a lost response no longer creates duplicate items, for both adding a deal to a list and adding a recipe to a list; each is shown by a test that fails on the pre-fix code and passes after.
  2. A structural test fails if any PATCH schema in the shared contracts injects defaults, so an omitted field can never be reset by a partial update.
  3. The `RotationEditor` component can be operated with the keyboard alone using proper semantics, the accessibility lint suppression is gone, and a keyboard test covers it.
  4. Service-role client usage outside `apps/service/src/privileged/` is audited, and a test proves the ESLint fence fails when it is violated.
  5. Running `deploy.sh` never places the database password on a process command line (a stubbed-argv test shows this), and Kong denies the unused GoTrue paths in addition to Caddy while the normal sign-in and token-refresh flows still pass.

**Plans:** 8/8 plans complete

Plans:
**Wave 1**
- [x] 04-01-PLAN.md — PR 1 content: tracer FIX-01 (held deal-add id, red then green), FIX-04 (rotation editor without the suppression, keyboard tests), FIX-02 tests on the PR head and the per-list lock on `fix/list-adds-lock`
- [x] 04-03-PLAN.md — PR 2 content: tracer FIX-05 (service-role audit, fence probes, four killed config mutations), FIX-03 (registry-driven PATCH default guard, killed schema mutation)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 04-02-PLAN.md — PR 1 landing: local proof, owner gate (incl. the CLAUDE.md lines), red `test-integration` run, lock fast-forward, six green jobs
- [x] 04-05-PLAN.md — PR 3 content, part 1 (stacked on PR 2): tracer FIX-06 (scoped `PGPASSWORD`, stubbed-argv test red then green), Kong E2E probes, owner `yaml@2.9.1` legitimacy gate

**Wave 3** *(blocked on Wave 2 completion and on the owner's merge of PR 1)*
- [x] 04-04-PLAN.md — PR 2 landing: sync after PR 1's merge, local proof, owner gate, six green jobs
- [x] 04-06-PLAN.md — PR 3 content, part 2 on `fix/kong-allowlist`: tracer Kong allowlist (format 3.0, static test red 13 of 32 then green), deploy and testing docs

**Wave 4** *(blocked on Wave 3 completion and on the owner's merge of PR 2)*
- [x] 04-07-PLAN.md — PR 3 landing: sync after PR 2's merge, local proof, owner gate, red `test-e2e` run on the old Kong, allowlist fast-forward, six green jobs

**Wave 5** *(blocked on Wave 4 completion and on the owner's merge of PR 3)*
- [x] 04-08-PLAN.md — Phase close on the final `main`: every fix green there, the FIX-LEDGER index, `main` CI, the owner's Kong host step

**UI hint**: yes

### Phase 5: Redundancy Reduction and Text Sync

**Goal:** Duplicated CI config, fixtures, and stale comments are reduced, and docs and the codebase map describe what the code actually does
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: RED-01, RED-02, RED-03, RED-04, RED-05
**Success Criteria** (what must be TRUE):
  1. The six CI jobs share one composite setup action instead of repeating the preamble, and the workflow is still named `CI` with its job ids unchanged.
  2. The seed typecheck runs exactly once in CI.
  3. The duplicated test fixtures flagged by the scan live in a single shared place, all tests still pass, and a re-scan shows fewer clones than the Phase 2 baseline.
  4. The stale spec citations (1,116 lines in 456 files at PR C's base, recounted with the full retired-spec vocabulary; 262 was a Phase 2 count) are removed as comment-only edits, verified by identical transformed output, with `supabase/migrations/` untouched; test titles and three fixture pages were changed in separately proven commits.
  5. `docs/` and `.planning/codebase/` match the code: statements spot-checked against the repo hold (for example, `hearth-admin` is described as hand-written), and no review, decision-log, or ADR file was added under `docs/`.

**Plans:** 13/13 plans complete

**Scope note:** seven plans exceed the 100k-token smart-zone estimate (05-04 110k, 05-06 140k, 05-07 130k, 05-08 140k, 05-09 150k, 05-10 130k, 05-12 110k; confidence low, no calibration samples yet). This is accepted and the plans are not re-sliced: the work is mechanical, gated per batch, and executed in worktrees.

Plans:
**Wave 1**
- [x] 05-01-PLAN.md — PR A content: tracer composite setup action in all six jobs (expansion proof), seed typecheck once, Dependabot directory, two workflow comments; push with GH_TOKEN or owner patch hand-off
- [x] 05-02-PLAN.md — PR B content, service: tracer shared integration stack hooks, every integration file on them, shared job logger; jscpd at most 90

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 05-03-PLAN.md — PR A landing: open, six green jobs, before/after job steps from CI, owner squash merge
- [x] 05-04-PLAN.md — PR B content, web: tracer browser stubs, cluster C helpers, household clock, WithQueue, deals table; jscpd at most 80

**Wave 3** *(blocked on Wave 2 completion and on the owner's merge of PR A)*
- [x] 05-05-PLAN.md — PR B landing: WB sync past PR A (one ordinary merge; on a workflow-scope refusal, the D-22 owner hand-off only), cherry-picked head, final scan below 96, six green jobs, owner merge

**Wave 4** *(blocked on Wave 3 completion and on the owner's merge of PR B)*
- [x] 05-06-PLAN.md — PR C start: tracer recount and proof tools with negative controls, packages, seed and E2E TypeScript cleared

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 05-07-PLAN.md — PR C: apps/service comments cleared in three proven batches
- [x] 05-08-PLAN.md — PR D content: docs claims checker, claim-by-claim audit of the seven specs, README citations, behavioral sample

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 05-09-PLAN.md — PR C: apps/web comments (incl. JSX) cleared in three proven batches

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 05-10-PLAN.md — PR C: non-TS code and config files, recipe HTML fixtures, and the 46 test titles in their own commit

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 05-11-PLAN.md — PR C landing: whole-range proof, post-condition, six green jobs, owner merge

**Wave 9** *(blocked on Wave 8 completion and on the owner's merge of PR C)*
- [x] 05-12-PLAN.md — PR D finish: docs for this phase's files, map regeneration (operator), D-11 Comments text, CLAUDE.md regenerated, RED-04 count restated

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 05-13-PLAN.md — PR D landing and phase close: repo-wide post-conditions, phase index, six green jobs, owner merge

### Phase 6: CI Enforcement and Lock-in

**Goal:** CI blocks regressions of everything this milestone cleaned, without turning `main` red or breaking the `CI`-triggers-deploy contract
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: CI-01, CI-02, CI-03, CI-04, CI-05, CI-06, CI-07, TIME-06
**Success Criteria** (what must be TRUE):
  1. A PR that adds a dead file, a dead export, or an unused dependency fails CI on the blocking knip check, and a PR that pushes source duplication over the jscpd threshold fails CI.
  2. A PR that tracks an ignored file, lets `db/types.ts` drift from the schema, edits an applied migration, or commits a script without the executable bit or with CRLF endings fails CI.
  3. `pnpm audit --prod` runs in CI and passes with an expiring allowance for `braces`, every job has a `timeout-minutes`, both workflows have had a correctness review, and the web coverage thresholds are either enforced or removed so config and `docs/testing.md` agree.
  4. Unit and component tests run across a date and timezone matrix on `main` and nightly, and pass.
  5. A throwaway PR confirms that a merge to `main` still fires `deploy.yml` from the workflow named `CI` after all workflow changes.

**Plans:** 10/16 plans executed (06-11 to 06-16 close the UAT gaps G-06-3 and G-06-5)

Plans:
**Wave 1**
- [x] 06-01-PLAN.md — PR 1 start: tracer knip gate (config, 28-row baseline, checker), repository hygiene gate with the three `.planning` mode fixes, migration append-only gate; phase ledger with the owner decisions

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 06-02-PLAN.md — PR 1: tracer audit gate (fail-closed, expiring allowlist, braces moot), owner legitimacy check, jscpd 5.4.1 at 2% with a config test

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 06-03-PLAN.md — PR 1: tracer sweep today cell (42/42 locally), deploy gate script for the running revision (OD-4 a to c)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 06-04-PLAN.md — PR 1 finish: tracer docs checked by the claims checker, thirteen local gates, push, owner gate

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 06-05-PLAN.md — PR 1 landing: tracer open with six green jobs, owner squash merge, `main` CI, WB sync

**Wave 6** *(blocked on Wave 5 completion and on the owner's merge of PR 1)*
- [x] 06-06-PLAN.md — PR 2 content: tracer hygiene job emulated from the YAML, web coverage and thresholds, `db:types` drift, timeouts, `sweep.yml`, `deploy.yml` through the gate

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 06-07-PLAN.md — PR 2 finish: tracer docs and the CI-05 review, sixteen local gates, patches and `apply.sh` hand-off, owner push and gate (canary choice)

**Wave 8** *(blocked on Wave 7 completion and on the owner's push of PR 2)*
- [x] 06-08-PLAN.md — PR 2 landing: tracer open with seven green jobs, owner-gated canary PR shows every gate red on CI, owner merge

**Wave 9** *(blocked on Wave 8 completion and on the owner's merge of PR 2)*
- [x] 06-09-PLAN.md — tracer `main` green and `Sweep`'s first run after PR 2; PR 3 content (CONTRIBUTING, CLAUDE.md, maps), owner gate

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 06-10-PLAN.md — PR 3 landing as the CI-07 proof (Deploy from `CI`'s `workflow_run`), today-cell and nightly sweeps, phase close

**Gap closure** (06-UAT.md: G-06-3 deploy gate redeploys the running commit; G-06-5 flaky tests in CI)

**Wave 11** *(first: the saved E2E traces start expiring on 2026-10-26)*
- [ ] 06-11-PLAN.md — G-06-5: tracer save of the expiring traces and a REST inventory of every CI failure, classified; flake rate and proof bar; local repeats of the unit, integration and sweep suites

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 06-12-PLAN.md — G-06-3: tracer red-then-green "skip the running commit" in the deploy gate, the owner's redeploy path (a re-run of the Deploy run redeploys, a re-run of `CI` does not), docs, local gates, push without the workflow commit

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 06-13-PLAN.md — G-06-3: tracer `deploy.yml` commit through the owner hand-off, pull request with the deploy-behavior change flagged, seven green jobs

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 06-14-PLAN.md — G-06-5: tracer root cause of every flaky test from its trace and a local repro; owner gate on fixes, proof bar and re-runs

**Wave 15** *(blocked on Wave 14 completion and the owner's gate)*
- [ ] 06-15-PLAN.md — G-06-5: tracer fixes on `fix/ci-flakes`, red before green, local proof per test and three full E2E runs, gates, push

**Wave 16** *(blocked on Wave 15 completion)*
- [ ] 06-16-PLAN.md — G-06-5: tracer pull request and N consecutive green CI runs, owner merges both gap pull requests, `main` green on attempt 1, CI-08 and success criterion 6, gaps closed

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Git History Curation and Branch Policy | 5/5 | Complete    | 2026-10-12 |
| 2. Baseline, Net Stabilization, and Analysis | 9/9 | Complete    | 2026-10-19 |
| 3. Evidence-Gated Removal | 9/9 | Complete    | 2026-10-20 |
| 4. Bug Fixes With Regression Tests | 8/8 | Complete    | 2026-10-21 |
| 5. Redundancy Reduction and Text Sync | 13/13 | Complete    | 2026-10-22 |
| 6. CI Enforcement and Lock-in | 10/16 | In Progress | - |
