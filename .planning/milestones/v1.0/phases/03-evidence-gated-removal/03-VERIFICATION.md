---
phase: 03-evidence-gated-removal
verified: 2026-10-20T00:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .dockerignore
  - .planning/phases/03-evidence-gated-removal/03-01-PLAN.md
  - .planning/phases/03-evidence-gated-removal/03-01-SUMMARY.md
  - .planning/phases/03-evidence-gated-removal/03-02-PLAN.md
  - .planning/phases/03-evidence-gated-removal/03-02-SUMMARY.md
  - .planning/phases/03-evidence-gated-removal/03-03-PLAN.md
  - .planning/phases/03-evidence-gated-removal/03-03-SUMMARY.md
  - .planning/phases/03-evidence-gated-removal/03-04-PLAN.md
  - .planning/phases/03-evidence-gated-removal/03-04-SUMMARY.md
  - .planning/phases/03-evidence-gated-removal/03-05-PLAN.md
  - .planning/phases/03-evidence-gated-removal/03-05-SUMMARY.md
  - .planning/phases/03-evidence-gated-removal/03-06-PLAN.md
  - .planning/phases/03-evidence-gated-removal/03-06-SUMMARY.md
  - .planning/phases/03-evidence-gated-removal/03-07-PLAN.md
  - .planning/phases/03-evidence-gated-removal/03-07-SUMMARY.md
  - .planning/phases/03-evidence-gated-removal/03-08-PLAN.md
  - .planning/phases/03-evidence-gated-removal/03-08-SUMMARY.md
  - .planning/phases/03-evidence-gated-removal/03-09-PLAN.md
  - .planning/phases/03-evidence-gated-removal/03-09-SUMMARY.md
  - .prettierignore
  - apps/service/src/jobs/index.ts
  - apps/web/src/components/bills/bills-copy.ts
  - apps/web/src/components/chores/chore-copy.ts
  - apps/web/src/lib/api/deals.ts
  - apps/web/src/lib/offline/write-queue.ts
  - apps/web/src/test/chore-fixtures.ts
  - apps/web/src/test/meal-fixtures.ts
  - docs/file-map.md
  - package.json
  - packages/matching/src/index.ts
  - packages/recurrence/src/index.ts
  - packages/shared/src/api/auth.ts
  - packages/shared/src/api/errands.ts
  - packages/shared/src/api/households.ts
  - packages/shared/src/api/lists.ts
  - packages/shared/src/api/matching.ts
  - packages/shared/src/api/meal-plan.ts
  - packages/shared/src/api/membership.ts
  - packages/shared/src/api/notifications.ts
  - packages/shared/src/api/recipes.ts
  - packages/shared/src/api/system.ts
  - packages/shared/src/api/users.ts
  - pnpm-lock.yaml
  - scripts/knip-summary.mjs
  - supabase/seed/package.json
covered_digest: "v3:sha256:0739eb79ac038e2db0baf59bb53e993945717d821cd4807f41edfaeb43a94fd3"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 3: Evidence-Gated Removal Verification Report

**Phase Goal:** The repo contains no files, exports, dependencies, or references that tooling and tests prove dead, and everything uncertain is on a list for the owner rather than deleted.
**Verified:** 2026-10-20
**Status:** passed
**Re-verification:** No, initial verification

**Method.** Code reality is `origin/main` at `9819e7c1436a8ad984f459c9fcb3e62fa68e0806` (the tip after PR #12, #13, #14). I verified it in a detached read-only worktree (removed afterwards), not from the SUMMARY files. The phase diff is `7d14b77..9819e7c` (3 commits, 27 files: 26 modified, 1 added, 0 deleted, 0 renamed).

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Each proven-dead file, export, and type is removed only with three-part proof, and re-running knip reports no remaining proven-dead findings | VERIFIED | Re-ran knip on a clean install of `9819e7c`. Default: 1 finding (`devDependencies apps/web/package.json tailwindcss`), production: 28, node-plugin-off config (`.planning/cleanup/logs/03-knip.nonode.json`): 1. Normalized with `scripts/knip-summary.mjs`, all three outputs are byte-identical to `phase3-after-{default,production,nonode}-summary.txt`. `tailwindcss` is a documented knip false positive: `apps/web/src/index.css` line 1 is `@import 'tailwindcss';`. Every one of the 28 production lines, plus `tailwindcss`, is on `OWNER-CANDIDATES.md` (see truth 4). Text search of the tree outside `.planning/` for about 30 removed names finds no live reference (the only hits are same-named but separately defined types in `db/types.ts`, `matching/src/matcher.ts`, and a local `GREEK_SALAD_ID` in `planner.test.tsx`). The build and test leg of the proof held: `pnpm typecheck`, `pnpm lint` (`--max-warnings=0`), `pnpm format:check` pass, and `pnpm test` passes (matching 156, shared 148, recurrence 77, service 725, web 715). |
| 2 | Unused dependencies are removed with `pnpm-lock.yaml` updated in the same commit, and `pnpm install --frozen-lockfile` succeeds | VERIFIED | `supabase/seed/package.json` loses only `tsx` (`4.23.13`), in commit `51c077e` together with `pnpm-lock.yaml`. `tsx` is still declared in the service package, so it is removed from the seed package only. `pnpm install --frozen-lockfile` exits 0 on `9819e7c`. `fuse.js` is absent from every `package.json` and from `pnpm-lock.yaml`; the benchmark cluster itself was removed in Phase 2 (`d8f3daf`, before the Phase 3 base), and `packages/matching/scripts/` no longer exists. |
| 3 | Stale references such as `BUILD_PROMPT.md` in ignore files are gone, `git ls-files -ci --exclude-standard` lists nothing, and regenerating `db/types.ts` produces no diff | VERIFIED (db:types leg rests on owner-authorized local evidence) | `.dockerignore` and `.prettierignore` no longer name `BUILD_PROMPT.md` (commit `9819e7c`); `git grep -I BUILD_PROMPT` outside `.planning/` finds nothing. `git ls-files -ci --exclude-standard` prints nothing. `git diff --quiet 7d14b77 9819e7c -- supabase/migrations apps/service/src/db/types.ts` exits 0. I did not re-run `pnpm db:types` (it needs the local Supabase Docker stack). The ledger records two local runs against the migrated database, both byte-identical to the committed file (`dbtypes-run1-vs-run2=same`, `dbtypes-run2-vs-committed=same`, `dbtypes-diffstat=empty`), taken on a tree whose migrations and `types.ts` equal the final tree. This is the owner-accepted override of the CI-only rule; see DEAD-05 below. |
| 4 | The owner receives a list of candidates tooling could not prove dead, with evidence for each, and none were deleted | VERIFIED | `.planning/cleanup/OWNER-CANDIDATES.md` has an Uncertain section (knip findings with evidence and a question each, a `node`-plugin test-directory blind-spot note, and the standing list: `web-push.d.ts`, `db/types.ts`, `docker/*`, `scripts/*.sh`, `supabase/migrations/*.sql`, the fixture directories, `workbox-*`, the `esbuild` override), a Test-only table (19 rows), notes, and a Removed section (64 rows). Cross-check against the final summaries: the 9 production findings that are not test-only (`FIXTURE_NOW`, `NORMALIZED_FIXTURE_DIR`, `normalized-fixtures.ts`, `knip-summary.mjs`, `normalizeTokens`, `currentChoreOccurrence`, `rebaseRotationOnDeparture` x2, `scrubFields`) and the default `tailwindcss` finding are Uncertain entries, and the other 19 production findings (`jobs/index.ts` x14, `refresh-deals.ts`, `ingredient-parser.ts`, `chore-copy.ts` x2, `use-push-device.tsx`) are the 19 Test-only rows. 9 + 19 = 28. The phase diff has no deletions (`A` x1, `M` x26) and `git diff --stat` for `supabase/` is the single `tsx` line. |
| 5 | Typecheck, lint, unit, integration, and E2E suites and both Docker builds pass, with no diff under `supabase/migrations/` and no change in application behavior | VERIFIED (with accepted CI history, see warnings) | Main CI run on `9819e7c` (run attempt 2): `lint`, `typecheck`, `test-unit`, `test-integration`, `test-e2e`, `build` all `success`; E2E builds the service and Caddy images through the Compose overlay. `supabase/migrations/` has zero diff. Every removed symbol is an export, re-export, type alias, test fixture, ignore-file line, or dev dependency, and the graph that proves them dead is `tsc` and `eslint` clean, so no runtime path changed. The two non-test code edits besides barrels (`bills-copy.ts` alias merge, `chore-fixtures.ts` comment) are covered by typecheck and the web tests. |

**Score:** 5/5 truths verified (0 behavior-unverified).

### Requirements Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| DEAD-01 Proven-dead files are removed | SATISFIED | At the Phase 3 base the only knip `files` finding in production mode was `apps/service/src/deals/flipp/normalized-fixtures.ts`, which tests import (kept, owner list). Default mode had no `files` findings. No file was deleted by the phase. The earlier dead file (`packages/matching/scripts/fuzzy-benchmark.ts`) went in Phase 2. A recorded null result, consistent with the tree. |
| DEAD-02 Proven-dead exports and types are removed | SATISFIED | 61 exports, types and re-exports removed (rows 2 to 62 of the owner list "Removed" table, including the bills alias). Default knip went from 54 findings to 1. |
| DEAD-03 Unused dependencies are removed with the lockfile in the same commit | SATISFIED | Seed `tsx` (see truth 2); `fuse.js` already gone. |
| DEAD-04 Stale references are removed | SATISFIED | `BUILD_PROMPT.md` ignore entries (truth 3). |
| DEAD-05 No tracked generated or leftover files remain, and `db/types.ts` has a drift check | SATISFIED, with a judgment (below) | Leftover half independently confirmed. Drift half is a one-time local check. |
| DEAD-06 Candidates tooling cannot prove dead are reported to the owner, not deleted | SATISFIED | Truth 4. |

No orphaned requirements: DEAD-01 to DEAD-06 are the only Phase 3 rows in REQUIREMENTS.md and all are claimed by plans.

### Judgment: is the DEAD-05 "drift check" reading acceptable?

Yes, as a Phase 3 reading, with a caveat the owner should know about.

- The ROADMAP success criterion that governs the phase says "regenerating `db/types.ts` produces no diff". That is a point-in-time check, and it was performed (twice, deterministic, byte-identical to the committed file) on a tree whose migrations and `types.ts` are unchanged through to `9819e7c`.
- A standing, failing-on-drift check is a different deliverable. REQUIREMENTS.md assigns it to Phase 6 CI-03 ("CI checks for tracked-ignored files, `db:types` drift, migration append-only and script modes"), and the Phase 6 success criterion 2 names it explicitly. Phase 3 changes no CI file, so it could not have added one.
- The weaker points are the evidence source (local Docker, not CI, owner-authorized after GitHub rejected the throwaway workflow push for missing `workflow` scope) and the checkbox wording. `[x] DEAD-05` reads "has a drift check" while the permanent check is still `Pending`. This is not a gap in Phase 3, but a reader of REQUIREMENTS.md alone could think the guard exists. Suggested, non-blocking follow-up when the phase is closed: annotate DEAD-05 as "one-time check done; permanent check is CI-03". If the owner wants the stricter reading (a standing check required to close DEAD-05), the status of DEAD-05 would be unmet until Phase 6.

### Key Link / Artifact Checks

| Item | Status | Details |
| --- | --- | --- |
| `scripts/knip-summary.mjs` | VERIFIED | Added, mode `100755`, wired through the `knip:summary` script in root `package.json`, documented in `docs/file-map.md` (both the `scripts/` row and the file table). I used it to reproduce all three summaries. Production knip reports it as unused (owner decision `knip-summary=keep-reported`, `knip.json` untouched, listed in OWNER-CANDIDATES). |
| `pnpm-lock.yaml` | VERIFIED | Changed with the `tsx` removal in the same commit; frozen install passes. |
| `supabase/migrations/` | VERIFIED | Untouched. |
| `apps/service/src/db/types.ts` | VERIFIED | Untouched. |

### Anti-Patterns Found

None blocking. Debt-marker grep (`TBD|FIXME|XXX`) is not applicable: the phase only removed lines and added the small normalizer script, which has none.

### Warnings and Accepted Facts (not gaps)

| # | Item | Severity | Note |
| --- | --- | --- | --- |
| 1 | Main CI `test-e2e` was red on the PR 1 squash commit `51c077e` and the PR 2 squash commit `aefe63a` (registry pull-limit flake); not re-run to avoid deploying superseded commits. | Accepted (owner) | Each PR's own CI run was green on an identical tree, and the final commit `9819e7c` is fully green after one re-run (run attempt 2, all six jobs `success`). Because the final tree contains all three PRs' changes, the E2E result on it covers the whole phase. The ledger also notes that E2E tests `17-accessibility-states` and `19-notifications` flaked once on main. Worth watching for flakiness in Phase 6 (CI-05). |
| 2 | `db:types` and `db:seed` evidence came from a local Docker run rather than CI. | Accepted (owner override) | See truth 3 and the DEAD-05 judgment. |
| 3 | `knip --production` still reports `scripts/knip-summary.mjs` and `normalized-fixtures.ts`. | Accepted (owner) | Both are on the owner list. Phase 6 CI-01 (blocking knip) will need either a `knip.json` entry for the script or an allowance, plus the question about narrowing the `node` plugin's `**/test/**` entry pattern that the owner list raises. |
| 4 | Four local worktrees and branches from the phase remain (`/home/user/hearth-deps`, `-exports`, `-refs`, `-dbtypes`). | Info | Listed in the ledger for the owner to remove. Remote branches for the three PRs are gone; the throwaway was never pushed. |
| 5 | `OWNER-CANDIDATES.md` notes that `.prettierignore` no longer ignores `BUILD_PROMPT.md`, so an untracked local copy would now be format-checked. | Info | The file was never tracked; CI is unaffected. Told to the owner in Notes. |

### Human Verification Required

None. The one owner-judgment item (whether a one-time `db:types` check closes DEAD-05) is stated above and does not block the phase, because the owner already authorized the evidence source and the permanent check is scheduled in Phase 6.

### Gaps Summary

No gaps. The tree on `origin/main` matches the phase goal: knip is down to one false positive in default mode and a documented, owner-listed set in production mode, nothing was deleted without proof, nothing uncertain was deleted, dependencies and lockfile are consistent, stale ignore entries are gone, migrations and generated types are untouched, and the full CI suite is green on the final commit.

---

_Verified: 2026-10-20_
_Verifier: Claude (gsd-verifier)_
