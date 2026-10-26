---
phase: 07-planning-cleanup-documentation-restructure
plan: 01
subsystem: planning
tags: [archive, git-mv, planning-cleanup, knip, jscpd]

requires:
  - phase: 06-ci-enforcement-and-lock-in
    provides: the v1.0 phase directories, cleanup ledgers and the repository gates this plan re-runs
provides:
  - ".planning/milestones/v1.0/{phases,cleanup,quick,ROADMAP.md,REQUIREMENTS.md} moved by one rename-only commit"
  - ".planning/phases/ holds only the active phase 07 directory"
  - ".planning/codebase/ deleted"
  - ".planning/milestones/v1.0/README.md archive index with raw-output classification and the owner review list"
affects: [07-02, 07-03, 07-04, 08-full-rebrand-to-hestia]

actuals:
  tokens: 3600
  tasks: 3
  commits: 4

plan_head_before: 44cb5660869ddc4276e670207107826c41a37ebd
plan_head_after: ee9fe79f8ae495289d24439d35e1baa62850ab26

tech-stack:
  added: []
  patterns:
    - "Archive by rename-only git mv so git log --follow keeps history; index file maps old paths to new"

key-files:
  created:
    - .planning/milestones/v1.0/README.md
  modified:
    - .planning/ROADMAP.md

key-decisions:
  - "Zero D-04 deletions: all 47 raw-output candidates are cited by a tracked planning file, and no patch passes the patch-id regenerability test in this clone"
  - "GSD block-start markers in .claude/CLAUDE.md that name a deleted map are left unchanged and listed for the owner"

requirements-completed: [CLEAN-01]

coverage:
  - id: D1
    description: "Every v1.0 artifact (280 files) is under .planning/milestones/v1.0/ through one rename-only commit; .planning/phases/ tracks only the 07 directory"
    requirement: CLEAN-01
    verification:
      - kind: other
        ref: "git diff-tree -r -M --raw a0bf27b: 280 entries, all R100 with equal modes and blob ids (Task 1 verify block)"
        status: pass
    human_judgment: false
  - id: D2
    description: ".planning/codebase/ deleted in its own commit and no active tracked file names a moved or deleted planning path (GSD markers exempt by name)"
    requirement: CLEAN-01
    verification:
      - kind: other
        ref: "Task 2 verify block (git grep scan, exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Archive index classifies every raw output (47 candidates, 47 kept, 0 deleted) and carries the owner review list"
    requirement: CLEAN-01
    verification:
      - kind: other
        ref: "Task 3 verify block: every candidate has a row, ledgers/tools/inventories intact, hygiene, knip, baseline, format:check, test:harness, docs-claims checked=1342 misses=0"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-25
status: complete
---

# Phase 7 Plan 01: Archive v1.0 planning artifacts Summary

**All v1.0 phases, ledgers and quick tasks now live under `.planning/milestones/v1.0/` via one rename-only commit (280 files, all R100), the stale `.planning/codebase/` maps are deleted, and an archive index classifies every raw output and lists the owner review items.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-25T15:09:23Z
- **Completed:** 2026-10-25T15:16Z
- **Tasks:** 3
- **Files modified:** 289 paths (280 renames, 7 deletions, the archive index, `.planning/ROADMAP.md`)

## Accomplishments

- Archived 280 tracked files in one rename-only commit: 181 under the six v1.0 phase directories, 93 under `cleanup/`, 4 under `quick/`, and the two flat milestone files. Every entry is `R100` with an unchanged mode; the four `100755` scripts stayed executable. `git log --follow` reaches the pre-archive commits (checked on `cleanup/TRIAGE.md`).
- Pointed `.planning/ROADMAP.md` line 5 at `milestones/v1.0/ROADMAP.md`.
- Deleted the seven `.planning/codebase/` maps in their own commit; readable at `git show f10ab38^:.planning/codebase/STACK.md`.
- Classified the raw outputs under the D-04 evidence rule: 47 candidates (23 knip outputs, 14 jscpd reports, 10 patches), 47 kept, 0 deleted. Every candidate is cited by a tracked planning file; the patches also fail the regenerable test (none of their `From` commits exist in this clone and none has a matching patch-id).
- Wrote `.planning/milestones/v1.0/README.md`: layout, old-to-new path map, one row per candidate, owner review list.

## Task Commits

1. **Task 1 (tracer): archive v1.0 phases, ledgers and quick tasks** - `a0bf27b` (chore), then the link fix `a063370` (docs)
2. **Task 2: delete the stale codebase maps** - `f10ab38` (chore)
3. **Task 3: index the archived v1.0 planning files** - `ee9fe79` (docs)

**Plan metadata:** committed after this file (docs: complete archive v1.0 planning plan).

Tracer gate: verify re-run end-to-end after Task 1 (automated-only, `end-of-phase` mode), passed, so expansion continued.

## Files Created/Modified

- `.planning/milestones/v1.0/{phases,cleanup,quick}/**`, `ROADMAP.md`, `REQUIREMENTS.md` - moved, not edited
- `.planning/milestones/v1.0/README.md` - archive index (new)
- `.planning/ROADMAP.md` - one link target changed
- `.planning/codebase/*.md` - deleted (7 files)

## Gate results

| Gate | Result |
| --- | --- |
| Archive commit | 280 entries, all `R100`, equal modes and blobs, destinations under `.planning/milestones/v1.0/` |
| `node scripts/check-repo-hygiene.mjs` | clean (1004 files, 14 scripts) |
| `eslint --max-warnings=0` on the archive | pass |
| `pnpm knip` and `check-knip-baseline.mjs` | pass |
| `pnpm format:check` | pass |
| `pnpm test:harness` | 393 tests, 393 pass |
| docs-claims (archived tool) | `checked=1342 misses=0` |
| Active-reference scan | only GSD's block-start marker `GSD:stack-start source:codebase/STACK.md` (line 22) remains, exempt by name |
| `.claude/CLAUDE.md`, `.gitignore`, `.planning/environment/`, `.planning/research/` | unchanged since `a21db47` |

## Decisions Made

- No D-04 deletion: the rule's evidence test kept all 47 candidates; zero deletions is a valid result and the commit was not padded.
- `.claude/CLAUDE.md` is untouched in this plan (plan 07-04 retargets its TESTING-map pointers).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Index claim corrected before commit**
- **Found during:** Task 3
- **Issue:** My first draft of the owner review text said the nine series patches "exist on `main` in rewritten form". Checking `git cat-file` and `git patch-id --stable` showed none of their `From` commits exist in this clone and none matches a commit's patch-id.
- **Fix:** Reworded the bullet to the verified fact and added "No patch met that test" to the rule paragraph.
- **Files modified:** `.planning/milestones/v1.0/README.md` (before it was first committed)
- **Committed in:** `ee9fe79`

**2. [Environment] Clean-tree check scoped around orchestrator files**
- **Issue:** The final gate asserts `git status --porcelain` is empty, but `.planning/STATE.md`, `.planning/state.json` (modified by the execute-phase start) and `.planning/milestone.lock` (untracked orchestrator lock) were already dirty before this plan began. I did not touch the lock; STATE.md and state.json are committed with the plan metadata. All other paths were clean after Task 3.

**Total deviations:** 1 auto-fixed (documentation accuracy), 1 environment note. **Impact:** none on scope.

## Issues Encountered

None. `pnpm install --frozen-lockfile` (environment repair for the missing `jscpd` binary) added only the lockfile-pinned `jscpd 5.4.1` and left `git status` unchanged.

## Owner review (verbatim from `.planning/milestones/v1.0/README.md`)

Nothing in `cleanup/` was deleted, so there is nothing to restore. These are the candidates kept because they are cited, grouped for a later owner decision. The ones listed first in each group are cited only by phase plans and summaries, not by a ledger, so they are the weakest to keep.

Knip outputs (regenerable with `pnpm knip`; 23 files):

- Cited only by phase plans and summaries: `knip/phase3-after-nonode-summary.txt`, `knip/phase3-before-default-summary.txt`, `knip/phase3-before-nonode-summary.txt`, `knip/phase3-before-production-summary.txt`, `knip/phase3-pr2-default-summary.txt`, `knip/phase3-pr2-nonode-summary.txt`, `knip/phase3-pr2-production-summary.txt`, `knip/phase3-after-production-summary.txt`.
- Cited by a ledger: the other 15 (`before-gap-fix-*`, `calibration-*`, `calibration-canary-*`, `default*`, `production*`, `phase3-after-default-summary.txt`).

jscpd reports (regenerable with `pnpm jscpd`; 14 files):

- Cited only by phase 2 plans: `jscpd/source/jscpd-report.json`, `jscpd/source-with-tests/jscpd-report.json`, `jscpd/whole-repo/jscpd-report.json`.
- Cited by a ledger: the eleven `jscpd/phase5-*/jscpd-report.json` files.

Patches (10 files):

- `ci-pull-supabase-from-ghcr.patch` is the only copy of commits 871ff4d and d25d8e6, which this repository does not contain (the owner applied it with `git am`, which rewrote them as a3f55d4 and ebb9ff6). Keep it.
- The nine `patches/*/000N-*.patch` files are cited by their series' hand-written `apply.sh` and by phase summaries. None of their `From` commits exist in this repository and none has a matching `git patch-id --stable` among its commits, so they also fail the regenerable test.

Notes for the owner:

- GSD tooling (`history-digest`, `/gsd-cleanup`, `complete-milestone`) looks for `milestones/v1.0-phases/` and `milestones/v1.0-ROADMAP.md`. With the `milestones/v1.0/{phases,cleanup,quick,ROADMAP.md,REQUIREMENTS.md}` layout, `history-digest` no longer lists the v1.0 phases. This was accepted with the layout and not worked around.
- `.gitignore` keeps the `.planning/cleanup/logs/` rule, and `.planning/environment/CLOUD-ENVIRONMENT.md` keeps its matching sentence, so raw logs that a clone holds at that old path stay ignored.
- The five v1.0 research files in `.planning/research/` (ARCHITECTURE, FEATURES, PITFALLS, STACK, SUMMARY) still cite pre-archive paths. They stayed in place with the v2.0 research and could move into this archive if you want.
- Do not regenerate `.claude/CLAUDE.md` with GSD (`generate-claude-md`) until `/gsd-map-codebase` has rebuilt the maps: with `.planning/codebase/` gone it would rebuild the stack block from the v1.0 tooling research.
- GSD block-start markers in `.claude/CLAUDE.md` whose source is a deleted map. GSD owns these markers; phase 7 leaves them unchanged and exempts them by name from its active-reference scan. The deferred `/gsd-map-codebase` run after Phase 8 gives their sources back.
  - line 22: `<!-- GSD:stack-start source:codebase/STACK.md -->` (`GSD:stack-start source:codebase/STACK.md`)
  - line 173: `<!-- GSD:conventions-start source:CONVENTIONS.md -->`
  - line 290: `<!-- GSD:architecture-start source:ARCHITECTURE.md -->`
  - The other markers (`project-start` line 1, `skills-start` line 521, `workflow-start` line 528) do not name a deleted map.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

Ready for 07-02 (docs rename and deployment merge). `.planning/phases/` holds only phase 07, so plans 02-04 work against live material only.

## Self-Check: PASSED

- `.planning/milestones/v1.0/README.md`, `.planning/milestones/v1.0/ROADMAP.md`, `.planning/milestones/v1.0/cleanup/REMOVAL-LEDGER.md` and `.planning/milestones/v1.0/phases/06-ci-enforcement-and-lock-in/06-CONTEXT.md` exist.
- Commits `a0bf27b`, `a063370`, `f10ab38`, `ee9fe79` are ancestors of HEAD.

---
*Phase: 07-planning-cleanup-documentation-restructure*
*Completed: 2026-10-25*
