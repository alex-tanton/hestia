# Milestone Archive: v1.0 — Hearth Cleanup and Hardening

**Completed:** 2026-10-25
**Scope:** 6 Phases, 60 Plans, 40 Requirements, 100% UAT Pass (32/32 tests)

---

## Overview

This milestone took an LLM-built household PWA to a base the owner can trust before a manual review. The order was chosen so that every step can be attributed and every merge to `main` (which deploys) is safe: first published a clean git history and a branch/PR policy, then made the test net deterministic and calibrated the dead-code analyzer, then removed only what was proven dead, then fixed the known bugs each behind a red-then-green regression test, then reduced redundancy and synced docs to the final file set, and finally turned on CI enforcement as a ratchet so `main` is never red.

## Phases

- [x] **Phase 1: Git History Curation and Branch Policy** - Publish a curated, owner-approved history to `origin` and write down how work lands afterward (completed 2026-10-12)
- [x] **Phase 2: Baseline, Net Stabilization, and Analysis** - Make the test suite deterministic on any day and timezone, and produce a calibrated, triaged dead-code and duplication analysis (completed 2026-10-19)
- [x] **Phase 3: Evidence-Gated Removal** - Remove proven-dead files, exports, dependencies, and stale references; hand uncertain candidates to the owner (completed 2026-10-20)
- [x] **Phase 4: Bug Fixes With Regression Tests** - Fix the known bugs and robustness gaps, each guarded by a test that failed before the fix (completed 2026-10-21)
- [x] **Phase 5: Redundancy Reduction and Text Sync** - Reduce duplicated CI, fixtures, and stale comments, and bring docs in line with the final code (completed 2026-10-22)
- [x] **Phase 6: CI Enforcement and Lock-in** - Turn on blocking dead-code, duplication, drift, audit, and date/timezone gates without breaking deploys (completed 2026-10-25)

---

## Phase Details

### Phase 1: Git History Curation and Branch Policy

**Goal:** The owner has a clean, approved history published to `origin` and a written workflow for how cleanup work lands afterward
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: GIT-01, GIT-02, GIT-03, GIT-04
**Success Criteria**:
  1. The ~55 local commits are curated (squashed, reworded, reordered, noise dropped) on top of origin's initial commit `7da55e3`, and running commitlint over the whole range exits clean.
  2. The owner has approved the rewrite plan, including what the first push triggers on deploy, before anything is pushed; `origin/main` then equals the curated history, reached as a fast-forward with no force-push.
  3. A written branch and PR policy exists in the repo (not as an ADR or decision-log file under `docs/`): major functionality goes through PRs from branches or worktrees with squash merge, and docs-only or mechanical changes go straight to `main`.
  4. Every script in the curated history is committed with executable mode `100755` and LF line endings, checkable with `git ls-files -s` and a CRLF scan over `*.sh`.

**Plans:** 5/5 plans complete (01-01 through 01-05)

---

### Phase 2: Baseline, Net Stabilization, and Analysis

**Goal:** The test suite passes deterministically on any weekday and household timezone, and a calibrated analyzer produces a triaged findings list, so removals can be attributed and trusted
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: BASE-01, BASE-02, BASE-03, BASE-04, TIME-01, TIME-02, TIME-03, TIME-04, TIME-05
**Success Criteria**:
  1. Typecheck, lint, test, and build results on untouched `main` are recorded in `.planning/cleanup/`, so the owner can see exactly which failures pre-exist (notably the 7 failing time-dependent web test files).
  2. Unit and component tests pass when run under several pinned dates and timezones (a weekday and a weekend day, a UTC-negative and a UTC-positive zone): the 7 formerly failing web test files are green, and the service and package suites pass the same sweep.
  3. E2E expectations are derived from seed data with no weekday assumptions, and `bills.integration.test.ts` passes regardless of whether the UTC date and the household-zone date differ at run time.
  4. Writing a bare `new Date()` or `Date.now()` in a test file or under `e2e/` fails lint.
  5. knip runs with explicit entry points (`sw.ts`, seed, e2e global setup, package exports), planted canaries behave as expected (known-dead is reported, known-live is not), findings are triaged into proven-dead, config-gap, test-only, and uncertain, and a jscpd duplication scan is recorded.

**Plans:** 9/9 plans complete (02-01 through 02-09)

---

### Phase 3: Evidence-Gated Removal

**Goal:** The repo contains no files, exports, dependencies, or references that tooling and tests prove dead, and everything uncertain is on a list for the owner rather than deleted
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: DEAD-01, DEAD-02, DEAD-03, DEAD-04, DEAD-05, DEAD-06
**Success Criteria**:
  1. Each proven-dead file, export, and type is removed only with three-part proof (no importer, a repo-wide text search across all file types finds no reference, and the relevant build or test passes), and re-running knip reports no remaining proven-dead findings.
  2. Unused dependencies (the `fuse.js` benchmark cluster, unused `tsx` in seed) are removed with `pnpm-lock.yaml` updated in the same commit, and `pnpm install --frozen-lockfile` succeeds.
  3. Stale references such as `BUILD_PROMPT.md` in ignore files are gone, `git ls-files -ci --exclude-standard` lists nothing, and regenerating `db/types.ts` produces no diff.
  4. The owner receives a list of candidates tooling could not prove dead (dynamic imports, Docker/Supabase config, string-reachable code) with the evidence for each, and none of them were deleted.
  5. Typecheck, lint, unit, integration, and E2E suites and both Docker builds pass after the removals, with no diff under `supabase/migrations/` and no change in application behavior.

**Plans:** 9/9 plans complete (03-01 through 03-09)

---

### Phase 4: Bug Fixes With Regression Tests

**Goal:** The known bugs and robustness gaps are fixed, and each fix is guarded by a regression test that failed before the fix
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06, FIX-07
**Success Criteria**:
  1. Replaying an offline list-add after a lost response no longer creates duplicate items, for both adding a deal to a list and adding a recipe to a list; each is shown by a test that fails on the pre-fix code and passes after.
  2. A structural test fails if any PATCH schema in the shared contracts injects defaults, so an omitted field can never be reset by a partial update.
  3. The `RotationEditor` component can be operated with the keyboard alone using proper semantics, the accessibility lint suppression is gone, and a keyboard test covers it.
  4. Service-role client usage outside `apps/service/src/privileged/` is audited, and a test proves the ESLint fence fails when it is violated.
  5. Running `deploy.sh` never places the database password on a process command line (a stubbed-argv test shows this), and Kong denies the unused GoTrue paths in addition to Caddy while the normal sign-in and token-refresh flows still pass.

**Plans:** 8/8 plans complete (04-01 through 04-08)

---

### Phase 5: Redundancy Reduction and Text Sync

**Goal:** Duplicated CI config, fixtures, and stale comments are reduced, and docs and the codebase map describe what the code actually does
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: RED-01, RED-02, RED-03, RED-04, RED-05
**Success Criteria**:
  1. The six CI jobs share one composite setup action instead of repeating the preamble, and the workflow is still named `CI` with its job ids unchanged.
  2. The seed typecheck runs exactly once in CI.
  3. The duplicated test fixtures flagged by the scan live in a single shared place, all tests still pass, and a re-scan shows fewer clones than the Phase 2 baseline.
  4. The stale spec citations (1,116 lines in 456 files at PR C's base, recounted with the full retired-spec vocabulary) are removed as comment-only edits, verified by identical transformed output, with `supabase/migrations/` untouched.
  5. `docs/` and `.planning/codebase/` match the code: statements spot-checked against the repo hold (for example, `hearth-admin` is described as hand-written), and no review, decision-log, or ADR file was added under `docs/`.

**Plans:** 13/13 plans complete (05-01 through 05-13)

---

### Phase 6: CI Enforcement and Lock-in

**Goal:** CI blocks regressions of everything this milestone cleaned, without turning `main` red or breaking the `CI`-triggers-deploy contract
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: CI-01, CI-02, CI-03, CI-04, CI-05, CI-06, CI-07, CI-08, TIME-06
**Success Criteria**:
  1. A PR that adds a dead file, a dead export, or an unused dependency fails CI on the blocking knip check, and a PR that pushes source duplication over the jscpd threshold fails CI.
  2. A PR that tracks an ignored file, lets `db/types.ts` drift from the schema, edits an applied migration, or commits a script without the executable bit or with CRLF endings fails CI.
  3. `pnpm audit --prod` runs in CI and passes with an expiring allowance for `braces`, every job has a `timeout-minutes`, both workflows have had a correctness review, and the web coverage thresholds are either enforced or removed so config and `docs/testing.md` agree.
  4. Unit and component tests run across a date and timezone matrix on `main` and nightly, and pass.
  5. A throwaway PR confirms that a merge to `main` still fires `deploy.yml` from the workflow named `CI` after all workflow changes.
  6. No test in CI fails intermittently; every flaky test observed in CI history is fixed at its cause with zero masking (no retries, no quarantine, no skips, no longer timeouts, no weakened assertions), proven by 6 consecutive all-green full CI runs on its pull request and green on main's first attempt on the merge commit (CI-08).

**Plans:** 16/16 plans complete (06-01 through 06-16)

---

## Milestone Summary

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Git History Curation and Branch Policy | 5/5 | Complete | 2026-10-12 |
| 2. Baseline, Net Stabilization, and Analysis | 9/9 | Complete | 2026-10-19 |
| 3. Evidence-Gated Removal | 9/9 | Complete | 2026-10-20 |
| 4. Bug Fixes With Regression Tests | 8/8 | Complete | 2026-10-21 |
| 5. Redundancy Reduction and Text Sync | 13/13 | Complete | 2026-10-22 |
| 6. CI Enforcement and Lock-in | 16/16 | Complete | 2026-10-25 |
