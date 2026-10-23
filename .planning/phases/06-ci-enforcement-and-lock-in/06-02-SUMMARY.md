---
phase: 06-ci-enforcement-and-lock-in
plan: 02
subsystem: infra
tags: [pnpm-audit, jscpd, ci, allowlist, node-test, dependencies]

requires:
  - phase: 06-ci-enforcement-and-lock-in
    provides: ci/gate-scripts at e5895b2 with the knip, hygiene and migration gates, and the phase ledger (06-01)
provides:
  - scripts/audit-prod.mjs, a fail-closed pnpm audit --prod gate with an expiring allowlist, tested by scripts/audit-prod.test.mjs
  - scripts/audit-allowlist.json holding an empty allow array
  - jscpd 5.4.1 as an exact-pinned root devDependency, the jscpd script, .jscpd.json at a 2% threshold, and scripts/jscpd-config.test.mjs
  - deps/fix-prod-advisories, a separate branch that fixes the two production advisories the gate found
  - ci/gate-scripts pushed at 0c1fb89 (no pull request opened)
affects: [06-03, 06-04, 06-05, 06-06, 06-08]

actuals:
  tokens: 31000
  tasks: 3
  commits: 9

tech-stack:
  added: [jscpd 5.4.1]
  patterns:
    - "Audit decisions come only from the parsed pnpm report; an error key, a missing advisories object or non-JSON is exit 2 after three attempts"
    - "Allowlist entries expire (GHSA id, reason, at most 180 days) and an expired entry fails whether or not it still matches"
    - "Gate config tests derive each fixture config from the committed .jscpd.json so the committed threshold is what is exercised"

key-files:
  created:
    - scripts/audit-prod.mjs
    - scripts/audit-prod.test.mjs
    - scripts/audit-allowlist.json
    - .jscpd.json
    - scripts/jscpd-config.test.mjs
  modified:
    - package.json
    - pnpm-lock.yaml
    - knip.json
    - .planning/cleanup/CI-ENFORCEMENT-LEDGER.md

key-decisions:
  - "The two production advisories found by the live audit are fixed by upgrading on deps/fix-prod-advisories, not allowlisted (owner reply: bump deps first); the allowlist stays empty"
  - "ip-address is pinned by a root pnpm override because the newest @fastify/rate-limit (11.2.1) keeps the same ^10.2.0 range, and pnpm update re-resolved over 300 lockfile lines"
  - "jscpd stays at 5.4.1, approved by the owner on 2026-10-23, and never floats to 5.4.2"

patterns-established:
  - "audit-prod.mjs has no repository option: to audit another tree, feed it that tree's pnpm audit --prod --json output with --report"

requirements-completed: []

plan_head_before: e5895b2fd62069c06e28774e200a514119da4824
plan_head_after: 0c1fb89445bfeea72936d97af72721861e30112c

coverage:
  - id: D1
    description: "The audit gate fails closed on a registry outage, honors and expires allowances (braces advisory as the fixture), and the shipped allowlist is empty"
    requirement: CI-04
    verification:
      - kind: unit
        ref: "node --test scripts/audit-prod.test.mjs (30 tests, including two stub-pnpm cases: one call for a clean report, three calls and exit 2 for an error object)"
        status: pass
      - kind: other
        ref: "live: exit 1 on ci/gate-scripts (2 advisories); exit 0 on deps/fix-prod-advisories; temp allowlist with an expired braces entry exits 1 with 'allowance expired'"
        status: pass
    human_judgment: false
  - id: D2
    description: "The duplication gate at 2% with a deterministic test-inclusive figure of 1.11%, proven to fail above its limit"
    requirement: CI-02
    verification:
      - kind: unit
        ref: "node --test scripts/jscpd-config.test.mjs (5 tests: config values, duplicated fixture exits 1, clean fixture exits 0, no TypeScript file exits 1)"
        status: pass
      - kind: other
        ref: "pnpm jscpd exit 0 (66 clones, 858 lines, 1.11%); two runs identical in totals and sorted clone lists; pnpm exec jscpd --threshold 1 exit 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Whether the day-dependent audit gate (a new advisory turns CI red and holds back deploys) is the behavior the owner wants, and when to merge the fix branch"
    verification: []
    human_judgment: true
    rationale: "T-06-08 is accepted by design; the owner decides when deps/fix-prod-advisories merges and how the gate's failures are handled day to day"

duration: 55min
completed: 2026-10-23
status: complete
---

# Phase 6 Plan 02: Audit and duplication gates Summary

**A fail-closed `pnpm audit --prod` gate with an expiring allowlist (empty), jscpd 5.4.1 at a 2% limit with a measured 1.11%, and a separate fix branch for the two production advisories the new gate caught on its first live run.**

## Performance

- **Duration:** about 55 min, including two owner checkpoints
- **Completed:** 2026-10-23
- **Tasks:** 3 of 3 (Task 2 was the owner's legitimacy reply, `approve-jscpd-5.4.1`)
- **Files modified:** 9 on `ci/gate-scripts` (5 created, 4 modified, counting the ledger on WB)

## Accomplishments

- `scripts/audit-prod.mjs` runs `pnpm audit --prod --json` (up to three attempts, waits of 10 s and 30 s scaled by `AUDIT_RETRY_DELAY_SCALE`), ignores pnpm's exit status and decides from the parsed report. An `error` key, a missing `advisories` object or non-JSON ends in exit 2. An advisory fails unless `scripts/audit-allowlist.json` allows its GHSA id; allowances need a reason and at most 180 days, are valid through their `expires` day and fail once expired even when they match nothing.
- `scripts/audit-prod.test.mjs` passes 30 of 30, with the braces advisory as the fixture for the expiry boundary (same day passes, the day before fails) and two stub-`pnpm` cases.
- The first live run found two real production advisories published on 2026-10-22: `GHSA-389g-gv7q-r4x8` (fastify, low) and `GHSA-rxp7-6hxx-x8q5` (ip-address, moderate). Nothing was allowlisted. After the owner's reply, `deps/fix-prod-advisories` (`89d2aac`, from `origin/main` at `cb808e6`) pins `fastify` 5.12.6 and adds a root override `ip-address` 10.7.4; `pnpm audit --prod` there says "No known vulnerabilities found" and `audit-prod.mjs` exits 0 on its report. Lint, format, typecheck, `pnpm test` (service 757, web 728) and the service build pass there. The branch is pushed and no pull request was opened.
- `jscpd` 5.4.1 entered the tree only after the owner's reply recorded in the ledger (`jscpd-legitimacy=approve-jscpd-5.4.1 2026-10-23`). The lockfile gained only `jscpd` and its eight `jscpd-*` platform packages. `.jscpd.json` holds the Phase 2 parameters and `threshold` 2; `pnpm jscpd` exits 0 at 66 clones, 858 duplicated lines, 1.11% (tsx 1.87%, typescript 0.75%), identical on two runs. `pnpm exec jscpd --threshold 1` exits 1.
- `scripts/jscpd-config.test.mjs` passes 5 of 5 (a duplicated 40-line fixture exits 1, a clean fixture exits 0, a directory without TypeScript exits 1 under `--fail-on-empty`). `test:harness` passes 325 of 325 in W1; eslint, prettier, knip and the 28-row baseline check are clean.
- Braces (CI-04's wording): `braces` 3.0.3 is reachable only through `kysely-codegen`, a devDependency of `@hearth/service`, so `pnpm audit --prod` cannot report it. Today's full audit no longer lists `GHSA-vfj7-8cjw-p6xm` at all. The ledger records `ci04-braces-note=`, and GitHub's Dependabot alert 1 is still open with scope `runtime`.
- `ci/gate-scripts` is pushed at `0c1fb89445bfeea72936d97af72721861e30112c` after merging WB (D-02) and a clean secret scan; it touches nothing under `supabase/migrations/`, `apps/service/src/db/types.ts`, `.github/` or `docs/`.

## Task Commits

1. **Task 1: Audit gate** - `e66a70a` on `ci/gate-scripts` (ci); ledger `a2a91dd` on WB (docs).
2. **Task 2: jscpd legitimacy** - owner reply recorded in the ledger on WB `81fc1fc` before any `package.json` change.
3. **Task 3: Duplication gate** - `cb14138` on `ci/gate-scripts` (ci); ledger `ffa9fd1` and `05db875` on WB (docs).
4. **Deviation branch:** `89d2aac` on `deps/fix-prod-advisories` (build); ledger `56d3376` on WB.

`commits: 9` is measured on `ci/gate-scripts` (`e5895b2..0c1fb89`): the two plan commits, the merge of WB and the WB commits it brought in.

**Plan metadata:** the `docs: complete plan 06-02` commit on WB (this file, STATE.md, ROADMAP.md).

## Files Created/Modified

- `scripts/audit-prod.mjs`, `scripts/audit-prod.test.mjs`, `scripts/audit-allowlist.json` - the audit gate, its tests and the empty allowlist
- `.jscpd.json`, `scripts/jscpd-config.test.mjs` - duplication configuration and its test
- `package.json`, `pnpm-lock.yaml` - `jscpd` 5.4.1, the `jscpd` script, and the two new `test:harness` files
- `knip.json` - `scripts/audit-prod.mjs!` entry
- `.planning/cleanup/CI-ENFORCEMENT-LEDGER.md` - owner replies, audit and jscpd results

## Decisions Made

- Upgrade, do not allowlist, for the two advisories; the allowlist stays `{"allow": []}` (owner reply).
- A root override for `ip-address` is the smaller change (19 lockfile lines against over 300) because no newer `@fastify/rate-limit` moves the range.
- `audit-prod.mjs` got no repository flag; the fix branch is audited by passing its report with `--report`.

## Deviations from Plan

### Owner-approved exceptions

**1. [Owner decision] Dependency upgrade on its own branch (phase rule 3 exception)**
- **Found during:** Task 1 (live audit exited 1)
- **Issue:** the plan stops with a checkpoint:decision when the live audit does not exit 0; two new production advisories existed.
- **Fix:** owner replied "bump deps first"; `deps/fix-prod-advisories` carries the fastify pin and the ip-address override, nothing else.
- **Files modified:** `apps/service/package.json`, `package.json`, `pnpm-lock.yaml` (on that branch only)
- **Commit:** `89d2aac`

**2. [Plan step adapted] `audit-prod-live=clean` is evidenced on the fix branch**
- **Issue:** Task 1's verify wants `audit-prod-live=clean` on `ci/gate-scripts`, which stays red on `audit-prod.mjs` until `deps/fix-prod-advisories` merges into `main`.
- **Adaptation:** the ledger records `audit-prod-live=clean-on-fix-branch` and the first-run `2-advisories-exit1`; the Task 1 automated command, run literally, fails on that line by design.

**Total deviations:** 2, both owner-directed. **Impact:** `ci/gate-scripts` is red on the audit gate until the fix branch merges; PR 1 must not wire the gate (PR 2 does) before that.

## Issues Encountered

- `pnpm update` re-resolved hundreds of lockfile lines; solved by `pnpm install --no-frozen-lockfile` after editing the spec plus an override.
- The planned braces `path=` finding could not be read from today's audit output (the advisory is gone from it); the path comes from `pnpm -r why braces` and the research fixture.

## Known Stubs

None.

## Threat Flags

None. T-06-05 and T-06-SC: the owner approved jscpd before any install and the lockfile gained only `jscpd` keys. T-06-06: fail-closed behavior is proven by the stub tests. T-06-07: the allowlist is empty and every entry would need an expiry. T-06-08 (accepted): the gate immediately turned a new advisory into a finding.

## Next Phase Readiness

Ready for 06-03 on `ci/gate-scripts` (W1 at `0c1fb89`). Before PR 1 lands or PR 2 wires `hygiene`, the owner needs to merge `deps/fix-prod-advisories` into `main` (no pull request was opened for it), then WB syncs with `main` per rule 7. CI-02 and CI-04 stay open until PR 2's CI runs the gates (06-08).

## Self-Check: PASSED

- Files exist in W1 `/home/user/hearth-gate-scripts`: `scripts/audit-prod.mjs`, `scripts/audit-prod.test.mjs`, `scripts/audit-allowlist.json`, `.jscpd.json`, `scripts/jscpd-config.test.mjs`.
- Commits exist: `e66a70a`, `cb14138` (W1), `89d2aac` (`deps/fix-prod-advisories`), `a2a91dd`, `81fc1fc`, `56d3376`, `ffa9fd1`, `05db875` (WB).
- `origin/ci/gate-scripts` equals W1 HEAD (`0c1fb89`); `origin/deps/fix-prod-advisories` equals `89d2aac`; the token scan of `.planning` is clean.
