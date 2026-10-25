---
phase: 06-ci-enforcement-and-lock-in
plan: 09
subsystem: infra
tags: [ci, sweep, deploy-gate, docs, owner-gate, advisories]

requires:
  - phase: 06-ci-enforcement-and-lock-in
    provides: PR 2 (#36) squash-merged as 5643554 with the hygiene job, the Sweep workflow and the deploy gate wired in (06-08)
provides:
  - the Sweep workflow's first push run on main, 36 of 36 cells passed (TIME-06, OD-2)
  - CI keeps triggering Deploy under the new deploy.yml (a green main run reached a queued deploy job)
  - two dependency-advisory fixes merged by the owner so the date-dependent audit gate is green on main (zod #38, undici and fast-uri #43)
  - PR 3 (#42) open and green on all seven jobs with CONTRIBUTING.md and .claude/CLAUDE.md in line with the gates, the six codebase maps updated on WB
affects: [06-10]

actuals:
  tokens: 10000
  tasks: 3
  commits: 16

tech-stack:
  added: []
  patterns:
    - "A date-dependent audit gate turns main red without a code change; the remedy is a small exact-pin or major-scoped override PR"

key-files:
  created: []
  modified:
    - .planning/cleanup/CI-ENFORCEMENT-LEDGER.md
    - .planning/codebase/STACK.md
    - .planning/codebase/TESTING.md
    - .planning/codebase/CONCERNS.md
    - .planning/codebase/INTEGRATIONS.md
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/STRUCTURE.md

key-decisions:
  - "The audit gate went red on main after PR 2 (zod, then undici and fast-uri); the owner chose small dependency-fix PRs (#38, #43) over an allowlist entry, keeping OD-1's empty allowlist"
  - "undici and fast-uri are fixed with major-scoped pnpm.overrides (undici@7, fast-uri@4, fast-uri@3) because pnpm update re-resolved 441 unrelated lockfile lines"
  - "PR 3 was refreshed (merge of origin/main and WB into docs/ci-lock-in) and re-polled after the fixes; main's own last run stays red on a notification E2E spec, accepted by the owner without a rerun"

requirements-completed: [CI-01, CI-02, CI-03, CI-04, CI-05, CI-06, TIME-06]

plan_head_before: 6382daf67dfeea486512eb5c75da452be1ce7651
plan_head_after: 864573c3d8a071d064a4341e21bdc1305d75f09e

coverage:
  - id: D1
    description: "main's CI on the dependency fixes has the gates running; hygiene (all six steps) is green"
    requirement: CI-05
    verification:
      - kind: other
        ref: "CI run 40056322936 on 7d2b84e: lint, typecheck, test-unit, test-integration, build, hygiene success, test-e2e failure (17-accessibility-states.spec.ts:526 notification flake, DA-4); run 40039951246 on 5216fc7: all seven success"
        status: partial
    human_judgment: false
  - id: D2
    description: "Sweep's first push run passed the date and time-zone matrix on main"
    requirement: CI-06
    verification:
      - kind: other
        ref: "Sweep push runs 40024555056 (PR 2), 40039951259 and 40056322945: success, log 'sweep: 36/36 passed'"
        status: pass
    human_judgment: false
  - id: D3
    description: "CI still triggers Deploy and the guard accepts a green run"
    requirement: CI-05
    verification:
      - kind: other
        ref: "Deploy run 40041408163 (workflow_run) for 5216fc7: deploy job created and queued on labels self-hosted, hearth; the red-CI runs 40025921613 skipped and 40057102510 pending"
        status: partial
    human_judgment: true
  - id: D4
    description: "PR 3 carries the landing rules, CLAUDE.md and maps that match the gates; no stale claims; all seven jobs green"
    requirement: CI-07
    verification:
      - kind: other
        ref: "PR #42 head 8b47f6b tree 13a49d8; CI run 40058213754 all seven success; claims checked=2865 misses=0; stale-claim grep empty; pr3-files=.claude/CLAUDE.md CONTRIBUTING.md"
        status: pass
    human_judgment: false
---

# Phase 6 Plan 09: main after PR 2, Sweep, and PR 3 Summary

**Recorded what PR 2's merge did on main (a red audit twice, fixed by two owner-merged dependency PRs; Sweep 36 of 36), and opened PR 3 (#42) with the landing rules, CLAUDE.md and maps in line with the gates, green on all seven jobs and waiting for the owner's merge.**

## Performance

- **Duration:** wall clock about 6.5 hours (2026-10-23 21:12Z to 2026-10-24 03:50Z), dominated by CI waits and owner replies.
- **Tasks:** 3 (one tracer, one auto, one owner decision, resolved as `approve-pr3`).
- **Files:** the ledger and six codebase maps on WB; `CONTRIBUTING.md` and `.claude/CLAUDE.md` on `docs/ci-lock-in`; `package.json` and `pnpm-lock.yaml` on the two owner-merged fix branches.

## Accomplishments

- **main after PR 2.** CI run 40024555057 on the squash `5643554` had six green jobs and a red `hygiene`: `pnpm audit --prod` newly reported `GHSA-mrhx-c7xc-m3w5` (zod 4.6.5, high). The audit depends on the date, so main went red on an unchanged tree (research Pitfall 10). The Deploy run for it (40025921613) was skipped by the `conclusion == 'success'` guard, as designed.
- **Zod fix.** PR #38 (`deps/fix-zod-advisory`, one commit `b302bfc`) exact-pinned zod 4.6.6 in `apps/service`, `packages/shared` and `apps/web`; only zod and the `kysely-codegen` snapshot's zod reference moved in the lockfile. Seven green jobs on the first attempt; the owner merged it as `5216fc7`. main's run 40039951246 on it was green on all seven jobs.
- **Sweep.** The push runs on `5643554` (40024555056), `5216fc7` (40039951259) and `7d2b84e` (40056322945) all concluded `success` with `sweep: 36/36 passed` and no `sweep-logs` artifact (TIME-06 and OD-2: the matrix runs on main).
- **Deploy.** Under the new `deploy.yml`, the green run on `5216fc7` created `workflow_run` Deploy run 40041408163 whose `deploy` job is `queued` on `self-hosted, hearth` with no runner: the guard accepts, and the job waits for the unregistered runner. Not touched or cancelled.
- **Undici and fast-uri fix.** After PR 3 opened, its `hygiene` job was red on 11 newly published production advisories (undici 7.30.0, fast-uri 4.2.2 and 3.1.8). PR #43 (`deps/fix-undici-fast-uri-advisories`, `944552a`) adds major-scoped `pnpm.overrides` `undici@7: 7.30.1`, `fast-uri@4: 4.2.3`, `fast-uri@3: 3.1.9`; the lockfile moves only those three packages, `undici@8.11.2` is untouched. The owner merged it as `7d2b84e`; main's run 40056322936 has `hygiene` green.
- **PR 3 content.** `CONTRIBUTING.md` states the deploy gate's rule, a new "What CI checks" section (seven jobs, six hygiene checks, how to satisfy each, `db:types` drift, coverage thresholds, date-dependent audit, `Sweep`), the scripts rule and local check commands, and keeps "Not yet enforced". `.claude/CLAUDE.md` mirrors the gates (git constraint, knip, jscpd, `ci.yml`, `sweep.yml`, `deploy.yml`, script lists). The six maps on WB carry the same facts; CONCERNS also lost the report-only knip risk and the missing-audit gap and corrected a stale timeout and line number.
- **PR #42.** Opened after the owner's `approve-pr3`; refreshed with plain merges of `origin/main` (`7d2b84e`) and WB into `docs/ci-lock-in` (head `8b47f6b`, tree `13a49d8`); CI run 40058213754 passed all seven jobs on the first attempt. Outside `.planning/` it changes only `CONTRIBUTING.md` and `.claude/CLAUDE.md`.

## Task Commits

1. **Task 1 (tracer)**: WB `abf5258` (PR 2's main CI, Sweep, skipped Deploy), `68e7b25` (merge of `origin/main` into WB), `31eca1c` (green main after the zod fix, queued Deploy); `5f21d81` (zod PR record); fix branch `b302bfc` (merged as `5216fc7`)
2. **Task 2**: WB `eaa08f8` (maps), `afaf5c1` (testing-map wording), `b91901a` and `b67ba99` (ledger); `docs/ci-lock-in` `60f9a90` (CONTRIBUTING.md and CLAUDE.md), merges `205da97`, `2bca147`, `bd2ff8e`, `8b47f6b`
3. **Task 3**: WB `ba368b6` (gate), `7b4b470` (PR 3 opened, hygiene red), `65974ef`, `d81544d` (PR #43 and its CI), `eddfcac` (main after #43), `864573c` (PR 3 refreshed and green); fix branch `944552a` (merged as `7d2b84e`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two date-dependent audit failures held main and PR 3 red; fixed by owner-merged dependency PRs**
- **Found during:** Task 1 (zod, advisory `GHSA-mrhx-c7xc-m3w5`) and Task 3 (undici and fast-uri, 11 audit rows)
- **Issue:** `node scripts/audit-prod.mjs` failed in CI's `hygiene` job on advisories published after PR 2 was proven green. Task 1 requires the owner to decide the remedy for a red hygiene job on main.
- **Fix:** the owner chose small fix PRs and Claude opened them: #38 (exact-pin zod 4.6.6) and #43 (major-scoped overrides; `pnpm update` was tried and discarded, 441 unrelated lockfile lines). The owner merged both. Nothing was allowlisted, so OD-1's empty allowlist holds. Both are owner-approved exceptions to phase rule 3 (no dependency changes), each on its own branch, as for #32 in 06-02.
- **Files modified:** `apps/service/package.json`, `apps/web/package.json`, `packages/shared/package.json`, `package.json`, `pnpm-lock.yaml` (on the fix branches only)
- **Commits:** `b302bfc` (merged `5216fc7`), `944552a` (merged `7d2b84e`)
- **Correction recorded:** my first reading of the 11 rows ("two paths each") was wrong; `fast-uri` is reported at two versions, 4.2.2 and 3.1.8, and the third override covers 3.1.9. The ledger carries the correction.

**2. [Rule 3 - Blocking] WB sync needed `git checkout --ours` on four `.planning` conflicts**
- **Found during:** Task 1 step 4
- **Issue:** merging `origin/main` into WB conflicted in `ROADMAP.md`, `STATE.md`, `state.json` and the ledger. The auto-mode classifier first denied `git checkout --ours`; the merge was aborted (WB unchanged) and the owner then authorized exactly those four paths. The retry merged as `68e7b25` with no conflict outside `.planning`.
- **Files modified:** none beyond the sync

**3. [Plan text not met as written] `main-ci-after-pr2=` and `deploy-after-pr2=` stay red and skipped**
- Task 1's checks expect seven green jobs and a non-skipped Deploy on PR 2's own squash commit. That commit's run was red on `hygiene`, so the Deploy run was skipped. The green and accepted evidence is `main-ci-after-zod=` and `deploy-after-zod=` on `5216fc7`. main's latest run (`7d2b84e`, `main-ci-after-audit2=`) has `hygiene` green but `test-e2e` red (below), so main has not yet shown seven green jobs on the post-fix commit; the owner chose not to rerun it.

### Rule 9 decisions (not code deviations)

- Notification-area `test-e2e` failures, never a registry flake and out of scope under DA-4: `17-accessibility-states.spec.ts:497` and `19-notifications.spec.ts:140` on PR 2 (06-08); `19-notifications.spec.ts:140` on PR #43 attempt 1 (one owner-authorized rerun then passed, 104 of 104); and `17-accessibility-states.spec.ts:526` on main after PR #43 (`Expected: >= 0, Received: -1`; the owner chose not to rerun). That is four failed runs over three heads and three distinct specs.

## Known Stubs

None.

## Issues Encountered

- `test-e2e` on main (`7d2b84e`, run 40056322936) is red from the notification spec above; the owner accepted it without a rerun. A red `test-e2e` blocks the Deploy for that commit through the CI-success guard, and the Deploy run 40057102510 for it is `pending` behind the queued run 40041408163 in the `deploy` concurrency group.
- The Deploy workflow still waits on an unregistered `hearth` self-hosted runner; it was not touched.
- Dependabot PRs #39 (zod 4.6.7), #40 (serialize-javascript) and #41 (an `apps/service` group bump) are open and were not touched.
- `hearth-audit-fix`, `hearth-audit-fix2`, `hearth-zod-fix`, `hearth-enforce-gates`, `hearth-gate-scripts` and `hearth-ci-lock-in` worktrees are still present; none is removed here.

## User Setup Required

PR #42 awaits the owner's squash merge. The owner may cancel the queued Deploy runs 40041408163 and 40057102510 first for the cleanest CI-07 evidence (06-10 asks again). A rerun decision may be needed again if the merge's own CI run hits a notification spec flake.

## Next Phase Readiness

06-10 merges PR 3 (owner), records main's CI and the Deploy run on that non-exempt merge (the CI-07 proof), the nightly Sweep, and the requirement closure. `requirements-completed` here lists CI-01 to CI-06 and the push half of TIME-06; CI-07 and the nightly half of TIME-06 belong to 06-10.

## Self-Check: PASSED

- WB commits `abf5258`, `68e7b25`, `31eca1c`, `5f21d81`, `eaa08f8`, `afaf5c1`, `b91901a`, `b67ba99`, `ba368b6`, `7b4b470`, `65974ef`, `d81544d`, `eddfcac` and `864573c` are ancestors of HEAD; `docs/ci-lock-in` head `8b47f6b` equals `origin/docs/ci-lock-in`.
- The ledger has `zod-fix-merged=`, `main-ci-after-zod=`, `sweep-after-zod=`, `deploy-after-zod=`, `audit2-fix-merged=`, `main-ci-after-audit2=`, `gate-pr3=approve-pr3`, `pr3=42`, `pr3-head=`, `pr3-tree=`, `pr3-files=` and `pr3-ci=`.
- REST: PR #38 and #43 merged; PR #42 open with head `8b47f6b`; token pattern and value scans under `.planning` are clean.
