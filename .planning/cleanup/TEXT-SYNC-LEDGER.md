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

Correction recorded during the e2e batch: the first inventory run classified a parenthetical that
wraps in the middle of `Phase N` (the logical text holds `Phase` newline `3`) as `mixed`. The pure
test now collapses whitespace first, `inventory-base.tsv` was regenerated from a detached worktree
at `base=` (`../hearth-base-05-06`), and six rows moved from `mixed` to `pure` (one in each of
`meal-plan.integration.test.ts`, `notification-producers.integration.test.ts`,
`recipes.integration.test.ts`, `chore-errand-writes.ts`, and two in the e2e recipe journey). Row
count and the other columns are unchanged: 1116 rows, `pure` 592, `mixed` 239. The batch TSVs were
regenerated from the corrected inventory; the recurrence, matching, shared and seed-ts counts did
not change.
By class: pure 592, mixed 239, prose 240 (232 comment, 4 html-text, 4 markdown), title 45.

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
| e2e | `e2e/*.ts`, `e2e/tests`, `e2e/support`, `e2e/setup` | 115 | 72 | 42 | 7437ac5 | comment-only OK | gates OK |
| service-http | `apps/service` routes, http, auth, db, gotrue, push, privileged, test helpers, top-level source, scripts, `vitest.coverage.config.ts` | 50 | 41 | 9 | 4b73f76 | comment-only OK | gates OK |
| service-domain | `apps/service/src` services, chores, deals, jobs, notifications, recipes (non-test) | 184 | 134 | 50 | d210844 | comment-only OK | gates OK |
| service-tests | `apps/service/src/**/*.test.ts` (unit and integration) | 106 | 53 | 38 | b4a9cb9 | comment-only OK | gates OK |

Batch notes: `sites` counts matching lines of the base inventory. `removed` counts lines of class
`pure`, where a pointer-only parenthetical was deleted (by `apply-pure`, or by hand when the
tool had left it); `rewritten` counts the mixed and prose lines edited by hand so the rule they
carried stays as plain words; `left:title` rows stay for 05-10 (6 in `matching`, 1 in `e2e`).

Gates per batch: ESLint `--max-warnings=0` and Prettier `--check` on the changed files, the
workspace typecheck, and the workspace tests with an unchanged count (recurrence 77, matching 156,
shared 172, e2e support tests 15 before and after; `@hearth/seed` has no tests, so its gates are
the typecheck and ESLint). Each commit was re-checked with `comment-only-check.mjs --base HEAD~1
--head HEAD`, and `git diff --exit-code {phase-base} -- supabase/migrations` is empty after every
batch. After the batches, `citation-inventory.mjs inventory` over `packages` and
`supabase/seed/*.ts` lists 6 rows and over the E2E TypeScript 1 row, all class `title`.
`e2e/fixtures/**` and `e2e/docker-compose.e2e.yml` are unchanged (05-10).

Not classified by the codemod: nothing was left unclassified. Three kinds of site always needed
a human: a quoted rule after the reference (rewritten to plain words), a sentence whose subject is
a retired document (restated as the rule, `the seed data` for the seed fixtures), and a lone
citation that was the only content of a comment (deleted with the comment).

Service unit count (05-07), `pnpm --filter @hearth/service test` at C's tip `7437ac5` before any
service edit (`Test Files  56 passed`, `Tests  757 passed`); every service batch must report the same:

tests-before-c.service-unit=757

`service-http` notes: the 50 sites are the base-inventory rows of the 33 changed files (41 `pure`,
7 `mixed`, 2 `prose`, no `title`). The 9 rewritten sites are `auth/jwt.ts`, `privileged/job-database.ts`,
`privileged/scheduled-reminders.ts` (2), `routes/system.ts`, `routes/users.ts`, `test/service-stack.ts`
(2) and `vitest.coverage.config.ts`; each keeps its rule (signature and expiry, the
service-role fence, dispatch step 1, no nagging for overdue chores, password re-verification, no live
outbound fetch in tests, the 80% target). Service unit suite after: 757 passed. The commit subject
was shortened to 66 characters before the first push (phase rule 4).

`service-domain` notes: 57 files; the 184 sites are 134 `pure`, 41 `mixed` and 9 `prose` rows of the base
inventory (no `title`). The 50 rewritten sites keep their rules as plain words (equal weighting and
half-up rounding in `readiness.ts`, the no-backfill rule in `log-autopay.ts`, the rotation and
undo rules in `chores.ts`, the rate discipline in the Flipp wrapper, the integer-cents rule in
`deals/money.ts`, the notification kinds in `notifications/copy.ts`). Service unit suite after: 757
passed.

`service-tests` notes: 54 files; the 106 sites are 53 `pure`, 16 `mixed`, 22 `prose` and 15 `title`
rows of the base inventory. The 15 `left:title` rows (`describe`/`it` titles, including the second
string of the concatenated titles in `jobs/log-autopay.test.ts` and `log-autopay.integration.test.ts`)
wait for 05-10's title commit. Integration files were typechecked and linted here and run in PR C's CI.

Whole service (05-07): `comment-only-check.mjs --base 708c714 --head HEAD -- apps/service` printed `OK 144 files`
(33 + 57 + 54); the three batches cover all 340 `apps/service` rows of the base inventory (50 + 184 + 106).
`citation-inventory.mjs inventory` over `apps/service` lists 15 rows, all class `title`. The service
unit suite reported 757 passed after each batch, equal to `tests-before-c.service-unit`.

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
