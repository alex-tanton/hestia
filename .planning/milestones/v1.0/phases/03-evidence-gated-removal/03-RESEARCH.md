# Phase 3: Evidence-Gated Removal - Research

**Researched:** 2026-10-19
**Domain:** Dead-code, dependency and stale-reference removal in a pnpm TypeScript monorepo, gated by knip, text search and CI
**Confidence:** HIGH (every number below was reproduced this session on a throwaway checkout of `origin/main`; items that could only be reasoned about are tagged `[ASSUMED]`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Carried forward from Phase 2 (owner decisions D-08 to D-18, still binding)**
- **D-01:** `packages/matching`, `packages/recurrence` and `packages/shared` are internal. An export with no importer anywhere, tests included, may be removed after Phase 3's own three-part proof. An export used only by tests stays. (Phase 2 D-18.)
- **D-02:** `apps/service/src/jobs/index.ts`: keep the barrel and `jobs/index.test.ts`. Drop only re-export lines with no use anywhere (the zero-use type re-exports: `AutopayBillRow`, `DispatchOutcome`, and the like). The 12 test-only runtime re-exports stay. (Phase 2 D-18.)
- **D-03:** `BILLS_LIST_EMPTY_COPY` is the canonical name; the unused alias `BILLS_EMPTY_COPY` in `apps/web/src/components/bills/bills-copy.ts` may go. (Phase 2 D-18.)
- **D-04:** The 19 test-only items are kept as they are. `tailwindcss` in `apps/web`, the Flipp fixture exports, `normalized-fixtures.ts`, and the whole D-10 standing list (anything reachable only through Docker, Compose, Kong, Caddy, SQL, or string-built paths) are kept and stay on the owner list. (Phase 2 D-18.)
- **D-05:** Never run `knip --fix`. Never treat knip output alone as proof. No broad ignore globs that hide candidates. `supabase/migrations/` is never edited. (Phase 2 D-08, D-10; project constraints.)
- **D-06:** The `fuse.js` benchmark cluster is already gone (Phase 2 D-16, commit `d8f3daf` on `origin/main`). DEAD-03's `fuse.js` part needs only a re-check that nothing references it and the lockfile is clean.

**Dependencies**
- **D-07:** Remove the unused `tsx` devDependency from `supabase/seed/package.json`. This overrides the "keep" note in Phase 2 D-18; the roadmap success criterion and DEAD-03 name it, and no seed script uses it (`db:seed` runs through `apps/service`'s own `tsx`, and the seed package has only `typecheck`). The lockfile changes in the same commit, `pnpm install --frozen-lockfile` is re-run, and `pnpm db:seed` and the seed typecheck must still work — **Reversibility:** reversible — one `pnpm add -D` restores it.

**Evidence and knip handling**
- **D-08:** Re-establish the evidence for `currentWeekFixture`, `emptyWeekFixture` and `previousWeekFixture` in `apps/web/src/test/meal-fixtures.ts` with `knip --trace-export`, a repo-wide text search, and the web test run. A fresh knip run no longer reports them because the root `test:harness` script makes `test/**` count as entry files. Leave `knip.json` as it is for Phase 3; whether it needs a narrow change for that side effect is a separate decision, to be revisited with Phase 6's blocking check.
- **D-09:** Commit the report normalizer as `scripts/knip-summary.mjs`. It lives today outside the repo (`../hearth-aside/bin/knip-summary.mjs`) and is cited by TRIAGE.md. In the repo it is subject to lint, format, typecheck and knip like any script, and Phase 6 can reuse it. It must not add `console.*` to shipped code (scripts are allowed). It must keep the output format (`kind<TAB>path<TAB>symbol` lines, sorted, final `total` line) so earlier summaries stay comparable.

**Removal mechanics and proof**
- **D-10:** For an unused export or type, remove only the `export` keyword when the file still uses the name internally. Delete the whole declaration, and any imports it orphans, when nothing uses it. Remove a whole file only after the three-part proof for the file itself.
- **D-11:** The three-part proof per item is: (1) no importer (`knip --trace-export` or `--trace-file`), (2) a repo-wide text search across every tracked file type, `.planning/` and `.claude/` excluded, finds no non-documentation reference, (3) the relevant typecheck, build or test passes after the removal. An item that fails any part moves to the owner list and stays in the tree.
- **D-12:** Proof is recorded in a removal ledger under `.planning/cleanup/` (one row per item, with the three results), plus a commit body that names its items so any single revert is surgical. Nothing about the removal goes into `docs/` (no review, decision-log, or ADR files).

**Landing**
- **D-13:** Land the work as one PR per category, stacked in this order: (1) dependencies with the lockfile, (2) files, exports and types, (3) stale references and leftovers. Each PR gets the full CI run, including both Docker builds, integration and E2E, and each can be reverted on its own. Squash merge per `CONTRIBUTING.md`. Every merge to `main` deploys, and `.planning/` edits stay out of the PRs (docs-only exemption applies to `docs/` only). The cloud box has no Docker, so integration, E2E and Docker-build evidence comes from PR CI.

**Leftovers and stale references**
- **D-14 (DEAD-05):** Run the ignored-file check (`git ls-files -ci --exclude-standard`, already empty) and also audit tracked files by pattern for build output, logs, `*.tsbuildinfo`, backups, duplicate lockfiles, and editor junk. Anything tooling cannot prove generated or leftover goes to the owner list. Tracked generated outputs that are meant to be committed (such as `apps/service/src/db/types.ts`) stay.
- **D-15 (DEAD-05, `db:types`):** Get the regenerate-and-diff evidence from PR CI, which already starts the Supabase stack for integration tests. A throwaway step or draft-PR job runs `pnpm db:types` twice and compares both runs against the committed file. This also answers the open question whether `db:types` output is deterministic. The permanent drift check is Phase 6 (CI-03); do not add it as a blocking CI step here.
- **D-16 (DEAD-04):** Phase 3 removes ignore-file and config references to files that no longer exist, for example `BUILD_PROMPT.md` in `.dockerignore` and `.prettierignore`, plus anything Phase 3's own removals orphan (including docs mentions of removed exports). Spec-citation comments (RED-04) and the wider `docs/` and codebase-map sync (RED-05) stay in Phase 5.

### Claude's Discretion
- Exact commit grouping inside each PR, the removal ledger's file name and column layout, and the order of items within a category.
- How the throwaway `db:types` CI evidence is arranged (extra step in a draft PR versus a scratch workflow), as long as it is not merged to `main`.
- Which of the 35 package-surface findings pass the proof (no importer anywhere, tests included) and so may go under D-01.

### Deferred Ideas (OUT OF SCOPE)
- A narrow `knip.json` change for the `test/**` entry side effect, and the permanent knip gate: Phase 6 (CI-01).
- The permanent `db:types` drift check, migration append-only check, and ignored-file check in CI: Phase 6 (CI-03).
- Spec-citation comment removal (262 citations) and the docs and codebase-map sync: Phase 5 (RED-04, RED-05).
- Open info items from the second Phase 2 code review (`02-REVIEW-FIXES.md`): not decided by the owner, outside this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEAD-01 | Proven-dead files are removed | Fresh knip finds zero files that can be proven dead: the only `files` finding is `apps/service/src/deals/flipp/normalized-fixtures.ts` (production mode, D-04 keep). DEAD-01 closes with a documented null result plus the non-TS orphan scan (see "Files: null result"). |
| DEAD-02 | Proven-dead exports and types are removed | 3 tool-visible proven-dead rows + 3 hidden meal-fixture rows + 5 cascade rows + alias + 13 jobs-barrel lines + 35 package-surface lines; each classified below with exact edits and orphaned imports. |
| DEAD-03 | Unused dependencies removed with the lockfile in the same commit | `fuse.js` already gone (verified). `tsx` removal rehearsed: `package.json` -1 line, `pnpm-lock.yaml` -3 lines, frozen install and both typechecks pass. |
| DEAD-04 | Stale references are removed (e.g. `BUILD_PROMPT.md`) | Exactly two stale refs found tree-wide: `.dockerignore:24` and `.prettierignore:4`. A path-existence sweep of all tracked config/docs found no others. Cascade comment in `chore-fixtures.ts` noted. |
| DEAD-05 | No tracked generated or leftover files remain, and `db/types.ts` has a drift check | `git ls-files -ci --exclude-standard` is empty; pattern audit finds nothing (only `.env.example`, intended). `db:types` determinism needs PR CI (recipe below). The permanent drift check is CI-03/Phase 6 (see Open Question 1). |
| DEAD-06 | Uncertain candidates are reported to the owner, not deleted | `OWNER-CANDIDATES.md` is stale in three places (resolved items listed below); refresh recipe and a no-deletion diff guard are specified. |
</phase_requirements>

## Summary

The Phase 2 ledger still holds on the current tree, with five drifts. `origin/main` is at `7d14b77`, one code commit ahead of the working branch (`74efe4c`, which carries 10 newer `.planning/` files that `origin/main` lacks). A fresh knip run on `origin/main` gives **54 default / 79 production findings** (recorded: 59 / 80). The five differences are: the three `meal-fixtures.ts` exports disappear from default mode (the `test:harness` side effect), `fuse.js` unlisted is gone (benchmark deleted in `d8f3daf`), and `vitest` unlisted is gone in both modes (root now declares `vitest`). Everything else is identical, so the six proven-dead rows are still dead: `ChoreLike`, `useFavoriteStores` and `listIdOfWrite` by direct knip evidence, and the three meal fixtures by `--trace-export` under a throwaway `node: false` knip config plus a text search that finds only their definitions.

The `test/**` side effect is precisely located. knip's `node` plugin reads root `test:harness` (`node --test ...`) and adds the entry pattern `**/test/**/*.{cjs,mjs,js,cts,mts,ts}`, which matches `apps/web/src/test/meal-fixtures.ts` and every other file under any `test/` directory. Disabling it for one run with a top-level `"node": false` in a throwaway config restores exactly the three missing findings and nothing else (default 57 = 54 + 3). Removing the three fixtures then creates a **second-order cascade** of five newly dead exports in the same file (`CURRENT_WEEK_SUNDAY`, `PREVIOUS_WEEK_SUNDAY`, `deletedRecipeEntry`, `wednesdayZitiEntry`, `wednesdaySaladEntry`), which the committed config will never report. The removal loop must therefore run to a fixed point using the throwaway config.

I rehearsed the web-side removals (the six proven-dead rows' declarations plus the alias fold) in a scratch worktree of `origin/main`: typecheck, eslint, prettier, the full web suite (56 files / 715 tests, same count as before) and `vite build` all pass, and knip drops exactly the expected lines (default 54 to 50; throwaway-config 57 to 55 with the five cascade rows appearing). The scratch worktree is deleted; the repo is untouched. The jobs barrel, package barrels and the 18 shared type aliases were *not* rehearsed (the sandbox declined a second scripted edit batch); their edits are specified below from reading the files and are tagged accordingly.

**Primary recommendation:** Cut all three code branches from `origin/main` (not the working branch), commit `scripts/knip-summary.mjs` first (copy verbatim from `/home/user/hearth-aside/bin/knip-summary.mjs`, sha256 `74b6e969750cbc6115bae9c2c810a7cb709469aba2858013016a3ea90cd8cb12`, reproduces all six recorded summaries byte-for-byte) with a root `knip:summary` script so knip treats it as an entry, then run the removal loop per category with the throwaway `node:false` config, and take integration, E2E and both Docker builds from PR CI only.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dead-code evidence (knip trace, text search) | Local tooling (cloud box) | — | Needs only node/pnpm/git; reproducible offline |
| Typecheck, lint, format, unit tests, web build | Local tooling | PR CI (same commands) | All run green on the cloud box in this session |
| Integration tests, `supabase start`, coverage thresholds | PR CI `test-integration` | — | No Docker daemon on the cloud box |
| Both Docker image builds + E2E | PR CI `test-e2e` (Compose `up --build`) | — | `e2e/setup/stack.ts` builds service and Caddy images; no other job builds Dockerfiles |
| `db:types` regenerate-and-diff | PR CI (throwaway step after `supabase start`) | — | Needs a migrated Postgres at 127.0.0.1:54322 |
| Removal ledger, owner list | `.planning/cleanup/` | — | Evidence trail stays out of `docs/` and out of code PRs (D-12, D-13) |
| Source edits, lockfile | Repo (`apps/*`, `packages/*`, `supabase/seed`, root) | — | Land via three stacked PRs |

## Drift Report: Phase 2 snapshot vs current tree

Re-checked on a detached worktree of `origin/main` @ `7d14b77` (`pnpm install --frozen-lockfile`, then `pnpm knip` and `pnpm knip:production`, normalized with the original helper). [VERIFIED: ran both commands this session; summaries diffed against `.planning/cleanup/knip/{default,production}-summary.txt`]

| # | Item | Phase 2 snapshot | Current (`origin/main` 7d14b77) | Action |
|---|------|------------------|---------------------------------|--------|
| 1 | Default findings total | 59 | **54** | Use 54 as the "before" for Phase 3 |
| 2 | Production findings total | 80 | **79** | Use 79 |
| 3 | `meal-fixtures.ts` x3 | reported (default) | not reported; `--trace-export` prints `No export currentWeekFixture found`, `--trace-file` prints `No exports found in apps/web/src/test/meal-fixtures.ts` | Re-prove with throwaway `node:false` config (below) |
| 4 | `fuse.js` unlisted in `packages/matching/scripts/fuzzy-benchmark.ts` | reported | gone; `packages/matching/scripts/` does not exist; `grep -n fuse pnpm-lock.yaml` prints nothing | D-06 re-check only |
| 5 | `test/clock-setup.mjs` unlisted `vitest` | reported (both modes) | gone; root `package.json:44` has `"vitest": "5.0.1"` | Remove from owner list |
| 6 | Standing-list item `packages/matching/scripts/fuzzy-benchmark.ts` | on owner list | file deleted by `d8f3daf` | Remove from owner list |
| 7 | `useFavoriteStores`, `listIdOfWrite`, `ChoreLike` | proven-dead | still reported, 0 importers, 1 text hit each (the definition) | Proceed |
| 8 | Working branch vs `origin/main` | — | `origin/main` has `7d14b77 fix: harden the clock pin and sweep, and document the harness` (7 files, +315/-24, all under `test/`, `scripts/`, `docs/`); the working branch has 10 `.planning/` files `origin/main` lacks | Merge `origin/main` into the working branch first; cut code branches from `origin/main` |
| 9 | CI health of `main` | Phase 1 left `test-unit` red | Push run `39298718857` on `7d14b77` is red only because `test-e2e` step "Run set -euo pipefail" (image pre-pull) failed 6 times with `toomanyrequests: Data limit exceeded` for `public.ecr.aws/supabase/gotrue:v2.196.0`; the same code passed on the PR run `39267711034` (all 6 jobs) | Infra flake, not a code failure; plan re-runs (`gh run rerun --failed`) |

Fresh default summary shape (verbatim totals): `devDependencies 2, duplicates 1, exports 14, types 37, total 54`. Disposition of the 54: 3 proven-dead + 1 alias duplicate + 13 jobs-barrel lines (12 types + `pruneCutoffs`) + 35 package-surface lines + 2 devDependencies (`tailwindcss` keep, `tsx` remove) = 54. [VERIFIED: summed from `default-summary.txt` produced this session]

Production-only extra findings are all test-only or D-10 items and stay (D-04): 40 exports, 37 types, 1 file (`normalized-fixtures.ts`), 1 duplicate.

## Standard Stack

No new packages are installed by this phase. It removes one devDependency declaration and adds one script file.

### Core (already installed, versions read from the repo)
| Tool | Version | Purpose | Why standard here |
|------|---------|---------|-------------------|
| knip | 6.41.0 (`package.json:39`) | Unused file/export/dependency analysis, `--trace-export`, `--trace-file`, `--trace-dependency` | Already calibrated in Phase 2; report-only (D-05) |
| pnpm | 10.34.5 | Lockfile maintenance | `pnpm install` rewrites the lockfile deterministically; never hand-edit it |
| git grep | system | Repo-wide text search (proof part 2) | Tracked files only, `-I` skips binaries |
| kysely-codegen | 0.20.0 | `db:types` | Only used for the CI regenerate-and-diff evidence |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Throwaway `"node": false` knip config for the meal-fixture proof | Edit committed `knip.json` | Deferred by D-08 to Phase 6; a committed `node:false` makes `test/support/vitest-project.mjs` appear as an unused production file (verified, see Pitfall 3) |
| `pnpm install` after hand-editing `package.json` | `pnpm --filter @hearth/seed remove tsx` | Equivalent; rehearsed the former and got a 3-line lockfile diff |

**Installation:** none. **Version verification:** `knip --version` is what `package.json` pins; no registry lookups were needed because nothing new is installed.

## Package Legitimacy Audit

No external package is added or upgraded, so the `package-legitimacy check` gate does not apply. `knip@6.41.0` was approved on 2026-10-13 (TRIAGE.md "Approvals"). One package declaration is removed: `tsx` from `supabase/seed/package.json`; `tsx@4.23.13` stays in the lockfile because `apps/service` declares the same version.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none added) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none. **Packages flagged [SUS]:** none.

## Architecture Patterns

### Evidence and removal flow

```
origin/main (7d14b77)
   |
   +--> branch 1 (deps) --> PR 1 --> CI (6 jobs) --> squash merge
   |        tsx out of supabase/seed + lockfile; scripts/knip-summary.mjs + root script
   |
   +--> branch 2 (code) --> PR 2 --> CI --> squash merge        (rebased on PR 1)
   |        loop per item:
   |          knip --trace-* (committed config AND throwaway node:false config)
   |            -> git grep -n -I -w -F  (all tracked types, .planning/.claude/lock excluded)
   |            -> edit (export keyword / declaration / barrel line / orphaned imports)
   |            -> typecheck + lint + format:check + tests + web build
   |            -> re-run knip; NEW finding appears? -> it is a cascade item, repeat
   |          until the diff of knip summaries == the removal set (fixed point)
   |
   +--> branch 3 (refs/leftovers) --> PR 3 --> CI --> squash merge
            .dockerignore / .prettierignore edits, orphan comment fixes

working branch (.planning only):
   ledger rows, refreshed OWNER-CANDIDATES.md, regenerated knip summaries  (never in the code PRs)

throwaway draft PR (never merged):
   ci.yml + extra step after "Start Supabase": pnpm db:types x2, diff vs committed file
```

### Recommended file additions
```
scripts/knip-summary.mjs        # copied verbatim from ../hearth-aside/bin/, mode 100755
package.json                    # + "knip:summary": "node scripts/knip-summary.mjs"
.planning/cleanup/REMOVAL-LEDGER.md      # one row per item (name is discretionary)
.planning/cleanup/OWNER-CANDIDATES.md    # refreshed in place
.planning/cleanup/knip/after-*-summary.txt   # post-removal summaries for comparison
```

### Pattern 1: Throwaway knip config for the hidden `test/**` entry
**What:** write a copy of `knip.json` with a top-level `"node": false`, pass it with `--config`, delete it afterwards. Put the file in the repo root (that is where it was tested), never commit it, and add it to `.git/info/exclude` locally to avoid accidents.
**When to use:** every `--trace-export`/knip run whose subject lives under any `test/` directory (`apps/web/src/test/`, `apps/service/src/test/`, root `test/`).
**Example:**
```bash
# Source: reproduced this session on origin/main 7d14b77 (exit 1 = findings, as for the committed config)
node -e 'const c=JSON.parse(require("fs").readFileSync("knip.json","utf8")); c.node=false;
  require("fs").writeFileSync("knip.nonode.tmp.json",JSON.stringify(c,null,2))'
pnpm --silent knip --config knip.nonode.tmp.json --trace-export currentWeekFixture
# apps/web/src/test/meal-fixtures.ts:currentWeekFixture
# └── (no imports found) ✗
pnpm --silent knip --config knip.nonode.tmp.json --reporter json > after.json
node scripts/knip-summary.mjs after.json after-summary.txt
rm -f knip.nonode.tmp.json
```
[VERIFIED: ran this session; output above is verbatim for `currentWeekFixture`, and the same `(no imports found) ✗` was printed for `emptyWeekFixture`, `previousWeekFixture`, `ChoreLike`, `useFavoriteStores`, `listIdOfWrite`]

Root cause, from `knip --debug` on the committed config: `'entry:**/test/**/*.{cjs,mjs,js,cts,mts,ts} (package.json)'`, supplied by the `node` plugin because root `package.json:16` has `"test:harness": "node --test test/clock-setup.test.mjs test/global-tz.test.mjs scripts/test-sweep.test.mjs test/eslint-clock-ban.test.mjs"`. [VERIFIED: `knip --debug` output + `package.json:16` read this session]

### Anti-Patterns to Avoid
- **`knip --fix` or any file-removal flag:** forbidden by D-05.
- **Judging "done" from the committed-config knip run alone:** it hides everything under `**/test/**`. Always compare against the throwaway-config run too.
- **Disabling the plugin in the committed `knip.json` "just to see":** deferred (D-08); also breaks `test/support/vitest-project.mjs` (Pitfall 3).
- **Editing `pnpm-lock.yaml` by hand.**
- **Touching `.planning/` in a code PR** (D-13).

## Removal worklist (DEAD-01, DEAD-02)

All edits below are specified against `origin/main` @ `7d14b77`. "Rehearsed" means applied in a scratch worktree, with typecheck, eslint, prettier, web tests and web build green.

### Files (DEAD-01): null result
- `pnpm knip` default: zero `files` lines. `pnpm knip:production`: one, `apps/service/src/deals/flipp/normalized-fixtures.ts`, which is imported by `apps/service/scripts/normalize-fixtures.ts` (package script `fixtures:normalize`, `apps/service/package.json:19`) and `normalized-fixtures.test.ts`: D-04 keep, owner list. [VERIFIED: summaries produced this session]
- Orphan scan of every tracked non-TypeScript file outside `.planning/`, `.claude/`, `e2e/fixtures/flipp/`, `supabase/migrations/` by basename: the only files with no basename reference anywhere else are `.husky/commit-msg`, seven `tsconfig.json` files and `docs/file-map.md`, all convention-discovered. Nothing is dead. [VERIFIED: ran a `git grep -F` loop over `origin/main` this session]
- Consequence: DEAD-01 is satisfied by a ledger entry that states "0 files pass the proof", with the two commands above as evidence. Do not invent a file removal to fill the requirement.

### A. Tool-visible proven-dead (3) — rehearsed

| Item | Edit | Orphaned by the edit | Evidence quote |
|------|------|----------------------|----------------|
| `ChoreLike` | delete `chore-copy.ts:210-211` (the type and its JSDoc) | drop `ChoreDetail` from the import on line 1 (`ChoreDetail` appears only on lines 1 and 211; `Chore` stays used) | `211: export type ChoreLike = Chore \| ChoreDetail;` [VERIFIED: apps/web/src/components/chores/chore-copy.ts:210-211] |
| `useFavoriteStores` | delete `deals.ts:172-~190` (whole function) | drop `favoriteStoreListSchema` and `type FavoriteStore` from the import block (`deals.ts` lines 10 and 19; both used only here). `dealKeys.favoriteStores` stays: `useFavoritesWriter` invalidates it. `favoriteStoreListSchema` is still used by `packages/shared/src/api/contract.ts:837`, so shared is untouched | `172: export function useFavoriteStores(` [VERIFIED: apps/web/src/lib/api/deals.ts:172-185] |
| `listIdOfWrite` | delete `write-queue.ts:42-46` plus one blank line | nothing: `MutationKey` and `LIST_WRITE_PREFIX` stay used (lines 1, 26, 30, 139) | `42: export function listIdOfWrite(key: MutationKey \| undefined): string \| undefined {` [VERIFIED: apps/web/src/lib/offline/write-queue.ts:42-46] |

Text search (proof part 2), all three: `git grep -n -I -w -e NAME -- . ':!pnpm-lock.yaml' ':!.planning' ':!.claude'` returns exactly one line each, the definition. No `docs/`, `README.md` or `CONTRIBUTING.md` mention of any of the six names. [VERIFIED: ran this session]

### B. Hidden proven-dead: the three meal fixtures (D-08) — rehearsed

`apps/web/src/test/meal-fixtures.ts`, current text:
```
570: export const currentWeekFixture: MealPlanWeekResponse = {
588: export const previousWeekFixture: MealPlanWeekResponse = {
593: export const emptyWeekFixture = (week: string): MealPlanWeekResponse => ({ week, entries: [] });
```
[VERIFIED: apps/web/src/test/meal-fixtures.ts:570-593]

Evidence set to record per D-08: (1) throwaway-config `--trace-export` for each: `(no imports found) ✗`; (2) text search finds only these three definition lines (`git grep -w` for the three names: lines 570, 588, 593 and nothing else); (3) full web suite, 56 files / 715 tests passed after removal. Also record that `git grep -n 'meal-fixtures'` shows the six test files that import *other* names from the module, so the module itself stays.

Edit: delete the three declarations; drop `MealPlanWeekResponse` from the type import (line 4 is the only remaining use after removal).

### C. Cascade created by B (5) — rehearsed, NOT reported by the committed config

After B, the throwaway-config knip run newly reports (verbatim):
```
exports	apps/web/src/test/meal-fixtures.ts	CURRENT_WEEK_SUNDAY
exports	apps/web/src/test/meal-fixtures.ts	PREVIOUS_WEEK_SUNDAY
exports	apps/web/src/test/meal-fixtures.ts	deletedRecipeEntry
exports	apps/web/src/test/meal-fixtures.ts	wednesdaySaladEntry
exports	apps/web/src/test/meal-fixtures.ts	wednesdayZitiEntry
```
Each is used nowhere after B (they existed only to build the three fixtures; `git grep -w` outside the file finds only a *comment* mention of `CURRENT_WEEK_SUNDAY` at `apps/web/src/test/chore-fixtures.ts:8`). Treat each as its own ledger row with the three-part proof, then delete the whole declarations (D-10: nothing uses them in-file either). Judgement call for the planner: `chore-fixtures.ts:7-9` explains that `TODAY` is "the same one `meal-fixtures.ts` uses as `CURRENT_WEEK_SUNDAY`". Recommended: remove `CURRENT_WEEK_SUNDAY` too and reword that one comment in the same commit (D-16 covers "anything Phase 3's own removals orphan"); the alternative is to keep it and list it for the owner. Either way the ledger must say which.

### D. Alias fold (D-03) — rehearsed
`bills-copy.ts:16-19` is
```
16: export const BILLS_EMPTY_COPY =
17:   'Hearth tracks what you owe and when — it never pays a bill or touches your accounts. Add a bill to start.';
19: export const BILLS_LIST_EMPTY_COPY = BILLS_EMPTY_COPY;
```
[VERIFIED: apps/web/src/components/bills/bills-copy.ts:16-19]. Because the *canonical* name is the alias, the edit is: rename line 16 to `export const BILLS_LIST_EMPTY_COPY =`, keep the string and the JSDoc above it, delete line 19 and the blank line. The string value is byte-identical; the only consumer, `BillsIndexScreen.tsx:7` and `:152`, imports `BILLS_LIST_EMPTY_COPY`. knip's `duplicates` line disappears.

### E. Jobs barrel (D-02) — specified, not rehearsed
`apps/service/src/jobs/index.ts` re-exports, and `main.ts:16` is its only non-test importer (`import { createScheduler, type Scheduler } from './jobs/index.js';`). `index.test.ts` asserts these 15 runtime names exist: `withJobLock, runDispatchNotifications, runLogAutopay, autopayOccurrences, pruneCache, runPruneCache, readinessNotBuiltYet, runOnDemandRefresh, runRefreshDeals, planFlyerRefreshNotifications, planRefresh, createScheduler, DISPATCH_NOTIFICATIONS_SCHEDULE, PRUNE_CACHE_SCHEDULE, REFRESH_DEALS_SCHEDULE`. [VERIFIED: apps/service/src/jobs/index.ts:1-27, apps/service/src/jobs/index.test.ts:14-30]

Lines to drop (all have 0 importers through the barrel in both knip modes): types `LockOutcome, DispatchOutbox, DispatchOutcome, PushTransport, AutopayBillRow, LogAutopayOutcome, PruneOutcome, RefreshDeps, RefreshOutcome, JobName`, and the whole line `export type { JobDatabase, JobLogger } from './types.js';`. The type names inside a runtime `export { ... }` are edited in place (`type X` entries removed; keep the runtime names). `Scheduler` stays (imported by `main.ts`).

Open interpretation (A1): `pruneCutoffs` (a runtime value, 0 importers, not asserted by `index.test.ts`) is the 13th default-mode barrel finding. D-02 says "drop only re-export lines with no use anywhere ... and the like", and `pruneCutoffs` qualifies on use, so the recommendation is to drop it too; it is a one-token revert. Its defining module and `prune-cache.test.ts` are untouched.

Cascade watch: each defining module (`dispatch-notifications.ts`, `log-autopay.ts`, `prune-cache.ts`, `refresh-deals.ts`, `advisory-lock.ts`, `scheduler.ts`, `types.ts`) still uses these names in-file (`ignoreExportsUsedInFile: true`), so knip should not newly report them; the loop re-run proves it. If it does, apply D-10 (drop the `export` keyword).

### F. Package-surface findings (D-01, 35) — specified from file reads, not rehearsed

External import census, so "no importer anywhere" is checkable: files importing from `@hearth/matching` use only `normalize`, `matchIngredient`, `MatchCandidate`, `MatchOverride`; files importing from `@hearth/recurrence` use only `currentTurn, occurrenceToComplete, rebaseRotationOnEdit, occurrenceDate, occurrenceIndexAtOrAfter, occurrenceIndexAtOrBefore, currentBillOccurrence, previewOccurrences` and types `CalendarDate, Recurrence, RecurrenceUnit`. [VERIFIED: regex census over `apps/ packages/ supabase/ e2e/` this session]

| Group | Names | Nature of the finding | Proof status | Recommended action |
|-------|-------|-----------------------|--------------|--------------------|
| F1 matching barrel, runtime (10) | `BRANDS, DESCRIPTORS, UNITS, FUZZY_THRESHOLD, tokenSimilarity, tokensFuzzyMatch, normalizeTokens, singularize, stripPunctuation, tokenize` | The *barrel line* has no importer; the defining module's export is used internally and by tests via relative imports (`./normalize.js`, `./similarity.js`, `./data/*.js`) | Passes: no external import (census), knip 0 importers, in-package uses are relative | Remove the names from `packages/matching/src/index.ts` lines 1-6 only. Leave the defining modules alone. The `UNITS` text hit in `ItemSheet.tsx:37` is an unrelated local constant, not an import |
| F2 matching barrel, types (3) | `MatchDecision, MatchResult, MatchTargetKind` | Same, for the `export type { ... } from './matcher.js'` block | Passes | Reduce the block to `MatchCandidate, MatchOverride`. `MatchResult` is the return type of `matchIngredient`; external callers infer it |
| F3 recurrence barrel (4) | `currentTurnIndex`, types `BillOccurrenceState, ChoreOccurrenceState, RebasedRotation` | Same | Passes (`currentTurnIndex` appears only in `rotation.ts` and `rotation.test.ts` via `./rotation.js`) | Remove from `packages/recurrence/src/index.ts` lines 21, 23-27, 29-35. Keep `currentChoreOccurrence` and `rebaseRotationOnDeparture` (test-only, D-01 and D-04) |
| F4 shared type aliases (18) | `SessionResponse, ErrandStatus, JoinHouseholdRequest, CreateListRequest, ListsQuery, UpdateListRequest, MatchDecision, MatchTargetKind, AddToListRequest, MealPlanQuery, WeekAddToListRequest, TransferAdminRequest, DeletePushSubscriptionRequest, ParseRecipeRequest, RecipesQuery, ClientErrorRequest, QuietHours, SetActiveHouseholdRequest` | Each is `export type X = z.infer<typeof xSchema>;` with 1 occurrence (the declaration). `packages/shared/src/index.ts` is `export * from './api/*.js'`, so they are public only by that star | Passes: 0 text hits outside the defining line. For `ErrandStatus`, `MatchDecision`, `MatchTargetKind` the only other same-spelled declarations are independent ones in `apps/service/src/db/types.ts` (generated) and `packages/matching/src/matcher.ts`, which do not import the shared ones | Delete the whole alias line (D-10, nothing uses it); keep every `xSchema`. Type-only: cannot change runtime. See Assumption A2 about the documented schema/type pair convention |

Counts check: 10 + 3 + 1 + 3 + 18 = 35. [VERIFIED: matches the 35 `exports`/`types` lines under `packages/` in the fresh default summary]

Not touched (test-only, D-01/D-04): `normalizeTokens` in `normalize.ts`, `currentChoreOccurrence`, `rebaseRotationOnDeparture` (both files), `scrubFields`.

Net effect if A through F and the `tsx` removal land: default knip should fall from 54 to 1 (`tailwindcss`, kept by D-04): 54 - 3 (A) - 1 (D) - 13 (E) - 35 (F) - 1 (`tsx`) = 1. Rehearsal covered A, B, D only: 54 to 50 in the committed config. [VERIFIED for 54 to 50; ASSUMED for the rest]

## Dependencies (DEAD-03) — rehearsed

Current state, read this session:
```
supabase/seed/package.json:16:    "tsx": "4.23.13",
apps/service/package.json:18:    "db:seed": "tsx ../../supabase/seed/seed-users.ts",
```
[VERIFIED: supabase/seed/package.json:13-18, apps/service/package.json:18]

Rehearsal: delete line 16, run `pnpm install` (non-frozen), then `pnpm install --frozen-lockfile`.
- `git diff --stat`: `pnpm-lock.yaml | 3 ---`, `supabase/seed/package.json | 1 -` (4 deletions, nothing else).
- The lockfile hunk is exactly the seed importer's `tsx: specifier 4.23.13 / version 4.23.13` triple.
- `pnpm install --frozen-lockfile` exit 0; `pnpm --filter @hearth/seed typecheck` exit 0; `pnpm --filter @hearth/service typecheck` (which also runs `tsc --noEmit -p ../../supabase/seed`) exit 0; `pnpm --filter @hearth/service exec tsx --version` prints `tsx v4.23.13`.
- knip default drops the `devDependencies supabase/seed/package.json tsx` line (54 to 53) and adds nothing.
[VERIFIED: all run this session in a scratch worktree, since deleted]

Docker is unaffected: `docker/service.Dockerfile:17` runs `pnpm install --frozen-lockfile --offline ... --filter @hearth/service...`, which never includes `@hearth/seed`, and `.dockerignore` already excludes `supabase`. [VERIFIED: docker/service.Dockerfile lines 10-18 and .dockerignore]

`fuse.js` (D-06): `git grep -n -I -i 'fuse\.js'` outside `.planning/.claude` finds only the design-rationale comment at `packages/matching/src/similarity.ts:6` ("... over `fuse.js` — tied at 12/12 ..."); `packages/matching/package.json` lists only `fastest-levenshtein` as a dependency; the lockfile has no `fuse`. Keep the comment (Phase 5 owns comments). [VERIFIED]

`pnpm db:seed` is not exercised by any CI job (`ci.yml` never calls it; E2E seeds through `e2e/fixtures/e2e-seed.sql` via psql). D-07 asks that it "still work": on this box the achievable proof is that `tsx` resolves from `apps/service` and the seed typecheck passes; a full run needs a Supabase stack (Docker host or owner). See Assumption A4.

## Stale references and leftovers (DEAD-04, DEAD-05)

### Stale references
- Exactly two: `.dockerignore:24` (`BUILD_PROMPT.md`, last line) and `.prettierignore:4` (`BUILD_PROMPT.md`). `git log --all -- BUILD_PROMPT.md` prints nothing and the file does not exist, so it was never in the published history; the owner may still have an untracked local copy (Assumption A6). [VERIFIED: ran this session; `.dockerignore` and `.prettierignore` read]
- Sweep method: extracted every `apps|packages|docker|scripts|e2e|supabase|test|docs/...` path from all tracked config, doc, workflow, Dockerfile and source files on `origin/main` and tested existence. All remaining misses were relative paths (`test/fake-app.ts` meaning `apps/service/src/test/fake-app.ts`), generated directories, or fixtures inside a test that writes them. No further stale path. All other ignore-file entries (`dist`, `dev-dist`, `playwright-report`, `test-results`, `supabase/.temp`, `.branches`) are generated-output globs, not stale. [VERIFIED]
- Orphans created by this phase: the comment at `chore-fixtures.ts:7-9` (see C). No `docs/`, README or CONTRIBUTING mention of any removed export (searched all six proven-dead names and `BILLS_EMPTY_COPY`).

### Leftovers (D-14)
- `git ls-files -ci --exclude-standard` prints nothing. [VERIFIED]
- Pattern audit regex over `git ls-files` (`.tsbuildinfo, .log, .bak, .orig, .rej, .swp, ~, .DS_Store, .tmp, .old, .dump, .sql.gz, dist/, dev-dist/, coverage/, playwright-report, test-results, .idea/, .vscode/, package-lock.json, yarn.lock, npm-shrinkwrap, bun.lockb, .env*`): only `.env.example` (intended). One lockfile: `pnpm-lock.yaml`. [VERIFIED]
- Largest tracked files are e2e Flipp raw captures (1.2 MB max) and the lockfile: D-10 fixtures, keep. Tracked generated-by-design: `apps/service/src/db/types.ts`, `apps/web/public/icons/*.png` (made by `apps/web/scripts/generate-icons.mjs`, script `icons` in `apps/web/package.json:13`).
- Tracked `.planning/cleanup/jscpd/**/jscpd-report.json` and `.planning/cleanup/knip/*.json` are Phase 2 evidence artifacts under `.planning/`, which D-14's pattern audit treats as out of scope; mention them in the ledger as intentional so the owner is not surprised. `.planning/cleanup/logs/` is gitignored (`.gitignore`).
- Every non-TS helper that looked orphaned is referenced: `apps/web/scripts/check-build.mjs` (`apps/web/package.json:8`), `generate-icons.mjs` (`:13`), `test/test-now.mjs` (imported by `clock-setup.mjs:42` and `global-tz.mjs:20`), `supabase/seed/compute-readiness.ts` (`seed-users.ts:23`), `apps/service/scripts/normalize-fixtures.ts` (`apps/service/package.json:19`). [VERIFIED]

## `scripts/knip-summary.mjs` (D-09)

- **Source exists in this container:** `/home/user/hearth-aside/bin/knip-summary.mjs` (39 lines, mode 644, sha256 `74b6e969750cbc6115bae9c2c810a7cb709469aba2858013016a3ea90cd8cb12`). It is lost with the container, so copy it in the first task. [VERIFIED: file read and hashed this session]
- **Reproducibility proof:** running it on all six recorded raw reports (`default`, `production`, `calibration-default`, `calibration-production`, `calibration-canary-default`, `calibration-canary-production`) reproduces the recorded `*-summary.txt` files byte-for-byte (`cmp` identical for each). Copy it verbatim; do not rewrite it. [VERIFIED]
- **Required output format** (if it ever has to be recreated): input `knip --reporter json` shape `{ issues: [{ file, <kind>: [...] }] }`; output one line per finding `kind<TAB>path<TAB>symbol`, where `files` entries take the path from `entry.name`, array entries (the `duplicates` kind) join their `name`s with `|`, and entries without a name use `-`; sort by kind, then path, then symbol as plain string comparison; final line `total<TAB>N<TAB>-`; trailing newline. Usage `node scripts/knip-summary.mjs <in.json> <out.txt>`; exit 2 with a usage message on missing args.
- **Repo fit:** `eslint.config.js:85-90` applies `files: ['**/*.js', '**/*.mjs']` with `disableTypeChecked` and node globals, so the file lints like `scripts/test-sweep.mjs`; ESLint has no `no-console` rule. It uses single quotes and fits `printWidth: 100`, but run `pnpm format:check` to confirm. [VERIFIED: eslint.config.js:85-90 read; formatting not yet checked]
- **Mode:** it has a shebang, so commit it executable: `git add --chmod=+x scripts/knip-summary.mjs` and check `git ls-files -s` shows `100755` (CONTRIBUTING "Scripts", GIT-04). `scripts/test-sweep.mjs` is 100644 (no shebang); do not copy that mode.
- **knip must not flag the new file.** `knip.json` root `entry` lists only `test/*.mjs!` and `scripts/test-sweep.mjs!`, and knip reports orphan files even in default mode (calibration canary). `scripts/test-sweep.mjs` is safe because root `package.json` scripts reference it (`--debug` shows `deferResolveEntry:scripts/test-sweep.mjs (package.json)` and a "Remove redundant entry pattern" hint for it). Same mechanism, no `knip.json` change (D-08): add `"knip:summary": "node scripts/knip-summary.mjs"` to root `package.json` scripts. Not yet tested for the new file (Assumption A3); the failing direction is a `files scripts/knip-summary.mjs` line in default knip output.
- **Optional hardening:** a `node --test` golden test (`scripts/knip-summary.test.mjs`) on a 6-line fixture JSON, added to the `test:harness` list at root `package.json:16`; covers sort order, `|` join for duplicates, `files` path source, and the `total` line. Discretionary.

## `db:types` evidence (D-15)

- Script: `apps/service/package.json:17` runs `kysely-codegen --dialect postgres --url "${HEARTH_DB_ADMIN_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}" --include-pattern "public.*" --date-parser string --out-file src/db/types.ts && prettier --write src/db/types.ts`; `supabase/config.toml` sets `[db] port = 54322`, `major_version = 17`. [VERIFIED: apps/service/package.json:17; supabase/config.toml:13-16]
- CI's `test-integration` job already runs `supabase start` (`ci.yml:68-69`), so the default URL works after that step.
- Cannot run here: no Docker daemon (`docker ps` fails: cannot connect to `/var/run/docker.sock`), although PostgreSQL 16 server binaries exist under `/usr/lib/postgresql/16` and `psql` is installed. A hand-built local Postgres would lack the Supabase `auth`/`realtime` schemas and roles the migrations assume, so its output would not be comparable to the committed file; do not use it as evidence.
- Recipe for the throwaway draft PR (branch off the PR-2 tip; never merge; close after reading the log). Insert after the `Start Supabase` step in `test-integration`:
```yaml
      - name: db:types determinism (throwaway)
        run: |
          set -euo pipefail
          pnpm db:types
          cp apps/service/src/db/types.ts "$RUNNER_TEMP/types-run1.ts"
          git diff --stat -- apps/service/src/db/types.ts
          pnpm db:types
          diff "$RUNNER_TEMP/types-run1.ts" apps/service/src/db/types.ts && echo "run1 == run2"
          git diff --exit-code -- apps/service/src/db/types.ts && echo "run2 == committed"
```
  Expected: `run1 == run2` and `run2 == committed`. A non-empty `git diff --stat` after run 1 means committed types drifted from migrations (then the schema or file needs a decision, not a silent regenerate); `run1 != run2` means the output is non-deterministic and CI-03 must not gate on it. Do not rename the `CI` workflow or any job id (STATE.md decision; `deploy.yml` triggers on workflow name `CI`). Note `ci.yml` has `cancel-in-progress` on PRs, so a later push cancels an in-flight run.
- Record the run id and verdict in the ledger.

## Landing mechanics (D-13)

- Branches: `git worktree add ../hearth-{topic} -b {type}/{topic} origin/main` per CONTRIBUTING; run `pnpm install` in each new worktree so Husky hooks exist. Never `--no-verify`. The pre-commit hook runs `pnpm exec lint-staged` and `pnpm typecheck` (`.husky/pre-commit`).
- Commit messages: types `feat|fix|docs|refactor|test|chore|perf|build|ci`; the closed scope list is `web, service, shared, recurrence, matching, db, e2e, docker` (no `deps`, `scripts` or `knip` scope: root/tooling commits go scope-less, e.g. `build: drop unused tsx from the seed package`); subject max 71 characters, body lines max 100, no trailing period. Multi-scope headers such as `refactor(shared,matching): ...` pass (Phase 1 precedent). [VERIFIED: commitlint.config.js:5-17]
- Put the proof into each commit body: item names, then one line each for the three proof results, so a revert is surgical (D-12).
- `.planning/` ledger edits go in separate commits on the working branch, never in the code PRs. Note that any `main` commit touching a non-`docs/` path triggers Deploy, including a `.planning/`-only one; the Deploy job currently waits for an unregistered self-hosted runner and does nothing.
- CI gates per PR: `lint`, `typecheck`, `test-unit`, `test-integration`, `test-e2e` (builds the service and Caddy images through `docker compose up --build`: this is the only Docker-build evidence), `build`. [VERIFIED: ci.yml:17-70 and `e2e/setup/stack.ts:147`]
- Expect to re-run `test-e2e` once or twice: the image pre-pull step fails on ECR rate limits (run `39298718857`, step "Run set -euo pipefail", six attempts at 30 to 150 s backoff, 18:00 to 18:07). Use `gh run rerun <id> --failed`. GraphQL is blocked from this environment, so `gh pr list` fails; use `gh api repos/{owner}/{repo}/...` REST routes or `gh run ...`.
- Dependabot PR (branch `dependabot/npm_and_yarn/npm-9dcceea590`, CI red on 2026-10-19) also edits `package.json`/`pnpm-lock.yaml` and includes `tsx`; whichever merges second rebases the lockfile with `pnpm install`. Not blocking.
- `supabase/migrations/` must show an empty diff: `git diff --stat origin/main...HEAD -- supabase/migrations` prints nothing (gate in the Validation section).
- The web bundle has a size budget; `pnpm --filter @hearth/web build` ended with `App shell 198.0 KB gzipped (budget 200 KB)`. Removals only shrink it, but it is the reason not to add anything to `apps/web` in this phase. [VERIFIED: build output this session]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | yes | v24.21.0 | — |
| pnpm | install, scripts | yes | 10.34.5 | — |
| git | proofs, worktrees | yes | — | — |
| knip | evidence | yes (devDependency) | 6.41.0 | — |
| gh CLI | CI status, re-runs | yes (REST only; GraphQL blocked) | — | `gh api repos/...` |
| supabase CLI | local stack | binary present (`/usr/local/bin/supabase`) | 2.117.0 per baseline | needs Docker, so unusable here |
| psql | `db:seed`, e2e seed | yes (`/usr/bin/psql`) | — | — |
| Docker daemon | integration, E2E, image builds, `db:types` | **no** (client installed, daemon unreachable) | — | PR CI only (D-13) |
| PostgreSQL server | — | binaries for 16 exist | 16 | Not a substitute for the Supabase stack (version 17 plus auth/realtime schemas) |

**Missing with no fallback on this box:** Docker. Integration tests, E2E, both Docker builds and `db:types` evidence come from PR CI. Only `test-unit`-equivalent commands run locally.

## Validation Architecture

Framework: Vitest 5.0.1 (web: jsdom; service/packages: node) plus `node --test` for the root harness; E2E is Playwright. Config files: `apps/*/vitest.config.ts`/`vite.config.ts`, `apps/service/vitest.integration.config.ts`, `e2e/playwright.config.ts`. Quick run: `pnpm typecheck && pnpm lint && pnpm format:check` (about 70 s together) plus the targeted suite; full local run: `pnpm test` (about 97 s, 6 packages, all green on `origin/main`: web 56 files/715 tests, service 55/725, shared 148, recurrence 77, matching 156, harness+e2e-unit 15). [VERIFIED: ran this session]

### Local versus CI-only

| Check | Local (cloud box) | PR CI only |
|-------|-------------------|------------|
| `pnpm install --frozen-lockfile` | yes (rehearsed, exit 0) | `lint`/`typecheck`/`test-unit`/`build` each run it |
| `pnpm typecheck` | yes (15 s) | `typecheck` job |
| `pnpm lint`, `pnpm format:check` | yes (46 s, 8 s) | `lint` job |
| `pnpm test` (unit, harness) | yes | `test-unit` job |
| `pnpm --filter @hearth/web build` | yes | `build` job (`pnpm build` also builds service, runs `write-openapi`) |
| `pnpm knip`, `pnpm knip:production`, trace commands | yes | not in CI (CI-01 is Phase 6) |
| `git ls-files -ci --exclude-standard`, pattern audit, `git grep` proofs | yes | not in CI (CI-03 is Phase 6) |
| `pnpm test:sweep` (date and zone matrix) | yes for unit suites | not in CI until TIME-06 |
| Integration suite and coverage thresholds | no | `test-integration` |
| E2E and both Docker image builds | no | `test-e2e` |
| `db:types` regenerate twice and diff | no | throwaway draft-PR step |
| `pnpm db:seed` end to end | no | not covered by any CI job |

### Phase Requirements to Test Map

| Req ID | Behavior | How verified | Expected | Failing direction |
|--------|----------|--------------|----------|-------------------|
| DEAD-01 | No proven-dead file remains | `pnpm knip` and `pnpm knip:production`, pipe through `node scripts/knip-summary.mjs`, `grep -P '^files\t'` | default: no lines; production: only `apps/service/src/deals/flipp/normalized-fixtures.ts` | any other `files` line, including `scripts/knip-summary.mjs` if it was not made an entry |
| DEAD-02 | Each removed export/type passed the three parts; none remain | per item: throwaway-config `--trace-export` (`(no imports found)`), `git grep -n -I -w -F -e NAME -- . ':!pnpm-lock.yaml' ':!.planning' ':!.claude'` (definition only), then `pnpm typecheck && pnpm lint && pnpm test` and the web build; at the end diff knip summaries against `.planning/cleanup/knip/default-summary.txt` | removed lines equal the ledger exactly; throwaway-config run shows no `exports apps/*/src/test/*` and no ledger item | a new finding after an edit (cascade, keep looping); typecheck/test failure (item goes to the owner list, edit reverted); a ledger item missing one of the three results |
| DEAD-03 | Dependency removed with lockfile, install frozen-clean | `pnpm install --frozen-lockfile` exit 0; `git show --stat <commit>` lists `supabase/seed/package.json` and `pnpm-lock.yaml` together; `grep -c fuse pnpm-lock.yaml` equals 0; `pnpm --filter @hearth/service typecheck`; `pnpm --filter @hearth/service exec tsx --version` | 4 deletions total, install exit 0, `tsx v4.23.13` | `ERR_PNPM_OUTDATED_LOCKFILE` (lockfile not updated in the same commit); a knip `unlisted tsx` or `unresolved` line |
| DEAD-04 | No ignore-file or config reference to a missing path | `git grep -n -I BUILD_PROMPT -- . ':!.planning' ':!.claude'` plus the path-existence sweep; `pnpm format:check` | empty output; clean format | any hit; a `chore-fixtures.ts` comment naming a deleted export |
| DEAD-05 | No tracked-ignored or generated leftovers; `db:types` reproducible | `git ls-files -ci --exclude-standard` (empty); the pattern-audit regex (only `.env.example`); CI throwaway step prints `run1 == run2` and `run2 == committed` | as stated | any listed file; a non-empty `git diff` on `apps/service/src/db/types.ts` |
| DEAD-06 | Uncertain items reported and not deleted | (a) `OWNER-CANDIDATES.md` refreshed against the final tree; (b) every finding left in the final default and production summaries appears by name in `OWNER-CANDIDATES.md` or the ledger; (c) `git diff --name-status origin/main...HEAD` shows no `D` for any path on the D-10 standing list (`docker/*`, `scripts/deploy.sh`, `scripts/generate-secrets.sh`, `supabase/**`, `e2e/fixtures/**`, `apps/service/src/db/types.ts`, `apps/service/src/push/web-push.d.ts`, `apps/service/src/deals/flipp/**`, `apps/service/src/recipes/fixtures/**`) | (a) three stale entries removed, (b) zero unmatched, (c) no matches | an unmatched finding; a `D` on a protected path |
| Phase gate | No migration diff, no behavior change, suites green | `git diff --stat origin/main...<tip> -- supabase/migrations` prints nothing; six CI jobs green on each PR; `pnpm test:sweep` on the final tree | empty diff; green | any migration path in the diff; a red `test-e2e` for a reason other than the registry pre-pull flake |

### Sampling Rate
- **Per task commit:** `pnpm typecheck && pnpm lint && pnpm format:check`, plus `pnpm --filter <pkg> test` for the touched package, plus knip (committed and throwaway config).
- **Per PR (before opening):** full `pnpm test`, `pnpm --filter @hearth/web build`; then PR CI (all six jobs).
- **Phase gate:** all three PRs merged green, final knip summaries diffed and archived under `.planning/cleanup/knip/`, ledger and owner list complete, then `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `scripts/knip-summary.mjs` (copy verbatim) plus root `knip:summary` script: needed by every later evidence step
- [ ] Throwaway-config generator snippet (documented above; not committed)
- [ ] `.planning/cleanup/REMOVAL-LEDGER.md` skeleton with columns: item, kind, tool evidence, text-search evidence, build/test evidence, commit, PR
- [ ] Optional golden test for `knip-summary.mjs`

## Security Domain

`security_enforcement` is enabled (absent means enabled; `.planning/config.json` sets it true, `security_asvs_level: 1`). This phase deletes code and one dependency declaration; it adds no runtime code, network surface or secret handling.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes (indirectly) | Keep the service-role fence: removals must not touch `apps/service/src/privileged/**` or the `eslint.config.js` `no-restricted-imports` block (lines 96-133); lint stays green |
| V2/V3/V4 Auth, session, access control | no | No auth or RLS code is edited; `supabase/migrations/` diff must stay empty |
| V5 Input validation | no | Zod schemas are kept; only `z.infer` type aliases in `packages/shared` go (erased at compile time) |
| V14 Configuration / supply chain | yes | Removing `tsx` from `supabase/seed` shrinks the dev surface; no new packages; lockfile changes only by the 3-line importer entry |

| Threat pattern | STRIDE | Mitigation |
|----------------|--------|------------|
| Deleting a string-reachable or config-reachable file that guards a control (Kong/Caddy/SQL/fixtures) | Tampering / Elevation | D-10 standing list is never deleted; guard (c) in DEAD-06 fails the phase on any `D` there |
| Removing a type alias that a runtime schema parse depended on | Tampering | Only `export type` aliases are removed, never schemas; `pnpm typecheck` and the full suites gate each commit |
| Lockfile tampering through a hand edit | Tampering | Regenerate with `pnpm install`; CI runs `--frozen-lockfile` |

## Common Pitfalls

### Pitfall 1: Trusting the committed-config knip run for anything under a `test/` directory
**What goes wrong:** it reports nothing for `apps/web/src/test/**`, `apps/service/src/test/**`, root `test/**`, so cascade deadness there is invisible; the phase would claim "no remaining findings" falsely.
**Why:** the `node` plugin's `**/test/**` entry pattern, triggered by root `test:harness`.
**How to avoid:** run both configs at every loop iteration; the throwaway run differs from the committed run by exactly the 3 meal fixtures today (57 vs 54), so any larger gap after removals means new hidden items.
**Warning signs:** `No export X found` from `--trace-export`.

### Pitfall 2: Deleting a declaration and leaving orphaned imports
**What goes wrong:** `useFavoriteStores` leaves `favoriteStoreListSchema` and `FavoriteStore` imported; `ChoreLike` leaves `ChoreDetail`; the meal fixtures leave `MealPlanWeekResponse`. `eslint`/`tsc` fail or warn (`--max-warnings=0`).
**How to avoid:** edit imports in the same commit; the per-commit lint run catches it. Note the schema `favoriteStoreListSchema` must NOT be removed from `packages/shared` (used by `contract.ts:837`).

### Pitfall 3: "Fixing" the hidden-entry side effect in committed `knip.json`
**What goes wrong:** with `node: false` committed, production mode newly flags `test/support/vitest-project.mjs` as an unused file (it is imported by three `*.test.mjs` harness tests, and listed in `docs/file-map.md:202`). [VERIFIED: appeared as an extra `files` line in the throwaway production run]
**How to avoid:** leave `knip.json` alone (D-08); that decision belongs to Phase 6 with the blocking check.

### Pitfall 4: Cutting branches from the working branch
**What goes wrong:** `claude/trusting-lovelace-y4r87h` lacks `7d14b77` (it changes `test/clock-setup.mjs`, `scripts/test-sweep.mjs`, harness tests and docs), and `origin/main` lacks the newer `.planning/` files. A PR from the working branch would drag `.planning/` into the diff, violating D-13, or revert `7d14b77`.
**How to avoid:** `git fetch origin`, merge `origin/main` into the working branch (precedent: `141b818`), but cut the three code branches from `origin/main`.

### Pitfall 5: Treating a red `test-e2e` as a code failure
**What goes wrong:** the ECR pre-pull flake fails the job before any test runs, which looks like a regression from the removals.
**How to avoid:** read the failing step; "Run set -euo pipefail" with `toomanyrequests` means rerun, not revert.

### Pitfall 6: Counting hits inside the same-name collisions
`UNITS` (local constant in `ItemSheet.tsx`), `MatchDecision`/`MatchTargetKind`/`ErrandStatus` (independent declarations in `db/types.ts` and `matcher.ts`), and `pruneCache` as an object key in `scheduler.ts` give `-w` text hits that are not references. Record them as "same spelling, different symbol" in the ledger instead of failing the proof, and show the import census as the real evidence.

### Pitfall 7: Docs-only commit exemption assumed for `.planning/`
Only `docs/` is exempt from deploy (`deploy.yml`: `grep -qv '^docs/'`). A `.planning/`-only commit on `main` still runs CI and queues Deploy.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding unused exports/files/deps | A custom AST scanner | knip 6.41.0 `--trace-*`, plus `git grep` | Calibrated in Phase 2; canaries pass |
| Normalizing knip JSON | A new script | the existing `knip-summary.mjs`, verbatim | Byte-identical reproduction of six recorded summaries |
| Lockfile edits | Hand-editing `pnpm-lock.yaml` | `pnpm install` | Deterministic; CI uses `--frozen-lockfile` |
| `db/types.ts` regeneration | Hand edits | `pnpm db:types` in CI | Generated file, header says do not edit |
| Proving config-reachable code dead | Heuristics | Do not prove it: owner list | D-05, D-10 |

**Key insight:** the risk in this phase is false confidence, not tooling gaps. Each deletion is easy; what needs engineering is the proof loop (two knip configs, text search, build) and the stop rule (anything unproven stays and is listed).

## Code Examples

### Three-part proof for one item (copy for the ledger)
```bash
# 1 importer evidence (committed config AND throwaway node:false config)
pnpm --silent knip --trace-export useFavoriteStores
pnpm --silent knip --config knip.nonode.tmp.json --trace-export useFavoriteStores
# 2 text search, every tracked type, planning dirs and lockfile excluded
git grep -n -I -w -F -e useFavoriteStores -- . ':!pnpm-lock.yaml' ':!.planning' ':!.claude'
# 3 relevant gate after the edit
pnpm typecheck && pnpm lint && pnpm format:check && pnpm --filter @hearth/web test
```
Verified output for item 2 on `origin/main`: one line, `apps/web/src/lib/api/deals.ts:172:export function useFavoriteStores(`.

### Zero-diff guards for the phase gate
```bash
git diff --stat origin/main...HEAD -- supabase/migrations      # must print nothing
git ls-files -ci --exclude-standard                            # must print nothing
git diff --name-status origin/main...HEAD | grep -E '^D\s+(docker/|supabase/|scripts/deploy.sh|scripts/generate-secrets.sh|e2e/fixtures/|apps/service/src/db/types.ts|apps/service/src/push/web-push.d.ts|apps/service/src/deals/flipp/|apps/service/src/recipes/fixtures/)' && echo FAIL
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single knip run as the dead-code verdict | Two configs plus text search plus build | This repo, since `test:harness` landed (PR #8) | Hidden `test/**` exports need the throwaway config |
| `fuse.js` benchmark script in `packages/matching/scripts/` | deleted | `d8f3daf` | DEAD-03 fuse part is a re-check only |
| `vitest` resolved through hoisting | declared at root | Phase 2 D-16 (`package.json:44`) | `unlisted vitest` finding gone |

**Deprecated:** the "Standing list" entry for `fuzzy-benchmark.ts` and the `fuse.js`/`vitest` owner rows are obsolete.

## Owner list refresh (DEAD-06)

Edit `.planning/cleanup/OWNER-CANDIDATES.md` in place on the working branch (never in `docs/`):
- Remove: `packages/matching/scripts/fuzzy-benchmark.ts:fuse.js` (unlisted finding), the standing-list item `packages/matching/scripts/fuzzy-benchmark.ts`, and `test/clock-setup.mjs:vitest`.
- Resolved by decision, move to the ledger as removed: the 13 jobs-barrel rows (if E lands), the `BILLS_EMPTY_COPY|BILLS_LIST_EMPTY_COPY` row, `supabase/seed/package.json:tsx`, and the package-surface rows that pass (F1 to F4).
- Keep, with refreshed evidence: `apps/web/package.json:tailwindcss` (`apps/web/src/index.css` line 1 `@import 'tailwindcss'`), the three Flipp fixture rows, the 19 test-only rows, the 4 package test-only rows, and every standing-list entry except the fuzzy-benchmark one.
- Add one new entry so the owner sees the hidden-entry class: "exports under any `test/` directory are invisible to the committed knip config (node plugin pattern `**/test/**` from `test:harness`); today that hid only the three meal fixtures; Phase 6 decides the config change".
- Add the cascade rows from C if any are kept rather than removed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-02's "and the like" covers `pruneCutoffs` (a runtime re-export with 0 uses) | Removal worklist E | Owner expected it kept; one-token revert |
| A2 | Deleting the 18 `export type X = z.infer<...>` aliases in `packages/shared` is acceptable even though CLAUDE.md documents a schema/type pair convention ("`createBillRequestSchema` / `CreateBillRequest`") | F4 | Owner prefers the convention; fallback is to leave them on the owner list and let Phase 6 configure knip instead. Type-only, so no runtime risk either way |
| A3 | Adding root script `knip:summary` makes knip treat `scripts/knip-summary.mjs` as an entry (inferred from how `scripts/test-sweep.mjs` is handled; not run on the new file) | knip-summary section | knip reports the new file as unused; fix by pointing a script at it or, in Phase 6, an entry pattern |
| A4 | No CI job exercises `pnpm db:seed`; PR CI therefore cannot prove D-07's "db:seed still works" | Dependencies | Evidence gap; closed only by a manual run on a Docker host or accepting typecheck plus `tsx` resolution |
| A5 | `kysely-codegen` output is deterministic and equals the committed `types.ts` | `db:types` section | Unknown until the throwaway CI run; Phase 6 must not gate on it if not |
| A6 | `BUILD_PROMPT.md` was never tracked, so the owner may hold an untracked local copy that `prettier --check .` would start flagging once `.prettierignore:4` goes | Stale references | Local-only nuisance; move the file or ignore it locally |
| A7 | E and F edits (barrels, shared aliases) will not trigger new cascade findings beyond what the fixed-point loop catches | E, F | Extra iterations; mitigated by the loop |
| A8 | Cascade item `CURRENT_WEEK_SUNDAY` is better removed (with a one-line comment fix) than kept | C | Owner may want the named anchor kept; ledger records either |

## Open Questions

1. **DEAD-05 wording versus CI-03 ownership.**
   - Known: REQUIREMENTS.md DEAD-05 says "`db/types.ts` has a drift check"; ROADMAP success criterion 3 says "regenerating `db/types.ts` produces no diff"; D-15 and the deferred list put the permanent check in Phase 6 (CI-03).
   - Unclear: whether the owner treats the one-off CI evidence as satisfying DEAD-05.
   - Recommendation: satisfy DEAD-05 with the one-off evidence, and record in the phase verification that the permanent check is CI-03 by decision D-15. Do not add a blocking CI step in Phase 3.
2. **Package-surface policy (F1 to F4).** Remove all 35 under D-01, remove only F1 to F3 (barrel lines) and leave the 18 shared aliases on the owner list, or leave all 35 and let Phase 6 tune `includeEntryExports`. Recommendation: remove all 35; every item meets the written D-01 proof and all of them are compile-time or barrel-line changes with trivially reversible commits (one commit per group).
3. **`CURRENT_WEEK_SUNDAY` comment** (Assumption A8) and `pruneCutoffs` (A1): confirm in plan review.
4. **Pending cleanup of the merge target.** The working branch must absorb `origin/main` before ledger commits are made, otherwise ledger rows cite a tree that differs from the code PRs' base.

## Project Constraints (from CLAUDE.md)

Directives that bind this phase (from `./.claude/CLAUDE.md`):
- No behavior change except documented bugs; dead-code removal requires tooling or test proof; ambiguous cases are reported, not deleted.
- Every bug fix needs a regression test (n/a here); full suite and CI stay green.
- Work on branches/worktrees and land through PRs per `CONTRIBUTING.md`; never force-push or rewrite published history; `main` deploys on every push except `docs/`-only.
- Specs in `docs/` are the only source of truth; no review, decision-log or ADR files are added there.
- ESLint `--max-warnings=0`; Prettier single quotes, `printWidth: 100`; strict TS (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`); named exports only; no `console.*` in shipped code (scripts allowed); do not hand-edit `apps/service/src/db/types.ts`.
- Test-time rule: no bare `new Date()`/`Date.now()` in tests; do not set `TZ` by hand.
- GSD enforcement: file edits only through a GSD workflow (this research made none in the repo).
- Do not rename the `CI` workflow or its job ids (STATE.md).

## Sources

### Primary (HIGH confidence): all verified by running or reading this session
- `origin/main` @ `7d14b77` detached worktree: `pnpm install --frozen-lockfile`, `pnpm knip`, `pnpm knip:production`, `knip --debug`, `knip --trace-export/--trace-file`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm --filter @hearth/web build`, tsx-removal rehearsal, web-side removal rehearsal (worktree deleted afterwards)
- Files read: `.planning/phases/03-evidence-gated-removal/03-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` (Phase 3 and 6 entries), `.planning/cleanup/{TRIAGE,OWNER-CANDIDATES,BASELINE}.md`, `knip.json`, root `package.json`, `apps/service/package.json`, `supabase/seed/package.json`, `packages/matching/package.json`, `eslint.config.js`, `commitlint.config.js`, `.github/workflows/{ci,deploy}.yml`, `CONTRIBUTING.md`, `.dockerignore`, `.prettierignore`, `.gitignore`, `docker/service.Dockerfile`, `docker/caddy.Dockerfile`, the barrels of `packages/{matching,recurrence,shared}` and `apps/service/src/jobs`, and the definition sites quoted above
- GitHub Actions: run `39298718857` (failed log tail, ECR `toomanyrequests`), run `39267711034` (PR, all green)

### Secondary (MEDIUM confidence)
- None used.

### Tertiary (LOW confidence)
- None; all unverified inferences are in the Assumptions Log.

No external documentation lookup was needed: every question was about this repository's own state or the observable behavior of the installed knip 6.41.0, which I tested directly rather than reading about.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, nothing new is installed; versions read from the repo.
- Architecture (proof loop and landing): HIGH, each step was executed on a scratch checkout, except the barrel/shared edits (MEDIUM, specified from file reads).
- Pitfalls: HIGH, each one was observed (hidden entry, orphaned imports, vitest-project false positive, ECR flake, branch divergence).

**Research date:** 2026-10-19
**Valid until:** until `origin/main` moves again or Dependabot PR #9 lands (re-run the drift table's knip commands first); otherwise stable for 30 days.
