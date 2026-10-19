---
phase: 03-evidence-gated-removal
plan: 03
subsystem: dead-exports-web
tags: [knip, dead-code, web, fixtures, pr-2]

requires:
  - phase: 03-evidence-gated-removal
    provides: "03-01 ledger, normalizer and throwaway knip config; 03-02 owner decisions A8=remove and OQ1=accept"
provides:
  - "Branch refactor/dead-exports (cut from origin/main 7d14b77), seven commits, pushed with no pull request"
  - "Ledger rows 2 to 14 (groups A, B, C, D, A8) with three proof results each"
affects: [03-04, 03-05, 03-07, 03-09]

tech-stack:
  added: []
  patterns: ["knip default plus --config $NONODE fixed-point loop after every removal commit"]

key-files:
  created: []
  modified:
    - apps/web/src/lib/offline/write-queue.ts
    - apps/web/src/components/chores/chore-copy.ts
    - apps/web/src/lib/api/deals.ts
    - apps/web/src/components/bills/bills-copy.ts
    - apps/web/src/test/meal-fixtures.ts
    - apps/web/src/test/chore-fixtures.ts
    - .planning/cleanup/REMOVAL-LEDGER.md

key-decisions:
  - "A8=remove honored: the three seed-anchor constants went and the chore-fixtures.ts comment was reworded in the same commit (D-16)"

requirements-completed: []

plan_head_before: 7d14b7775fa653e11ac85020564340ac5ba176cf
plan_head_after: 8ed4513de4cbaab8cbd6be7b6cb63b5bd539a260
commits: 7
actuals:
  tokens: 4000
  tasks: 3
  commits: 7

duration: 1h
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 03: Web slice of PR 2 (dead exports) Summary

**Thirteen web items are gone across seven commits on `refactor/dead-exports`, with knip at a fixed point under both the committed and the `node: false` configs and the web suite at 56 files and 715 tests after every commit.**

## Commits on refactor/dead-exports (base `7d14b77`)

| # | SHA | Subject | Items |
| --- | --- | --- | --- |
| 1 | `5f20a80c459085dd3424a3308b1c6856dfe047e6` | refactor(web): remove the unused listIdOfWrite helper | `listIdOfWrite` |
| 2 | `e5f78583796062ff8a29a35afa7485a2706ab2d3` | refactor(web): remove the unused ChoreLike type | `ChoreLike`, orphaned `ChoreDetail` import |
| 3 | `4584b8e203fb90cf7ebdc8ae2fa7a2473a0e3d6c` | refactor(web): remove the unused useFavoriteStores hook | `useFavoriteStores`, orphaned `favoriteStoreListSchema` and `FavoriteStore` imports |
| 4 | `e5b18aaf0517fb59c666467ab7344681999a100e` | refactor(web): fold BILLS_EMPTY_COPY into BILLS_LIST_EMPTY_COPY | `BILLS_EMPTY_COPY` (D-03) |
| 5 | `cb172d1b0f081fa26467aa72d7b34f677c7e9765` | test(web): remove three unused meal-plan week fixtures | `currentWeekFixture`, `previousWeekFixture`, `emptyWeekFixture` |
| 6 | `23c8ab2df0cdccea4ebdda98bdbfa83be90d09a7` | test(web): remove meal-plan entries orphaned by the week fixtures | `deletedRecipeEntry`, `wednesdayZitiEntry`, `wednesdaySaladEntry` |
| 7 | `8ed4513de4cbaab8cbd6be7b6cb63b5bd539a260` | test(web): remove seed-anchor constants orphaned in meal fixtures | `CURRENT_WEEK_SUNDAY`, `PREVIOUS_WEEK_SUNDAY`, `GREEK_SALAD_ID` |

Branch pushed at `8ed4513`; no pull request opened. The diff against `origin/main` is six `apps/web` files, no deletions of files, nothing under `.planning/` or `.claude/`, `packages/shared` and `BillsIndexScreen.tsx` unchanged, no secret-shaped added line, `commitlint --from origin/main` exit 0.

Working-branch ledger commits: `docs: record the listIdOfWrite removal`, `docs: record three Phase 3 web removals`, `docs: record the meal-fixture removals`.

## A8 outcome

`A8=remove`. The week constants, the seed-data block comment above them and `GREEK_SALAD_ID` were removed. The `GREEK_SALAD_ID` in `apps/web/src/screens/meals/planner.test.tsx` is a separate local constant (different value) and stays. `chore-fixtures.ts` now says `TODAY` is a Sunday without naming the removed constant.

## knip totals (normalized summaries)

| Config | Base | After plan 03-03 |
| --- | --- | --- |
| default (committed) | 54 | 50 |
| production | 79 | 75 |
| nonode (throwaway) | 57 | 50 |

Default and production each lost exactly `listIdOfWrite`, `ChoreLike`, `useFavoriteStores` and the `bills-copy.ts` duplicates line, and gained nothing. Nonode lost those four plus the nine meal-fixture names and gained nothing. The cascade followed the research prediction: removing the week fixtures exposed five lines, removing the entries exposed `GREEK_SALAD_ID`, and removing the anchors exposed nothing. Under the committed config the meal-fixture removals are invisible (D-08), as recorded in the ledger.

## Verification

After every commit: web `typecheck`, root `lint`, `format:check`, web test and web build all exit 0 (`.planning/cleanup/logs/03-03-t{1,2,3}-*.log`). Web test counts: 56 files, 715 tests, identical to the base run. No test was removed or skipped. Integration, E2E and Docker builds are CI evidence and wait for PR 2 (plan 03-07).

## Deviations from Plan

None - plan executed exactly as written. Husky pre-commit (lint-staged, typecheck) and commit-msg hooks ran on every commit without bypass.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- FOUND: all seven commit SHAs are ancestors of `refactor/dead-exports`, and `origin/refactor/dead-exports` equals the local tip `8ed4513`.
- FOUND: ledger rows 2 to 14 for all 13 removed names; text search exits 1 for every removed name except the unrelated local `GREEK_SALAD_ID`.
- No merge, no pull request, no push to `main`, no force-push.
