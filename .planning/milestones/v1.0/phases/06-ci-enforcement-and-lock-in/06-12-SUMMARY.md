---
phase: 06-ci-enforcement-and-lock-in
plan: 12
subsystem: infra
tags: [ci, deploy, deploy-gate, run-attempt, uat-gap-closure]

requires:
  - phase: 06-ci-enforcement-and-lock-in
    provides: Phase 6 base complete, UAT gap G-06-3 identified for deploy gate running commit
provides:
  - Gate skips deploying the running commit when HEARTH_DEPLOY_ATTEMPT is 1 or unset (OD-6)
  - Deliberate redeploy path: re-run the Deploy run itself (attempt 2+) redeploys the running commit (OD-7)
  - Re-run of CI push run on main starts a new Deploy run at attempt 1 and skips rebuilding
  - Older-commit and docs-only gate rules hold under any attempt; hostile attempt values exit 1 before docker inspection
  - Documentation updated across docs/deploy.md, docs/testing.md, CONTRIBUTING.md, README.md, .claude/CLAUDE.md, and codebase maps
  - 13 local gates passing with exit=0; branch pushed to origin/fix/deploy-gate-running-commit (commit a36fabadf7fad8ec41add4c679bc3884cf67efb7)
affects: [06-13]

actuals:
  tokens: 17000
  tasks: 3
  commits: 4 on W5, 4 on WB

tech-stack:
  added: []
  patterns:
    - "HEARTH_DEPLOY_ATTEMPT validation and attempt-gated redeploy path in scripts/deploy-gate.sh"
    - "TDD with tap reporter for harness unit tests in scripts/deploy-gate.test.mjs"

key-files:
  created: []
  modified:
    - scripts/deploy-gate.sh
    - scripts/deploy-gate.test.mjs
    - docs/deploy.md
    - docs/testing.md
    - CONTRIBUTING.md
    - README.md
    - .claude/CLAUDE.md
    - .planning/cleanup/CI-ENFORCEMENT-LEDGER.md
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/INTEGRATIONS.md

key-decisions:
  - "OD-6: The deploy gate skips deploying a commit equal to the running revision, superseding PC-5's re-run clause"
  - "OD-7: A deliberate redeploy works by re-running the Deploy run (attempt 2+); a CI re-run starts attempt 1 and is skipped"

requirements-completed: []

plan_head_before: e08f305
plan_head_after: 0ecbd90

coverage:
  - id: GATE-01
    description: "The deploy gate skips deploying the running commit at attempt 1 or unset"
    requirement: G-06-3
    verification:
      - kind: test
        ref: "scripts/deploy-gate.test.mjs (g063-red=fail 2 of 36, g063-green=pass 36 of 36)"
        status: pass
      - human_judgment: false
  - id: GATE-02
    description: "A re-run of the Deploy run itself (attempt 2+) redeploys the running commit; hostile attempts exit 1"
    requirement: G-06-3
    verification:
      - kind: test
        ref: "scripts/deploy-gate.test.mjs (g063-force=red 8 green 47 of 47)"
        status: pass
      - human_judgment: false
  - id: GATE-03
    description: "All documentation, codebase maps, and tests accurately describe the running commit and redeploy rules"
    requirement: G-06-3
    verification:
      - kind: document
        ref: "docs/deploy.md, CONTRIBUTING.md, README.md, docs/testing.md, .claude/CLAUDE.md, docs-claims-check checked=1032 misses=0"
        status: pass
      - human_judgment: false
  - id: GATE-04
    description: "Thirteen local repository gates pass cleanly on W5 and branch is pushed to origin"
    requirement: G-06-3
    verification:
      - kind: test
        ref: "g063-gates=frozen,lint,format-check,typecheck,test,shellcheck,knip,knip-baseline,jscpd,audit,hygiene,migrations,commitlint exit=0, pushed=a36fabadf7fad8ec41add4c679bc3884cf67efb7"
        status: pass
      - human_judgment: false
---

# Phase 6 Plan 12: Deploy Gate Running Commit Skip and Deliberate Redeploy Summary

**Implemented OD-6 and OD-7 in `scripts/deploy-gate.sh`: skipped deploying commits that are already running when triggered by new Deploy runs (attempt 1), enabled deliberate redeployment via re-running the Deploy run itself (attempt 2+), updated documentation and maps, verified all 13 local gates, and pushed `fix/deploy-gate-running-commit` to origin.**

## Performance

- **Tasks:** 3 (100% completed)
- **Commits:**
  - W5 (`fix/deploy-gate-running-commit`): 4 commits (`fdddef7`, `55db688`, `4e874d0`, `744f9cc`, `ea5a633`, plus merge from WB at `a36faba`)
  - WB (`claude/confident-dirac-10eu0a`): 4 commits (`319be6d`, `b76f242`, `8d3d022`, `0ecbd90`)
- **Gates:** 13/13 passed with `exit=0`

## Accomplishments

- **Task 1: Deploy Gate Skips Running Commit (OD-6)**
  - Recorded OD-6 in `.planning/cleanup/CI-ENFORCEMENT-LEDGER.md` superseding PC-5's re-run clause based on evidence that every completed attempt of a CI push run starts a new Deploy run.
  - Red commit on W5 (`fdddef7`): `test: expect the deploy gate to skip the running commit` (`# tests 36, # pass 34, # fail 2`).
  - Green commit on W5 (`55db688`): `fix: skip deploying the commit that is already running` (`# tests 36, # pass 36, # fail 0`).
  - ShellCheck and harness (382 tests) passed cleanly.
  - Recorded `g063-why=`, `g063-base=`, `g063-red=fail 2 of 36`, `g063-green=pass 36 of 36`.

- **Task 2: Deliberate Redeploy Path (OD-7, rerun-deploy)**
  - Recorded OD-7 quoting owner decision: re-run the Deploy run itself (attempt 2+) redeploys the running commit; a re-run of CI does not.
  - Gathered REST evidence: CI re-runs on `a5c4384` started Deploy runs 39719463322, 39720541360, 39721751275, each `run_attempt=1`.
  - Red commit on W5 (`4e874d0`): `test: cover a deliberate re-run of the Deploy run` (`# tests 47, # pass 39, # fail 8`).
  - Green commit on W5 (`744f9cc`): `fix: let a re-run of Deploy redeploy the running commit` (`# tests 47, # pass 47, # fail 0`).
  - Implemented strict input validation on `HEARTH_DEPLOY_ATTEMPT` (1-4 digits without leading zero; bad values exit 1 with empty stdout before docker inspection). Older-commit and docs-only rules hold under any attempt.
  - ShellCheck and harness (393 tests) passed cleanly.
  - Recorded `force-path=rerun-deploy`, `g063-attempt-evidence=`, `g063-force=red 8 green 47 of 47`.

- **Task 3: Documentation, Local Gates, and Branch Push**
  - Updated documentation files on W5: `docs/deploy.md`, `CONTRIBUTING.md`, `README.md`, `docs/testing.md`, `.claude/CLAUDE.md`, and test file describe titles.
  - Updated codebase maps on WB: `.planning/codebase/ARCHITECTURE.md` and `.planning/codebase/INTEGRATIONS.md`.
  - Audited for forbidden phrases (`running commit redeploys it`, etc.) and verified that all lines mentioning running with redeploy/rerun contain whitelist tokens (`already running`, `new Deploy run`, `re-run the Deploy run`, `attempt`, `older`).
  - Verified documentation claims using `docs-claims-check.mjs`: `checked=1032 misses=0` in `.planning/cleanup/logs/06-12-docs-claims.log`.
  - Generated full document diff log: `.planning/cleanup/logs/06-12-doc-diffs.log` (18.9 KB, 7 files).
  - Merged WB into W5 (`git merge --no-edit claude/confident-dirac-10eu0a`).
  - Ran all 13 local repository gates on W5 into `.planning/cleanup/logs/06-12-{name}.log`, all concluding `exit=0`:
    1. `frozen` (`pnpm install --frozen-lockfile`)
    2. `lint` (`pnpm lint`)
    3. `format-check` (`pnpm format:check`)
    4. `typecheck` (`pnpm typecheck`)
    5. `test` (`pnpm test`)
    6. `shellcheck` (`shellcheck scripts/deploy-gate.sh`)
    7. `knip` (`pnpm knip`)
    8. `knip-baseline` (`node scripts/check-knip-baseline.mjs`)
    9. `jscpd` (`pnpm jscpd`)
    10. `audit` (`node scripts/audit-prod.mjs`)
    11. `hygiene` (`node scripts/check-repo-hygiene.mjs`)
    12. `migrations` (`node scripts/check-migrations-append-only.mjs --base origin/main`)
    13. `commitlint` (`pnpm exec commitlint --from origin/main --to HEAD`)
  - Verified no forbidden paths touched against `origin/main` (`.github`, `supabase/migrations`, `apps/service/src/db/types.ts`).
  - Pushed W5 to `origin/fix/deploy-gate-running-commit` at `a36fabadf7fad8ec41add4c679bc3884cf67efb7`.
  - Recorded `g063-doc-review=done files=7`, `g063-docs-claims=checked=1032 misses=0`, `g063-gates=... exit=0`, and `g063-pushed=a36fabadf7fad8ec41add4c679bc3884cf67efb7`.
  - Passed the comprehensive automated verification suite.

## Next Steps

- Proceed to **Plan 06-13 (`06-13-PLAN.md`)**: Wire `HEARTH_DEPLOY_ATTEMPT: ${{ github.run_attempt }}` into `.github/workflows/deploy.yml` directly (utilizing available workflow scope permissions), open PR, monitor CI, and land G-06-3.
