---
phase: 05-redundancy-reduction-and-text-sync
plan: 09
subsystem: web
tags: [citations, comments, typescript-compiler, jsx, ledger, apps-web]

requires:
  - phase: 05-redundancy-reduction-and-text-sync
    provides: "05-07: refactor/drop-spec-citations with apps/service cleared, and the citation-inventory and comment-only-check tools"
provides:
  - apps/web free of retired-spec citations in comments (211 files, three proven comment-only batches), 23 describe/it titles and the 2 index.css rows left for 05-10
  - TSVs batch-web-lib, batch-web-components, batch-web-screens and three ledger rows
  - recorded web unit baseline tests-before-c.web=728 and tests-after-c.web=728
affects: [05-10 non-TS files, index.css and titles, 05-11 PR C landing]

actuals:
  tokens: 70000
  tasks: 3
  commits: 3

# commits: measured on the working branch from plan_head_before (git rev-list --count 5d0cd57..e035af3 is 3:
# b9f159b, a142bdb, e035af3, the three ledger/TSV commits). The three code commits live on
# refactor/drop-spec-citations in ../hearth-citations (79255b5, 94fa9bd, 3ef8862) plus three merges of the
# working branch into it (0924abf, b9fc5e4, 343efc6), and are not on the working branch. The close-out commit
# `docs: complete plan 05-09` follows plan_head_after. tokens is chars/4 over the code diff (about 266k
# characters) plus the ledger rows and notes.
plan_head_before: 5d0cd5760e012a9f5728a9fae0007d705eac4423
plan_head_after: e035af3a0097604518fb04d41db16facf1fce945

tech-stack:
  added: []
  patterns:
    - "Each batch: apply-pure, then every queued mixed and prose site rewritten by exact-string or whole-line replacements (a scratchpad script, not committed), the queue re-run empty of non-title sites"
    - "A JSX comment keeps its why and loses only the attribution; no JSX comment container became empty in this plan"

key-files:
  created:
    - .planning/cleanup/text-sync/batch-web-lib.tsv
    - .planning/cleanup/text-sync/batch-web-components.tsv
    - .planning/cleanup/text-sync/batch-web-screens.tsv
  modified:
    - ".planning/cleanup/TEXT-SYNC-LEDGER.md (three batch rows, tests-before/after-c.web, notes)"
    - "211 files on refactor/drop-spec-citations under apps/web: comments only"

key-decisions:
  - "Dispositions stay per line: removed (pointer-only parenthetical deleted), rewritten (mixed or prose restated as plain words), left:title (waits for 05-10)"
  - "Seed-fixture sources read 'the seed data' or 'Seed data:' (capital D would still match the vocabulary)"
  - "Bare references to a retired document that the vocabulary does not catch (a lone 'Design', 'Branding' or 'Design's') were reworded in the same comment pass where they sat in the same comment or file batch"
  - "Quoted spec rules left behind by apply-pure were turned into plain words (for example the reconnect toast and the removed-member rule)"

patterns-established:
  - "Web batch rows in TEXT-SYNC-LEDGER.md: web-lib 144 sites, web-components 138, web-screens 192 (474 in all, equal to the base inventory's apps/web TypeScript rows)"

requirements-completed: []

duration: about 1 hour 20 minutes wall time
completed: 2026-10-22
status: complete
---

# Phase 5 Plan 09: PR C web Summary

**`apps/web` no longer cites the retired spec in any comment: 474 base-inventory sites over 211 files went through three proven comment-only batches (the compiler-print comparison prints `OK 211 files` from the PR C base to the tip), the web suite stays at 728 tests, the app-shell budget check passes at 198.0 KB, and only 23 test titles plus the 2 `index.css` lines are left for 05-10.**

## Performance

- **Duration:** about 1 hour 20 minutes wall time
- **Completed:** 2026-10-22
- **Tasks:** 3 (one tracer, two auto)
- **Files modified:** 211 code files on `refactor/drop-spec-citations`; three TSVs and the ledger on the working branch

## Accomplishments

- **Baseline.** `pnpm --filter @hearth/web test` at C's tip before any web edit: 57 files, 728 tests. Recorded as `tests-before-c.web=728`. Every batch and the end state report 728 (`tests-after-c.web=728`).
- **Three batches on `refactor/drop-spec-citations`** (each: apply-pure, reviewed queue, hand edits, queue re-run empty of non-title sites, comment-only OK on the working tree, ESLint `--max-warnings=0` and Prettier `--check`, web typecheck, web suite, migrations identical to the phase base, then commit and a second comment-only OK on the commit):

| Batch | Paths | Files changed | Sites | Removed | Rewritten | Left (titles) | Commit |
| ----- | ----- | ------------- | ----- | ------- | --------- | ------------- | ------ |
| web-lib | `lib`, `pillars`, `test` helpers, top-level source, `scripts/check-build.mjs`, `vite.config.ts` (non-test) | 57 | 144 | 67 | 77 | 0 | `79255b5` |
| web-components | `components` (source and tests) | 65 | 138 | 45 | 90 | 3 | `94fa9bd` |
| web-screens | `screens`, `lib/**/*.test.ts(x)`, top-level `*.test.ts(x)` | 92 | 192 | 71 | 101 | 20 | `3ef8862` |

  Totals: 474 sites (equal to the base inventory's `apps/web` TypeScript rows), 183 removed, 268 rewritten, 23 left as titles.
- **Whole-app proof (Task 3).** `comment-only-check.mjs --base 708c714 --head HEAD -- apps/web` printed `OK 211 files`. `citation-inventory.mjs inventory` over `apps/web` lists 25 rows: 23 `title` rows and the 2 `apps/web/src/index.css` rows (05-10). `index.css` is byte-identical to the base. `supabase/migrations` is identical to the phase base. No removed line held a directive.
- **Gates at the pushed tip.** Web typecheck, ESLint over `apps/web` with `--max-warnings=0` (jsx-a11y strict, react-hooks), Prettier on the changed files, web suite 728 passed, and `pnpm --filter @hearth/web build`, whose `check-build.mjs` printed `App shell 198.0 KB gzipped (budget 200 KB); magic link off, as built.` The checker parsed `check-build.mjs` as JS and it is part of the OK count.
- **Rules kept (T-05-22, T-05-23).** Rewritten sites state the rule without the attribution: the write queue is durable, bounded and shown once on failure; only list-item and chore/errand writes queue; server state is never copied into component state; weeks start on Sunday and meal-plan dates use the household timezone; money is integer cents; the accessibility reasons (never color alone, focus moves into what replaced a control, the non-gesture up/down alternative to drag, a live region must be in the tree before it speaks) stay in their comments. No JSX comment container became empty, so none was deleted, and the checker's JSX normalisation was never needed beyond comment text.
- **Pushes.** `refactor/drop-spec-citations` is pushed at `343efc6` (working branch merged in before each push, D-04); the working branch `claude/eloquent-mayer-szjtjf` was pushed at `e035af3` before this summary. The changed paths outside `.planning` were all under `apps/service`, `apps/web`, `packages`, `e2e` or `supabase/seed`, and the secret-pattern scan of the added lines printed nothing. PR C is not opened: 05-11 lands it.

## Task Commits

1. **Task 1: web-lib (tracer)** - `79255b5` (code, on C), `b9f159b` (docs: record the web-lib citation batch, on the working branch)
2. **Task 2: web-components** - `94fa9bd` (code, on C), `a142bdb` (docs: record the web-components citation batch)
3. **Task 3: web-screens** - `3ef8862` (code, on C), `e035af3` (docs: record the web-screens citation batch)

Merges of the working branch into C before each push: `0924abf`, `b9fc5e4`, `343efc6`.

**Plan metadata:** the `docs: complete plan 05-09` commit that adds this summary and the state updates.

## Decisions Made

- Dispositions are by line, as in 05-06 and 05-07. The TSVs come from the base inventory rows of the files each batch's pathspec covers (including title-only files).
- The `Seed Data` source became `the seed data's ...` in running text and `Seed data:` as a short lead-in; both avoid the capitalised vocabulary match.
- Where the spec was quoted after the reference (for example the reconnect toast, "a removed member loses access immediately", "No gamification in chores"), the quote became plain words with no attribution.
- A handful of references that the vocabulary does not match (`Design writes it`, `Design's invite states`, `Branding rules out`, `the Branding offline copy`, `the pattern Design's week planner reuses`, `Design keeps`) sat in comments this plan was already editing or in the same files; they were reworded as well, since they point at the same retired documents. Test titles that say `Design` (for example `'follows the Design timings'`, `'gives Design's sentence ...'`) are strings and wait for 05-10's title decision.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] apply-pure left broken grammar or indentation in three comments**
- **Found during:** Task 2 (diff review of the `apply-pure` output)
- **Issue:** `bills-copy.ts` read "never pays them / made honest and explicit" after a parenthetical was dropped; a JSX comment in `RecipeCard.tsx` had a refilled line at column 0; `hooks.ts` and `use-write-queue.ts` kept a bare spec quote with no attribution.
- **Fix:** rewritten by hand to complete sentences with the original indentation.
- **Files modified:** `bills-copy.ts`, `RecipeCard.tsx`, `lib/api/hooks.ts`, `lib/offline/use-write-queue.ts`
- **Commits:** `79255b5`, `94fa9bd`

### Other deviations

- The plan names the working branch `claude/vigilant-gates-a4ihid`; the real one is `claude/eloquent-mayer-szjtjf`, as the earlier plans recorded.
- The web-components commit message was amended once before its first push (the first body said 93 sites; the batch has 138 rows, 135 non-title). No published commit was rewritten.
- Tasks 1 and 2 verify commands re-run `comment-only-check.mjs --base HEAD~1 --head HEAD`; after a working-branch merge into C, HEAD is a merge commit and that form prints `OK 0 files`. The real per-commit proofs (`OK 57`, `OK 65`, `OK 92 files`) were taken on the batch commits before each merge, and the Task 3 whole-app proof covers all three from the PR C base.
- The edits were applied with a scratchpad script of exact-string and whole-line replacements (not committed); every replacement asserted a unique match.
- The plan's line "about 476 lines in about 220 files": the base inventory has 476 `apps/web` rows (474 TypeScript plus the 2 in `index.css`); the three batches changed 211 distinct files.

**Total deviations:** 1 auto-fixed (apply-pure artefacts), 0 architectural. **Impact on plan:** none; outputs match the plan's acceptance criteria.

## Issues Encountered

None beyond the above. The Husky pre-commit hook ran lint-staged and a full workspace typecheck on each commit and passed; no `workflow`-scope refusal, no registry flake, no gate failure. Web E2E runs in PR C's CI.

## Known Stubs

None.

## Threat Flags

None. Comment text only; no endpoint, auth path, file access or schema change. T-05-22 is mitigated by the compiler-print equality over all 211 files (JSX text and attributes included), the unchanged web suite count and the passing build; T-05-23 by the per-site rewrites that keep each accessibility rationale.

## Next Phase Readiness

- 05-10 (non-TS files, `apps/web/src/index.css`, the root configs, and the 45 test-title lines, of which 23 are in `apps/web` and 15 in `apps/service`) can run the same procedure against `../hearth-citations`.
- `refactor/drop-spec-citations` has the working branch merged as of `e035af3`; it still has to take a fresh `git merge --no-edit {WB}` before any later push (D-04).

## Self-Check: PASSED

- Ledger rows `| web-lib |`, `| web-components |`, `| web-screens |` and the keys `tests-before-c.web=728`, `tests-after-c.web=728` are present; the three TSVs are committed.
- Commits `79255b5`, `94fa9bd`, `3ef8862` are ancestors of `origin/refactor/drop-spec-citations` (`343efc6`); `b9f159b`, `a142bdb`, `e035af3` are ancestors of the working branch and its `origin` tip.
- Task 3's verify command printed `TASK3-VERIFY-PASS`; the tracked-pattern scan and the token value scan succeeded.

---
*Phase: 05-redundancy-reduction-and-text-sync*
*Completed: 2026-10-22*
