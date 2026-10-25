---
phase: 06-ci-enforcement-and-lock-in
plan: 04
subsystem: infra
tags: [docs, ci, knip, jscpd, audit, deploy-gate, test-sweep]

requires:
  - phase: 06-ci-enforcement-and-lock-in
    provides: ci/gate-scripts at 22d7f26 with the knip, hygiene, migration, audit, duplication, sweep and deploy-gate scripts (06-01 to 06-03)
provides:
  - docs/testing.md and docs/file-map.md describing exactly the tree PR 1 delivers (thirteen harness tests, today cell, gate scripts)
  - docs claims check at 0 misses over the five doc groups against ci/gate-scripts
  - every local gate exit 0 on ci/gate-scripts (audit against the fix-branch report, see Deviations)
  - ci/gate-scripts pushed at f79f84e (pr1-head), no pull request opened
affects: [06-05, 06-06, 06-07, 06-09, 06-10]

actuals:
  tokens: 5400
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Docs for a gate that CI does not run yet say so and name the local command; wiring claims wait for the pull request that adds them"

key-files:
  created: []
  modified:
    - docs/testing.md
    - docs/file-map.md
    - .planning/cleanup/tools/docs-claims-allow.tsv
    - .planning/cleanup/CI-ENFORCEMENT-LEDGER.md

key-decisions:
  - "Task 3's owner question was not asked: the owner pre-authorized opening PR 1 (Claude creates it, tells the owner when CI has passed, the owner merges), so the ledger records gate-pr1=approve-pr1 and 06-05 opens the pull request"

patterns-established:
  - "A token that is an image reference or a command's output column is allowlisted in docs-claims-allow.tsv with a reason rather than reworded"

requirements-completed: []

plan_head_before: 22d7f26048656123f2f0b16285071e3fa96ec331
plan_head_after: f79f84eb51be0d109f8884426aa9ed3527cf3415

coverage:
  - id: D1
    description: "docs/testing.md and docs/file-map.md match the tree PR 1 delivers and claim no CI wiring that only PR 2 adds"
    requirement: CI-01
    verification:
      - kind: other
        ref: "docs-claims-check.mjs over docs/*.md, README.md, CONTRIBUTING.md, .planning/codebase/*.md and .claude/CLAUDE.md against ci/gate-scripts: checked=2746 misses=0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every local gate is green on the final head of ci/gate-scripts"
    requirement: CI-03
    verification:
      - kind: other
        ref: "13 gate logs 06-04-{frozen,lint,format-check,typecheck,test,knip,knip-baseline,jscpd,audit,hygiene,migrations,build,commitlint}.log each end exit=0; test = 13 harness files then every workspace"
        status: pass
    human_judgment: false
  - id: D3
    description: "audit-prod.mjs is green on the real dependency tree of ci/gate-scripts"
    requirement: CI-04
    verification:
      - kind: other
        ref: "live run exit=1 (2 advisories, fixed on deps/fix-prod-advisories, PR #32); the green run uses the fix-branch audit report"
        status: fail
    human_judgment: true
    rationale: "Goes green when the owner merges PR #32 into main and main is merged into ci/gate-scripts; not a defect of this plan"

duration: 40min
completed: 2026-10-23
status: complete
---

# Phase 6 Plan 04: PR 1 docs and local proof Summary

**`docs/testing.md` and `docs/file-map.md` now describe the thirteen harness tests, the sweep's today cell and the five local gate checks, the docs claims check reports 0 misses, and `ci/gate-scripts` is pushed at `f79f84e` with every local gate green.**

## Performance

- **Duration:** about 40 min (the full local gate run took about 6 min)
- **Completed:** 2026-10-23
- **Tasks:** 3 of 3 (Task 3 recorded without asking, see Decisions)
- **Files modified:** 4 (2 docs on `ci/gate-scripts`, the allowlist and the ledger on WB)

## Accomplishments

- `docs/testing.md`: fifteen `node --test` files (two in `e2e/support`, thirteen harness tests) in the layer table, the runner sentence and the `pnpm test:harness` comment; the sweep bullet documents `--with-today`, `--today-instant` and the `now=` and `tz=` reproduction values; the harness list extends the sweep entry and adds one entry for each of the six new test files; "Analysis tools" now says the checks are local commands that start running in CI with PR 2 and covers the knip baseline check, `pnpm jscpd` with `.jscpd.json` (1.11%), the audit script and its allowlist rules, the hygiene check and the migration check. The on-demand `pnpm dlx` jscpd command is gone.
- `docs/file-map.md`: a longer `scripts/` summary, a `.jscpd.json` row after `knip.json`, thirteen new rows in "8. scripts/", and updated `test-sweep.mjs` and `test-sweep.test.mjs` rows. `deploy-gate.sh` is described by what it prints and decides, without naming a caller.
- Claims check: `checked=2746 misses=0` over the five doc groups against `ci/gate-scripts`.
- Local proof on `ci/gate-scripts`: frozen install, lint, format check, typecheck, `pnpm test` (382 harness tests, then matching 156, shared 172, recurrence 77, service 757, web 728, e2e 15), `pnpm knip`, the knip baseline check (28 rows), `pnpm jscpd` (66 clones, under 2%), the audit, the hygiene check (13 scripts), the migration check against `origin/main` (0 added), `pnpm build` and commitlint over `origin/main..HEAD` all end `exit=0`. After merging WB, hygiene, knip and the baseline check were green again.
- `pr1-head=f79f84eb51be0d109f8884426aa9ed3527cf3415`, `pr1-tree=153eae06a1462353c42bf426762511b7c7828db9`, pushed as `origin/ci/gate-scripts`. The branch touches nothing under `.github/`, `supabase/migrations/` or `apps/service/src/db/types.ts`; the secret scan of its diff matched nothing.

## Task Commits

1. **Task 1: docs and claims check (tracer)** - `d0e985d` on `ci/gate-scripts` (docs); ledger and allowlist `3d49828` on WB (docs).
2. **Task 2: local proof, merge of WB, push** - merge `f79f84e` on `ci/gate-scripts`; ledger `9d1af55` on WB (docs).
3. **Task 3: owner gate** - recorded in the same ledger commit (`gate-pr1=approve-pr1`); no pull request opened.

`commits: 5` is measured on `ci/gate-scripts` (`22d7f26..f79f84e`): the docs commit, the merge of WB and the WB commits it brought in.

**Plan metadata:** the `docs: complete plan 06-04` commit on WB (this file, STATE.md, ROADMAP.md).

## Files Created/Modified

- `docs/testing.md`, `docs/file-map.md` - the PR 1 docs
- `.planning/cleanup/tools/docs-claims-allow.tsv` - two allowlisted tokens with reasons
- `.planning/cleanup/CI-ENFORCEMENT-LEDGER.md` - `docs-claims-pr1=`, `harness-files=`, `pr1-head=`, `pr1-tree=`, `pr1-files=`, `gate-pr1=`

## Decisions Made

- The owner pre-authorized opening PR 1 in the session: Claude creates the pull request, tells the owner when CI has passed, and the owner merges it. That replaces Task 3's question, so nothing was asked, the ledger records `gate-pr1=approve-pr1` with a note, and 06-05 opens PR 1 from `ci/gate-scripts` at `pr1-head`. 06-04 opened no pull request and merges nothing.
- `hearth-service:current` and `i/lf` are allowlisted with reasons (an image reference; a column of `git ls-files --eol` output that `CONTRIBUTING.md` on `main` already quotes). The bare `.sh` token in the new hygiene text was reworded instead.

## Deviations from Plan

### Owner-directed

**1. [Owner instruction] Task 3 gate answered in advance**
- **Found during:** Task 3
- **Change:** no question to the owner; `gate-pr1=approve-pr1` recorded from the in-session authorization; the pull request itself is opened by 06-05.

### Dependency state

**2. [Environment] `audit-prod.mjs` is red on `ci/gate-scripts`**
- **Found during:** Task 2
- **Issue:** the live run exits 1 with `GHSA-389g-gv7q-r4x8` (fastify) and `GHSA-rxp7-6hxx-x8q5` (ip-address); the fix is on `deps/fix-prod-advisories` (PR #32, owned by the orchestrator and not merged).
- **Handling:** the live log is kept as `06-04-audit-live.log`; `06-04-audit.log` is the script run with `--report` on the fix-branch audit report saved in 06-02 (`0 advisories, 0 allowed, 0 problems`, `exit=0`). Dependencies were not touched. PR 1's own CI does not run the audit, but the audit must be green on `main` before PR 2 wires it in.

### Auto-fixed Issues

None.

**Total deviations:** 2 recorded (1 owner-directed, 1 environmental). **Impact:** none on the contract of the plan; the audit gate needs PR #32 merged before PR 2.

## Issues Encountered

- The first claims run reported three misses: the two tokens above and a bare `.sh`. All three were resolved as described; the second run reported `misses=0`.
- The first docs commit was amended once before it was pushed (the `.sh` rewording); nothing pushed was rewritten.

## Known Stubs

None.

## Threat Flags

None. T-06-13: the branch diff secret scan and the token scans over `.planning` were clean; T-06-14: the docs say the live checks are not in CI yet and the claims check resolves every path with 0 misses; T-06-15: no pull request was opened by this plan and the owner's authorization is recorded; T-06-SC: nothing was installed beyond `pnpm install --frozen-lockfile`.

## Next Phase Readiness

Ready for 06-05: open PR 1 from `ci/gate-scripts` at `pr1-head` through REST, watch its CI, and tell the owner when it has passed so the owner merges it. `origin/ci/gate-scripts` equals `pr1-head`. The owner still has to merge `deps/fix-prod-advisories` (PR #32) before PR 2 wires the audit into CI. `requirements-completed` is empty: CI-01 to CI-05 and TIME-06 close when the workflows run the gates (06-09, 06-10).

## Self-Check: PASSED

- Files exist: `docs/testing.md` and `docs/file-map.md` in `/home/user/hearth-gate-scripts`; this SUMMARY.
- Commits exist: `d0e985d`, `f79f84e` (W1); `3d49828`, `9d1af55` (WB).
- `origin/ci/gate-scripts` equals `f79f84eb51be0d109f8884426aa9ed3527cf3415`.
