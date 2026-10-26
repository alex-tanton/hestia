---
phase: 03-evidence-gated-removal
plan: 05
subsystem: shared-contract-type-aliases
tags: [knip, dead-code, shared, zod, type-aliases, pr-2]

requires:
  - phase: 03-evidence-gated-removal
    provides: "03-04 refactor/dead-exports tip ff9de03 and ledger rows 1 to 44; owner decision A2=remove"
provides:
  - "Three alias commits on refactor/dead-exports (18 z.infer aliases removed, 0 added lines), pushed, no pull request"
  - "Ledger rows 45 to 62 (Group F4) with three proof results each, plus the PR 2 branch-wide test and build record"
  - "PR 2 content complete and green under the whole suite and the full build"
affects: [03-07, 03-09]

tech-stack:
  added: []
  patterns: ["type alias removed, zod schema kept exported", "knip default, nonode and production fixed-point comparison after every commit"]

key-files:
  created: []
  modified:
    - packages/shared/src/api/auth.ts
    - packages/shared/src/api/errands.ts
    - packages/shared/src/api/households.ts
    - packages/shared/src/api/lists.ts
    - packages/shared/src/api/matching.ts
    - packages/shared/src/api/meal-plan.ts
    - packages/shared/src/api/membership.ts
    - packages/shared/src/api/notifications.ts
    - packages/shared/src/api/recipes.ts
    - packages/shared/src/api/system.ts
    - packages/shared/src/api/users.ts
    - .planning/cleanup/REMOVAL-LEDGER.md

key-decisions:
  - "A2=remove honored: all 18 unused z.infer aliases are gone; every xSchema is still exported from the same module, so no runtime validation changed"

requirements-completed: []

plan_head_before: ff9de03606420d3b826aba4f037ea39292d18333
plan_head_after: a56608224a701d6123f21bab740f9b64c99879cf
commits: 3
actuals:
  tokens: 5000
  tasks: 3
  commits: 3

duration: 25min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 05: Shared contract aliases of PR 2 Summary

**Eighteen unused `z.infer` type aliases in `packages/shared/src/api/` are removed in three commits on `refactor/dead-exports` (0 added lines, every zod schema kept), knip loses exactly those 18 lines in all three configs and gains none, and the whole suite and full build are green at the PR 2 tip.**

## Commits on refactor/dead-exports (parent `ff9de03`)

| # | SHA | Subject | Aliases removed |
| --- | --- | --- | --- |
| 1 | `386da96` | refactor(shared): drop the unused SessionResponse alias | `SessionResponse` (tracer): 1 |
| 2 | `c6788d5` | refactor(shared): drop unused z.infer aliases (errands to meal-plan) | `ErrandStatus`, `JoinHouseholdRequest`, `ListsQuery`, `CreateListRequest`, `UpdateListRequest`, `MatchTargetKind`, `MatchDecision`, `MealPlanQuery`, `AddToListRequest`, `WeekAddToListRequest`: 10 |
| 3 | `a566082` | refactor(shared): drop unused z.infer aliases (membership to users) | `TransferAdminRequest`, `DeletePushSubscriptionRequest`, `RecipesQuery`, `ParseRecipeRequest`, `ClientErrorRequest`, `QuietHours`, `SetActiveHouseholdRequest`: 7 |

Full SHAs are in the ledger rows 45 to 62. The branch tip `a56608224a701d6123f21bab740f9b64c99879cf` is pushed (`ff9de03..386da96`, `386da96..c6788d5`, `c6788d5..a566082`, plain pushes). Working-branch docs commits: ledger rows after each task (`docs: record the SessionResponse removal`, `docs: record ten shared alias removals`, `docs: record the remaining shared alias decisions`) and the completion commit.

## Outcomes

- **A2:** `remove`. All 18 aliases were deleted, so nothing from this plan goes to the Kept section.
- **Schemas:** unchanged. The tracer commit's `auth.ts` still exports `sessionResponseSchema`; the group commits add 0 lines (`git show --numstat` sums to 0 added) and touch only the named alias lines. No barrel line changed (`packages/shared/src/index.ts` is an `export *` barrel).
- **Same-spelling hits (recorded in ledger rows 46, 50 and 51):** `ErrandStatus`, `MatchDecision` and `MatchTargetKind` are also declared independently in the generated `apps/service/src/db/types.ts` and, for the last two, in `packages/matching/src/matcher.ts`. None imports the shared alias, and `packages/shared` no longer names them.
- **Diff against `origin/main` for `packages/shared`:** exactly the 11 `api/*.ts` modules of this plan.

## Proof

For each alias: (1) `knip --trace-file packages/shared/src/api/{module}.ts --trace-export {Name}` printed `(no imports found)` for all 18 (`$L/03-05-trace-{SessionResponse,t2,t3}.log`). (2) `git grep -n -I -w -F -e {Name}` outside the lockfile, `.planning` and `.claude` hit only the removed declaration, plus the three same-spelling cases above (`$L/03-05-text-t2.log`, `$L/03-05-text-t3.log`). (3) After each commit: typecheck of all workspaces, root lint, format:check and the shared suite exit 0, shared counts equal to the before log (12 files, 148 tests).

## Branch-wide run at the PR 2 tip

| Check | Result |
| --- | --- |
| `pnpm test` | exit 0; matching 156, shared 148, recurrence 77, service 725, web 715 tests, identical to the earlier runs (`$L/03-05-branch-test.log`) |
| `pnpm build` | exit 0; service bundle, OpenAPI write and web build; App shell 198.0 KB gzipped against the 200 KB budget (`$L/03-05-branch-build.log`) |

## knip totals (normalized summaries)

| Config | Before this plan | After SessionResponse | After errands to meal-plan | After membership to users |
| --- | --- | --- | --- | --- |
| default | 20 | 19 | 9 | 2 |
| nonode | 20 | 19 | 9 | 2 |
| production | 45 | not run | not run | 27 |

Each step removed exactly its `types` lines and added none (verify commands compare sorted summaries with `comm`). The two default lines left are `tailwindcss` (apps/web, D-04 keep) and seed `tsx` (PR 1 removes it). The production total of 27 compares to the 03-04 production summary with exactly the 18 `types` lines gone; production was measured once at the tip, as the plan lists default and nonode only. Summaries: `$L/03-05-{base,t1,t2,t3}-{default,nonode}-summary.txt`, `$L/03-05-t3-production-summary.txt`.

## Deviations from Plan

None. The plan executed as written. Environment notes: `../hearth-exports` has no `scripts/knip-summary.mjs` (it lives on the unmerged `build/unused-deps` branch), so the normalizer came from `../hearth-deps/scripts/knip-summary.mjs`, whose sha256 matches `74b6e969...cb12` (rule 6). The ledger note on the branch-wide run sits under the Removals table.

## Known Stubs

None. Nothing was added; only type alias lines were removed.

## Threat Flags

None. No new endpoint, auth path or file access. T-03-15 and T-03-16 mitigations held: schemas untouched, `A2=remove` read from the ledger before each task. `supabase/migrations/**`, `apps/service/src/db/types.ts`, `apps/service/src/privileged/**`, `eslint.config.js`, `knip.json`, `.github/**` and `docker/**` show an empty diff against `origin/main` on the branch, nothing under `.planning` or `.claude`, and no added line matched the secret pattern.

## Not done here

Integration, E2E and Docker evidence comes from PR 2's CI (plan 03-07). No pull request was opened; PR 1 (#12) is still open and unmerged.

## Self-Check: PASSED

- Files exist: the 11 `packages/shared/src/api/*.ts` modules in `../hearth-exports`, this summary, the ledger.
- Commits `386da96`, `c6788d5`, `a566082` are ancestors of the worktree HEAD, and `git ls-remote origin refactor/dead-exports` equals `a56608224a701d6123f21bab740f9b64c99879cf`.
- All three task verify commands printed OK.
