This ledger lives only in `.planning/`; it is not a spec and never goes into `docs/`. It records, for Phase 3, every item removed or kept, the three-part proof for each (D-11, D-12), and the decisions the removals depend on. Nothing here is a design record: it is the evidence trail for the owner's review.

## Gates and decisions

base=7d14b7775fa653e11ac85020564340ac5ba176cf

The working branch `claude/trusting-lovelace-y4r87h` absorbed `origin/main` through the plain merge `4e25543` (pushed `df9f298..4e25543`, no force). Code branches are cut from `origin/main` at the `base=` SHA, never from the working branch. Research measured everything on the same SHA, so there is no base drift.

A1=remove (owner, 2026-10-19)
A2=remove (owner, 2026-10-19)
A8=remove (owner, 2026-10-19)
OQ1=accept (owner, 2026-10-19)
gate-pr1=approve-both (owner, 2026-10-19)
knip-summary=keep-reported (owner, 2026-10-19)

pr1=12
pr1-head=e7a7dbcabf9523518795f92edec7ac49df87d3ca

PR 1 pre-gate state (plan 03-02 Task 1, 2026-10-19): no pull request is open and the throwaway branch `ci/db-types-evidence` is not created; both wait for the owner's `gate-pr1` answer (Task 2). `origin/main` is still `7d14b77`, an ancestor of `build/unused-deps` tip `e7a7dbc` (no merge needed). On Node 24.21.0, pnpm 10.34.5, `TZ` unset, in `/home/user/hearth-deps`: `pnpm install --frozen-lockfile`, `lint`, `format:check`, `typecheck`, `test` (matching 156, shared 148, recurrence 77, service 725, web 715 tests) and `build` all exit 0 (`$L/03-02-{frozen,lint,format-check,typecheck,test,build}.log`); `commitlint --from origin/main --to HEAD` exit 0 over both commits; `git push --dry-run origin build/unused-deps` prints "Everything up-to-date". The diff against `origin/main` is exactly `docs/file-map.md`, `package.json`, `pnpm-lock.yaml`, `scripts/knip-summary.mjs`, `supabase/seed/package.json`, with nothing under `.planning`, `.claude`, `supabase/migrations`, `.github`, `docker` or `db/types.ts`, and no secret-shaped added line. Re-measured on the tip: `knip:production` total 80 versus base 79, the single added line `files	scripts/knip-summary.mjs	-`. Open for the owner at the gate: (a) add `scripts/knip-summary.mjs!` to `knip.json` `entry`, (b) keep the line reported and list it on the owner list, (c) drop the normalizer commit. Note: the body of commit `8c82091` says knip "treats it as an entry and does not report it"; that is true for default mode only. The branch is pushed, so the body is not rewritten; PR 1's body states the production behavior correctly.

## Counts

Totals are the `total` line of the normalized knip summaries (`scripts/knip-summary.mjs` output format). Base summaries: `.planning/cleanup/knip/phase3-before-{default,production,nonode}-summary.txt`. "nonode" is the throwaway config with the `node` plugin disabled, which also shows exports under `test/` directories (D-08); it is never committed.

| Config | Base | PR 2 tip | Final |
| --- | --- | --- | --- |
| default (committed `knip.json`) | 54 | | |
| production (`knip:production`) | 79 | | |
| nonode (throwaway config) | 57 | | |

Base kinds, default: devDependencies 2, duplicates 1, exports 14, types 37. Drift against the Phase 2 snapshot (59 default, 80 production): the three `apps/web/src/test/meal-fixtures.ts` exports are hidden from default mode by the `test:harness` side effect, `unlisted fuse.js` is gone (commit `d8f3daf`) and `unlisted vitest` is gone (root `vitest` declared). Diffed against `.planning/cleanup/knip/{default,production}-summary.txt` on this base: exactly those five lines in default and the one `vitest` line in production, nothing else. Every proven-dead line in `OWNER-CANDIDATES.md` is still present: `ChoreLike`, `useFavoriteStores` and `listIdOfWrite` in the default summary, the three meal fixtures in the nonode summary, and `supabase/seed/package.json` `tsx` in the default summary.

Two default runs on the unchanged base gave byte-identical summaries (`cmp`), so a knip run on an unchanged tree is repeatable.

## Tooling

Not a removal. The report normalizer is on branch `build/unused-deps` (PR 1, not open):

- Commit `8c8209129a719dcbb24244d7d9d125756e759bd9`, `chore: add the knip report normalizer`.
- Source `/home/user/hearth-aside/bin/knip-summary.mjs`, copied unchanged. sha256 of the source, of the working-tree copy and of the committed blob (`git show HEAD:scripts/knip-summary.mjs`, checked after lint-staged ran): `74b6e969750cbc6115bae9c2c810a7cb709469aba2858013016a3ea90cd8cb12`. Mode `100755`.
- Reproduction: the script reproduces all six recorded Phase 2 summaries byte for byte (`cmp` identical): `default`, `production`, `calibration-default`, `calibration-production`, `calibration-canary-default`, `calibration-canary-production`.
- Root script `knip:summary` = `node scripts/knip-summary.mjs`; `docs/file-map.md` has the new section 8 row and the reworded `scripts/` row.
- Default knip on the branch reports no line for the file (research assumption A3 holds in default mode): the summary is byte-identical to the base summary, 54 findings.
- Production knip does report it: the branch summary has one more line than the base, `files	scripts/knip-summary.mjs	-` (total 80). `knip:production --debug` shows `scripts/test-sweep.mjs` as a `!`-marked (production) entry in `knip.json`, while `scripts/knip-summary.mjs` appears only in the project file list, so a `package.json` script reference alone does not make it an entry in production mode. The fix would be a `scripts/knip-summary.mjs!` entry in `knip.json`, which D-08 keeps unchanged for Phase 3, so no edit was made. Consequence for later plans: from the first branch commit on, the production reference is the base summary plus that one line (80), and DEAD-01's "production reports only `normalized-fixtures.ts`" is true of the base but not of any branch tip until the owner decides what to do with this line (for the owner list).

## Null results and re-checks

DEAD-01 files: no file passes the proof, so no file was deleted. The base default summary has 0 lines of kind `files`. The base production summary has exactly 1, `apps/service/src/deals/flipp/normalized-fixtures.ts`, which stays (D-04): `knip --trace-file` shows `buildNormalizedFixtures` and `serializeFixture` imported by `apps/service/scripts/normalize-fixtures.ts` (package script `fixtures:normalize`) and by `normalized-fixtures.test.ts` (`$L/03-01-trace-normalized-fixtures.log`); it is on the owner list. Non-TypeScript orphan scan: 85 tracked files outside `.planning/`, `.claude/`, `e2e/fixtures/flipp/`, `supabase/migrations/` and the `.ts`/`.tsx`/`.mts`/`.cts` names were checked by basename; the 9 with no other tracked file naming them are all convention-discovered and none is dead. `.husky/commit-msg` is run by Git as a hook, because Husky points `core.hooksPath` at `.husky/_`, which runs every file in `.husky/`. The seven `tsconfig.json` files `apps/service/tsconfig.json`, `apps/web/tsconfig.json`, `e2e/tsconfig.json`, `packages/matching/tsconfig.json`, `packages/recurrence/tsconfig.json`, `packages/shared/tsconfig.json` and `supabase/seed/tsconfig.json` are found by TypeScript's project lookup when each package's `typecheck` script runs `tsc --noEmit` (the seed one also through `tsc --noEmit -p ../../supabase/seed` from `apps/service`). `docs/file-map.md` is a reference document read by people. Nothing went to Kept from the scan. Since the branch commit `8c82091` the production run also lists the new normalizer as a `files` line (see Tooling); that is not a dead-file finding.

D-06 fuse.js: nothing to remove. (1) The only tracked file naming `fuse.js` outside `.planning/` and `.claude/` is `packages/matching/src/similarity.ts`, line 6, a design-rationale comment (comments belong to Phase 5, RED-04, and stay). (2) `pnpm-lock.yaml` (10677 lines) has 0 case-insensitive matches for `fuse`. (3) `packages/matching/scripts` does not exist. (4) The `dependencies` of `packages/matching/package.json` are exactly `fastest-levenshtein` (1.0.16).

D-08 hidden entry: `knip --debug` on the committed config lists the entry pattern `**/test/**/*.{cjs,mjs,js,cts,mts,ts}` with the source `(package.json)`, supplied by the `node` plugin because root `test:harness` runs `node --test` (`$L/03-01-knip-debug.log`). Comparing the base default summary with the base throwaway-config summary: the throwaway config adds exactly three lines, `apps/web/src/test/meal-fixtures.ts` `currentWeekFixture`, `emptyWeekFixture` and `previousWeekFixture`, and removes nothing (54 versus 57). `knip.json` is unchanged on the branch (D-08). Every later trace of a path under a `test/` directory therefore also uses `$NONODE`.

## Removals

| # | Item | Kind | Group | Decision | Tool evidence | Text-search evidence | Build/test evidence | Branch commit | PR | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `supabase/seed/package.json:tsx` | devDependency | dependencies (PR 1) | D-07 | Base default summary has `devDependencies`, `supabase/seed/package.json`, `tsx`; `knip --trace-dependency tsx` prints `No imports found matching tsx` (`$L/03-01-trace-tsx.log`) | `git grep -n -w -F -e tsx -- supabase/seed` prints only `supabase/seed/package.json:16`. Seed runner references: only `apps/service/package.json:18` `db:seed` (`tsx ../../supabase/seed/seed-users.ts`, resolved from `apps/service`) and `apps/service/package.json:13` `typecheck`; no command runs `tsx` from inside the seed package | `pnpm install --frozen-lockfile` exit 0; `@hearth/seed` typecheck exit 0; `@hearth/service` typecheck (also `tsc -p ../../supabase/seed`) exit 0; `pnpm --filter @hearth/service exec tsx --version` prints `tsx v4.23.13`; lockfile diff is 3 deleted lines (the seed importer's `tsx` triple), manifest 1 deleted line, 0 added. Base-to-tip default summary: exactly the `tsx` line removed, nothing added (54 to 53). `pnpm db:seed` end to end is CI evidence from plan 03-02 (no Docker here) | `e7a7dbcabf9523518795f92edec7ac49df87d3ca` | PR 1 (not open) | removed |

## Kept (for the owner list)

| Item | Why kept | Evidence |
| --- | --- | --- |

## CI evidence

pr1-ci=lint:success typecheck:success test-unit:success test-integration:success test-e2e:success build:success (CI run 39325433012, pull_request, head e7a7dbc, 2026-10-19; no re-run needed)

PR 1 (#12, `build/unused-deps` into `main`) is open and unmerged, mergeable state clean; the owner's squash merge is pending. The six jobs ran once on the PR head, and `test-e2e` built the service and Caddy images through Compose, so that is the Docker-build evidence for the `tsx` removal.

Throwaway CI run replaced by a local run (owner override, 2026-10-19). The throwaway commit `8401de9` could not be pushed: GitHub rejected it ("refusing to allow an OAuth App to create or update workflow `.github/workflows/ci.yml` without `workflow` scope"), and the owner could not push it either. The owner then asked for the run to happen in this environment instead. This is local evidence, not CI evidence (phase rule on CI-only evidence overridden by the owner). Setup: Docker 29.8.2, `supabase start` (v2.117.0) with the optional services excluded (studio, imgproxy, edge-runtime, logflare, vector, supavisor, mailpit, storage-api, postgrest, postgres-meta), run in `/home/user/hearth-deps` on the PR 1 tip `e7a7dbc` (seed `tsx` removed), the same two procedures as the throwaway steps. Logs: `$L/03-02-local-{dbtypes1,dbtypes2,dbreset,dbseed}.log` (gitignored).

dbtypes-source=local-docker (owner-authorized, 2026-10-19)
dbtypes-run1-vs-run2=same
dbtypes-run2-vs-committed=same
dbtypes-diffstat=empty
dbseed=exit0
dbseed-status=proven locally (dbseed=exit0, `supabase db reset` then `pnpm db:seed`, local Docker run, not CI)

`pnpm db:types` ran twice against the migrated database and both outputs were byte-identical to the committed `apps/service/src/db/types.ts` (no drift, codegen deterministic, so OQ1's determinism question is answered for this stack). `pnpm db:seed` created the five seed users and seeded households, members, favorites, notification settings and invites after `supabase db reset`, with `tsx` resolved through the service package. The throwaway branch stays local, is never pushed, and no draft was opened.

## Stale-reference sweep

## Leftovers audit
