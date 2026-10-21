# Phase 5: Redundancy Reduction and Text Sync - Context

**Gathered:** 2026-10-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Reduce duplicated CI config, duplicated test fixtures and stale spec-citation comments, and bring `docs/` and `.planning/codebase/` in line with what the code actually does. Requirements RED-01 to RED-05. Behavior must not change; this is cleanup only. New capabilities (blocking duplication checks, drift checks, the date/timezone matrix) belong to Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Carried forward (still binding)
- **D-01:** Nothing review-like is added under `docs/` (no review, decision-log or ADR files); specs in `docs/` are the only source of truth. `supabase/migrations/` is never edited. (Project constraints, Phase 3 D-05.)
- **D-02:** Land work as pull requests per category, squash-merged per `CONTRIBUTING.md`; never push to `main` directly or rewrite published history. Every merge to `main` runs CI and deploys; only `docs/` is exempt. (Phase 3 D-13.)
- **D-03:** Proof is recorded in a ledger under `.planning/cleanup/`, one row per item, plus commit bodies that name their items so a single revert is surgical. (Phase 3 D-12.)

### Planning files in PRs (owner, 2026-10-21)
- **D-04:** `.planning/` files SHOULD be pushed and included in the PRs. This reverses Phase 3 D-13's "`.planning/` edits stay out of the PRs" for this phase and later ones. Consequence for the planner: a PR touching `.planning/` is not docs-exempt, so it runs CI and, once merged, deploys. — **Reversibility:** reversible — it is a landing convention.

### Fixture consolidation (RED-03)
- **D-05:** The baseline to beat is the Phase 2 test-inclusive jscpd scan: 96 clones, 85 test-involved, 1,438 duplicated lines (1.87%). Re-run the same command unchanged (jscpd 5.4.1, `--min-tokens 60 --min-lines 8`, same ignore list minus the test globs; see `.planning/cleanup/TRIAGE.md`, "Duplication baseline") and show fewer clones. The source-only figure (11 clones, 0.47%) is recorded but is not the criterion.
- **D-06:** Shared integration-test setup lives in `apps/service/src/test/` beside the existing helpers (`fake-app.ts`, `zone-dates.ts`). Web fixtures follow the existing `apps/web/src/test/` convention. Test helpers stay subject to the lint rule banning bare `new Date()` and `Date.now()`.
- **D-07:** Depth: cross-file clones only (for example the 20 to 34 line setup blocks shared by `api`, `chores`, `errands`, `bills`, `lists`, `meal-plan`, `notifications` and `match-overrides` integration tests). Repeated blocks inside a single test file are left alone so each test stays readable. All tests must still pass.

### Spec-citation removal (RED-04)
- **D-08:** Remove all citations of the old spec's sections, with no rewrites to `docs/` pointers: parenthetical forms such as `(Technical Architecture, "...")`, `(Requirements, "...")`, `(Design › ...)` and the `›` variants. Keep the surrounding explanation (the "why"); if a comment is only a citation, delete the comment. The roadmap's "262" is a Phase 2 count; a broad grep now finds roughly 335 matches in about 303 files. The planner re-derives the exact count with a recorded command and puts it in the ledger. — **Reversibility:** costly — it touches hundreds of files, though git history restores any of them.
- **D-09:** Scope covers all code files, not only `.ts`/`.tsx`: also `.mjs`, `.sh`, `.yml`, `.css`, `docker/kong.yml`, `scripts/deploy.sh`, `e2e/docker-compose.e2e.yml` and `supabase/seed/`. `supabase/migrations/` (8 files, 9 matches) is untouched, and Success Criterion 4 requires proving it.
- **D-10:** Proof of comment-only change for TypeScript/TSX: a script parses each changed file before and after with the TypeScript compiler, drops comments, and asserts identical ASTs; lint, typecheck and the test suite also pass. The script and its result are recorded in the ledger. For non-TS files (shell, YAML, CSS, `.mjs` if not parsed), the planner picks an equivalent proof, such as a diff showing only comment lines changed (Claude's discretion).
- **D-11:** Update `.claude/CLAUDE.md`'s Comments convention. It currently tells contributors to keep spec citations in files that already use them, which conflicts with this removal.

### CI composite action (RED-01, RED-02)
- **D-12:** Add `.github/actions/setup/action.yml`, a composite action with no inputs, covering `pnpm/action-setup`, `actions/setup-node` (`node-version-file: .nvmrc`, `cache: pnpm`) and `pnpm install --frozen-lockfile`. Each job keeps `actions/checkout` as its first step, because a local action cannot be loaded before the repo is checked out. (Owner chose "four steps incl. checkout"; that is not possible, so this is the equivalent form, flagged to the owner.) The Supabase CLI step (`supabase/setup-cli@v3`, 2.117.0) stays inline in `test-integration` and `test-e2e`.
- **D-13:** The workflow stays named `CI`, with its job ids unchanged (`lint`, `typecheck`, `test-unit`, `test-integration`, `test-e2e`, `build`), because `deploy.yml` triggers on `workflow_run` for the workflow named `CI`.
- **D-14:** Duplicate seed typecheck: remove `&& tsc --noEmit -p ../../supabase/seed` from the `typecheck` script in `apps/service/package.json`. The seed package's own `typecheck` (`supabase/seed/package.json`), run by `pnpm -r typecheck`, remains, so CI checks the seed exactly once.
- **D-15:** Proof: the PR's own CI run is green, plus a recorded before/after comparison of the expanded job steps. The throwaway-PR check that a merge to `main` still fires `deploy.yml` stays in Phase 6 (CI-07).

### Docs and codebase-map sync (RED-05)
- **D-16:** `.planning/codebase/`: re-run `/gsd-map-codebase` to regenerate all seven maps (last mapped at `b96ca32`, 2026-10-11, about 50 commits ago). Known stale claim to confirm gone: `ARCHITECTURE.md` says `hearth-admin` is "built to" `apps/service/bin/hearth-admin`, but that file is a hand-written POSIX shell wrapper. Note that `.claude/CLAUDE.md` embeds copies of map content; the planner decides whether it needs the same refresh.
- **D-17:** `docs/` (7 files, about 2,600 lines): claim-by-claim audit against the code, fixing mismatches in place, with a ledger under `.planning/cleanup/`. Include behavior changed in Phases 2 to 4 (Kong routes and the `hearth-compose up -d --force-recreate kong` step, deploy password handling, held ids for deal-add, test time pinning, and the knip and jscpd tooling).
- **D-18:** Spot-check for Success Criterion 5: a script verifies that every backticked path, script name and `pnpm` command in `docs/` and the maps exists, and a recorded sample of behavioral statements (including `hearth-admin` described as hand-written) is verified by hand. Both results go in the ledger.

### Claude's Discretion
- Exact PR split and order (suggested: CI action and seed typecheck; fixtures; citations; docs and maps), commit grouping, ledger file names and column layout.
- Which shared helpers to extract for each fixture cluster and their names.
- Comment-only proof method for non-TypeScript files (D-10).
- Whether `.claude/CLAUDE.md`'s embedded map copies are refreshed in this phase (D-16).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` (Phase 5) - goal and the five success criteria
- `.planning/REQUIREMENTS.md` - RED-01 to RED-05
- `.planning/phases/03-evidence-gated-removal/03-CONTEXT.md` - carried-forward removal, proof and landing decisions
- `.planning/phases/04-bug-fixes-with-regression-tests/04-CONTEXT.md` - behavior changes the docs audit must reflect

### Baselines and evidence
- `.planning/cleanup/TRIAGE.md` ("Duplication baseline (jscpd 5.4.1)") - exact jscpd commands and the 96-clone baseline
- `.planning/cleanup/jscpd/` - raw jscpd reports (`source`, `source-with-tests`, `whole-repo`)
- `.planning/cleanup/REMOVAL-LEDGER.md` - ledger format used in Phase 3

### CI
- `.github/workflows/ci.yml` - six jobs with the repeated preamble
- `.github/workflows/deploy.yml` - `workflow_run` on the workflow named `CI` (must keep working)
- `apps/service/package.json` (`typecheck` script) and `supabase/seed/package.json` - the duplicate seed typecheck

### Docs and maps
- `docs/architecture.md`, `docs/branding.md`, `docs/deploy.md`, `docs/design.md`, `docs/file-map.md`, `docs/testing.md`, `docs/use-cases.md` - the specs to audit
- `.planning/codebase/*.md` - the seven maps to regenerate
- `.claude/CLAUDE.md` - Comments convention to update; embeds map content
- `CONTRIBUTING.md` - PR and squash-merge rules

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/service/src/test/` (`fake-app.ts`, `zone-dates.ts`): home for shared service test setup.
- `apps/web/src/test/` (`harness.tsx`, `meal-fixtures.ts`): web test helpers and fixtures.
- `scripts/knip-summary.mjs`: report-normalizer pattern for a comment-AST check script.

### Established Patterns
- Test helpers fall under the ESLint `no-restricted-syntax` ban on real-clock reads.
- Service and packages use NodeNext (relative imports end in `.js`); web uses explicit `.ts`/`.tsx` extensions.
- `eslint-disable` is rare and always carries a reason.

### Integration Points
- `ci.yml` jobs consume the composite action via `uses: ./.github/actions/setup`.
- `deploy.yml` is triggered by the `CI` workflow name; renaming it or its jobs would break deploys.
- `pnpm -r typecheck` is the single typecheck entry point for CI.

</code_context>

<specifics>
## Specific Ideas

- The Phase 2 count of 262 citations does not match a fresh grep (about 335 matches, 303 files; 164 in `apps/web`, 101 in `apps/service`). Recount with a recorded command before editing.
- Largest cross-file fixture cluster: `api.integration.test.ts` setup (lines 28-57) repeated in `chores`, `meal-plan`, `bills`, `lists`, `notifications` and `match-overrides` integration tests; `chores` and `errands` share a 34-line block.

</specifics>

<deferred>
## Deferred Ideas

- The 11 source-only clones (for example `BillDetailScreen`/`RecipeDetailScreen`, `SignInScreen`/`SignUpScreen`, `ChangeEmailForm`/`ChangePasswordForm`, `ListDetailScreen`/`PantryScreen`): production-code refactors, not requested by the roadmap; left for a later decision.
- Blocking jscpd and knip checks, drift checks, the date/timezone matrix and the throwaway-PR deploy check: Phase 6.

</deferred>

---

*Phase: 5-Redundancy Reduction and Text Sync*
*Context gathered: 2026-10-21*
