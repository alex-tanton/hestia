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
| web-lib | `apps/web` lib, pillars, test helpers, top-level source, `scripts/check-build.mjs`, `vite.config.ts` (non-test) | 144 | 67 | 77 | 79255b5 | comment-only OK | gates OK |
| web-components | `apps/web/src/components` (source and tests) | 138 | 45 | 90 | 94fa9bd | comment-only OK | gates OK |
| web-screens | `apps/web/src/screens`, `apps/web/src/lib/**/*.test.ts(x)`, top-level `apps/web/src/*.test.ts(x)` | 192 | 71 | 101 | 3ef8862 | comment-only OK | gates OK |
| nonts | `.env.example`, `docker/` (Caddyfile, caddy.Dockerfile, docker-compose.yml, kong.yml), `e2e/docker-compose.e2e.yml`, `e2e/fixtures/e2e-seed.sql`, `scripts/deploy.sh`, `supabase/config.toml`, `supabase/seed/seed.sql`, `apps/web/src/index.css`, `commitlint.config.js`, `eslint.config.js` | 62 | 46 | 16 | 05cebd4 | comment-only OK | gates OK |

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

Web unit count (05-09), `pnpm --filter @hearth/web test` at C's tip before any web edit (`Test Files  57 passed`,
`Tests  728 passed`); every web batch must report the same:

tests-before-c.web=728

`web-lib` notes: 57 files; the 144 sites are 67 `pure`, 77 `mixed` or `prose` rows of the base inventory (no
`title`; `apps/web/src/index.css` is 05-10's). Rewritten sites keep their rule as plain words (the write
queue is durable and bounded, only list-item and chore/errand writes queue, server state never copied into
component state, meal-plan dates evaluated in the household timezone, money as integer cents). Seed-fixture
sources read `the seed data` or `Seed data:`. Gates: ESLint `--max-warnings=0` and Prettier on the 57 files,
web typecheck, web suite 728 passed, `pnpm --filter @hearth/web build` (the app-shell line printed
`App shell 198.0 KB gzipped (budget 200 KB)`). `check-build.mjs` was parsed as JS by the checker.

`web-components` notes: 65 files changed (66 files carry base-inventory rows); the 138 sites are 45 `pure`,
90 `mixed` or `prose` and 3 `title` rows (the three `describe`/`it` titles in `meals/meal-components.test.tsx`
wait for 05-10). No JSX comment container became empty, so none was deleted; the JSX comments in
`ChoreListRow.tsx`, `RotationEditor.tsx` and `RecipeCard.tsx` kept their why. `apply-pure` left two
fragments that were fixed by hand (`bills-copy.ts` grammar, `RecipeCard.tsx` JSX comment indentation). Five
comments that named the retired docs without matching the vocabulary (`Design`/`Branding` alone in
`Skeleton.tsx`, `StateBlocks.tsx`, `ItemPrice.tsx`, `ListPickerSheet.tsx`, `OfflineBanner.tsx`) were reworded
in the same pass. Web suite 728 passed, equal to `tests-before-c.web`.

`web-screens` notes: 92 files changed (97 files carry base-inventory rows); the 192 sites are 71 `pure`, 101
`mixed` or `prose` and 20 `title` rows (19 under `screens`, 1 in `lib/password.test.ts`), which wait for 05-10.
Four comments that named the retired docs without matching the vocabulary (`Design` alone in
`auth-client.ts`, `format.ts`, `api/problem.ts`, and a line-width refill in `chores.test.tsx`) were reworded in the
same commit. Gates: ESLint `--max-warnings=0` on all of `apps/web`, Prettier on the changed files, web typecheck,
web build (`App shell 198.0 KB gzipped (budget 200 KB)`), web suite 728 passed.

Whole web app (05-09): `comment-only-check.mjs --base 708c714 --head HEAD -- apps/web` printed `OK 211 files`.
The three web batches cover 144 + 138 + 192 = 474 sites, equal to the base inventory's `apps/web` TypeScript
rows (the 2 `apps/web/src/index.css` rows are 05-10's). `citation-inventory.mjs inventory` over `apps/web` lists 25
rows: 23 titles (3 in `components`, 20 in `screens` and `lib`) and the 2 `index.css` rows. The web suite
reported 728 passed after each batch, equal to `tests-before-c.web`.

tests-after-c.web=728

## Titles

One commit on `refactor/drop-spec-citations` restates the test titles that cited the retired spec (D-19):
`test: restate test titles without spec citations`. It changes 45 titles (one per `count-titles` row; the plan
text and the research say 46, which counted differently, see Counts) in 28 files: 15 service, 23 web, 1 e2e
and 6 matching titles. `titles.tsv` has one row per title with its old and new text (no header). The message says
plainly that the commit is not comment-only.

Style: a `describe` names its subject in plain words; an `it` or `test` states the expected behavior in the present
tense, in lower case; no title names a document, a section, a screen number or a numbered rule; a rule the citation
carried stays in plain words (`per-ounce price: /oz gives oz`, `notification copy length: at most 60 characters`);
the seed fixtures read `the seed data`; the two concatenated titles became one literal each.

titles-commit=96fb846dfe75ff669abdd97192fa8e06b2e5a8fe

Proofs:

- `comment-only-check.mjs --base 96fb846~1 --head 96fb846 --titles -- apps packages e2e` prints `OK 28 files`: the
  compiler print is equal once the first argument of `describe`, `it` and `test` is ignored, so no other literal and no
  code changed.

titles-proof=OK

- The same command without `--titles` prints `FAILED 28 of 28 files`, and the failing files are exactly the 28 files of
  `titles.tsv`.

titles-plain-check=FAIL as expected

- No consumer of test names: `git grep -nE -- '--grep|testNamePattern| -t '` over the package scripts, `scripts`,
  the Playwright config, `.github` and `docs` finds only `mapfile -t lines` in `scripts/ci-prepull-images.sh`, a shell
  flag, not a test filter.

title-consumers=none

- Counts before and after at C's tip (`pnpm -r test`): matching 156/156, shared 172/172, recurrence 77/77, service
  757/757, web 728/728, e2e support tests 15/15. The integration titles are covered by `vitest list --config
  vitest.integration.config.ts` (382 lines before and after), and `playwright test --list` reports `Total: 104 tests in
  19 files` before and after.

titles-counts-equal=yes

- Gates: `pnpm typecheck`, `pnpm lint`, `pnpm format:check` pass; migrations identical to the phase base.

Left alone on purpose (the plan limits the title edit to the inventory's `title` rows): nine titles still say `Design`,
`Branding`, `Requirements` or `the ... document` without matching the vocabulary, so they are neither counted nor
changed: `parse-price.test.ts:34`, `Toast.test.tsx:34`, `password.test.ts:12`, `sections.test.ts:15`,
`onboarding.test.tsx:225` and `:243`, `settings.test.tsx:95`, `tokens.test.ts:99`, `similarity.test.ts:42`. They
are reported for the owner or 05-11 to decide.

Post-condition: `citation-inventory.mjs inventory` over the PR C tree (`. ':!README.md' ':!.claude'`) has a header and
no rows, and `git grep -E -f cit-rx.txt` outside `.planning`, `docs`, `supabase/migrations`, `README.md` and
`.claude` prints nothing.

pr-c-left=0

## HTML fixtures

Commit `4f4c124` on `refactor/drop-spec-citations` (`test(e2e): drop retired spec citations from recipe
fixture pages`), the three files `e2e/fixtures/recipes/full-json-ld-light.html`, `full-json-ld-dark.html`
and `no-json-ld.html`, one `<p>` paragraph each (4 base rows: two in the light page). Each paragraph keeps its
purpose and loses the retired document references; the dark page now says the broccoli is a match against
the "Broccoli Crowns" deal "in the seed data".

Proofs:

- `nonts-comment-check.mjs --html` on the working tree and on the commit prints `OK 3 files` (ld+json
  blocks byte-identical, text outside the paragraphs equal).
- `$L/05-10-extract.mts` ran `extractRecipeJsonLd` on the base and new version of each page: light and
  dark `equal`, `no-json-ld.html` `equal` (both `undefined`).
- `git grep -F` for each removed phrase (`Done when`, `E2E environment`, `Favorite-store groceries`,
  `A recipe imports from a URL`) over `e2e` and `apps` outside the fixtures prints nothing. Spec 13 asserts
  titles, readiness and prices from the JSON-LD, never the paragraph text. The recipe-import journey runs in
  PR C's CI.

html-consumers=none
html-jsonld-identical=yes
html-extract-equal=yes

## Non-TS proofs

Tool: `.planning/cleanup/tools/nonts-comment-check.mjs` (rules: parsed YAML deep-equal; `#` files with
whole-line comments and blanks dropped, every diff line a comment, shebang and Dockerfile parser
directive untouched; SQL with `--` to end of line dropped after an unsafe-quote guard; CSS with block
comments dropped and whitespace collapsed; HTML with `--html`: ld+json blocks byte-identical and
paragraph contents blanked). Controls: `.planning/cleanup/tools/nonts-comment-controls.sh` (output
`.planning/cleanup/logs/05-10-controls.log`), each line is the code-changing mutant's verdict, then the
comment-only change's verdict:

nonts-control-yaml=FAIL OK
nonts-control-hash=FAIL OK
nonts-control-sql=FAIL OK
nonts-control-css=FAIL OK
nonts-control-html=FAIL OK

Batch `nonts` (commit `05cebd4` on `refactor/drop-spec-citations`), proofs per file, taken on the working
tree and again on the commit (`--base HEAD~1 --head HEAD`, `OK 11 files` plus `OK 2 files`):

| file | rule |
| ---- | ---- |
| `.env.example`, `docker/Caddyfile`, `docker/caddy.Dockerfile`, `scripts/deploy.sh`, `supabase/config.toml` | `#` comments only; non-comment text equal; shebang and `# syntax=docker/dockerfile:1` untouched |
| `docker/docker-compose.yml`, `docker/kong.yml`, `e2e/docker-compose.e2e.yml` | parsed YAML deep-equal |
| `e2e/fixtures/e2e-seed.sql`, `supabase/seed/seed.sql` | `--` comments only; SQL text equal; no `--` after an open quote in the base |
| `apps/web/src/index.css` | `/* */` comments only; CSS text equal |
| `commitlint.config.js`, `eslint.config.js` | `comment-only-check.mjs` compiler-print equal |

kong-yaml-equal=yes

`docker/kong.yml` parses to the same configuration, so the Kong allowlist test (part of the service
suite, 757 passed before and after) passes and no Kong recreate is needed on the host.

Decisions and notes for 05-10 Task 1:

- The two root JS configs (3 lines: `commitlint.config.js` 1, `eslint.config.js` 98 and 135) are in PR C,
  because D-09 names "the two root JS configs". They are proven by the TypeScript compiler print, not the
  non-TS checker.
- `apply-pure` is not used for the non-TS files: its refill reflowed `.env.example` (it merged the
  commented-out `HEARTH_RATE_LIMIT_PER_MINUTE=300` example into a sentence), broke comment indentation in
  `e2e/docker-compose.e2e.yml` and deleted the `-- ----` rule lines in the SQL files. All 62 sites were
  edited by hand (exact-string replacements, no reflow), so those separator and example lines are intact.
- Bare references the vocabulary does not catch were reworded in the same files (`Design:`, `Branding:`,
  `the Branding ones`, `Seed Data` as a subject, `Phase 3 "Done when"`), as in 05-09.
- Gates: `bash -n scripts/deploy.sh`, `pnpm test:harness` (231 pass, 0 fail: deploy test and both ESLint
  config tests), `pnpm lint`, `pnpm format:check`, service suite 757 passed (Kong allowlist test
  included), `pnpm --filter @hearth/web build` (`App shell 198.0 KB gzipped (budget 200 KB)`). Migrations
  identical to the phase base. `citation-inventory.mjs queue` over the batch lists 0 sites.
- Counts: 62 sites (46 pure, 9 mixed, 7 prose), 46 removed, 16 rewritten; `batch-nonts.tsv` has 62 rows.

## Retained

Whole-range proofs at PR C's head (05-11, taken from `base=` in `../hearth-citations`; logs `05-11-range-*.log`):

- `comment-only-check.mjs --base 708c714 --head 96fb846~1 -- . ':!.planning'` prints `OK 429 files (14 non-TS skipped)`.
- `comment-only-check.mjs --base 96fb846~1 --head 96fb846 --titles -- . ':!.planning'` prints `OK 28 files`.
- `nonts-comment-check.mjs --base 708c714 --head 96fb846 --html` over the non-script paths (the tool fails
  `.ts`, `.tsx`, `.mjs` and `.js` as an unknown type, so the pathspec excludes them with
  `':(exclude,glob)**/*.ts'` and the like; the plan's command without that exclusion cannot print OK) prints
  `OK 14 files`: the same 14 non-TS files the range changes (11 non-TS config and script files, 3 HTML fixtures).
- The range holds 14 non-merge commits touching code, each recorded above (12 batch rows, the HTML commit
  `4f4c124` and `titles-commit`); nothing else.

range-commits=14

Post-condition (D-21): `citation-inventory.mjs inventory --repo C -- . ':!README.md' ':!.claude'` has a header and 0 rows
(`pr-c-left=0` holds on the merged head); `git grep -E -f cit-rx.txt` outside `.planning`, `docs`,
`supabase/migrations`, `README.md` and `.claude` prints nothing.

- Migrations: 17 citation lines in 8 files, equal to `count-migrations`; `git diff --exit-code c64d79e -- supabase/migrations`
  is empty (untouched).
- `count-phase-mentions`: 27 at `base=`, 29 on the head under the same pathspec. They name product phases, not
  citations (research A10): lines that used to match the vocabulary as well (for example `seed.sql`,
  `matching/similarity.ts`) now match only `Phase N` after the document name was dropped. Left alone.
- `README.md` and `.claude/CLAUDE.md` sites, PR D's:

left-for-pr-d=4

(`README.md` lines 69, 121 and 146, and `.claude/CLAUDE.md` line 232.)

Local gates at the head (logs `05-11-{frozen,lint,format-check,typecheck,test,build,commitlint}.log`, all `exit=0`; Node 24.21.0):
frozen install, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (harness 231 pass, 0 fail, then workspaces),
`pnpm build` and `commitlint --from 708c714 --to HEAD`. Counts at the head equal those measured in a throwaway worktree detached
at `base=` (`05-11-base-test.log`, removed afterwards):

tests-final-c.matching=156
tests-final-c.shared=172
tests-final-c.recurrence=77
tests-final-c.service=757
tests-final-c.web=728
tests-final-c.e2e-support=15

Clone count (Phase 2 test-inclusive command, label `05-11`, `.planning/cleanup/jscpd/phase5-05-11/jscpd-report.json`;
`jscpd-compare.mjs --max-clones 95` exits 0): 66 clones, 858 duplicated lines, 1.11%, identical to `final-b-clones=66`
(a comment-only sweep adds no clone).

after-c-clones=66

Open item for the owner (not edited, outside the plan's `title` class): nine test titles still name a retired
document in bare words: `parse-price.test.ts:34`, `Toast.test.tsx:34`, `password.test.ts:12`, `sections.test.ts:15`,
`onboarding.test.tsx:225` and `:243`, `settings.test.tsx:95`, `tokens.test.ts:99`, `similarity.test.ts:42`.

pr-c-ready=2ae102e79ae1982d049263d53492b0dc0d5747d5

## CI

PR C (opened 2026-10-22, `refactor/drop-spec-citations` into `main`, not a draft, `mergeable_state` clean). The body is
`.planning/cleanup/logs/05-11-pr-c.md` (gitignored); proposed squash title `refactor: remove retired spec citations from code`.

pr-c=28
pr-c-head=e1997a71efd6182157ff0713ca973ea78ba6e314

The head is `pr-c-ready` (`2ae102e`) plus the merge of the working branch carrying the Task 1 record. The PR lists 495
files: 454 outside `.planning/`, none under `supabase/migrations/`, `docs/`, `.github/`, `README.md` or `.claude/`.

CI run 39705754497 (`pull_request`, one attempt, no rerun), all six jobs `success`:

| job | job id | conclusion |
| --- | ------ | ---------- |
| lint | 119585285161 | success |
| typecheck | 119585285186 | success |
| test-unit | 119585285035 | success |
| test-integration | 119585285328 | success |
| test-e2e | 119585285258 | success |
| build | 119585285347 | success |

pr-c-ci=39705754497 lint:success typecheck:success test-unit:success test-integration:success test-e2e:success build:success

E2E: `104 passed (8.7m)`; spec 13 ran in both themes (`tests/13-recipe-import-and-readiness.spec.ts:130`, light and dark)
and passed.

pr-c-e2e-13=passed

Integration (`test-integration` runs `test:coverage`; `Test Files  76 passed (76)`): this run `Tests  1190 passed (1190)`;
`main`'s latest green run (39661257811 at `a660d58`) `Tests  1190 passed (1190)`.

pr-c-integration-tests=1190
main-integration-tests-c=1190

Logs: `05-11-pr-integration.log`, `05-11-main-integration.log`, `05-11-pr-e2e.log`, `05-11-pr-files.txt`.

Merge: not done; it is the owner's squash merge (05-11 Task 3).
