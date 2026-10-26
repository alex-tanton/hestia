---
phase: 05-redundancy-reduction-and-text-sync
plan: 12
subsystem: docs
tags: [docs, codebase-maps, claude-md, path-checker, ledger, conventions]
status: complete

requires:
  - phase: 05-redundancy-reduction-and-text-sync
    provides: "05-11: PR C squash-merged as 9fdc9c9; 05-08: docs fixes and the claims checker on docs/sync-specs"
provides:
  - "docs/sync-specs synced past PR C with the setup action and shared test helpers described; checker 591 tokens, 0 misses"
  - "Seven .planning/codebase maps regenerated from 283f15d (contains 9fdc9c9) with the D-11 Comments rule"
  - ".claude/CLAUDE.md regenerated from the maps; hand-maintained E2E section byte-identical"
  - "RED-04 restated with the recorded count (1,116 lines in 456 files) in ROADMAP.md and REQUIREMENTS.md"
affects: [05-13 PR D landing]

actuals:
  tokens: 70000
  tasks: 3
  commits: 7

# commits: measured on the working branch, git rev-list --count 30be5d3..HEAD --first-parent is 7 at ca15d89:
# 3a561ad (main sync), 283f15d, e486d7f (operator's map commit), b506589, 34a753c, 2a02f8a, ca15d89. The
# close-out commit `docs: complete plan 05-12` follows this file. Code-side commits live on docs/sync-specs:
# 5cfa35d (Task 1), eda7416, 29b9c6a and the WB merges. tokens is an estimate (chars/4 over the diff
# excluding the regenerated maps, which the operator's session produced).
plan_head_before: 30be5d3
plan_head_after: ca15d89

tech-stack:
  added: []
  patterns:
    - "Map claims checked with the docs checker and an allowlist row per unresolvable token, each with a reason"
    - "Regenerate project instructions with generate-claude-md, then prove the hand-maintained section byte-identical"

key-files:
  created: []
  modified:
    - .planning/codebase/CONVENTIONS.md
    - .claude/CLAUDE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/cleanup/DOCS-AUDIT-LEDGER.md
    - .planning/cleanup/tools/docs-claims-allow.tsv
    - docs/file-map.md (docs/sync-specs)
    - docker/docker-compose.yml (docs/sync-specs, comment only)

key-decisions:
  - "The mapper output was kept as produced apart from two sentences (D-11 Comments rule; eslint-disable reason count)"
  - "The compose comment cites the README heading Restore production, the one that covers a fresh Supabase Postgres container"
  - "Generated CLAUDE.md content is not hand-edited: the dropped Anti-Patterns and Component Responsibilities headings stay dropped and are reported"

patterns-established:
  - "A stale citation of a heading is fixed to a heading that exists and covers the case, and proven comment-only"

requirements-completed: []
---

# Phase 5 Plan 12: Maps, project instructions and PR D finish Summary

**The seven codebase maps and `.claude/CLAUDE.md` are regenerated from a tree that contains PR C and say "explain why; do not cite sections of retired spec documents", with `hearth-admin` a hand-written shell wrapper and four scheduled jobs; the docs checker reports zero misses over docs, README, maps and CLAUDE.md.**

## Performance

- **Completed:** 2026-10-22
- **Tasks:** 3 (Task 1 tracer in an earlier run, Task 2 the operator's `/gsd-map-codebase`, Task 3 here)

## Accomplishments

- Task 1 (earlier): WB and `docs/sync-specs` synced past `pr-c-merged=9fdc9c9`; file map and testing doc describe the setup action and the shared test helpers (`5cfa35d`).
- Task 2: maps committed by the operator as `e486d7f`; all seven carry `last_mapped_commit: 283f15dbb2b5ed8ded0ba14e04d5015e5d0d367c`, which contains `9fdc9c9`. Recorded as `maps-commit=` and `maps-mapped-at=` in the ledger.
- Task 3: D-11 Comments text in `CONVENTIONS.md` (first rule: "Explain why, not what. Do not cite sections of retired spec documents; state the rule itself.", the keep-citations bullet gone); `.claude/CLAUDE.md` regenerated (`b506589`) with the same text in its conventions block; RED-04 count restated (`34a753c`).
- Owner request: stale items fixed. Caddy tag `2.11.4` in the old CLAUDE.md is `2.11.7` after regeneration (docs and README never carried a Caddy tag); `docs/file-map.md` `jobs` row no longer claims meal plans are refreshed (`eda7416`); `docker/docker-compose.yml:275` now cites `(README, "Restore production")` (`29b9c6a`, comment-only, YAML deep-equal proof).
- Checks: the checker over maps and CLAUDE.md reports `checked=1762 misses=0` (138 raw map misses allowlisted with reasons, 80 allowlist rows added); over docs and README at D `checked=591 misses=0`; `git grep -nE -f cit-rx.txt -- .claude README.md docs` prints nothing at D; both hearth-admin wording searches print nothing.
- Pushes: WB at `ca15d89`; `docs/sync-specs` at `8bd18ab` (merge of WB into D after both D commits).

## CLAUDE.md diff summary

253 lines added, 289 removed. The hand-maintained `Running E2E in the Claude cloud sandbox` section is byte-identical (`cmp` of the saved before and after files), and the workflow, skills and profile blocks are unchanged. The `## Project` block still carries the six constraints; its Git line now reads as in `PROJECT.md` ("Phase 1, `origin/main` from d3da748"). The stack block follows the new `STACK.md` (Caddy `2.11.7`, `ci-prepull-images.sh`, `## Container Images`; the old `## Database` and `## CI/CD Toolchain` headings are gone). The conventions block carries the D-11 text and gains `## Patterns for New Code`. The architecture block describes `refresh-plan.ts` as a planner used by `refresh-deals.ts` (not scheduled), replaces `## Component Responsibilities` and `## Anti-Patterns` with `## Layering Deviations (observed)`, and adds `### Error Path` and `### Deals and Recipe Import Paths`. Full text in the ledger under `## Maps and project instructions`.

## Map claims corrected

- maps-1: `CONVENTIONS.md` said each of the five `eslint-disable-next-line` comments carries a `-- reason`; `apps/service/src/cli.test.ts:65` states its reason on the line above. Reworded in the map before CLAUDE.md was generated.
- The mappers' other flagged items held: the four scheduled jobs and the planner status of `refresh-plan.ts` (the stale part was `docs/file-map.md`, row 60, and the old CLAUDE.md), `functions.sql` counts (13 definitions, 14 `search_path` lines), the deals route as the only `withUserDb` importer, the shadowed `lists/deals` route. Package, image and tool versions all match (row 62).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `docs/file-map.md` `jobs` row listed meal plans as refreshed**
- **Found during:** owner request to verify the five-scheduled-jobs claim
- **Fix:** "refreshing deals and meal plans" became "refreshing deals"
- **Files modified:** `docs/file-map.md` (docs/sync-specs)
- **Commit:** eda7416

**2. [Rule 1 - Bug] `CONVENTIONS.md` overstated `-- reason` on every lint suppression**
- **Commit:** b506589

**3. [Owner request] compose comment cited a README heading that does not exist**
- **Fix:** `(README, "Restore production")`, proven comment-only; no other edit to the file
- **Commit:** 29b9c6a

The plan's commit subject for the maps was shortened to fit 71 characters; the allowlist rows went in their own commit (`2a02f8a`) so the D merge carried them.

## Known Stubs

None.

## Unresolved items for the owner

- The regenerated `.claude/CLAUDE.md` no longer has the old Anti-Patterns section (queries outside `withUserDb`, importing `privileged/` from routes, isolation only in application code, duplicated schemas, hand-edited generated types) or a Component Responsibilities table; the new `ARCHITECTURE.md` mapper output does not carry them. They are generated content and were left as produced.
- The Git line in the CLAUDE.md `## Project` block now carries "Phase 1, `origin/main` from d3da748" because `PROJECT.md` has it; the old CLAUDE.md copy omitted it.
- PR D is not opened (05-13).

## Threat Flags

None.

## Self-Check: PASSED

- Maps share one `last_mapped_commit` containing `9fdc9c9`; Task 3's verify command exited 0.
- Commits found on WB: b506589, 34a753c, 2a02f8a, ca15d89; on `docs/sync-specs`: eda7416, 29b9c6a, 8bd18ab.
