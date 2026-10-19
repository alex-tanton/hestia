This ledger lives only in `.planning/`; it is not a spec and never goes into `docs/`. It records, for Phase 3, every item removed or kept, the three-part proof for each (D-11, D-12), and the decisions the removals depend on. Nothing here is a design record: it is the evidence trail for the owner's review.

## Gates and decisions

base=7d14b7775fa653e11ac85020564340ac5ba176cf

The working branch `claude/trusting-lovelace-y4r87h` absorbed `origin/main` through the plain merge `4e25543` (pushed `df9f298..4e25543`, no force). Code branches are cut from `origin/main` at the `base=` SHA, never from the working branch. Research measured everything on the same SHA, so there is no base drift.

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

## Removals

| # | Item | Kind | Group | Decision | Tool evidence | Text-search evidence | Build/test evidence | Branch commit | PR | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `supabase/seed/package.json:tsx` | devDependency | dependencies (PR 1) | D-07 | Base default summary has `devDependencies`, `supabase/seed/package.json`, `tsx`; `knip --trace-dependency tsx` prints `No imports found matching tsx` (`$L/03-01-trace-tsx.log`) | `git grep -n -w -F -e tsx -- supabase/seed` prints only `supabase/seed/package.json:16`. Seed runner references: only `apps/service/package.json:18` `db:seed` (`tsx ../../supabase/seed/seed-users.ts`, resolved from `apps/service`) and `apps/service/package.json:13` `typecheck`; no command runs `tsx` from inside the seed package | `pnpm install --frozen-lockfile` exit 0; `@hearth/seed` typecheck exit 0; `@hearth/service` typecheck (also `tsc -p ../../supabase/seed`) exit 0; `pnpm --filter @hearth/service exec tsx --version` prints `tsx v4.23.13`; lockfile diff is 3 deleted lines (the seed importer's `tsx` triple), manifest 1 deleted line, 0 added. Base-to-tip default summary: exactly the `tsx` line removed, nothing added (54 to 53). `pnpm db:seed` end to end is CI evidence from plan 03-02 (no Docker here) | `e7a7dbcabf9523518795f92edec7ac49df87d3ca` | PR 1 (not open) | removed |

## Kept (for the owner list)

| Item | Why kept | Evidence |
| --- | --- | --- |

## CI evidence

## Stale-reference sweep

## Leftovers audit
