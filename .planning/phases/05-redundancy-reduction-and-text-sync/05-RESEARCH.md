# Phase 5: Redundancy Reduction and Text Sync - Research

**Researched:** 2026-10-21
**Domain:** Repo cleanup: GitHub Actions composite action, test-fixture consolidation (Vitest), comment-only codemod with compiler-level proof, docs and codebase-map audit
**Confidence:** HIGH for CI, fixtures, proof method and counts (all measured this session); MEDIUM for the docs/maps risk list (a sample, not a full audit); two owner-visible scope findings below.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Carried forward (still binding)**
- **D-01:** Nothing review-like is added under `docs/` (no review, decision-log or ADR files); specs in `docs/` are the only source of truth. `supabase/migrations/` is never edited. (Project constraints, Phase 3 D-05.)
- **D-02:** Land work as pull requests per category, squash-merged per `CONTRIBUTING.md`; never push to `main` directly or rewrite published history. Every merge to `main` runs CI and deploys; only `docs/` is exempt. (Phase 3 D-13.)
- **D-03:** Proof is recorded in a ledger under `.planning/cleanup/`, one row per item, plus commit bodies that name their items so a single revert is surgical. (Phase 3 D-12.)

**Planning files in PRs (owner, 2026-10-21)**
- **D-04:** `.planning/` files SHOULD be pushed and included in the PRs. This reverses Phase 3 D-13's "`.planning/` edits stay out of the PRs" for this phase and later ones. Consequence for the planner: a PR touching `.planning/` is not docs-exempt, so it runs CI and, once merged, deploys. — **Reversibility:** reversible — it is a landing convention.

**Fixture consolidation (RED-03)**
- **D-05:** The baseline to beat is the Phase 2 test-inclusive jscpd scan: 96 clones, 85 test-involved, 1,438 duplicated lines (1.87%). Re-run the same command unchanged (jscpd 5.4.1, `--min-tokens 60 --min-lines 8`, same ignore list minus the test globs; see `.planning/cleanup/TRIAGE.md`, "Duplication baseline") and show fewer clones. The source-only figure (11 clones, 0.47%) is recorded but is not the criterion.
- **D-06:** Shared integration-test setup lives in `apps/service/src/test/` beside the existing helpers (`fake-app.ts`, `zone-dates.ts`). Web fixtures follow the existing `apps/web/src/test/` convention. Test helpers stay subject to the lint rule banning bare `new Date()` and `Date.now()`.
- **D-07:** Depth: cross-file clones only (for example the 20 to 34 line setup blocks shared by `api`, `chores`, `errands`, `bills`, `lists`, `meal-plan`, `notifications` and `match-overrides` integration tests). Repeated blocks inside a single test file are left alone so each test stays readable. All tests must still pass.

**Spec-citation removal (RED-04)**
- **D-08:** Remove all citations of the old spec's sections, with no rewrites to `docs/` pointers: parenthetical forms such as `(Technical Architecture, "...")`, `(Requirements, "...")`, `(Design › ...)` and the `›` variants. Keep the surrounding explanation (the "why"); if a comment is only a citation, delete the comment. The roadmap's "262" is a Phase 2 count; a broad grep now finds roughly 335 matches in about 303 files. The planner re-derives the exact count with a recorded command and puts it in the ledger. — **Reversibility:** costly — it touches hundreds of files, though git history restores any of them.
- **D-09:** Scope covers all code files, not only `.ts`/`.tsx`: also `.mjs`, `.sh`, `.yml`, `.css`, `docker/kong.yml`, `scripts/deploy.sh`, `e2e/docker-compose.e2e.yml` and `supabase/seed/`. `supabase/migrations/` (8 files, 9 matches) is untouched, and Success Criterion 4 requires proving it.
- **D-10:** Proof of comment-only change for TypeScript/TSX: a script parses each changed file before and after with the TypeScript compiler, drops comments, and asserts identical ASTs; lint, typecheck and the test suite also pass. The script and its result are recorded in the ledger. For non-TS files (shell, YAML, CSS, `.mjs` if not parsed), the planner picks an equivalent proof, such as a diff showing only comment lines changed (Claude's discretion).
- **D-11:** Update `.claude/CLAUDE.md`'s Comments convention. It currently tells contributors to keep spec citations in files that already use them, which conflicts with this removal.

**CI composite action (RED-01, RED-02)**
- **D-12:** Add `.github/actions/setup/action.yml`, a composite action with no inputs, covering `pnpm/action-setup`, `actions/setup-node` (`node-version-file: .nvmrc`, `cache: pnpm`) and `pnpm install --frozen-lockfile`. Each job keeps `actions/checkout` as its first step, because a local action cannot be loaded before the repo is checked out. (Owner chose "four steps incl. checkout"; that is not possible, so this is the equivalent form, flagged to the owner.) The Supabase CLI step (`supabase/setup-cli@v3`, 2.117.0) stays inline in `test-integration` and `test-e2e`.
- **D-13:** The workflow stays named `CI`, with its job ids unchanged (`lint`, `typecheck`, `test-unit`, `test-integration`, `test-e2e`, `build`), because `deploy.yml` triggers on `workflow_run` for the workflow named `CI`.
- **D-14:** Duplicate seed typecheck: remove `&& tsc --noEmit -p ../../supabase/seed` from the `typecheck` script in `apps/service/package.json`. The seed package's own `typecheck` (`supabase/seed/package.json`), run by `pnpm -r typecheck`, remains, so CI checks the seed exactly once.
- **D-15:** Proof: the PR's own CI run is green, plus a recorded before/after comparison of the expanded job steps. The throwaway-PR check that a merge to `main` still fires `deploy.yml` stays in Phase 6 (CI-07).

**Docs and codebase-map sync (RED-05)**
- **D-16:** `.planning/codebase/`: re-run `/gsd-map-codebase` to regenerate all seven maps (last mapped at `b96ca32`, 2026-10-11, about 50 commits ago). Known stale claim to confirm gone: `ARCHITECTURE.md` says `hearth-admin` is "built to" `apps/service/bin/hearth-admin`, but that file is a hand-written POSIX shell wrapper. Note that `.claude/CLAUDE.md` embeds copies of map content; the planner decides whether it needs the same refresh.
- **D-17:** `docs/` (7 files, about 2,600 lines): claim-by-claim audit against the code, fixing mismatches in place, with a ledger under `.planning/cleanup/`. Include behavior changed in Phases 2 to 4 (Kong routes and the `hearth-compose up -d --force-recreate kong` step, deploy password handling, held ids for deal-add, test time pinning, and the knip and jscpd tooling).
- **D-18:** Spot-check for Success Criterion 5: a script verifies that every backticked path, script name and `pnpm` command in `docs/` and the maps exists, and a recorded sample of behavioral statements (including `hearth-admin` described as hand-written) is verified by hand. Both results go in the ledger.

### Claude's Discretion
- Exact PR split and order (suggested: CI action and seed typecheck; fixtures; citations; docs and maps), commit grouping, ledger file names and column layout.
- Which shared helpers to extract for each fixture cluster and their names.
- Comment-only proof method for non-TypeScript files (D-10).
- Whether `.claude/CLAUDE.md`'s embedded map copies are refreshed in this phase (D-16).

### Deferred Ideas (OUT OF SCOPE)
- The 11 source-only clones (for example `BillDetailScreen`/`RecipeDetailScreen`, `SignInScreen`/`SignUpScreen`, `ChangeEmailForm`/`ChangePasswordForm`, `ListDetailScreen`/`PantryScreen`): production-code refactors, not requested by the roadmap; left for a later decision.
- Blocking jscpd and knip checks, drift checks, the date/timezone matrix and the throwaway-PR deploy check: Phase 6.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RED-01 | A CI composite setup action replaces the preamble repeated in six jobs | The six preambles are byte-identical (verified); a prototype action plus rewritten `ci.yml` passes `actionlint` and an expanded-steps deep-equal proof (Code Examples 1 and 2). Constraints: checkout stays per job, `shell: bash` on `run`, Dependabot entry, workflow-file push scope. |
| RED-02 | The duplicate seed typecheck is removed | Duplicate confirmed by running `pnpm -r --reporter=append-only typecheck` (output quoted in Standard Stack). One-token edit in `apps/service/package.json`. |
| RED-03 | Duplicated test fixtures flagged by the scan are consolidated | Current jscpd run gives 99 clones (baseline 96, so the bar is below 96, not below 99). 50 cross-file test clones grouped into 7 clusters with helper designs; live-binding technique verified under vitest 5.0.1. |
| RED-04 | The 262 stale spec citations are removed, comment-only and verified | The real population is far larger than 262 or 335: 1,118 lines in 458 files with the full retired-spec vocabulary. Not all are comments (46 string literals in 27 test files, 3 HTML fixtures). AST-equality prototype verified with negative controls. |
| RED-05 | `docs/` and the codebase map match the code | Path/command checker prototype run (docs paths are largely clean); concrete verified mismatches listed in "Risky claims"; map regeneration and CLAUDE.md managed-block mechanics documented. |
</phase_requirements>

## Summary

This is a text-and-config cleanup phase with no new runtime dependencies. The five requirements split into two easy items (RED-01 composite action, RED-02 one-token script edit), one measurable-but-fiddly item (RED-03 fixtures, graded by a jscpd count), one very large mechanical item (RED-04 citations) and one audit item (RED-05). The main planning risks are scope and proof, not technique.

**Two findings change the shape of the plan.** First, the citation population is much bigger than CONTEXT and the roadmap say. "262" was a Phase 2 *file* count; CONTEXT's "~335 matches in ~303 files" comes from a narrower regex. The retired spec was seven documents (Product Requirements Document, Technical Architecture, Engineering Practices, Design System and UI Specification, Branding, Seed Data, Implementation Handoff; commit `e3781a9` removed them), and the code cites all seven under several names (`Requirements`, `PRD`, `Handoff non-negotiable N`, `Handoff, Phase N "Done when"`, `Seed Data`, ...). With that vocabulary there are **1,118 matching lines in 458 files** outside `.planning/`, `docs/` and `supabase/migrations/`, plus 17 lines in the 8 migration files that must stay. About 223 of the ~750 parenthetical citations wrap across comment lines, so a line-based `sed` is not safe; and about 200 parentheticals mix a citation with explanatory text, so they need a human read. Second, not every citation is a comment: 46 are string literals (mostly `describe`/`it` titles in 27 test files) and three are visible body text in `e2e/fixtures/recipes/*.html`. A strict "identical comment-stripped AST" proof cannot cover the string-literal ones, so they need either a separate, explicitly weaker proof mode (title-normalised AST, which I prototyped) or to be left and reported.

**Primary recommendation:** Land four PRs in the suggested order (CI action plus seed typecheck; fixtures; citations; docs and maps). For RED-04 use the full seven-document vocabulary, a codemod that handles wrapped comments for the ~580 pure citations plus a reviewed manual list for the rest, and a TypeScript-compiler AST-equality checker (with JSX normalisation, shown below) as the gate. Treat string-literal titles as a separate commit with a title-normalised proof, and leave the three HTML fixtures untouched and ledgered. Take the final jscpd scan after all four PRs and compare against 96, not against the current 99.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Shared CI setup (pnpm, Node, install) | CI config (`.github/actions/setup`) | `ci.yml` jobs | Composite action owns the three setup steps; each job owns checkout and job-specific steps. |
| Seed typecheck | Workspace scripts (`supabase/seed/package.json`) | Root `pnpm -r typecheck` | The seed workspace already owns its typecheck; the service script duplicated it. |
| Shared integration-test setup | Service test helpers (`apps/service/src/test/`) | Per-file test setup | D-06: helpers beside `service-stack.ts`. |
| Shared web test stubs | Web test helpers (`apps/web/src/test/`) | Per-file `mount` functions | D-06: follows the existing `harness.tsx` convention. |
| Comment-only proof | Dev tooling script (Node + `typescript`) | ESLint, `tsc`, Vitest | Compiler-level equality is the gate; lint/typecheck/tests are corroboration. |
| Docs and map accuracy | `docs/`, `.planning/codebase/`, `.claude/CLAUDE.md` | Verification script | Text artifacts audited against code; no runtime tier. |

## Standard Stack

No new packages are installed by this phase. Everything below is already present or run without being added to the repo.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `typescript` (compiler API) | 6.0.3 | Parse, transform and print ASTs for the comment-only proof | Already the repo's compiler (root devDependency); D-10 names it. `[VERIFIED: package.json devDependencies "typescript": "6.0.3"]` |
| `yaml` | 2.9.1 | Parse YAML (workflows, kong.yml, compose) to JS values for equality proof | Already installed in `apps/service` by Phase 4 (owner-approved); comments are dropped by `parse()`. `[VERIFIED: apps/service/node_modules/yaml/package.json present; node_modules/.pnpm yaml@2.9.1]` |
| `jscpd` | 5.4.1 (via `pnpm dlx`, not installed) | Re-run the duplication baseline | D-05 names it; Phase 2 used it. Ran in 1.3 s this session. `[VERIFIED: pnpm dlx jscpd@5.4.1 run this session]` |
| `actionlint` | 1.7.7 (on PATH here) | Lint the rewritten `ci.yml` and the local-action reference | Present in the sandbox; passes the prototype. `[VERIFIED: actionlint --version]` |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| ESLint | 10.11.0 | Gate for helpers (clock ban applies) | Every PR: `pnpm lint` (45 s baseline) |
| Vitest | 5.0.1 | Fixture-consolidation gate | `pnpm -r test` (71 s baseline) |
| commitlint | 21.2.2 | Commit message gate (hook) | Every commit; see rules below |
| `/gsd-map-codebase` | gsd-core 1.16.0 | Regenerate the seven maps | Last PR only, after code is final |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TS printer-based AST equality | esbuild transform output equality | esbuild drops types and empty JSX children but may keep legal or annotation comments; D-10 names the TS compiler, so use it. Keep esbuild as an optional second opinion only. |
| Line-by-line citation `sed` | AST-aware codemod over comment ranges | `sed` cannot handle the 223 wrapped citations or the comment-continuation prefixes. Do not use `sed`. |

**Installation:** none. Commands used:
```bash
pnpm dlx jscpd@5.4.1 <paths> ...     # not added to package.json (Phase 2 precedent)
```

**Version verification:**
- `jscpd`: `npm view jscpd time` shows 5.4.1 published 2026-10-09 and 5.4.2 published 2026-10-20. Pin `@5.4.1`, the version the baseline used. `[VERIFIED: npm registry]`
- The duplicate seed typecheck, reproduced:
```
apps/service typecheck$ tsc --noEmit && tsc --noEmit -p ../../supabase/seed
supabase/seed typecheck$ tsc --noEmit
```
  `[VERIFIED: pnpm -r --reporter=append-only typecheck, this session; apps/service/package.json:13 "typecheck": "tsc --noEmit && tsc --noEmit -p ../../supabase/seed",]`. `pnpm -r list` shows `@hearth/seed ./supabase/seed` is a workspace member, so `pnpm -r typecheck` already runs it. Both invocations use `supabase/seed/tsconfig.json` (`"include": ["*.ts"]`).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| jscpd (5.4.1, `pnpm dlx` only) | npm | package years old; 5.4.1 is 12 days old, latest 5.4.2 is 1 day old | ~2.1M/wk | github.com/kucherenko/jscpd | SUS (`too-new`, driven by the latest release date) | Not installed in the repo. Pin `@5.4.1` as Phase 2 did; the owner already accepted this tool and version in D-05. Planner: a `checkpoint:human-verify` is not needed beyond D-05, but do not float to `latest`. |
| typescript | npm | years | very high | already in repo | OK | Approved (existing) |
| yaml | npm | years | very high | already in repo (owner-approved in Phase 4) | OK | Approved (existing) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `jscpd` (recency only; see disposition). `[VERIFIED: gsd-tools package-legitimacy check, this session]`

## Architecture Patterns

### Workstream and PR flow

```
HEAD dbcbe1b (main + phase context)
  |
  |-- PR A: ci + seed typecheck (RED-01, RED-02)
  |      .github/actions/setup/action.yml  (new)
  |      .github/workflows/ci.yml          (6 preambles -> 1 line each)
  |      .github/dependabot.yml            (add action dir)
  |      apps/service/package.json         (drop seed tsc)
  |      proof: expand-compare script, actionlint, PR CI six green
  |      NOTE: workflow-file push needs token scope (see Pitfall 9)
  |
  |-- PR B: fixtures (RED-03)
  |      apps/service/src/test/*.ts (new helpers) + 8-13 integration tests
  |      apps/web/src/test/*.ts(x)  (new helpers) + ~16 web tests
  |      proof: pnpm -r test, lint, jscpd re-scan (running count)
  |
  |-- PR C: citations (RED-04), commits split by area
  |      codemod -> review mixed list -> comment-only-check.mjs gate
  |      separate commit: test titles (title-normalised proof)
  |      separate commit: non-TS files (per-type proof)
  |      migrations: untouched, proven by empty diff
  |
  `-- PR D: docs + maps (RED-05)  (touches .claude/CLAUDE.md and README, so it deploys)
         docs/ fixes, /gsd-map-codebase, CLAUDE.md regen, CONVENTIONS Comments text (D-11)
         final jscpd scan + post-condition greps recorded in ledger
```

Order rationale: B before C so the jscpd comparison and line numbers are not disturbed by 450-file churn; C before D so the regenerated maps describe post-removal code (the mapper would otherwise re-learn "keep spec citations" from the code); A first because it is small and gives later PRs a leaner CI.

### Recommended ledger layout (Claude's discretion)
```
.planning/cleanup/
├── REDUNDANCY-LEDGER.md   # RED-01..03: before/after expanded steps, typecheck proof, jscpd counts, helper map
├── TEXT-SYNC-LEDGER.md    # RED-04: recorded commands + counts, per-batch proof results, exceptions
├── DOCS-AUDIT-LEDGER.md   # RED-05: claim rows (claim, file:line, check, result, fix commit), script output
└── tools/                 # comment-only-check.mjs, citation-inventory.mjs, docs-claims-check.mjs
```
ESLint accepts a `.mjs` script under `.planning/` (probed with `eslint --stdin --stdin-filename .planning/cleanup/tools/probe.mjs`, exit 0) and `.planning/` is in `.prettierignore`. `[VERIFIED: probe run this session; .prettierignore]`

### Pattern 1: Composite setup action (RED-01)
**What:** One local composite action replaces the three-step preamble; each job keeps `actions/checkout` first.
**When to use:** All six jobs.
**Facts:**
- The six preambles are byte-identical, so a literal replace is exact. `[VERIFIED: python str.count == 6 on the 6-step block of .github/workflows/ci.yml]`. The block (quoted verbatim, lines 21-26 in `lint`):
```yaml
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
```
- Composite action requirements: top-level `name` and `description` are required; `shell` is required on any `run` step; `uses` steps are allowed. `[CITED: docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax]`
- A local `uses: ./.github/actions/setup` reads the action from the checked-out workspace, so checkout must already have run; GitHub's own example puts `actions/checkout` first. `[CITED: docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-composite-action]`
- Ordering inside the composite must stay pnpm, then setup-node: `cache: pnpm` needs pnpm on PATH first.
- In `test-integration` and `test-e2e` the `supabase/setup-cli@v3` step comes after install today, so it stays inline after the composite call; step order is preserved.
- An unsolicited alternative exists: GitHub documents a `$/` "self repository reference" prefix (`uses: $/.github/actions/hello-world-action`) that resolves at the running commit "so you do not need to check out the repository first". It is not available in GitHub Enterprise Server. That could in principle put checkout inside the action (the owner's original "four steps incl. checkout"). It is new, unfamiliar to `actionlint` 1.7.7 and untested here, and D-12 is locked, so do not use it; mention it to the owner only. `[CITED: docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax, steps[*].uses]` `[ASSUMED: actionlint 1.7.7 does not understand `$/`]`

### Pattern 2: AST-equality proof for comment-only edits (RED-04, D-10)
**What:** Normalise each file (parse, drop empty JSX expressions and whitespace-only JSX text, print with `removeComments`) before and after; require identical output.
**Why the JSX normalisation:** deleting a whole `{/* ... */}` JSX comment removes a JSX child node, so a naive comment-stripped print differs. Verified: naive printer says DIFFERENT for a whole-comment deletion in `ChoreListRow.tsx` and IDENTICAL for an in-place edit; the normalised version says IDENTICAL for both. `[VERIFIED: prototype run this session]`
**Negative controls (all passed as expected):** changing a code string literal (`toBe('cheese')` to `toBe('Xcheese')`) is DIFFERENT in both modes; renaming `no-restricted-syntax` inside `eslint.config.js` is DIFFERENT.
**Speed:** normalising all 561 tracked `.ts/.tsx/.js/.mjs` files takes about 1.2 s, so run it over the whole diff, not a sample.
See Code Example 3.

### Pattern 3: Shared service integration hooks (RED-03)
**What:** Put `expectStatus` and the `startStack`/`newApp`/`close` hook trio in one helper module and re-export the live `app` binding.
**Verified technique:** an exported `let` that a helper reassigns inside `beforeEach` is seen live by the importing test file under Vitest 5.0.1 (experiment: `export let app` reassigned in `beforeEach`, test read `101` then `102`). So test files keep the identifier `app` (via `import { app } from './test/stack-hooks.js'`) and the hundreds of `as(app, ...)` call sites do not change. `[VERIFIED: vitest 5.0.1 experiment, this session]`
Why it is safe here: no `eslint-plugin-import` (no `no-mutable-exports`) is in the lint stack. `[VERIFIED: CLAUDE.md Technology Stack lists eslint-plugin-react-hooks and eslint-plugin-jsx-a11y only]`
See Code Example 4.

### Anti-Patterns to Avoid
- **Line-based `sed` over citations:** 223 parentheticals wrap across lines with a comment prefix (` * `, `// `, `-- `, `# `). Use a range-aware codemod.
- **Deleting only the parenthetical when it carries explanation:** about 200 contain colon-led rationale (`(Handoff non-negotiable 12: equal weighting ...)`). Keep the "why".
- **Editing `supabase/migrations/`:** 8 files, 17 lines. Never touch.
- **Folding same-file clones (D-07):** 38 of the 99 clones are inside one file (31 involve `chores.integration.test.ts`). Leave them.
- **Using `pnpm dlx jscpd` without the version pin:** `latest` is 5.4.2 and would not reproduce the baseline.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Comment-only proof for TS/TSX/JS | Regex diff of "comment lines" | TypeScript compiler printer with `removeComments` plus JSX normalisation | Regex cannot see string literals, template literals or JSX text; compiler can. |
| Comment-only proof for YAML | Line diff | `yaml` 2.9.1 `parse()` deep-equal | `parse()` drops comments by construction; also proves block scalars were not touched. |
| Workflow equivalence | Eyeballing 6 jobs | Expand the composite into each job and `assert.deepEqual` against the old workflow | Catches a reordered or dropped step (negative control verified). |
| Duplicate detection | Custom clone finder | `jscpd@5.4.1` with the Phase 2 flags | The baseline is defined by it. |
| Map regeneration | Hand-editing seven maps | `/gsd-map-codebase` then `gsd_run query generate-claude-md` | Maps stamp `last_mapped_commit` deterministically; CLAUDE.md blocks are generated from them. |

**Key insight:** every proof in this phase can be mechanical and cheap. The expensive part is judgement on ~200 mixed citations and the docs audit.

## Runtime State Inventory

Included because RED-04 is a string-removal sweep and RED-03/RED-01 rename and move things.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. No datastore keys on comment text. Test titles are not persisted anywhere. | None |
| Live service config | `docker/kong.yml` is bind-mounted into Kong (deploy.md: "After merging a `docker/kong.yml` change ... run `hearth-compose up -d --force-recreate kong`"). A comment-only edit to line 1 changes the file but not Kong's parsed config; Kong reads it at start. | Prefer including it (D-09 lists it), prove with YAML parse equality, and say in the PR body that no Kong recreate is needed for a comment-only change. |
| OS-registered state | None. The self-hosted runner executes `deploy.yml`; `CI` workflow name and job ids stay unchanged. | None |
| Secrets/env vars | None renamed. `.env.example` has 3 comment citations only. | Comment edits only. |
| Build artifacts | `dist/` and `dev-dist/` are gitignored. Built web assets should hash identically after comment-only edits (optional extra proof, `[ASSUMED]`, not run). Test names in Vitest output change for the 46 title edits; nothing keys off test names (no `--grep`/`-t`/`testNamePattern` in scripts, config, docs, CI). | Record before/after test counts (1,890 workspace tests green at baseline) instead. |

Test-name consumers checked: `git grep` for `--grep|-t '|testNamePattern` in `package.json`, `scripts`, `e2e/playwright.config.ts`, `.github`, `docs` returned nothing. `[VERIFIED: git grep, this session]`

## Common Pitfalls

### Pitfall 1: Counting the wrong thing
**What goes wrong:** The ledger records 262 or ~335 and the post-condition grep still finds hundreds of sites.
**Why:** 262 was a file count under an older definition; CONTEXT's regex is narrower than the vocabulary the code actually uses.
**How to avoid:** Record this command and these numbers (at HEAD `dbcbe1b`) in the ledger, then require zero after:
```bash
CIT_RX='Technical Architecture|Engineering Practices|Seed Data|Handoff|non-negotiable|\bPRD\b|\((Requirements|Design|Branding|Use Cases)\b|\b(Requirements|Design|Branding) ›|\b(Requirements|Branding|Design), "'
git grep -nE "$CIT_RX" -- . ':!.planning' ':!docs' ':!supabase/migrations' | wc -l            # 1118 lines
git grep -lE "$CIT_RX" -- . ':!.planning' ':!docs' ':!supabase/migrations' | wc -l           # 458 files
git grep -nE "$CIT_RX" -- supabase/migrations | wc -l                                         # 17 lines, 8 files (must stay)
git grep -nE "$CIT_RX" -- docs | wc -l                                                        # 0
```
`[VERIFIED: commands run this session]`. Narrower variants for comparison: `\((Technical Architecture|Requirements|Design|Engineering Practices)` gives 582 lines in 343 files outside the three excluded trees; the single-term counts are Technical Architecture 194 lines, `(Requirements` 182, `(Design` 151, Engineering Practices 110, Handoff 101, PRD 90, non-negotiable 112.
**Where the 1,118 sit:** `apps/web` 213 files, `apps/service` 142, `packages/shared` 20, `e2e/tests` 18, `e2e/support` 10, `packages/matching` 9, `packages/recurrence` 8, plus about 22 non-TS files. By syntax in TS/TSX: comments 1,120 matches, string literals 46 (27 files), JSX comments 11. `[VERIFIED: TS-scanner classifier run this session]`
**Warning signs:** a "done" ledger with a number that differs from a fresh grep.

### Pitfall 2: Wrapped citations
**What goes wrong:** A regex removes `(Technical Architecture, "API` and leaves `surface" › "Chores"; PRD ...)` on the next line.
**Why:** 223 of ~750 parenthetical citations span lines, in 166 files. `[VERIFIED: paren-matching scan, this session]`
**How to avoid:** Match with a balanced-parenthesis scanner over the original text, strip the comment prefix on continuation lines when computing the body, and delete whole lines only when the remaining comment text is empty.

### Pitfall 3: Mixed citations (rationale inside the parentheses)
**What goes wrong:** Deleting `(Handoff non-negotiable 12: equal weighting, half-up rounding)` loses the rule.
**Why:** A purity heuristic classified about 583 parentheticals as pure references and about 199 as mixed (a heuristic; unquoted multiword section names inflate "mixed"). `[VERIFIED: heuristic script, treat as an estimate]`
**How to avoid:** Auto-remove only pure ones; emit the mixed list as a review queue (file:line plus text), rewrite each to keep the rule without the citation. Plan for it explicitly; do not size RED-04 as "mechanical".

### Pitfall 4: Bare prose references to the retired documents
**What goes wrong:** The regex-driven pass leaves "the PRD says", "Seed Data's prices", "Handoff, Phase 2 'Done when'" untouched or breaks the sentence.
**Why:** They are outside parentheses. Seed Data alone has 128 lines (53 of the form `Seed Data, "`, 13 `Seed Data's`, ...). The README's "Creates the Seed Data users" (README.md:121) is a product term, not a citation.
**How to avoid:** Include them in the manual review queue; decide per site. Flag README:121 as keep.

### Pitfall 5: Citations that are not comments
**What goes wrong:** The AST gate fails on 27 test files (and a sweep that ignored the gate would change test names silently).
**Why:** `describe('Bill detail (Design › Screens › 15)', ...)`, `it('... (non-negotiable 8)', ...)`, and concatenated titles such as `'... ' + '(Engineering Practices, "Testing")'` are string literals. `[VERIFIED: apps/web/src/screens/bills/bill-detail.test.tsx:71; apps/service/src/jobs/log-autopay.test.ts:34]`
**How to avoid:** Do titles in their own commit, proved with the `--titles` mode (first argument of `describe`/`it`/`test` replaced by a placeholder in both versions; every other literal must still match; negative control verified). The title edit is a behavior-neutral rename of Vitest test names, not "comment-only", so say so in the ledger and PR body. Alternative if the owner prefers strictness: leave titles and list them as retained.

### Pitfall 6: HTML fixtures carry citations as visible body text
**What goes wrong:** Editing `e2e/fixtures/recipes/full-json-ld-light.html`, `full-json-ld-dark.html`, `no-json-ld.html` can change what the recipe importer or the E2E journey reads.
**Why:** The citations are inside `<p>` text (for example `(Engineering Practices › "E2E environment"; Handoff, Phase 3 "Done when": ...)`), not HTML comments. Whether the importer or any assertion reads body text is unproven here. `e2e/fixtures/` is excluded from Prettier and ESLint.
**How to avoid:** Leave all three untouched and ledger them as retained pending owner decision (`[ASSUMED]` that this is the safe default). D-09 does not list HTML.

### Pitfall 7: Directive comments and the printer
**What goes wrong:** The AST proof ignores `// eslint-disable`, `// @ts-expect-error`, `/// <reference>`; deleting one passes the AST check but changes lint or type behavior.
**How to avoid:** No citation currently shares a line with such a directive (git grep, 0 hits), but add a guard that fails if any removed line contains `eslint-disable`, `@ts-`, `v8 ignore`, `c8 ignore`, `istanbul`, `prettier-ignore` or `<reference`, and keep `pnpm lint` (which reports unused disables) and `pnpm typecheck` in the gate. `[VERIFIED: git grep, 0 same-line hits]`

### Pitfall 8: jscpd bar is 96, current main is 99
**What goes wrong:** The team stops at 98 and calls it "fewer than before".
**Why:** The Phase 4 test `apps/web/src/screens/deals/deal-card.test.tsx` added 4 same-file clones; deleting `fuzzy-benchmark.ts` removed 1. Net 96 - 1 + 4 = 99. `[VERIFIED: jscpd run and report diff this session]`
**How to avoid:** Target well below 96. There are 61 cross-file clones now (50 test-involved, 11 source-only deferred), so removing about 25 to 35 of the 50 gives a safe margin. Measure after each helper extraction. New helpers must not create clones among themselves.

### Pitfall 9: Workflow-file pushes from the cloud session
**What goes wrong:** `git push` of a branch containing `.github/workflows/ci.yml` is rejected.
**Why:** Quick task 261020-wnk recorded the rejection: "refusing to allow an OAuth App to create or update workflow .github/workflows/ci.yml without workflow scope"; its branch was never pushed. `[VERIFIED: .planning/quick/261020-wnk-.../261020-wnk-SUMMARY.md:49,81]`. `gh auth status` in this sandbox also reports an invalid `GH_TOKEN`.
**How to avoid:** PR A (and any RED-04 edit to `ci.yml`/`deploy.yml`) needs a `checkpoint:human-action`: the owner pushes the branch, or supplies a token with `workflow` scope. Plan PR A so the owner's push is one step. Keep the `ci.yml` and `deploy.yml` citation edits in PR A or hand them to the owner with the rest, so PR C does not need workflow scope.

### Pitfall 10: Dependabot stops seeing the moved actions
**What goes wrong:** `pnpm/action-setup@v6` and `actions/setup-node@v7` move into `.github/actions/setup/action.yml`, which Dependabot's `github-actions` entry with `directory: /` does not scan; weekly bumps for those two silently stop.
**Why:** GitHub's docs say set `directory` to `/` to check workflow files in `.github/workflows`; they do not mention composite actions. `[CITED: docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/auto-update-actions]`. A third-party note says composite actions need an entry per directory. `[ASSUMED]`
**How to avoid:** In `.github/dependabot.yml` change the github-actions entry to `directories: ['/', '/.github/actions/setup']` (the file already uses the `directories` key for docker). Verify on the first Dependabot run.

### Pitfall 11: CLAUDE.md managed blocks are regenerated from the maps
**What goes wrong:** D-11 is applied to `.claude/CLAUDE.md` by hand, then a later map regeneration overwrites it from the unchanged `CONVENTIONS.md`.
**Why:** CLAUDE.md blocks are marked `<!-- GSD:conventions-start source:CONVENTIONS.md -->`, `GSD:stack`, `GSD:architecture`; the section "Running E2E in the Claude cloud sandbox" sits outside the markers. `[VERIFIED: .claude/CLAUDE.md lines 22, 162, 257, 472]`. The same Comments text is in `.planning/codebase/CONVENTIONS.md:131`.
**How to avoid:** Make the D-11 change in the regenerated `CONVENTIONS.md` first, then regenerate CLAUDE.md (`gsd_run query generate-claude-md --output ./.claude/CLAUDE.md`), then confirm the hand-maintained E2E section survived. The replacement text must not use the retired vocabulary, or the post-condition grep will hit CLAUDE.md. Suggested wording: "Explain why, not what. Do not cite sections of retired spec documents; state the rule itself."

### Pitfall 12: Pre-commit cost on a 450-file commit
**What goes wrong:** `lint-staged` runs `eslint --fix` and `prettier --write` on every staged `.ts/.tsx/.js/.mjs`, then the hook runs `pnpm typecheck`.
**How to avoid:** Commit in batches by area (web screens, web components, service, packages, e2e, non-TS), not one giant commit. Full `pnpm lint` is 45 s and `pnpm typecheck` 14 s here, so per-batch hooks are fine. Commitlint: types are `feat|fix|docs|refactor|test|chore|perf|build|ci`; scopes only `web|service|shared|recurrence|matching|db|e2e|docker`; subject at most 71 characters; body lines at most 100. `[VERIFIED: commitlint.config.js; probe: "docs(05): x" REJECTED, "chore: strip spec citations from comments" OK, "refactor(web,service): drop spec citations" OK, "test(service): share the integration stack hooks" OK, "ci: add a composite setup action" OK]`

### Pitfall 13: Sandbox is Node 22, not 24
**What goes wrong:** `pnpm test` in this sandbox shows 3 failures in `scripts/test-sweep.test.mjs` ("an --only that selects no test fails the sweep") and a `Unsupported engine` warning.
**Why:** `node --version` is v22.22.0 while `.nvmrc` is 24. Cause not proven; CI runs Node 24 and is green. `[VERIFIED: node --version; pnpm test run, 228 pass 3 fail in the harness phase]` `[ASSUMED: Node 22 is the cause]`
**How to avoid:** Executors should compare against this baseline (harness: 228 pass / 3 fail on Node 22; workspace suites all green) and rely on PR CI for the authoritative run.

## Code Examples

### 1. Composite action (RED-01)
```yaml
# .github/actions/setup/action.yml
name: Set up Hearth
description: Install pnpm and Node from .nvmrc with the pnpm store cached, then install dependencies from the lockfile.

# Callers run actions/checkout first: a local action is read from the checked-out workspace.
runs:
  using: composite
  steps:
    - uses: pnpm/action-setup@v6
    - uses: actions/setup-node@v7
      with:
        node-version-file: .nvmrc
        cache: pnpm
    - run: pnpm install --frozen-lockfile
      shell: bash
```
Each job then reads:
```yaml
    steps:
      - uses: actions/checkout@v7
      - uses: ./.github/actions/setup
      - run: pnpm lint
```
Prototype result: replacing all six blocks gives `actionlint .github/workflows/ci.yml` exit 0 (`actionlint` run on `action.yml` itself reports "on section is missing", because it treats it as a workflow; do not lint the action file with it). The only baseline `actionlint` finding on today's workflows is the unknown self-hosted label `hearth` in `deploy.yml:25`, which is expected. `[VERIFIED: actionlint 1.7.7 run this session]`

### 2. Expanded-steps equivalence proof (D-15)
```js
// .planning/cleanup/tools/expand-compare.mjs  usage: node expand-compare.mjs <old ci.yml> <new ci.yml> <action.yml>
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const YAML = createRequire('/ABS/PATH/apps/service/package.json')('yaml'); // resolve from the workspace that has it
const [oldP, newP, actP] = process.argv.slice(2);
const oldWf = YAML.parse(fs.readFileSync(oldP, 'utf8'));
const newWf = YAML.parse(fs.readFileSync(newP, 'utf8'));
const action = YAML.parse(fs.readFileSync(actP, 'utf8'));
const inline = action.runs.steps.map(({ shell, ...rest }) => rest); // `shell` exists only in composites
for (const job of Object.values(newWf.jobs)) {
  job.steps = job.steps.flatMap((s) => (s.uses === './.github/actions/setup' ? structuredClone(inline) : [s]));
}
assert.equal(newWf.name, 'CI');                                          // D-13
assert.deepEqual(Object.keys(newWf.jobs), Object.keys(oldWf.jobs));      // D-13 job ids and order
assert.deepEqual(newWf, oldWf);                                          // D-15
console.log('OK');
```
Prototype output: `OK: expanded workflow deep-equals the original; jobs: lint, typecheck, test-unit, test-integration, test-e2e, build`; with `cache: pnpm` changed to `cache: npm` in the action it throws (negative control). `[VERIFIED: run this session]`. Get the old file with `git show origin/main:.github/workflows/ci.yml`. Note: after PR A also edits comments, YAML parse equality still holds because `parse()` drops comments.

### 3. TS/JS comment-only checker core (D-10)
```js
// .planning/cleanup/tools/comment-only-check.mjs (core). usage: node comment-only-check.mjs <base-ref> [--titles]
import ts from 'typescript';
const TITLE_FNS = new Set(['describe', 'it', 'test']);

export function normalize(text, fileName, { titles = false } = {}) {
  const kind = /x$/.test(fileName) ? ts.ScriptKind.TSX : /\.[cm]?js$/.test(fileName) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, false, kind);
  const transformer = (ctx) => {
    const f = ctx.factory;
    const visit = (node) => {
      if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
        // An empty `{/* comment */}` child and whitespace-only JSX text carry no semantics.
        const kept = node.children
          .filter((c) => !(ts.isJsxExpression(c) && !c.expression) && !(ts.isJsxText(c) && c.containsOnlyTriviaWhiteSpaces))
          .map((c) => ts.visitNode(c, visit));
        return ts.isJsxElement(node)
          ? f.updateJsxElement(node, ts.visitNode(node.openingElement, visit), kept, ts.visitNode(node.closingElement, visit))
          : f.updateJsxFragment(node, ts.visitNode(node.openingFragment, visit), kept, ts.visitNode(node.closingFragment, visit));
      }
      if (titles && ts.isCallExpression(node)) {
        const callee = ts.isPropertyAccessExpression(node.expression) ? node.expression.expression : node.expression;
        if (ts.isIdentifier(callee) && TITLE_FNS.has(callee.text) && node.arguments.length > 0) {
          const [, ...rest] = node.arguments;
          return f.updateCallExpression(node, ts.visitNode(node.expression, visit), node.typeArguments,
            [f.createStringLiteral('<title>'), ...rest.map((a) => ts.visitNode(a, visit))]);
        }
      }
      return ts.visitEachChild(node, visit, ctx);
    };
    return (root) => ts.visitNode(root, visit);
  };
  const out = ts.transform(sf, [transformer]);
  return ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed }).printFile(out.transformed[0]);
}
// Driver: for each file in `git diff --name-only <base-ref>` matching ts/tsx/js/mjs,
// compare normalize(git show <base-ref>:<path>) with normalize(working file); print path and FAIL on any mismatch;
// also fail if a removed line matches /eslint-disable|@ts-|v8 ignore|c8 ignore|istanbul|prettier-ignore|<reference/.
// Record the exit code and the file count in TEXT-SYNC-LEDGER.md.
```
`describe.each(table)('name', fn)` is not matched by the title mode (its callee is a call), so such a file reports DIFFERENT and goes to manual review. `[VERIFIED: prototype run; titles mode IDENTICAL for a title-only edit and DIFFERENT for a code-string edit]`

### 4. Service integration hooks (RED-03 cluster A)
```ts
// apps/service/src/test/stack-hooks.ts (new). Relative imports end in .js (NodeNext).
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, expect } from 'vitest';
import { startStack, type Stack } from './service-stack.js';

/** Live bindings: test files import `app` and `stack` and read them at call time. */
export let stack: Stack;
export let app: FastifyInstance;

/** Call once at the top of an integration test file. */
export function useStack(): void {
  beforeAll(async () => {
    stack = await startStack();
  });
  beforeEach(async () => {
    // A fresh app per test, so the in-memory per-IP rate limits never carry over.
    app = await stack.newApp();
  });
  afterAll(async () => {
    await stack.close();
  });
}

export function expectStatus(response: LightMyRequestResponse, status: number): void {
  expect(response.statusCode, response.body).toBe(status);
}
```
Current duplicates this replaces: `let stack: Stack; let app: FastifyInstance; beforeAll(startStack) / beforeEach(newApp) / afterAll(close)` and a local `expectStatus` in 11 files (`api`, `bills`, `chores`, `deals`, `errands`, `lists`, `match-overrides`, `meal-plan`, `notifications`, `readiness`, `recipes`). `[VERIFIED: grep -c 'function expectStatus' returns 1 in each of those 11]`. `deals.integration.test.ts:55` does `app = await stack.newApp({ deps: { deals } })` and `recipes.integration.test.ts` builds its own apps; they adopt only `expectStatus`. `readiness.integration.test.ts` has extra setup in `beforeAll`; check before adopting `useStack()`.

## Fixture Consolidation Map (RED-03)

Measured: 99 clones now (baseline 96); 61 cross-file (50 test-involved, 11 source-only deferred) and 38 same-file (left alone, D-07). `[VERIFIED: jscpd@5.4.1 report diff vs .planning/cleanup/jscpd/source-with-tests/jscpd-report.json]`

| Cluster | Clones (cross-file) | Duplicated block | Proposed helper | Where |
|---------|--------------------|------------------|-----------------|-------|
| A. Service stack hooks | 14: `api` vs `chores`, `meal-plan`, `bills`, `lists`, `notifications`, `match-overrides`; `chores` vs `errands` (34 and 12 lines); `lists` vs `match-overrides`; `meal-plan` vs `match-overrides`, `readiness`, `lists` | `let stack/app`, three hooks, `expectStatus`, then per-file `createHousehold`-style helper | `useStack()`, `expectStatus` (Code Example 4); then consider moving the repeated "create a household for a user" body into `service-stack.ts`, which already exports `household()` and `createHouseholdFor()` | `apps/service/src/test/stack-hooks.ts` |
| B. Job logger and job-db setup | 3: `dispatch-notifications.integration` vs `jobs.integration` (20 lines), `scheduler.test` (12), `dispatch-notifications.test` (10) | `makeLogger()`/`logger()` returning a `JobLogger` that pushes into `lines`; the `beforeAll` that builds `jobDb` | `recordingJobLogger(lines)` and optionally `createJobTestDb()` | `apps/service/src/test/job-logger.ts` |
| C. Web online/pointer/mount stubs | about 26: `write-queue.test.tsx` and `bill-detail`, `bills-index`, `recipe-detail`, `lists`, `planner`, `recipe-library`, `subscriptions`, `chores`, `errands`, `deal-search`, `chores-offline-queue` | `setOnline()` (14 files; 12 byte-identical, 2 variants), the `matchMedia` coarse-pointer stub in `beforeEach` (12 files; 10 identical, 2 variants), `openMenu()` (4 files; 2+2 variants), `mount()` = `createFetchStub` + `vi.stubGlobal('fetch')` + `renderScreen` (16 files) | `setOnline`, `stubCoarsePointer`, `useOnlineAndPointerStubs()` (registers the `beforeEach`/`afterEach` pair), `openMenu`; and `mountWithFetchStub(ui, handlers)` in `harness.tsx` | `apps/web/src/test/browser.ts` and `harness.tsx` |
| D. Household-timezone fake clock | 3: `bills`, `chores`, `screens/household-timezone` (16 lines each), plus `meals/household-timezone` vs `recipe-detail` (17) | `beforeEach(useFakeTimers({toFake:['Date']}); setSystemTime(PINNED_INSTANT); onlineManager.setOnline(true))` and `afterEach(useRealTimers; unstubAllGlobals; restoreAllMocks)` | `useHouseholdClock(instant)` | `apps/web/src/test/browser.ts` |
| E. Offline-queue harness | 6: `chores-offline-queue` vs `errands-offline-queue` (16, 9, 18 lines), `chores`/`errands` | `WithQueue` wrapper component, `setOnline`, mount function shape | `WithQueue` exported once; `setOnline` from C | `apps/web/src/test/harness.tsx` |
| F. Deals test stubs | about 8: `deal-search`, `favorites`, `flyers`, `suggestions` (17 lines), `deal-card` vs `onboarding` (15) | base handler table and mount | `baseHandlers`-style factory in `deal-fixtures.ts` | `apps/web/src/test/deal-fixtures.ts` |
| G. Misc | 1: `App.test.tsx` vs `settings.test.tsx` (10 lines) | session handler stub | fold into harness only if trivial | `harness.tsx` |

Notes:
- Before replacing any duplicate, diff the variants. `setOnline` has 3 distinct bodies across 14 files, `openMenu` 2 distinct, the pointer stub 3. A helper must preserve each file's exact semantics or the file keeps a local variant.
- `jscpd` exact file lists for each cluster are in the 99-clone list; regenerate with the command below rather than trusting these counts after the first edits.
- Helpers fall under the lint ban on bare `new Date()` and `Date.now()` (`eslint.config.js` clock rule applies to test files and helpers); `setOnline` uses `new Event(...)`, which is allowed. Service helper dir `apps/service/src/test/**` is excluded from the service-role import fence and from knip's project set, and `src/test/**` is excluded from service coverage. `[VERIFIED: eslint.config.js ignores list lines 100-106; vitest.coverage.config.ts exclude; knip.json "!src/test/**!"]`
- Optional, not required: `packages/matching/vitest.config.ts` and `packages/shared/vitest.config.ts` are a 21-line source-side clone (listed in the 11 deferred). Leave unless a count is needed.

### jscpd re-scan (D-05), exact command
```bash
pnpm dlx jscpd@5.4.1 apps packages e2e supabase/seed --format typescript,tsx --min-tokens 60 --min-lines 8 \
  --ignore "**/node_modules/**,**/dist/**,**/coverage/**,**/db/types.ts" \
  --reporters json,console --output .planning/cleanup/jscpd/after-phase-5
```
Run from the repo root. It worked through the sandbox proxy in 1.3 s and respects `.gitignore` by default. The `--gitignore` flag does not exist in 5.4.1. `[VERIFIED: ran this session; totals today: 521 sources, 99 clones, 1,472 duplicated lines (1.90%) at HEAD dbcbe1b]`. `pnpm dlx` has no `--offline`/`--prefer-offline` option (both errored); the sandbox's proxy made the fetch work. If the network is down, reuse of pnpm's dlx cache is `[ASSUMED]`.
Compare with `statistics.total.clones` (baseline 96) and duplicated lines (baseline 1,438) in `jscpd-report.json`. Take the final scan after PR C as well as PR B: jscpd's treatment of comments was not tested, so a 450-file comment sweep may move the count in either direction (`[ASSUMED]` small).

## Docs and Maps: Risky Claims (RED-05)

Prototype checker over `docs/*.md` (414 backticked path-like tokens): no outright missing repo paths. All misses were relative names (`index.css`, `sw.ts`), directory shorthand under `e2e/`, config strings, or negations. The real drift is behavioral. Verified mismatches and high-risk statements, in priority order:

| # | Claim (file:line) | Reality | Evidence |
|---|-------------------|---------|----------|
| 1 | `docs/file-map.md:74`: "`bin` | The built `hearth-admin` command-line executable." Also `.planning/codebase/ARCHITECTURE.md:227` ("built to"), `STRUCTURE.md:16` and `:265` ("Built hearth-admin executable"), and the CLAUDE.md copy at line 390 | `apps/service/bin/hearth-admin` is a hand-written POSIX shell wrapper (`#!/bin/sh`, `exec node "$here/../dist/cli.js" "$@"`), mode 100755; the Dockerfile copies it and symlinks it onto PATH. The bundle it runs is `dist/cli.js`. | `[VERIFIED: apps/service/bin/hearth-admin; git ls-files -s; docker/service.Dockerfile:35-37]` |
| 2 | `docs/testing.md:692-693`: the three pure packages' "`test`/`test:coverage` scripts both run with `--coverage`, so `pnpm test` ... fails the moment coverage drops below 90% ... in any of the three" | Only `packages/recurrence` `test` has `--coverage`. `packages/matching` and `packages/shared` `test` is `vitest run --passWithNoTests`. Thresholds of 90 are set in all three configs. | `[VERIFIED: packages/matching/package.json:11, packages/shared/package.json:13, packages/recurrence/package.json:11; vitest.config.ts thresholds lines 18/15/18]` |
| 3 | `docs/testing.md:706-708`: "`apps/web` has no `test:coverage` script and no coverage configuration at all" | `apps/web/package.json:12` has `"test:coverage": "vitest run --coverage --passWithNoTests"` and `vite.config.ts:87` sets `thresholds: { statements: 82, branches: 78, functions: 74, lines: 84 }`. CI does not run it. Phase 6 (CI-06) will decide enforce-or-remove, so describe the present state only. | `[VERIFIED: apps/web/package.json:12; apps/web/vite.config.ts:78-88]` |
| 4 | `docs/file-map.md` `scripts/` table (lines 148-156) omits `ci-prepull-images.sh`, `ci-prepull-images.test.mjs`, `deploy.test.mjs`; the `test/` table omits `eslint-service-role-fence.test.mjs`; the service `routes` row (line 60) omits `match-overrides` and `health` | These files exist. | `[VERIFIED: ls scripts test apps/service/src/routes]` |
| 5 | `docs/file-map.md:21` and the CI row at `:186` describe `.github/` without the new composite action | Add `.github/actions/setup` once PR A lands | derived |
| 6 | `docs/architecture.md:298`: "every queueable write either carries a client-generated UUID (an add) or sends an absolute value" | Deal add is an online mutation, not a queued write; Phase 4 holds its item id per list and deal at `QueryClient` scope across retries and unmounts, in memory only (a reload mints a new id). D-17 asks for this to be reflected. | `[VERIFIED: apps/web/src/lib/api/deals.ts:239-272; .planning/cleanup/FIX-LEDGER-HELD-ID.md findings (c),(d)]` |
| 7 | `.planning/codebase/CONCERNS.md:31` (RotationEditor eslint suppression), `:58-61` (Kong `auth-v1-all`, "deny the rest in Kong"), `CONVENTIONS.md:60` ("eslint-disable appears only twice"), `:125` (console.log only in `fuzzy-benchmark.ts`), `TESTING.md:125` ("Tests never depend on the wall clock", needs the pin and sweep) | Fixed or removed in Phases 2-4: FIX-04, FIX-07 (Kong is now an allowlist), benchmark deleted, clock pin added. | `[VERIFIED: grep of maps; docs/deploy.md:77-82 and docker/kong.yml route names]` |
| 8 | README prose references (README.md:69 "Engineering Practices, 'E2E environment', has the detail."; :146 "(Technical Architecture, ...") | Citations of retired documents; remove the pointer sentence (D-08, no docs rewrite) | `[VERIFIED: README.md:69,146]` |
| 9 | jscpd tooling (D-17 asks for it) | `git grep jscpd` outside `.planning/` returns nothing: jscpd is not committed tooling (run via `pnpm dlx`). Nothing in `docs/` to fix; add a short mention to `docs/testing.md` only if the owner wants the scan documented before Phase 6 wires it into CI. | `[VERIFIED: git grep jscpd -- . ':!.planning', 0 hits]` |

Already correct (spot-checked, no action): Kong allowlist paragraph in `docs/deploy.md:74-82` matches `docker/kong.yml` route names (`auth-v1-verify`, `-token`, `-logout`, `-user`, `-otp`, `-admin-users`, `-denied`, `realtime-v1-ws`); `docs/testing.md` service thresholds (95/83/96/97) match `vitest.coverage.config.ts`; `HEARTH_TEST_NOW` default `2026-10-14T12:00:00.000Z` matches `test/clock-setup.mjs:45`; `docs/deploy.md:160` `PGPASSWORD` and `:177-179` Kong recreate step are present; `docs/` contains none of the retired vocabulary.

### D-18 verification script (design)
Extract backticked tokens from `docs/*.md`, `.planning/codebase/*.md`, `README.md`; for tokens that look like paths or script names, test against `git ls-files` (exact, then directory, then unique suffix); for `pnpm ...` tokens test the script name against root and `--filter` workspace `package.json` scripts. Treat tokens with spaces, `=`, `<`, `{`, URLs and absolute host paths (`/srv`, `/etc`) as out of scope. Output a table of misses; each miss is fixed or justified in the ledger. Ambiguous bare names (`app.ts`, `bills.ts`, `index.ts`, `db.ts`, `money.ts`, `occurrence.ts`, `vitest.config.ts`) resolve to several files and need a human glance. A working prototype of the extractor ran in this session (414 tokens checked).
Behavioral sample for the ledger (choose at least 10): the nine rows above, plus `hearth-admin reset-password` use in `docs/use-cases.md:111`, the `docker/kong-entrypoint.sh` description, the notification outbox claim-then-send description, and the E2E overlay description.

### Codebase map regeneration mechanics (D-16)
- `/gsd-map-codebase` spawns `gsd-codebase-mapper` agents that write the seven documents directly; `last_mapped_commit` is stamped deterministically afterwards. `[CITED: ~/.claude/gsd-core/workflows/map-codebase.md]`
- Current maps carry `last_mapped_commit: b96ca32ac1130c09f8aa3066d715181ddf3fb31a`, `last_mapped_at: 2026-10-11`. `[VERIFIED: .planning/codebase/STACK.md frontmatter]`
- CLAUDE.md blocks refreshed by hand in `2cff293` (docs: refresh stale project instructions) already differ from the stale maps (CLAUDE.md says `eslint-disable` appears five times, the map says twice). After regeneration, CLAUDE.md's stack, conventions and architecture blocks will be rewritten from the new maps: review the diff rather than accept blindly. Recommendation for the open decision: refresh CLAUDE.md in this phase, because D-11 requires editing its Comments text anyway and regeneration is the supported way.
- Do the regeneration last and re-run the `CIT_RX` post-condition grep over `.planning/codebase/` and `.claude/CLAUDE.md` (currently 1 hit in `CONVENTIONS.md`, plus the CLAUDE.md Comments line).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Repeat setup steps per job | Local composite action (`runs.using: composite`) | Long-standing | Setup edits happen in one file; Dependabot needs an explicit directory entry. |
| Same-repo action requires checkout | `$/` self-repository reference resolves at the running commit without checkout | Recent per GitHub docs | Would allow checkout inside the action; out of scope (D-12 locked). `[CITED: docs.github.com workflow-syntax]` |

**Deprecated/outdated:** the retired spec vocabulary itself (seven documents deleted in `e3781a9`); `fuzzy-benchmark.ts` (deleted in `d8f3daf`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Dependabot's `github-actions` entry with `directory: /` does not scan `.github/actions/*/action.yml`; an explicit directory entry is needed | Pitfall 10 | If it does scan, the extra entry is harmless duplication. |
| A2 | `$/` is not understood by actionlint 1.7.7 | Pattern 1 | Only affects an option we are not taking. |
| A3 | The 3 harness failures in this sandbox come from Node 22 vs required 24 | Pitfall 13 | If they are real regressions on main, they would also fail in CI (CI is green), so low risk; executors compare to baseline. |
| A4 | HTML fixture body text is not read by the importer or assertions; the safe default is to leave the fixtures alone | Pitfall 6 | If some are safe to edit, 3 citations remain; cheap to fix later. |
| A5 | Web build output hashes are identical after comment-only edits (optional extra proof) | Runtime State Inventory | Only an optional proof; if hashes differ, fall back to the AST proof. |
| A6 | jscpd treats comments such that a comment sweep moves the clone count only slightly | Fixture map | If large, take the scan after PR C as well as PR B and judge the delta. |
| A7 | `pnpm dlx` can reuse its cache offline | jscpd re-scan | If not, run where the network is reachable (as here). |
| A8 | ~583 pure vs ~199 mixed parentheticals (heuristic split) | Pitfall 3 | Planner may under- or over-size the manual review queue. |
| A9 | The 11 "other" non-comment, non-string TS matches are JSX `{/* */}` comments (one inspected: `ChoreListRow.tsx:79`; all are in `.tsx` components) | Pitfall 1 | If any is JSX text, the AST proof will flag it and it moves to manual review. |
| A10 | "Phase N" mentions that are not part of a Handoff citation (about 40 lines, for example `Phase 3 owns the 0.85 fuzzy threshold`) are product-phase references to the retired plan, not spec citations | Open Questions | If the owner wants them gone too, the sweep grows by about 40 lines and risks confusion with GSD phase numbers. |

## Open Questions (RESOLVED)

1. **Scope of "citations" versus D-08's example list (needs planner decision, flag to owner)**
   - What we know: D-08 says "all citations of the old spec's sections" with `(Technical Architecture ...)`, `(Requirements ...)`, `(Design › ...)` as examples. The code also cites Engineering Practices, Branding, Seed Data, PRD, `Handoff non-negotiable N`, `Handoff, Phase N "Done when"` (counts above). Narrow vs full is 582 vs 1,118 lines.
   - What's unclear: whether the owner expected only the narrow set.
   - Recommendation: use the full vocabulary (the retired set is the seven deleted documents; leaving `non-negotiable 8` cites a deleted document just as much). State the real counts in the ledger and the PR body.
   - **RESOLVED (D-21):** the full retired-spec vocabulary is in scope (`.planning/cleanup/tools/cit-rx.txt`), with the real counts recorded in the ledger and migrations left untouched.

2. **String-literal test titles (27 files, 46 matches)**
   - Recommendation: edit them in a separate commit proved with the title-normalised mode and labelled "not comment-only; Vitest test names change". Alternative: leave and list as retained. Success Criterion 4 says "comment-only", so the owner should know titles are being treated differently.
   - **RESOLVED (D-19):** all 46 titles are edited to one consistent style in their own commit labelled NOT comment-only, proved with the title-normalised AST mode (plan 05-10).

3. **HTML fixtures (3 files)**: recommended retain and ledger (Pitfall 6).
   - **RESOLVED (D-20):** the owner chose to include the three recipe HTML fixtures, with recorded proof that no E2E assertion depends on the removed text (plan 05-10).

4. **Non-Handoff "Phase N" references (~40 lines)** and **bare `Seed Data` product-term uses** (README.md:121): recommend leave and ledger as "not spec citations"; owner may widen.
   - **RESOLVED (assumption A10 as applied in the plans):** "Phase N" lines that match nothing in the vocabulary are left and counted as `count-phase-mentions=` (05-06); `Seed Data` matches the vocabulary, so it is rewritten as lower-case "the seed data" (citation rules) and README.md:121 is one of the README citation lines handled in 05-08.

5. **Workflow-file push scope (Pitfall 9)**: the owner must push PR A (or grant `workflow` scope). Confirm who pushes before the plan assigns the task to an executor.
   - **RESOLVED (D-22):** Claude pushes with the session's `GH_TOKEN`; on a `workflow`-scope refusal, the only routes are patch files plus one owner command (05-01 for PR A, 05-05 for the WB sync), the owner's own push, or the same push after the owner grants the scope. No other ref, merge shape or branch name is used.

6. **`docker/kong.yml` comment edit**: recommend include (D-09) with the no-recreate note; the owner may prefer to defer it to avoid any host action.
   - **RESOLVED (D-09):** `docker/kong.yml` is in scope; 05-10 proves it parses to the same configuration, so no Kong recreate is needed on the host.

7. **`ROADMAP.md`/`REQUIREMENTS.md` still say "262 stale spec citations"**: update wording to the recorded count when the phase closes (planning-file edit, allowed by D-04).
   - **RESOLVED (D-04, plan 05-12):** 05-12 restates the RED-04 wording in `ROADMAP.md` and `REQUIREMENTS.md` with the recorded count; the planning files ride in PR D under D-04.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | all scripts, tests | yes (wrong major) | v22.22.0 (repo wants 24) | PR CI on Node 24 is authoritative |
| pnpm | everything | yes | 10.34.5 | none needed |
| `typescript` (compiler API) | comment-only checker | yes | 6.0.3 | none needed |
| `yaml` | YAML proofs | yes (in `apps/service`) | 2.9.1 | resolve via `createRequire` from that workspace |
| jscpd 5.4.1 | RED-03 scan | yes via `pnpm dlx` over the proxy | 5.4.1 | none (network needed) |
| actionlint | workflow lint | yes | 1.7.7 | CI only |
| Docker daemon | local integration/E2E (optional) | yes (server 29.9.1); `supabase_db_hearth` container not running | | PR CI runs integration and E2E; sandbox E2E needs the CA workaround in `.claude/CLAUDE.md` |
| Supabase CLI | `pnpm db:*`, integration | yes | /usr/local/bin/supabase | PR CI |
| `psql` | `db:seed` | yes | /usr/bin/psql | PR CI |
| `gh` | opening PRs | token invalid in this sandbox | n/a | owner opens PRs / provides token |
| Token with `workflow` scope | pushing `.github/workflows/*` | no (rejected before) | | owner pushes PR A |

**Missing dependencies with no fallback:** none for planning; the workflow-scope push is a human action.
**Missing dependencies with fallback:** Node 24 (use PR CI), working `gh` token.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.1 (unit, component, integration), `node --test` (harness), Playwright 1.63.0 (E2E, CI only) |
| Config file | `apps/*/vitest.config.ts` / `apps/web/vite.config.ts` test block / `packages/*/vitest.config.ts`; integration: `apps/service/vitest.integration.config.ts` |
| Quick run command | `pnpm typecheck && pnpm --filter @hearth/web test -- <file>` (typecheck 14 s) |
| Full suite command | `pnpm lint && pnpm format:check && pnpm typecheck && pnpm -r test` (about 2.5 min here) |

Baseline recorded at HEAD `dbcbe1b` on this sandbox: `pnpm lint` exit 0 (45 s); `pnpm format:check` exit 0 (8 s); `pnpm typecheck` exit 0 (14 s); `pnpm -r test` exit 0 in 71 s: matching 156, shared 172, recurrence 77, service 757 (56 files), web 728 (57 files), 1,890 tests; `pnpm test:harness` 228 pass, 3 fail (Node 22 caveat). Integration (`supabase start` needed) and E2E run in PR CI. `[VERIFIED: run this session]`

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RED-01 | Six jobs call one setup action; expanded steps equal the old steps; name `CI`, job ids unchanged | script + lint + CI | `node .planning/cleanup/tools/expand-compare.mjs <old> .github/workflows/ci.yml .github/actions/setup/action.yml` ; `actionlint .github/workflows/ci.yml` ; PR CI six jobs green | no, Wave 0 (script) |
| RED-01 | Dependabot sees the action | config check | `grep -n "actions/setup" .github/dependabot.yml` | n/a |
| RED-02 | Seed typechecked exactly once | command | `pnpm -r --reporter=append-only typecheck 2>&1 \| grep -c 'tsc --noEmit -p ../../supabase/seed'` equals 0, and `... \| grep -c '^supabase/seed typecheck\$'` equals 1; `pnpm typecheck` exit 0 | n/a |
| RED-03 | Fewer jscpd clones than 96; all tests pass | scan + suite | jscpd command above, then `node -e` reading `statistics.total.clones` < 96; `pnpm -r test` equals 1,890 passing (count may grow only if tests are added) | n/a |
| RED-03 | Helpers obey the clock ban | lint | `pnpm lint` | n/a |
| RED-04 | TS/TSX/JS edits are comment-only | script | `node .planning/cleanup/tools/comment-only-check.mjs <base-ref>` exit 0 over every changed ts/tsx/js/mjs file | no, Wave 0 |
| RED-04 | Title edits change only titles | script | same with `--titles` on the title commit | no, Wave 0 |
| RED-04 | YAML edits comment-only | script | `yaml` `parse()` deep-equal for each changed `.yml` (ci, deploy, kong, docker-compose, e2e overlay) | no, Wave 0 |
| RED-04 | `.env.example`, `Caddyfile`, `Dockerfile`, `.sh`, `.toml` edits comment-only | script | every changed line, before and after, is a whole-line comment or equal up to the trailing comment; fail on any changed line whose prefix before `#` differs | no, Wave 0 |
| RED-04 | SQL seed edits comment-only | script | strip `--` comments (verified: no string in `seed.sql` or `e2e-seed.sql` contains `--`, and no `/*` block comments) and compare | no, Wave 0 |
| RED-04 | CSS edit comment-only | script | strip `/* ... */` and compare; optional: web build asset hashes equal | no, Wave 0 |
| RED-04 | Migrations untouched | git | `git diff --exit-code <base-ref> -- supabase/migrations` exit 0 | n/a |
| RED-04 | No citation remains | grep | the four `CIT_RX` commands: first two return 0 (allowlist: retained HTML fixtures and README prose, listed in the ledger) | n/a |
| RED-05 | Backticked paths, scripts, commands exist | script | `node .planning/cleanup/tools/docs-claims-check.mjs docs/*.md .planning/codebase/*.md README.md` zero unexplained misses | no, Wave 0 |
| RED-05 | `hearth-admin` described as hand-written | grep | `head -1 apps/service/bin/hearth-admin` is `#!/bin/sh`; `git grep -nE 'built (to\|hearth-admin)\|Built hearth-admin' -- docs .planning/codebase .claude/CLAUDE.md` returns nothing | n/a |
| RED-05 | No new file under `docs/` | git | `git diff --name-status --diff-filter=A <base-ref> -- docs` is empty; `git ls-files docs \| wc -l` equals 7 | n/a |
| RED-05 | Maps regenerated | frontmatter | `grep last_mapped_commit .planning/codebase/*.md` shows the new SHA in all seven | n/a |

### Sampling Rate
- **Per task commit:** `pnpm typecheck` plus the comment-only checker over the commit's files (or the targeted Vitest file for fixture work). Husky already runs lint-staged and typecheck.
- **Per wave merge:** `pnpm lint && pnpm format:check && pnpm -r test`, plus the proof scripts for that wave, plus jscpd after fixture waves.
- **Phase gate:** full suite, all proof scripts, final jscpd scan, post-condition greps, PR CI six green (integration and E2E run only in CI), then `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `.planning/cleanup/tools/comment-only-check.mjs` plus negative controls (code-string change, directive deletion) recorded in the ledger
- [ ] `.planning/cleanup/tools/expand-compare.mjs`
- [ ] `.planning/cleanup/tools/citation-inventory.mjs` (balanced-paren scanner, pure/mixed classifier, wrapped-comment-aware remover)
- [ ] `.planning/cleanup/tools/docs-claims-check.mjs`
- [ ] Per-type comment-only checks for non-TS files (YAML via `yaml`, `#`, `--`, `/* */`)
- [ ] Ledger files from the layout above
- Framework install: none needed.

## Security Domain

`security_enforcement` is enabled (key present as true, ASVS level 1, block on high). This phase adds no runtime code paths, endpoints or data handling.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no auth code changes |
| V3 Session Management | no | none |
| V4 Access Control | no | RLS and the privileged-import fence are untouched; the fence's ESLint block must still pass |
| V5 Input Validation | no | none |
| V6 Cryptography | no | none |
| V14 Configuration / build and deploy | yes | Keep workflow `permissions: contents: read`; the composite action holds no secrets and inherits the job's permissions; keep action versions pinned to major tags as today (CIX-01 pinning to SHAs is v2, out of scope) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Workflow edit weakens the deploy gate (renamed workflow, changed job ids, removed `if:`) | Tampering | D-13 name and id check in `expand-compare.mjs`; keep `deploy.yml` logic unchanged (only a comment edit) |
| A comment sweep silently deletes a lint or type directive or changes behavior | Tampering | AST-equality gate plus directive guard plus lint and typecheck |
| Docs misstate a security control (password handling, Kong allowlist) after the audit | Information disclosure (misleading operators) | Audit rows 6 and the deploy-security paragraphs against `scripts/deploy.sh` and `docker/kong.yml`; both were checked and match today |
| Ledger or logs capture secrets | Information disclosure | Raw logs stay gitignored under `.planning/cleanup/logs/`; ledgers record commands and counts only |
| Dependabot blind spot for moved actions | Supply chain | Add the action directory to `dependabot.yml` |

## Sources

### Primary (HIGH confidence)
- Repo files read this session: `.github/workflows/ci.yml`, `deploy.yml`, `.github/dependabot.yml`, `apps/service/package.json`, `supabase/seed/package.json`, `commitlint.config.js`, `eslint.config.js`, `knip.json`, `.lintstagedrc.json`, `.prettierignore`, `.husky/*`, `apps/service/src/test/service-stack.ts`, `apps/web/src/test/harness.tsx`, `apps/service/bin/hearth-admin`, `docs/file-map.md`, `docs/testing.md` (coverage section), `docs/deploy.md` (Kong), `.planning/cleanup/TRIAGE.md` (duplication baseline), `.planning/quick/261020-wnk-.../261020-wnk-SUMMARY.md`
- Experiments run this session: `pnpm -r typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm -r test`, `pnpm test`, `pnpm dlx jscpd@5.4.1`, `actionlint`, TypeScript-compiler AST prototype with negative controls, vitest live-binding experiment, ESLint stdin probe, commitlint probes, `npm view jscpd`, gsd-tools package-legitimacy check
- docs.github.com: metadata-syntax (composite requirements), creating-a-composite-action, workflow-syntax (`steps[*].uses`, `$/`), auto-update-actions (Dependabot directory)

### Secondary (MEDIUM confidence)
- Third-party note that Dependabot composite actions need one entry per directory (via web search summary, not read in full)

### Tertiary (LOW confidence)
- Heuristic pure/mixed citation split and the ~40-line "Phase N" estimate (scratch scripts)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all tools run in this sandbox; no new packages.
- Architecture (PR flow, composite action, proofs): HIGH - prototypes executed with negative controls.
- Fixture clusters: HIGH for the cluster map (from the live jscpd report), MEDIUM for exact helper boundaries (variants must be diffed per file).
- Citation sizing: HIGH for line/file counts, MEDIUM for the pure/mixed split.
- Docs/maps risks: MEDIUM - nine verified items, but not a full claim-by-claim audit; the executor's script and reading complete it.
- Pitfalls: HIGH.

**Research date:** 2026-10-21
**Valid until:** 2026-11-04 (counts move with every merge; re-run the recorded commands at plan start; jscpd and GitHub docs are fast-moving)
