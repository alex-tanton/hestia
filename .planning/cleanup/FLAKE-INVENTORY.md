# CI Flake Inventory

**Purpose:** Track, classify, and evidence all job and test failures across the repository's GitHub Actions CI and Sweep history (G-06-5, OD-5).  
**Sources:** Tool output from `.planning/cleanup/tools/ci-flake-inventory.mjs`, saved `playwright-report` artifacts under `.planning/cleanup/logs/06-11-artifacts/`, and repository ledgers (`CI-ENFORCEMENT-LEDGER.md`, `FIX-LEDGER*.md`).  
**Tool command:** `node .planning/cleanup/tools/ci-flake-inventory.mjs --repo alex-tanton/hearth --out .planning/cleanup/logs/06-11-tracer --artifacts .planning/cleanup/logs/06-11-artifacts`

## Classification rules

Failures in CI and Sweep history are classified using these ordered rules:

1. **`intentional`**: The ledger records the run as deliberate red regression or canary evidence (for example canary run 40023558441 in `CI-ENFORCEMENT-LEDGER.md`, FIX-07 run 39457296052 and FIX-02 run 39440151507 in `FIX-LEDGER*.md`).
2. **`infra`**: An infrastructure failure signature occurring within its expected step: setup steps (pnpm, node, or Supabase setup), image pre-pull steps (`ci-prepull-images` or `docker pull`), the `supabase start` step, or `pnpm test:e2e` when no Playwright test results were produced (stack never came up). The same string inside test output does not make the attempt infra.
3. **`real`**: Every attempt and run on that head SHA fails in the same way, explained by a code, dependency, or configuration state on that head (cited with the commit or PR that resolved it).
4. **`flaky`**: Either (a) a later attempt of the same run, or another run on the same head SHA, passed that job, or (b) the same test (spec file and title) is flaky by (a) on another head and the diff between the two heads does not touch its spec file.
5. **`unexplained`**: Any failure not matching the above, treated as a candidate for root-cause diagnosis in plan 06-14.

## Occurrences

| id | start UTC | New York | workflow and event | branch | head | run/attempt | job | signature | class | evidence | artifact |
|---|---|---|---|---|---|---|---|---|---|---|---|
| O-001 | 2026-10-23 20:12:03 | 2026-10-23 16:12:03 | ci.yml (pull_request) | ci/enforce-gates | 0061269c32e30c9f84eb3d80198577888dd31084 | 40017353021/1 | test-e2e | tests/17-accessibility-states.spec.ts:497:5 › accessibility states (light) › notification type: saving, then a failed save | flaky | attempt 3 green on head 0061269 | 40017353021-12530125369.zip |
| O-002 | 2026-10-23 20:23:38 | 2026-10-23 16:23:38 | ci.yml (pull_request) | ci/enforce-gates | 0061269c32e30c9f84eb3d80198577888dd31084 | 40017353021/2 | test-e2e | tests/19-notifications.spec.ts:140:3 › notifications — meal reminder with the push double (light) › enables a type, delivers its reminder once, and a tap opens its household | flaky | attempt 3 green on head 0061269 | 40017353021-12530670919.zip |

## Flaky tests

| id | spec and title | current location on `origin/main` | themes | occurrences | heads | first seen | last seen | New York times | co-failures | artifacts | root cause (06-14) | fix (06-15) | proof (06-16) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F-01 | accessibility states (light) › notification type: saving, then a failed save | tests/17-accessibility-states.spec.ts:497 | notifications, accessibility | 1 | 0061269 | 2026-10-23 | 2026-10-23 | 16:12:03 | none | 40017353021-12530125369.zip | pending 06-14 | pending 06-15 | pending 06-16 |

## Real and intentional failures

*(Populated in Task 2 over the full repository history)*

## Registry and infrastructure

Infrastructure failure signatures, mitigations in place, and proposed dispositions for the owner at 06-14's gate:

*(Populated in Task 2 over the full repository history)*

## Local repetition

*(Populated in Task 3 from repeated local runs of the unit, integration, and sweep suites)*

## Root causes

*(Populated in Plan 06-14)*

## Proof

*(Populated in Task 2 and Plan 06-16)*
