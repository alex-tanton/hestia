---
phase: 02-baseline-net-stabilization-and-analysis
plan: 01
subsystem: testing
tags: [baseline, vitest, typecheck, lint, timezone, ci-evidence]

requires:
  - phase: 01-git-history-curation-and-branch-policy
    provides: published curated main at d3da748 that is measured here
provides:
  - ".planning/cleanup/BASELINE.md: two-run record of typecheck, lint, format, every workspace unit suite, integration/coverage (CI evidence) and build on untouched d3da748"
  - "The seven time-dependent web test files tabulated across two runs and four time zones"
  - "Attribution reference for failures in later Phase 2 plans"
affects: [02-02, 02-03, 02-04, 02-08]

actuals:
  tokens: 4300
  tasks: 2
  commits: 0
plan_head_before: 0b1147bf06d558d167f9f74494ffa4d70da88aaf
plan_head_after: 0b1147bf06d558d167f9f74494ffa4d70da88aaf

tech-stack:
  added: []
  patterns:
    - "Measure in a detached throwaway worktree, TZ set only through a spawned process env"

key-files:
  created:
    - .planning/cleanup/BASELINE.md
  modified: []

key-decisions:
  - "Docker daemon unreachable, so integration and coverage rows use path (b): job-level CI evidence only"
  - "Failures only seen under a TZ variant are listed separately and carry no pre-existing/flaky label, because the plan defines those labels over runs 1 and 2"

requirements-completed: [BASE-01]

duration: 16min
completed: 2026-10-12
status: complete
---

# Phase 2 Plan 01: Baseline on untouched main Summary

**Untouched d3da748 on Node 24 has exactly one failing test in both runs (`favorites.test.tsx`, pre-existing), no flaky failures, and three more stale-date web tests that fail only under `Pacific/Pago_Pago`.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-10-12T22:10Z (approximate; the start time was not captured at launch)
- **Completed:** 2026-10-12T22:27Z
- **Tasks:** 2
- **Files modified:** 1 created (`.planning/cleanup/BASELINE.md`); raw logs under `.planning/cleanup/logs/baseline/` are gitignored

## Accomplishments

- Toolchain confirmed (`cloud-check.sh` exit 0: Node v24.21.0, pnpm 10.34.5, Supabase 2.117.0) and Docker recorded as absent, which selected path (b).
- Two full runs on a detached, unmodified d3da748 worktree: typecheck, lint, format:check, build and the e2e `node --test` file passed both times; service (716), shared (148), recurrence (77) and matching (156) passed; web was 714 passed and 1 failed both times.
- The only failure, `favorites.test.tsx` "keeps the stale list with its as-of date rather than emptying", fails in run 1, run 2 and every zone, so it is `pre-existing`. Nothing is `flaky`.
- Seven-file time-dependent table filled for run 1, run 2, UTC, America/Los_Angeles, Pacific/Kiritimati and Pacific/Pago_Pago. Under Pago_Pago, `deal-search`, `flyers` and `suggestions` also fail (one test each); `recurrence-preview`, `chores` and `chores-offline-queue` pass everywhere at this instant.
- The throwaway worktree was removed, no branch was created, and the session `TZ` stayed unset.

## Task Commits

None. The plan defines no commit for either task: it states that BASELINE.md and this SUMMARY stay uncommitted in the primary checkout until plan 02-02 Task 1 commits them as the first commit on `test/deterministic-clock` (phase rules 11 and 12). The orchestrator's "commit each task" instruction conflicts with that, and I followed the plan's phase rules, as the orchestrator told me to respect them. `commits: 0` is measured: this plan changed no tracked file.

## Files Created/Modified

- `.planning/cleanup/BASELINE.md` - the baseline record; uncommitted by design
- `.planning/cleanup/logs/baseline/` - raw logs, Vitest JSON reports (run 1, run 2, four TZ variants), environment check; gitignored, never committed

## Decisions Made

- Docker was unavailable, so the `test:integration` and `test:coverage` rows come from the two existing CI runs on d3da748 (path b), not from a local run.
- Run 1 is the `pull_request` CI run 38206071791 and run 2 the `push` run 38254024046, as the plan suggests. Nothing was triggered or re-run.

## Deviations from Plan

### Gaps and judgment calls

**1. CI job logs could not be downloaded (integration counts missing)**
- **Found during:** Task 2 (path b)
- **Issue:** `gh run view --job --log` returned HTTP 403 from the Actions log host, so the per-test counts and failing names for the integration files, and the CI `test-unit` failing test name, are unavailable.
- **Handling:** Recorded the job and step conclusions from `gh run view --json jobs` instead. `test:coverage` and "Start Supabase" concluded `success` in both runs (so thresholds were met), and `test-unit` failed at step "Run pnpm test" in both. The rows say `n/a (CI log unavailable)`. I tried one `gh` log download per job and did not try other routes around the 403.
- **Impact:** The Integration rows are job-level pass/fail only. Closing this needs a Docker-capable session or a job log supplied by the owner.

**2. Proxy README and status were not read**
- A read of `/root/.ccr/README.md` and the proxy status endpoint, which the environment notes suggest for 403s, was denied by the permission classifier (reason given: containment escape). I did not retry it by another route.

**3. The plan's literal "no change since d3da748" check does not print nothing**
- `git diff --name-only d3da748 main -- . ':(exclude).planning' ':(exclude).claude'` lists `.dockerignore`, `.gitignore` and `.prettierignore`, all edited by docs commit 89eb558 (which added ignore entries for the planning folders and the logs directory). None is application code and none affects the measurement, since the measured tree is d3da748 itself. The plan's exclusion list simply did not anticipate those edits. A narrower check over `apps`, `packages`, `e2e`, `supabase`, `docker`, `scripts`, `.github`, `package.json`, `pnpm-lock.yaml` and `docs` prints nothing.

**4. The primary checkout is not on `main`**
- The session is on `claude/trusting-lovelace-y4r87h` (two docs-only commits ahead of `main` at 89eb558), while phase rule 1 assumes `main`. I did not switch branches, per rule 1.

**5. The plan's verify regex for the Integration path line is defective**
- `grep -qE '^path \((a): local Supabase|b): CI runs)'` has unbalanced parentheses and matches neither `path (a): local Supabase` nor `path (b): CI runs {ids}`. I wrote the line in the format the action text specifies (`path (b): CI runs 38206071791, 38254024046`) and did not add a contrived line to satisfy the regex. Every other clause of the Task 2 verify passed, except the literal main-diff check in item 3.
- Task 1's verify cannot be re-run as written now, because it requires the baseline worktree, which Task 2 correctly removed. Its clauses held at the time Task 1 finished (cloud-check exit 0, detached HEAD d3da748, empty status, exit line in the typecheck log, Environment section written).

### Auto-fixed Issues

None.

**Total deviations:** 0 auto-fixed, 5 recorded above
**Impact on plan:** BASELINE.md is complete except for integration test counts, which no available source provides.

## Issues Encountered

- I first launched a wait loop with no `sleep`, which would have spun a CPU core. I killed it within a minute; the measurement runner was unaffected.
- Run 1 typecheck was not timed (Task 1 ran before the timing runner existed).

## Known Stubs

None.

## Threat Flags

None. No network endpoint, auth path or schema was added or changed. The only logs that could hold secrets (`supabase start` output) were never produced on path (b).

## User Setup Required

None beyond the cloud-environment items listed in the plan's `user_setup`, all of which were already satisfied (`cloud-check.sh` exit 0).

## Next Phase Readiness

- Plan 02-02 Task 1 must copy `.planning/cleanup/BASELINE.md` and this SUMMARY onto `test/deterministic-clock` in the same session; they are untracked in the primary checkout and would be lost with the session.
- Plan 02-02 Task 2 can read the seven-file table: `favorites.test.tsx` fails now, the other three stale-date files fail only at UTC-11, and the three recurrence/chores files showed no failure at this instant.
- Plan 02-04 will also have no Docker in this session, so it faces the same CI-log 403 for its integration evidence unless that is resolved first.

## Self-Check: PASSED

- FOUND: .planning/cleanup/BASELINE.md
- FOUND: .planning/cleanup/logs/baseline/ (env-check.log, install.log, run1/run2 logs and JSON, four tz-*-web.json)
- CONFIRMED: `git worktree list` shows only the primary checkout; `git branch --list` shows no new branch
- CONFIRMED: `git status --short` shows only two untracked paths, `.planning/cleanup/` (BASELINE.md) and this SUMMARY; no tracked file changed and HEAD is still 0b1147b

---
*Phase: 02-baseline-net-stabilization-and-analysis*
*Completed: 2026-10-12*
