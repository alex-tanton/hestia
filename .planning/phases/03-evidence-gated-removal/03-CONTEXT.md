# Phase 3: Evidence-Gated Removal - Context

**Gathered:** 2026-10-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove only what tooling and tests prove dead: files, exports, types, dependencies, and stale references that point at nothing. Everything tooling cannot prove goes to the owner on a list and is not deleted. The phase ends with the removal ledger written, the owner candidate list handed over, and the full suite plus both Docker builds green, with no diff under `supabase/migrations/` and no change in application behavior.

Requirements: DEAD-01, DEAD-02, DEAD-03, DEAD-04, DEAD-05, DEAD-06.

The inputs are `.planning/cleanup/TRIAGE.md` (89 rows, 6 proven-dead) and `.planning/cleanup/OWNER-CANDIDATES.md`. Phase 3 repeats the three-part proof for every item before deleting it. Phase 2's owner decisions D-13 to D-18 (in `02-CONTEXT.md`) already settle most scope questions and are carried forward below.

</domain>

<decisions>
## Implementation Decisions

### Carried forward from Phase 2 (owner decisions D-08 to D-18, still binding)
- **D-01:** `packages/matching`, `packages/recurrence` and `packages/shared` are internal. An export with no importer anywhere, tests included, may be removed after Phase 3's own three-part proof. An export used only by tests stays. (Phase 2 D-18.)
- **D-02:** `apps/service/src/jobs/index.ts`: keep the barrel and `jobs/index.test.ts`. Drop only re-export lines with no use anywhere (the zero-use type re-exports: `AutopayBillRow`, `DispatchOutcome`, and the like). The 12 test-only runtime re-exports stay. (Phase 2 D-18.)
- **D-03:** `BILLS_LIST_EMPTY_COPY` is the canonical name; the unused alias `BILLS_EMPTY_COPY` in `apps/web/src/components/bills/bills-copy.ts` may go. (Phase 2 D-18.)
- **D-04:** The 19 test-only items are kept as they are. `tailwindcss` in `apps/web`, the Flipp fixture exports, `normalized-fixtures.ts`, and the whole D-10 standing list (anything reachable only through Docker, Compose, Kong, Caddy, SQL, or string-built paths) are kept and stay on the owner list. (Phase 2 D-18.)
- **D-05:** Never run `knip --fix`. Never treat knip output alone as proof. No broad ignore globs that hide candidates. `supabase/migrations/` is never edited. (Phase 2 D-08, D-10; project constraints.)
- **D-06:** The `fuse.js` benchmark cluster is already gone (Phase 2 D-16, commit `d8f3daf` on `origin/main`). DEAD-03's `fuse.js` part needs only a re-check that nothing references it and the lockfile is clean.

### Dependencies
- **D-07:** Remove the unused `tsx` devDependency from `supabase/seed/package.json`. This overrides the "keep" note in Phase 2 D-18; the roadmap success criterion and DEAD-03 name it, and no seed script uses it (`db:seed` runs through `apps/service`'s own `tsx`, and the seed package has only `typecheck`). The lockfile changes in the same commit, `pnpm install --frozen-lockfile` is re-run, and `pnpm db:seed` and the seed typecheck must still work — **Reversibility:** reversible — one `pnpm add -D` restores it.

### Evidence and knip handling
- **D-08:** Re-establish the evidence for `currentWeekFixture`, `emptyWeekFixture` and `previousWeekFixture` in `apps/web/src/test/meal-fixtures.ts` with `knip --trace-export`, a repo-wide text search, and the web test run. A fresh knip run no longer reports them because the root `test:harness` script makes `test/**` count as entry files. Leave `knip.json` as it is for Phase 3; whether it needs a narrow change for that side effect is a separate decision, to be revisited with Phase 6's blocking check.
- **D-09:** Commit the report normalizer as `scripts/knip-summary.mjs`. It lives today outside the repo (`../hearth-aside/bin/knip-summary.mjs`) and is cited by TRIAGE.md. In the repo it is subject to lint, format, typecheck and knip like any script, and Phase 6 can reuse it. It must not add `console.*` to shipped code (scripts are allowed). It must keep the output format (`kind<TAB>path<TAB>symbol` lines, sorted, final `total` line) so earlier summaries stay comparable.

### Removal mechanics and proof
- **D-10:** For an unused export or type, remove only the `export` keyword when the file still uses the name internally. Delete the whole declaration, and any imports it orphans, when nothing uses it. Remove a whole file only after the three-part proof for the file itself.
- **D-11:** The three-part proof per item is: (1) no importer (`knip --trace-export` or `--trace-file`), (2) a repo-wide text search across every tracked file type, `.planning/` and `.claude/` excluded, finds no non-documentation reference, (3) the relevant typecheck, build or test passes after the removal. An item that fails any part moves to the owner list and stays in the tree.
- **D-12:** Proof is recorded in a removal ledger under `.planning/cleanup/` (one row per item, with the three results), plus a commit body that names its items so any single revert is surgical. Nothing about the removal goes into `docs/` (no review, decision-log, or ADR files).

### Landing
- **D-13:** Land the work as one PR per category, stacked in this order: (1) dependencies with the lockfile, (2) files, exports and types, (3) stale references and leftovers. Each PR gets the full CI run, including both Docker builds, integration and E2E, and each can be reverted on its own. Squash merge per `CONTRIBUTING.md`. Every merge to `main` deploys, and `.planning/` edits stay out of the PRs (docs-only exemption applies to `docs/` only). The cloud box has no Docker, so integration, E2E and Docker-build evidence comes from PR CI.

### Leftovers and stale references
- **D-14 (DEAD-05):** Run the ignored-file check (`git ls-files -ci --exclude-standard`, already empty) and also audit tracked files by pattern for build output, logs, `*.tsbuildinfo`, backups, duplicate lockfiles, and editor junk. Anything tooling cannot prove generated or leftover goes to the owner list. Tracked generated outputs that are meant to be committed (such as `apps/service/src/db/types.ts`) stay.
- **D-15 (DEAD-05, `db:types`):** Get the regenerate-and-diff evidence from PR CI, which already starts the Supabase stack for integration tests. A throwaway step or draft-PR job runs `pnpm db:types` twice and compares both runs against the committed file. This also answers the open question whether `db:types` output is deterministic. The permanent drift check is Phase 6 (CI-03); do not add it as a blocking CI step here.
- **D-16 (DEAD-04):** Phase 3 removes ignore-file and config references to files that no longer exist, for example `BUILD_PROMPT.md` in `.dockerignore` and `.prettierignore`, plus anything Phase 3's own removals orphan (including docs mentions of removed exports). Spec-citation comments (RED-04) and the wider `docs/` and codebase-map sync (RED-05) stay in Phase 5.

### Claude's Discretion
- Exact commit grouping inside each PR, the removal ledger's file name and column layout, and the order of items within a category.
- How the throwaway `db:types` CI evidence is arranged (extra step in a draft PR versus a scratch workflow), as long as it is not merged to `main`.
- Which of the 35 package-surface findings pass the proof (no importer anywhere, tests included) and so may go under D-01.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and scope
- `.planning/ROADMAP.md` — Phase 3 goal and the five success criteria
- `.planning/REQUIREMENTS.md` — DEAD-01 to DEAD-06 and the "Out of Scope" table (no bulk deletion on tool output alone, migrations stay append-only)
- `.planning/PROJECT.md` — constraints (no behavior change, evidence required, `main` deploys, `docs/` is the only spec source)
- `.planning/STATE.md` — Phase 3 blockers and concerns (stale meal-fixtures evidence, `knip-summary.mjs`, `db:types` determinism)

### Phase 2 outputs this phase consumes
- `.planning/cleanup/TRIAGE.md` — the item-by-item ledger (89 rows) and the bucket rules; Phase 3 repeats its proof before deleting
- `.planning/cleanup/OWNER-CANDIDATES.md` — uncertain items with evidence and the standing D-10 list
- `.planning/cleanup/BASELINE.md` — what passed and failed on untouched `main`, for comparison after removals
- `.planning/cleanup/knip/default.json`, `.planning/cleanup/knip/production.json`, and the matching `*-summary.txt` files — raw reports and normalized summaries
- `.planning/phases/02-baseline-net-stabilization-and-analysis/02-CONTEXT.md` — owner decisions D-08 to D-18 (especially D-10, D-13 to D-18)

### Repo files that define reachability or process
- `knip.json` — entry points and workspace config (do not widen with ignore globs)
- `CONTRIBUTING.md` — branch and PR policy (squash merge, what may go straight to `main`)
- `docs/testing.md` — clock pin, sweep, and test conventions the removals must not break
- `docs/architecture.md` — the layers and the service-role fence
- `.github/workflows/ci.yml` — jobs, including both Docker builds, integration and E2E; keep the workflow named `CI` and its job ids unchanged
- `apps/service/package.json` (`db:types`, `db:seed`) and `supabase/seed/package.json` — where the `tsx` and `db:types` evidence comes from
- `.dockerignore`, `.prettierignore`, `.gitignore` — stale-reference and leftover audit targets
- `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONCERNS.md` — codebase maps to check candidates against

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `knip` 6.41.0 with the root `knip.json` and the `knip` / `knip:production` scripts — the report-only analyzer, run in both default and `--production` modes
- Phase 2 reports in `.planning/cleanup/knip/` — before/after comparison points; `calibration-canary-*` show what the tool does and does not catch
- `scripts/test-sweep.mjs` and `pnpm test:sweep`, `pnpm test:sweep:integration` — run the suites across the date and time-zone matrix after removals

### Established Patterns
- Proven-dead set today (6 rows): `ChoreLike` (`apps/web/src/components/chores/chore-copy.ts`), `useFavoriteStores` (`apps/web/src/lib/api/deals.ts`), `listIdOfWrite` (`apps/web/src/lib/offline/write-queue.ts`), and the three meal-fixtures exports above
- Named exports only; barrels (`packages/*/src/index.ts`, `apps/service/src/jobs/index.ts`) are pure re-exports, so a removed export can leave a barrel line behind — check barrels with each removal
- Package-surface findings (35) appear only because `includeEntryExports` is on for `packages/*`; they are internal per D-01 but each needs its own proof
- Commits follow commitlint conventional format; scope enum is enforced by `commitlint.config.js`

### Integration Points
- Web and service unit suites, the integration suite, Playwright E2E, and both Docker builds (`docker/service.Dockerfile`, `docker/caddy.Dockerfile`) are the "relevant build or test" for the third proof part
- `pnpm install --frozen-lockfile` is the gate for dependency removal; `pnpm-lock.yaml` changes in the same commit as `package.json`
- `supabase/migrations/` must show an empty diff at phase end

</code_context>

<specifics>
## Specific Ideas

- The owner wants the evidence trail in `.planning/cleanup/` and in commit bodies, not in `docs/`.
- The roadmap's own wording for success criterion 2 (the `fuse.js` cluster and unused seed `tsx`) is what settled the `tsx` question, over the earlier "keep pending objection" note.

</specifics>

<deferred>
## Deferred Ideas

- A narrow `knip.json` change for the `test/**` entry side effect, and the permanent knip gate: Phase 6 (CI-01).
- The permanent `db:types` drift check, migration append-only check, and ignored-file check in CI: Phase 6 (CI-03).
- Spec-citation comment removal (262 citations) and the docs and codebase-map sync: Phase 5 (RED-04, RED-05).
- Open info items from the second Phase 2 code review (`02-REVIEW-FIXES.md`): not decided by the owner, outside this phase.

</deferred>

---

*Phase: 3-Evidence-Gated Removal*
*Context gathered: 2026-10-19*
