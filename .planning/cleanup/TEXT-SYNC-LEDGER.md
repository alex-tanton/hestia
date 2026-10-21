# Text sync ledger (PR C: RED-04)

base=708c7149508a479718b105914032ce0844909a97
branch=refactor/drop-spec-citations
worktree=../hearth-citations

Working branch note: the plan names `claude/vigilant-gates-a4ihid`; the session's working branch is
`claude/eloquent-mayer-szjtjf` (see `CI-SETUP-LEDGER.md`, "Gates and decisions"). `base=` is the
working branch tip (`708c714`, the merge of `origin/main` at PR B's squash commit `a660d58`) from
which `refactor/drop-spec-citations` was cut. `git fetch origin && git merge --no-edit origin/main`
on the working branch printed `Already up to date.` at the start of 05-06, and
`git merge-base --is-ancestor a660d58 HEAD` succeeds, so no second sync push was needed and no
D-22 hand-off was written (`wb-sync-05-06` was not created).

Phase base for the migration check: `phase-base=` in `CI-SETUP-LEDGER.md`
(`c64d79e41ae7daab9ca48e3841a08db1446c64e5`).

## Counts

Recorded at `base=` in `../hearth-citations` (D-21). `CIT_RX` is the one-line regex in
`.planning/cleanup/tools/cit-rx.txt`.

```bash
T=.planning/cleanup/tools; C=../hearth-citations
git -C $C grep -nE -f "$PWD/$T/cit-rx.txt" -- . ':!.planning' ':!docs' ':!supabase/migrations' | wc -l   # count-lines
git -C $C grep -lE -f "$PWD/$T/cit-rx.txt" -- . ':!.planning' ':!docs' ':!supabase/migrations' | wc -l   # count-files
git -C $C grep -nE -f "$PWD/$T/cit-rx.txt" -- supabase/migrations | wc -l                                 # count-migrations
git -C $C grep -nE -f "$PWD/$T/cit-rx.txt" -- docs | wc -l                                                # count-docs
```

count-lines=1116
count-files=456
count-migrations=17
count-docs=0

The 17 migration lines sit in 8 files and stay untouched (D-01, D-09). For comparison: the roadmap's
"262" is a Phase 2 count under an older definition, and the research found 1,118 lines in 458 files
and 17 migration lines at `dbcbe1b`. The two-line, two-file drop since then comes from Phase 3 and 4
edits and the fixture work of PR B.

Inventory (`node $T/citation-inventory.mjs inventory --repo $C --out
.planning/cleanup/text-sync/inventory-base.tsv`): one row per matching line, so 1116 rows equal
`count-lines` exactly. A line with two sites is one row (the tool classifies the worst of its
matches); a parenthetical that wraps over several lines is one row per matching line with the group's
last line in `end_line`. No reconciliation was needed.

By kind: comment 1063, string 45, html-text 4, prose 4 (jsx-text 0, code 0).
By class: pure 586, mixed 245, prose 240 (232 comment, 4 html-text, 4 markdown), title 45.

By area (rows):

| area | rows |
| ---- | ---- |
| `apps/web` | 474 |
| `apps/service` | 340 |
| `e2e` (TypeScript) | 115 |
| `packages` | 109 |
| `supabase/seed` (TypeScript) | 8 |
| root config TypeScript/JS (`commitlint.config.js`, `eslint.config.js`) | 3 |
| non-TS (`.sh`, `.yml`, `.toml`, `.sql`, `.css`, `.html`, Dockerfiles, `.env.example`) | 63 |
| `README.md` | 3 |
| `.claude/CLAUDE.md` | 1 |

count-titles=45
count-html-text=4
count-phase-mentions=27

`count-titles` is 45 lines in 28 files; the research counted 46 string literals in 27 files (it
counted differently, for example two titles on one line). The 4 HTML rows are
`e2e/fixtures/recipes/full-json-ld-dark.html:34`, `full-json-ld-light.html:33` and `:34`, and
`no-json-ld.html:11` (05-10 owns them, D-20). `count-phase-mentions` is the number of lines under the
same pathspec that match `\bPhase [0-9]` and nothing in the vocabulary
(`git grep -nE '\bPhase [0-9]' -- . ':!.planning' ':!docs' ':!supabase/migrations' | grep -vE -f
$T/cit-rx.txt | wc -l`); they name product phases and are left alone (research A10).

## Tools and negative controls

Tools (committed on the working branch, run from the primary checkout):

- `.planning/cleanup/tools/citation-inventory.mjs`: `inventory`, `apply-pure`, `queue`. Kinds come from
  the TypeScript compiler's token trivia for script files and from syntax scans for the rest;
  `pure` means a parenthetical made only of retired document names, quoted section names,
  `Phase N`, numbers, `non-negotiable`, screen words and the separators `, ; > → — - / &`, or a
  capitalised section name after `›`.
- `.planning/cleanup/tools/comment-only-check.mjs`: prints each changed script file through
  `createPrinter({ removeComments: true })` before and after, drops empty JSX comment containers and
  whitespace-only JSX text (JSX whitespace rule), and fails on any removed directive line
  (`eslint-disable`, `@ts-`, `v8 ignore`, `c8 ignore`, `istanbul`, `prettier-ignore`, `<reference`,
  shebang, Dockerfile `# syntax=`). `--titles` also ignores the first argument of `describe`, `it`
  and `test` (directly, through `.skip`/`.only`/`.concurrent`, or through `.each(table)(...)`).
- `.planning/cleanup/tools/comment-only-controls.sh`: builds the scratch repository and runs the six
  controls; its output is `.planning/cleanup/logs/05-06-controls.log`.

Controls, in a scratch repository under `.planning/cleanup/logs/05-06-controls/` (expected, then
actual):

control-1=OK OK
control-2=OK OK
control-3=FAIL FAIL
control-4=FAIL FAIL
control-5=OK OK
control-6=FAIL FAIL

1. a comment text edited: OK. 2. a whole `{/* ... */}` JSX comment container deleted: OK. 3. a code
string changed (`'cheese'` to `'Xcheese'`): FAIL. 4. a line holding `eslint-disable-next-line`
deleted: FAIL (the message names the directive line). 5. `--titles` with a `describe` title edited:
OK (5a), and with a code string also changed: FAIL (5b); control 5 is OK when both hold. 6. the same
title edit without `--titles`: FAIL.

ESLint with `--max-warnings=0` passes on both `.mjs` tools.

## Batches

| batch | paths | sites | removed | rewritten | commit | comment-only | gates |
| ----- | ----- | ----- | ------- | --------- | ------ | ------------ | ----- |
| recurrence | `packages/recurrence` | 15 | 2 | 13 | 4891a12 | comment-only OK | gates OK |
| matching | `packages/matching` | 26 | 6 | 14 | 2b8808c | comment-only OK | gates OK |
| shared | `packages/shared` | 68 | 50 | 18 | 94af15d | comment-only OK | gates OK |
| seed-ts | `supabase/seed/*.ts` | 8 | 5 | 3 | 94756a9 | comment-only OK | gates OK |

Batch notes: `sites` counts matching lines of the base inventory; `removed` counts lines whose
parenthetical `apply-pure` deleted (class `pure`); `rewritten` counts the lines edited by hand;
`matching` also leaves 6 test titles (`describe` strings in `fixtures.test.ts` and `matcher.test.ts`)
with disposition `left:title` for 05-10. Gates per batch: ESLint `--max-warnings=0` and Prettier
`--check` on the changed files, the workspace typecheck, and the workspace tests with an unchanged
count (recurrence 77, matching 156, shared 172; `@hearth/seed` has no tests, so its gates are the
typecheck and ESLint). Each commit was re-checked with `comment-only-check.mjs --base HEAD~1 --head
HEAD`, and `git diff --exit-code {phase-base} -- supabase/migrations` is empty after every batch.
After the three batches `citation-inventory.mjs inventory` over `packages` and `supabase/seed/*.ts`
lists 6 rows, all class `title`.

## Titles

Not started (05-10).

## HTML fixtures

Not started (05-10).

## Non-TS proofs

Not started (05-10).

## Retained

Not started.

## CI

Not started.
