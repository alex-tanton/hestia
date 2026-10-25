---
phase: 06-ci-enforcement-and-lock-in
plan: 03
subsystem: infra
tags: [test-sweep, time-zones, deploy-gate, ci, node-test, bash]

requires:
  - phase: 06-ci-enforcement-and-lock-in
    provides: ci/gate-scripts at 0c1fb89 with the knip, hygiene, migration, audit and duplication gates and the phase ledger (06-01, 06-02)
provides:
  - scripts/test-sweep.mjs --with-today and --today-instant, the sweep's nightly today cell with a rotating zone and reproducible result lines
  - scripts/deploy-gate.sh (100755), the deploy decision against the running hearth-service:current revision (OD-4 a, b, c), and scripts/deploy-gate.test.mjs
  - a local 42-of-42 sweep (36 fixed-cell runs plus 6 today-cell runs)
  - ci/gate-scripts pushed at 22d7f26 (no pull request opened)
affects: [06-04, 06-05, 06-06, 06-07, 06-09, 06-10]

actuals:
  tokens: 31000
  tasks: 2
  commits: 6

tech-stack:
  added: []
  patterns:
    - "A rotating test cell is a pure function of its instant (UTC epoch day modulo the zone count), so any failure is reproduced from its printed now= and tz="
    - "Shell gates run in tests as the real script copied into a temp git repository with a stub docker first on PATH"
    - "A value from a workflow payload is validated (40 lowercase hex digits, equal to HEAD) before any other use, with explicit hex digits instead of ranges"

key-files:
  created:
    - scripts/deploy-gate.sh
    - scripts/deploy-gate.test.mjs
  modified:
    - scripts/test-sweep.mjs
    - scripts/test-sweep.test.mjs
    - package.json
    - .planning/cleanup/CI-ENFORCEMENT-LEDGER.md

key-decisions:
  - "The today cell's zone is TODAY_ZONES[floor(epoch ms / 86400000) % 11] over 11 zones (a count not divisible by 7), so a weekday does not keep its zone"
  - "The deploy gate reads the diff with --no-renames so code moved into docs/ still counts as a code change"
  - "A git ancestry check that cannot decide (a shallow clone) deploys with the reason on stderr, the same fail-open choice as an unknown running revision (PC-5, T-06-11)"

patterns-established:
  - "Gate scripts print one decision line on stdout and one reason line on stderr, and exit 1 with empty stdout when their input is unusable"

requirements-completed: []

plan_head_before: 0c1fb89445bfeea72936d97af72721861e30112c
plan_head_after: 22d7f26048656123f2f0b16285071e3fa96ec331

coverage:
  - id: D1
    description: "The sweep adds a real-date today cell with a zone that rotates by UTC day, prints now= and tz= for reproduction, and leaves the matrix and output unchanged without the flag"
    requirement: TIME-06
    verification:
      - kind: unit
        ref: "node --test scripts/test-sweep.test.mjs (54 tests, 21 new: three fixed instants and day boundaries, an eleven-day rotation, nine rejections that run nothing, a real two-cell run with its logs)"
        status: pass
      - kind: other
        ref: "node scripts/test-sweep.mjs --with-today on Node 24: sweep: 42/42 passed, 36 fixed and 6 today runs PASS, exit=0 (today cell now=2026-10-23T18:32:46.709Z tz=Europe/London)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The deploy gate skips a commit older than the running revision and a docs/ and .planning/ only change, deploys everything else, and refuses a hostile HEARTH_DEPLOY_SHA before a shell sees it"
    requirement: CI-05
    verification:
      - kind: unit
        ref: "node --test scripts/deploy-gate.test.mjs (36 tests in temp repositories with a stub docker: unknown, equal, older, docs-only, code-after-docs, diverged, rename and hostile-SHA cases; one stdout line and only hearth-service:current asked in every exit-0 case)"
        status: pass
      - kind: other
        ref: "bash -n and shellcheck clean; git ls-tree shows 100755; node scripts/check-repo-hygiene.mjs clean (13 scripts); knip exit 0 and the 28-row baseline equal"
        status: pass
    human_judgment: false
  - id: D3
    description: "Whether the deploy gate's fail-open choices (unknown, diverged or uncomparable running revision deploys) and its re-run redeploy match the owner's appetite on the production box"
    verification: []
    human_judgment: true
    rationale: "PC-5 and T-06-11 are accepted by design; the script is unused until PR 2 wires it into deploy.yml, and a runner change cannot be tried before merge"

duration: 75min
completed: 2026-10-23
status: complete
---

# Phase 6 Plan 03: Sweep today cell and deploy gate Summary

**`test-sweep.mjs --with-today` adds a nightly cell at the real instant with a zone chosen by UTC day (and proved 42 of 42 locally), and `deploy-gate.sh` decides deploys against the running image's revision, covering OD-4 a, b and c.**

## Performance

- **Duration:** about 75 min, most of it the 42-run local sweep
- **Completed:** 2026-10-23
- **Tasks:** 2 of 2
- **Files modified:** 6 (2 created, 4 modified, counting the ledger on WB)

## Accomplishments

- `--with-today` appends a `today` unit cell after the selected fixed cells. `--today-instant ISO` fixes its instant and goes through `parseTestNow`, so it accepts exactly what `HEARTH_TEST_NOW` accepts. The zone is `TODAY_ZONES[floor(epoch ms / 86400000) % 11]` over `Pacific/Kiritimati`, `America/Los_Angeles`, `Asia/Kolkata`, `Europe/London`, `Pacific/Pago_Pago`, `Australia/Lord_Howe`, `America/New_York`, `Asia/Kathmandu`, `Pacific/Auckland`, `America/St_Johns`, `Asia/Tokyo`. Its result lines read `cell=today now={now} tz={tz} workspace=... result=... exit=...`, so a red nightly reproduces with `HEARTH_TEST_NOW={now} TZ={tz}`. Without the flag the matrix and the output are unchanged.
- Verified instants: `2026-10-22T14:00:00.000Z` gives `Asia/Kolkata`, `2026-10-23T14:00:00.000Z` gives `Europe/London`, `2026-10-21T23:59:59.999Z` gives `America/Los_Angeles` (the UTC day boundary). `--today-instant` without `--with-today`, an offset-less or garbage instant, a missing value, and `--suite integration --with-today` all exit 2 and run nothing; `--cell today` stays an unknown cell.
- The local proof ran `node scripts/test-sweep.mjs --with-today` on Node 24 with `TZ` unset: `sweep: 42/42 passed` (36 fixed-cell runs plus 6 today-cell runs, the live instant being `2026-10-23T18:32:46.709Z` in `Europe/London`), recorded as `sweep-local=42/42 fixed=36/36 today=6/6` in the ledger.
- `scripts/deploy-gate.sh` prints exactly `deploy=true` or `deploy=false` for the checked-out commit by comparing it with the `org.opencontainers.image.revision` label of `hearth-service:current`: older than the running revision skips (OD-4 c), only `docs/` and `.planning/` changed since it skips (OD-4 a, b), and a re-run, no image, a non-commit label, an unknown or diverged revision, or any other change deploys (PC-5). `HEARTH_DEPLOY_SHA` must be 40 lowercase hex digits and equal `HEAD`, checked before docker is asked.
- `scripts/deploy-gate.test.mjs` passes 36 of 36 against temp repositories and a stub docker, including the hostile-value cases (a command substitution leaves no marker file). It is appended to `test:harness`.

## Task Commits

1. **Task 1: Sweep today cell (tracer)** - `b14b733` on `ci/gate-scripts` (test); ledger `60f8d1d` on WB (docs).
2. **Task 2: Deploy gate** - `aca380c` on `ci/gate-scripts` (ci); ledger `f404b76` on WB (docs).

`commits: 6` is measured on `ci/gate-scripts` (`0c1fb89..22d7f26`): the two plan commits, the merge of WB and the WB commits it brought in.

**Plan metadata:** the `docs: complete plan 06-03` commit on WB (this file, STATE.md, ROADMAP.md).

## Files Created/Modified

- `scripts/test-sweep.mjs`, `scripts/test-sweep.test.mjs` - the today cell, its flags and tests
- `scripts/deploy-gate.sh`, `scripts/deploy-gate.test.mjs` - the deploy decision and its tests
- `package.json` - `scripts/deploy-gate.test.mjs` appended to `test:harness`
- `.planning/cleanup/CI-ENFORCEMENT-LEDGER.md` - `sweep-local=`, `sweep-list-today=`, `deploy-gate-tests=`, `hygiene-live=` and `pr1-branch-push=`

## Decisions Made

- Eleven zones, not seven, so the weekday-to-zone mapping drifts week to week (research A5 dry-ran each).
- The diff uses `--no-renames` and `-z`: moving code into `docs/` still lists the code path, and an odd file name cannot hide or split another path.
- `knip.json` needed no change: the deploy gate is a shell script and its test, like the other `*.test.mjs` files, is not a knip entry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rename detection could hide a code deletion**
- **Found during:** Task 2 (designing the diff read)
- **Issue:** `git diff --name-only` follows `diff.renames`, so moving `src/x.ts` to `docs/x.ts` would list only the `docs/` path and the gate would skip a deploy that removes code.
- **Fix:** `--no-renames`; a test moves a file into `docs/` and expects `deploy=true`.
- **Files modified:** `scripts/deploy-gate.sh`, `scripts/deploy-gate.test.mjs`
- **Commit:** `aca380c`

**2. [Rule 2 - Missing critical functionality] A history git cannot compare must not crash the gate**
- **Found during:** Task 2
- **Issue:** `git merge-base --is-ancestor` exits 128 on a shallow clone, which `set -e` would turn into an unexplained failure of the `changes` step.
- **Fix:** exit codes other than 0 and 1 deploy with the reason on stderr (the same fail-open rule as an unknown running revision, T-06-11).
- **Files modified:** `scripts/deploy-gate.sh`
- **Commit:** `aca380c`

### Dependency state on ci/gate-scripts

Per the owner's 06-02 decision, `audit-prod.mjs` stays red on `ci/gate-scripts` until `deps/fix-prod-advisories` merges into `main`. Nothing in this plan's verification depends on a clean audit, so no verify clause was adapted; dependencies were not touched.

**Total deviations:** 2 auto-fixed, 0 owner-directed. **Impact:** none on the plan's contract.

## Issues Encountered

- A first-draft test expected `2026-10-23T01:00:00+02:00` (which is `2026-10-22T23:00:00Z`) to map to `America/Los_Angeles`; the correct zone is `Asia/Kolkata`. The implementation was right and the expectation was fixed.
- After the W1 commit, `scripts/deploy-gate.sh` showed mode `100644` on disk although the commit holds `100755` (cause not investigated; likely the pre-commit hook's stash and restore); `chmod +x` restored it and the tree is clean.

## Known Stubs

None.

## Threat Flags

None. T-06-09 and T-06-10 are mitigated and tested case by case; T-06-11 (fail-open on an unknown running revision) is accepted and logged on stderr; T-06-12: the tests use explicit instants and the clock fence lints the test file; T-06-SC: nothing was installed.

## Next Phase Readiness

Ready for 06-04 (docs for the sweep, the harness list and the scripts) on `ci/gate-scripts` (W1 at `22d7f26`). The owner still needs to merge `deps/fix-prod-advisories` before PR 1 lands. `deploy.yml` is unchanged; PR 2 wires `deploy-gate.sh` in with `fetch-depth: 0`. TIME-06 and CI-05 stay open until `sweep.yml` runs and `deploy.yml` calls the gate (06-09, 06-10).

## Self-Check: PASSED

- Files exist in W1 `/home/user/hearth-gate-scripts`: `scripts/deploy-gate.sh` (`100755`), `scripts/deploy-gate.test.mjs`, `scripts/test-sweep.mjs`, `scripts/test-sweep.test.mjs`.
- Commits exist: `b14b733`, `aca380c`, `22d7f26` (W1), `60f8d1d`, `f404b76` (WB).
- `origin/ci/gate-scripts` equals W1 HEAD (`22d7f26`); the secret scan of the branch diff was clean; the branch touches nothing under `.github/`, `supabase/migrations/` or `apps/service/src/db/types.ts`.
