---
phase: 06-ci-enforcement-and-lock-in
plan: 06
subsystem: infra
tags: [ci, github-actions, workflows, coverage, sweep, deploy-gate]

requires:
  - phase: 06-ci-enforcement-and-lock-in
    provides: PR 1 on main as b585d25 (gate scripts) and the dependency fix f624a34 (06-05)
provides:
  - ci/enforce-gates (W2, local only) with five commits cut from pr2-base d0c587c
  - hygiene job in ci.yml wired to the six PR 1 gates, every command run from the YAML
  - web coverage in test-unit at 84/80/77/85, db:types drift step, timeouts and persist-credentials false
  - sweep.yml (main, nightly, dispatch) and deploy.yml calling scripts/deploy-gate.sh
  - five patches under .planning/cleanup/patches/ci-enforce-gates/ and the workflow-facts proof tool
affects: [06-07, 06-08, 06-09, 06-10]

actuals:
  tokens: 3352
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Workflow facts are printed by .planning/cleanup/tools/workflow-facts.mjs and compared with the plan; every run: command is executed from the YAML instead of retyped"

key-files:
  created:
    - .planning/cleanup/tools/workflow-facts.mjs
    - .planning/cleanup/patches/ci-enforce-gates/0001-ci-add-a-hygiene-job-that-runs-the-repository-gates.patch
    - .planning/cleanup/patches/ci-enforce-gates/0002-test-web-raise-the-coverage-thresholds-to-the-measur.patch
    - .planning/cleanup/patches/ci-enforce-gates/0003-ci-enforce-web-coverage-db-types-drift-and-job-timeo.patch
    - .planning/cleanup/patches/ci-enforce-gates/0004-ci-run-the-date-and-time-zone-sweep-on-main-and-nigh.patch
    - .planning/cleanup/patches/ci-enforce-gates/0005-ci-gate-deploys-on-the-running-revision-and-keep-no-.patch
  modified:
    - .planning/cleanup/CI-ENFORCEMENT-LEDGER.md

key-decisions:
  - "Web coverage thresholds are 84/80/77/85, the measured 85.38/81.83/78.59/86.96 rounded down minus one (PC-10)"
  - "W2 is not pushed: the token has no workflow scope, so the branch reaches origin only through the 06-07 hand-off"

requirements-completed: []

plan_head_before: d0c587c0b55cf3f4c68404b80d6ed7ad40f1c59f
plan_head_after: 56cfe00369c4245152b880adaf27284117997797

coverage:
  - id: D1
    description: "ci.yml keeps the name CI and its six job ids and gains a hygiene job whose six steps run from the YAML"
    requirement: CI-01
    verification:
      - kind: other
        ref: "workflow-facts.mjs on W2 ci.yml: jobs=lint,typecheck,test-unit,test-integration,test-e2e,build,hygiene; six step commands exit=0 (06-06-hygiene-3..8.log); actionlint, prettier, knip and the baseline check pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "Web coverage thresholds and the db:types drift step rest on local measurements"
    requirement: CI-06
    verification:
      - kind: other
        ref: "coverage-measured=85.38/81.83/78.59/86.96, thresholds 84/80/77/85, test:coverage exit 0, statements=99 exit 1; db:types twice gave 81209804cfa662518d6e0546e38ba4b02ca0bb467a1fc463400cf07867b7ffdb equal to the committed blob"
        status: pass
    human_judgment: false
  - id: D3
    description: "sweep.yml and deploy.yml are complete and the deploy gate wiring was smoke-tested"
    requirement: CI-05
    verification:
      - kind: other
        ref: "sweep-facts=ok, deploy-facts=ok, deploy-wiring-smoke=deploy=true, actionlint on all three workflows (only the hearth label ignored)"
        status: pass
    human_judgment: false
---

# Phase 6 Plan 06: PR 2 workflow content Summary

**PR 2's three workflow files and the web coverage thresholds are built on `ci/enforce-gates` and proven locally from the YAML itself; the branch is not pushed (no `workflow` scope) and is saved as five patches on WB.**

## Performance

- **Tasks:** 3 (one tracer, two auto).
- **Files:** W2 changes `ci.yml`, `deploy.yml`, `apps/web/vite.config.ts` and adds `sweep.yml`; WB gains the facts tool, five patches and ledger lines.

## Accomplishments

- `pr2-base=d0c587c0b55cf3f4c68404b80d6ed7ad40f1c59f` (a WB commit that is on `origin` and contains PR 1 `b585d25`). W2 is `/home/user/hearth-enforce-gates` on `ci/enforce-gates`, head `a2bb317`.
- `workflow-facts.mjs` (planning tool, DA-3) prints name, triggers, jobs, timeouts, checkout options, per-step name, run and `if`, and the count of `${{ }}` in `run:` values; the tool is lint-clean and prettier-clean.
- **hygiene job (tracer):** after `build`, `timeout-minutes: 10`, full-history checkout without a token, `id: setup`, and six named steps each guarded by `!cancelled() && steps.setup.outcome == 'success'`: `pnpm knip`, the baseline check (28 rows), `pnpm jscpd` (66 clones, under 2%), `audit-prod.mjs` (0 advisories; green on a tree cut from `main` after PR #32), the hygiene check (971 files, 13 scripts) and the migration check (0 added, `BASE_SHA` through `env`). All six commands were read from the YAML and exited 0 (`hygiene-emulated=6/6`).
- **Coverage (CI-06):** measured 85.38 statements, 81.83 branches, 78.59 functions, 86.96 lines (3884/4549, 2401/2934, 1212/1542, 3616/4158); thresholds 84/80/77/85 in `apps/web/vite.config.ts` with a comment naming the measurement; `test:coverage` passes, and with statements forced to 99 it exits 1.
- **test-unit** now runs `pnpm test:harness` (382 tests), `pnpm -r --filter '!@hearth/web' test` and `pnpm --filter @hearth/web test:coverage`.
- **db:types drift (D-10):** a step right after `Start Supabase` runs `pnpm db:types` then `git diff --exit-code -- apps/service/src/db/types.ts`. On a fresh local stack on Node 24 two runs gave `81209804cfa662518d6e0546e38ba4b02ca0bb467a1fc463400cf07867b7ffdb`, equal to the committed blob and to research's hash (`db-types-deterministic=yes`). The stack was stopped with `supabase stop --no-backup`.
- **Timeouts and tokens:** lint, typecheck, build and hygiene 10, test-unit 15, test-integration 25, test-e2e 40, sweep and deploy 60; every checkout in the three files has `persist-credentials: false`; `run-interpolation=0` everywhere.
- **sweep.yml:** named `Sweep`, triggers `push` to main (ignoring `docs/**` and `.planning/**`), `schedule` `17 5 * * *`, `workflow_dispatch`; no `pull_request`; push runs `pnpm test:sweep --log-dir sweep-logs`, schedule and dispatch add `--with-today`; a failure uploads `sweep-logs` for 14 days.
- **deploy.yml:** keeps its name, `workflows: [CI]`, `branches: [main]`, `types: [completed]`, three-part `if` and `[self-hosted, hearth]`; adds `timeout-minutes: 60`, `fetch-depth: 0`, `persist-credentials: false`, and the `changes` step runs `scripts/deploy-gate.sh >> "$GITHUB_OUTPUT"`. A smoke test with a stub `docker` that fails wrote exactly `deploy=true`.

## Task Commits

W2 (`ci/enforce-gates`, local only):

1. **Task 1 (tracer)**: `bc856fd` ci: add a hygiene job that runs the repository gates
2. **Task 2**: `6dab328` test(web): raise the coverage thresholds to the measured values; `dc55e65` ci: enforce web coverage, db types drift and job timeouts
3. **Task 3**: `ccfb84a` ci: run the date and time-zone sweep on main and nightly; `a2bb317` ci: gate deploys on the running revision and keep no token

WB (pushed): `2787120`, `11d8998` and `56cfe00` each save the patches, the ledger lines and (first one) the facts tool; the plan's own closing commit is the fourth. `commits: 4` counts the first-parent WB commits from `plan_head_before` including that commit; `plan_head_after` is `56cfe00`, the head before it. W2's five commits are separate from this count.

## Deviations from Plan

None in the work. Notes:

- The plan expects the second `test-unit` log to show the `test` script of `@hearth/seed`; `@hearth/seed` has no `test` script, so the log shows `@hearth/service`, `@hearth/e2e`, `@hearth/matching`, `@hearth/recurrence` and `@hearth/shared`, and nothing from `@hearth/web`. The set is what `pnpm -r` runs today.
- The first coverage run (`06-06-web-coverage.log`) was the measurement at the old thresholds; the run after the edit is `06-06-web-coverage-after.log`, which is also copied as `06-06-unit-3.log` since it is the same command as the third `test-unit` step.
- Phase rule 5: the token has no `workflow` scope, so W2 was not pushed; `.planning/cleanup/patches/ci-enforce-gates/` holds the patches (`d0c587c..a2bb317`). No `apply.sh` yet (06-07 writes it).
- The Deploy workflow still waits on an unregistered `hearth` self-hosted runner. It was not touched.

## Known Stubs

None.

## Issues Encountered

- A `rm -f $P/*.patch` was refused by the safety check (variable expansion); a literal path was used instead.
- The web coverage runs exceed the tool's foreground limit and were polled in the background.

## User Setup Required

None yet. The owner pushes `ci/enforce-gates` (or applies the patches) in 06-07; Claude cannot.

## Next Phase Readiness

06-07 writes the docs for PR 2 in W2, runs the sixteen local gates and produces the `apply.sh` hand-off. Open points for it: the first red `hygiene` run is possible on the day an advisory appears (the audit reads today's database); the `sweep` nightly costs Actions minutes (flagged A2); the failure mail for the schedule goes to whoever last changes the cron line (A1).

## Self-Check: PASSED

- W2 commits `bc856fd`, `6dab328`, `dc55e65`, `ccfb84a`, `a2bb317` exist on `ci/enforce-gates`; W2 is clean; `types.ts` is unchanged.
- WB commits `2787120`, `11d8998`, `56cfe00` exist, are pushed, and `origin/claude/confident-dirac-10eu0a` equals HEAD before this summary's commit.
- The ledger has `pr2-base=`, `hygiene-emulated=6/6`, `ci-facts-jobs=`, `ci-facts-name=`, `coverage-measured=`, `coverage-thresholds=`, `coverage-negative=`, `test-unit-split=`, `db-types-*`, `deploy-wiring-smoke=`, `sweep-facts=` and `deploy-facts=`.
- Task 1, 2 and 3 verify commands exited 0 on this tree.
