---
phase: 03-evidence-gated-removal
plan: 04
subsystem: dead-exports-barrels
tags: [knip, dead-code, barrels, service, matching, recurrence, pr-2]

requires:
  - phase: 03-evidence-gated-removal
    provides: "03-03 refactor/dead-exports tip 8ed4513 and ledger rows 1 to 14; owner decision A1=remove"
provides:
  - "Three barrel commits on refactor/dead-exports (jobs, matching, recurrence), pushed, no pull request"
  - "Ledger rows 15 to 44 (groups E, F1, F2, F3) with three proof results each"
affects: [03-05, 03-07, 03-09]

tech-stack:
  added: []
  patterns: ["barrel entry is the item; the symbol stays in its defining module", "knip default, nonode and production fixed-point comparison after every commit"]

key-files:
  created: []
  modified:
    - apps/service/src/jobs/index.ts
    - packages/matching/src/index.ts
    - packages/recurrence/src/index.ts
    - .planning/cleanup/REMOVAL-LEDGER.md

key-decisions:
  - "A1=remove honored: pruneCutoffs left the jobs barrel; prune-cache.test.ts imports it from prune-cache.ts directly, so the symbol and its tests are untouched"

requirements-completed: []

plan_head_before: 8ed4513de4cbaab8cbd6be7b6cb63b5bd539a260
plan_head_after: ff9de03606420d3b826aba4f037ea39292d18333
commits: 3
actuals:
  tokens: 7300
  tasks: 2
  commits: 3

duration: 30min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 04: Barrels of PR 2 (jobs, matching, recurrence) Summary

**Thirty barrel entries are gone in three commits on `refactor/dead-exports`, with only the three barrel files changed, knip losing exactly those lines in all three configs and gaining none, and every suite count unchanged.**

## Commits on refactor/dead-exports (parent `8ed4513`)

| # | SHA | Subject | Entries removed |
| --- | --- | --- | --- |
| 1 | `48e1413` | refactor(service): drop unused re-exports from the jobs barrel | 12 types (`LockOutcome`, `DispatchOutbox`, `DispatchOutcome`, `PushTransport`, `AutopayBillRow`, `LogAutopayOutcome`, `PruneOutcome`, `RefreshDeps`, `RefreshOutcome`, `JobName`, `JobDatabase`, `JobLogger`) and `pruneCutoffs` (A1=remove): 13 |
| 2 | `ff61301` | refactor(matching): drop unused re-exports from the barrel | `normalizeTokens`, `tokenize`, `stripPunctuation`, `singularize`, `BRANDS`, `DESCRIPTORS`, `UNITS`, `FUZZY_THRESHOLD`, `tokenSimilarity`, `tokensFuzzyMatch`, `MatchDecision`, `MatchResult`, `MatchTargetKind`: 13 |
| 3 | `ff9de03` | refactor(recurrence): drop unused re-exports from the barrel | `currentTurnIndex`, `BillOccurrenceState`, `ChoreOccurrenceState`, `RebasedRotation`: 4 |

Full SHAs are in the ledger rows. The branch tip `ff9de03606420d3b826aba4f037ea39292d18333` is pushed (`8ed4513..48e1413`, then `48e1413..ff9de03`, plain pushes). Working-branch docs commits: `c322d27` (jobs ledger rows), `af777d9` (package ledger rows), and the completion commit.

## Outcomes

- **A1:** `remove`. `pruneCutoffs` is no longer re-exported by the jobs barrel. The 15 runtime names `jobs/index.test.ts` asserts and `type Scheduler` (used by `main.ts`) remain.
- **Kept names:** matching barrel is `normalize`, `matchIngredient`, `MatchCandidate`, `MatchOverride`. Recurrence barrel keeps `currentChoreOccurrence` and `rebaseRotationOnDeparture` (used by `index.test.ts`).
- **Defining modules:** unchanged. `git diff --name-only 8ed4513 ff9de03` lists exactly the three barrel files.
- **Test-only cascade lines:** none. No knip run added a line in default, nonode or production, so nothing new goes to Kept.

## Proof

For each entry: (1) `knip --trace-file {barrel} --trace-export {name}` printed `(no imports found)` with no `:import[` line (13, 13 and 4 entries; `$L/03-04-trace-{jobs,matching,recurrence}.log`). (2) The only importers of the jobs barrel are `main.ts` and `jobs/index.test.ts`, and neither names a removed entry; the other hits are the defining modules and direct relative imports (`$L/03-04-text-jobs.log`). No file imports a removed name from `@hearth/matching`; outside the package the only hits are the known same-spelling ones (`UNITS` in `ItemSheet.tsx`, `MatchDecision` and `MatchTargetKind` in `db/types.ts` and `shared/api/matching.ts`, `BRANDS` in a Flipp fixture). Nothing outside `packages/recurrence` names the four recurrence entries, and `index.test.ts` names none. A `docs/architecture.md` hit for `DispatchOutbox` still names a live type, so it needed no rewording. (3) Gates, all `exit=0`:

| Commit | Gates | Counts |
| --- | --- | --- |
| jobs | service typecheck (with seed), lint, format:check, service test, service build | service 55 files, 725 tests, same as before |
| matching | typecheck of all workspaces, lint, format:check, matching test | matching 156 tests |
| recurrence | typecheck of all workspaces, lint, format:check, recurrence test, web build | recurrence 77 tests |
| all three | `pnpm test` before and after | 133 files and 1821 tests (matching 156, shared 148, recurrence 77, service 725, web 715), identical |

## knip totals (normalized summaries)

| Config | Before this plan | After jobs | After matching and recurrence |
| --- | --- | --- | --- |
| default | 50 | 37 | 20 |
| nonode | 50 | 37 | 20 |
| production | 75 | 62 | 45 |

The default summary equals the 03-03 final summary byte for byte before the first commit (`cmp`). Each step removed exactly its barrel lines and added none. Summaries: `$L/03-04-{base,t1,t2}-{default,nonode,production}-summary.txt`.

## Deviations from Plan

None. The plan executed as written. One environment note: `../hearth-exports` has no `scripts/knip-summary.mjs` (it lives on the unmerged `build/unused-deps` branch), so the normalizer came from `../hearth-deps/scripts/knip-summary.mjs`, whose sha256 matches `74b6e969...cb12`, per rule 6.

## Known Stubs

None. Nothing was added; only re-export lines were removed.

## Threat Flags

None. No new endpoint, auth path or file access. `apps/service/src/privileged/**`, `eslint.config.js` and `supabase/migrations/**` are untouched (empty diff stat against `origin/main`); added lines match no secret pattern.

## Not done here

Integration, E2E and Docker evidence for these barrel edits comes from PR 2's CI (plan 03-07). No pull request was opened; PR 1 (#12) is still open and unmerged.

## Self-Check: PASSED

- Files exist: the three barrel files in `../hearth-exports`, this summary, the ledger.
- Commits `48e1413`, `ff61301`, `ff9de03` are ancestors of the worktree HEAD, and `git ls-remote origin refactor/dead-exports` equals `ff9de03606420d3b826aba4f037ea39292d18333`.
- Both task verify commands printed OK.
