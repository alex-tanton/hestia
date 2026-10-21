---
phase: quick-261020-v7v
plan: 01
subsystem: web
tags: [deals, offline-retry, tanstack-query, regression-test]
requires:
  - phase: 04-bug-fixes-with-regression-tests
    provides: FIX-01 held-id map (d4b01b2) and the WR-02 review finding
provides:
  - useAddDealToList holds retry ids per QueryClient and per signed-in user
  - two regression cases in deal-card.test.tsx (unmount, user switch)
affects: [apps/web deals, 04-UAT item 4, 04-REVIEW-DISPOSITION WR-02]
tech-stack:
  added: []
  patterns: [module-level WeakMap keyed by QueryClient, scoped by auth user id]
key-files:
  created: [.planning/cleanup/FIX-LEDGER-HELD-ID.md]
  modified:
    - apps/web/src/lib/api/deals.ts (branch fix/held-deal-id)
    - apps/web/src/screens/deals/deal-card.test.tsx (branch fix/held-deal-id)
    - .planning/phases/04-bug-fixes-with-regression-tests/04-UAT.md
    - .planning/phases/04-bug-fixes-with-regression-tests/04-REVIEW-DISPOSITION.md
key-decisions:
  - "Held ids are kept in a WeakMap<QueryClient, { userId, ids }>; another user's sign-in on the same page replaces the holder, because nothing in apps/web/src clears the QueryClient on sign-out"
  - "Only a success clears an id; no TTL, no pruning, no persistence (owner's rule)"
status: complete
actuals:
  tokens: 1800
  tasks: 3
  commits: 2
plan_head_before: 48c111f79ecde910636805976752c94b5f615802
plan_head_after: c69569a70c8d31c601961f6713abeaf949d03b50
completed: 2026-10-20
---

# Phase quick-261020-v7v Plan 01: WR-02 held deal-add id Summary

**A lost-response retry on a deal card now reuses the same item id after the card unmounts, held in a module-level WeakMap keyed by QueryClient and scoped to the signed-in user.**

The `actuals` block describes the code branch `fix/held-deal-id` (two commits from base `48c111f`, chars/4 over the 7105-byte diff). The `plan_head_*` values are that branch's base and tip. The session-branch docs commits are separate and not counted.

## Accomplishments

- Unmount regression case `sends the same item id after the card unmounts, so the deal lands once`: red on origin/main's hook (`Tests  1 failed | 17 passed (18)`, `expect(ids[1]).toBe(ids[0])`), green after the QueryClient-scoped holder (18 passed).
- User-switch guard `mints a fresh id when another user signs in on the same page`: red against the QueryClient-only holder (`1 failed | 18 passed (19)`, `expect(ids[1]).not.toBe(ids[0])`), green once the holder is also scoped by user (19 passed).
- Gates on the final head, all exit=0: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, web suite (57 files, 728 tests). Pre-commit hooks ran on both commits.
- Branch `fix/held-deal-id` pushed at `c69569a70c8d31c601961f6713abeaf949d03b50`. Its diff against origin/main names only `apps/web/src/lib/api/deals.ts` and `apps/web/src/screens/deals/deal-card.test.tsx`. No pull request was opened.

## Task Commits

1. Task 1 (tracer): `c57ba1ad712760f7314ae3dc1cca1517cadf2f7f` fix(web): keep a deal-add retry id across card unmounts
2. Task 2: `c69569a70c8d31c601961f6713abeaf949d03b50` fix(web): start held deal-add ids afresh for another user
3. Task 3: ledger, UAT note and review disposition on the session branch (`docs:` commit, see git log)

## Deviations from Plan

### Owner adjustments (applied as instructed, not plan deviations)

- UAT item 4 stays `result: [pending]` with a `note:` line (branch, SHA, owner decision 2026-10-20, awaiting the owner's PR and squash merge). Summary counts and `## Current Test` are unchanged. The plan's `pass` result and count changes, and the Task 3 verify clauses that check them, were not applied.
- The WR-02 row in `04-REVIEW-DISPOSITION.md` now reads `fixed on branch fix/held-deal-id (not merged)` with the pushed SHA.
- The commit trailers use `Co-Authored-By: Claude Sonnet 5.5` per the environment note, not the plan's Opus line.
- The executor also added a "Quick Tasks Completed" section to STATE.md, which had none.

None of the plan's code steps needed deviation.

## Findings carried to the owner

- Held ids never expire. After an add that landed but lost its response, a later deliberate re-add of the same deal to the same list reuses the id and is a no-op on the server while the toast says Added. The window lasts until a success, a reload, or another user's sign-in. This is by design under the owner's success-only rule (ledger finding c).
- A reload between failure and retry still mints a new id (memory only; persistence is the deferred offline-queue capability).
- WR-03 / RotationEditor was not touched.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, trust boundary or secret. The branch diff passed the secret-pattern scan.

## Self-Check: PASSED

- origin `fix/held-deal-id` equals the worktree HEAD `c69569a70c8d31c601961f6713abeaf949d03b50`.
- Both code commits are ancestors of that tip.
- The ledger file exists at `.planning/cleanup/FIX-LEDGER-HELD-ID.md`.
