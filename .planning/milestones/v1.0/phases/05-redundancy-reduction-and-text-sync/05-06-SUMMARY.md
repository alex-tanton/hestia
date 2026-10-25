---
phase: 05-redundancy-reduction-and-text-sync
plan: 06
subsystem: tooling
tags: [citations, comments, typescript-compiler, codemod, ledger, pull-request]

requires:
  - phase: 05-redundancy-reduction-and-text-sync
    provides: "05-05: PR B squash commit a660d58 on main and the working branch synced past it (708c714)"
provides:
  - refactor/drop-spec-citations (PR C branch, not yet a pull request) at 7437ac5 with five proven comment-only batches
  - recorded recount of the retired-spec citations at PR C's base (1116 lines in 456 files outside .planning, docs and supabase/migrations)
  - citation-inventory.mjs (inventory, apply-pure, queue) and comment-only-check.mjs (compiler-print proof, --titles mode, directive guard) with six recorded negative controls
  - TEXT-SYNC-LEDGER.md, inventory-base.tsv (1116 rows) and five batch TSVs
affects: [05-07 apps/service batches, 05-09 apps/web batches, 05-10 non-TS files and titles, 05-11 PR C landing]

actuals:
  tokens: 29000
  tasks: 3
  commits: 3

# commits: measured on the working branch from plan_head_before (git rev-list --count 708c714..c8c5c52 is 3:
# d267d66, 036b7ad, c8c5c52). The five code commits live on refactor/drop-spec-citations in ../hearth-citations
# (4891a12, 2b8808c, 94af15d, 94756a9, 7437ac5) and are not on the working branch. The close-out commit
# `docs: complete plan 05-06` follows plan_head_after and adds this summary. tokens is chars/4 over the tools,
# the ledger and the code diff (the generated TSVs are not counted).
plan_head_before: 708c7149508a479718b105914032ce0844909a97
plan_head_after: c8c5c525084548470de277b89c020312d62bd56a

tech-stack:
  added: []
  patterns:
    - "A comment-only edit is proven by printing the before and after of every changed file through the TypeScript compiler with comments removed, with empty JSX comment containers and whitespace-only JSX text normalised away"
    - "A codemod removes only pointer-only parentheticals; every mixed and prose site goes through a reviewed queue and is rewritten by hand"
    - "Edited comment paragraphs are refilled to 100 columns so a removal leaves no ragged lines"

key-files:
  created:
    - .planning/cleanup/tools/citation-inventory.mjs
    - .planning/cleanup/tools/comment-only-check.mjs
    - .planning/cleanup/tools/comment-only-controls.sh
    - .planning/cleanup/TEXT-SYNC-LEDGER.md
    - .planning/cleanup/text-sync/inventory-base.tsv
    - .planning/cleanup/text-sync/batch-recurrence.tsv
    - .planning/cleanup/text-sync/batch-matching.tsv
    - .planning/cleanup/text-sync/batch-shared.tsv
    - .planning/cleanup/text-sync/batch-seed-ts.tsv
    - .planning/cleanup/text-sync/batch-e2e.tsv
  modified:
    - "72 files on refactor/drop-spec-citations: packages/recurrence (8), packages/matching (11), packages/shared (20), supabase/seed (2), e2e (31); comments only"

key-decisions:
  - "Dispositions are by line: removed means a pointer-only parenthetical was deleted, rewritten means a mixed or prose line was restated as plain words, left:title waits for 05-10"
  - "The seed-fixture source is written 'the seed data' in lower case, per the citation rules"
  - "Edited paragraphs are refilled to 100 columns instead of leaving short lines where a group was removed"

patterns-established:
  - "Ledger key lines count-lines, count-files, count-migrations, count-docs, count-titles, count-html-text, count-phase-mentions and control-N={expected} {actual} are the recorded evidence for RED-04"

requirements-completed: []

duration: about 30 minutes wall time (19:37 to 20:05 UTC)
completed: 2026-10-21
status: complete
---

# Phase 5 Plan 06: PR C start Summary

**The real citation population is on record (1,116 lines in 456 files, not the roadmap's 262), two proof tools are shown by six negative controls to catch code, string, directive and title edits, and `packages/*`, the seed TypeScript and the E2E TypeScript are clear of citations in five proven comment-only commits.**

## Performance

- **Duration:** about 30 minutes wall time
- **Completed:** 2026-10-21
- **Tasks:** 3 (one tracer, two auto)
- **Files modified:** 72 code files on `refactor/drop-spec-citations`; ten new files under `.planning/cleanup/` on the working branch

## Accomplishments

- **Sync (Task 1 step 1).** `git fetch origin && git merge --no-edit origin/main` on the working branch printed `Already up to date.`: `708c714` already held `a660d58`, and `git merge-base --is-ancestor a660d58 HEAD` succeeds. No second sync push was needed and no D-22 hand-off was written. `refactor/drop-spec-citations` was cut from `708c714` in `../hearth-citations` and installed.
- **Recount (D-21), recorded with commands in `TEXT-SYNC-LEDGER.md`.** `count-lines=1116`, `count-files=456`, `count-migrations=17` (8 files, untouched), `count-docs=0`, `count-titles=45`, `count-html-text=4`, `count-phase-mentions=27`. The inventory has exactly 1116 rows, one per matching line. By class: pure 592, mixed 239, prose 240, title 45. By area: `apps/web` 474, `apps/service` 340, `e2e` 115, `packages` 109, `supabase/seed` TS 8, root config TS 3, non-TS 63, `README.md` 3, `.claude/CLAUDE.md` 1.
- **Proof tools with negative controls (D-10).** `comment-only-check.mjs` compares the TypeScript compiler's comment-free print of each changed file, normalises empty JSX comment containers and whitespace-only JSX text, and fails on any removed directive line. Controls: `control-1=OK OK` (comment edit), `control-2=OK OK` (whole JSX comment container deleted), `control-3=FAIL FAIL` (code string changed), `control-4=FAIL FAIL` (eslint-disable line deleted), `control-5=OK OK` (`--titles` passes a title edit and fails once a code string also changes), `control-6=FAIL FAIL` (title edit without `--titles`). Both `.mjs` tools pass ESLint with `--max-warnings=0`.
- **Five batches on `refactor/drop-spec-citations`** (each: apply-pure, reviewed queue, hand edits, comment-only OK, ESLint and Prettier on changed files, workspace typecheck, workspace tests with an unchanged count, migrations identical to the phase base):

| Batch | Paths | Sites | Removed | Rewritten | Left (titles) | Commit | Tests before and after |
| ----- | ----- | ----- | ------- | --------- | ------------- | ------ | ---------------------- |
| recurrence | `packages/recurrence` | 15 | 2 | 13 | 0 | `4891a12` | 77 and 77 |
| matching | `packages/matching` | 26 | 6 | 14 | 6 | `2b8808c` | 156 and 156 |
| shared | `packages/shared` | 68 | 50 | 18 | 0 | `94af15d` | 172 and 172 |
| seed-ts | `supabase/seed/*.ts` | 8 | 5 | 3 | 0 | `94756a9` | no test script |
| e2e | `e2e/*.ts`, `tests`, `support`, `setup` | 115 | 72 | 42 | 1 | `7437ac5` | 15 and 15 (support tests) |

- **Result.** Over `packages` and `supabase/seed/*.ts` the inventory lists 6 rows and over the E2E TypeScript 1 row, all class `title`; `e2e/fixtures/**` and `e2e/docker-compose.e2e.yml` are unchanged; `supabase/migrations` equals the phase base. The three verify commands passed (`TASK1-VERIFY-PASS`, `TASK2-VERIFY-PASS`, `TASK3-VERIFY-PASS`).

## Task Commits

1. **Task 1: tools, recount, controls, recurrence** - `4891a12` (code, on C), `d267d66` (docs: record the citation recount and first batch, on the working branch)
2. **Task 2: matching, shared, seed-ts** - `2b8808c`, `94af15d`, `94756a9` (code, on C), `036b7ad` (docs: record the matching, shared and seed citation batches)
3. **Task 3: e2e** - `7437ac5` (code, on C), `c8c5c52` (docs: record the e2e citation batch and the corrected recount)

**Plan metadata:** the `docs: complete plan 05-06` commit that adds this summary and the state updates.

`refactor/drop-spec-citations` is pushed at `7437ac5`; the working branch `claude/eloquent-mayer-szjtjf` was pushed at `c8c5c52` before this summary. PR C is not opened: 05-11 lands it after the remaining batches.

## Decisions Made

- Dispositions are recorded per line in the batch TSVs. `removed` is a pointer-only parenthetical that was deleted, `rewritten` is a mixed or prose site restated so the rule survives as plain words, `left:title` waits for 05-10's separate title commit.
- Every quoted rule after a reference became plain words; a sentence whose subject was a retired document now states the rule itself; the seed-fixture source reads `the seed data`.
- The tool refills an edited paragraph to 100 columns, so some commits show whole-paragraph diffs. The comment-only proof is unaffected.
- Not classified by the codemod: nothing was left unclassified. The only things it could not decide alone were the mixed and prose sites, which is the reviewed queue by design. Three roots outside this plan's scope also match: `commitlint.config.js` (1 line), `eslint.config.js` (2 lines); they belong to a later plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrapped `Phase N` made a pointer-only parenthetical look mixed**
- **Found during:** Task 3 (the E2E recipe journey kept a group `apply-pure` had not removed)
- **Issue:** the pure test required `Phase 3` to be written with a literal space, but a group wrapped across comment lines holds `Phase` newline `3`.
- **Fix:** the test collapses whitespace first. `inventory-base.tsv` was regenerated from a detached worktree at `base=` (`../hearth-base-05-06`, removed afterwards); six rows moved from `mixed` to `pure` (pure 586 to 592, mixed 245 to 239), 1116 rows unchanged. The earlier batches' content was not affected because every leftover site had been edited by hand; their counts did not change.
- **Files modified:** `.planning/cleanup/tools/citation-inventory.mjs`, `.planning/cleanup/text-sync/inventory-base.tsv`
- **Commit:** `c8c5c52`

**2. [Rule 1 - Bug] The codemod left an orphan punctuation line and ragged paragraphs**
- **Found during:** Task 2 (`matcher.test.ts` gained a line reading `* . normalize.test.ts ...`; removals left short lines)
- **Fix:** punctuation after a group that opened its line moves to the previous line, a merged line that would exceed 100 columns keeps the original break, and an edited paragraph is refilled. The affected working-tree edits were reverted with `git checkout -- {specific files}` in the code worktree and regenerated before anything was committed.
- **Files modified:** `.planning/cleanup/tools/citation-inventory.mjs`
- **Commit:** `036b7ad`

### Other deviations

- The plan names the working branch `claude/vigilant-gates-a4ihid`; the real one is `claude/eloquent-mayer-szjtjf`, as 05-01 to 05-05 recorded.
- I added `.planning/cleanup/tools/comment-only-controls.sh`, which the plan did not list, so the six controls can be re-run from one command.
- The shared and seed-ts commits were amended once, before their first push, to correct the site counts in the body. No published commit was rewritten.
- The Husky pre-commit hook's lint-staged step reformatted the two new `.mjs` tools when they were committed; their behavior is unchanged and ESLint passes.
- Pushes needed no inline credential helper; plain `git push` was accepted, and the token scans of `.planning` printed nothing (tracked-pattern scan and token value scan both succeeded).
- The plan lists `e2e/global-setup.ts`, `e2e/global-teardown.ts` and `e2e/playwright.config.ts`; only `e2e/playwright.config.ts` carried citations.

**Total deviations:** 2 auto-fixed (both tool bugs), 0 architectural. **Impact on plan:** none; the outputs match the plan's acceptance criteria.

## Issues Encountered

None beyond the tool fixes above. No `workflow`-scope refusal, no registry flake, no gate failure.

## Known Stubs

None.

## Threat Flags

None. Comment text only; no endpoint, auth path, file access or schema change.

## Next Phase Readiness

- 05-07 (`apps/service`), 05-09 (`apps/web`) and 05-10 (non-TS files, the 45 title lines, 4 HTML-body lines, the two root config TS files) can run the same batch procedure with `citation-inventory.mjs` and `comment-only-check.mjs` from the primary checkout against `../hearth-citations`.
- `refactor/drop-spec-citations` still has to take `git merge --no-edit {WB}` before a later push (D-04); its diff against `origin/main` outside `.planning/` is the 72 code files above.

## Self-Check: PASSED

- Ledger key lines present: `base=`, `count-lines=1116`, `count-files=456`, `count-migrations=17`, `count-docs=0`, `count-titles=45`, `count-phase-mentions=27`, `control-1` to `control-6`, and a batch row for each of recurrence, matching, shared, seed-ts and e2e.
- Commits `4891a12`, `2b8808c`, `94af15d`, `94756a9`, `7437ac5` are on `origin/refactor/drop-spec-citations`; `d267d66`, `036b7ad`, `c8c5c52` are ancestors of the working branch and of its `origin` tip.
- `comment-only-check.mjs` over `packages`, `supabase/seed` and `e2e` from `base=` to HEAD printed `OK`; `supabase/migrations` is identical to the phase base.

---
*Phase: 05-redundancy-reduction-and-text-sync*
*Completed: 2026-10-21*
