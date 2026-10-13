# Architecture Research

**Domain:** Repo cleanup and hardening of a brownfield TypeScript pnpm monorepo (Fastify service, React/Vite PWA, Supabase/Postgres, Playwright E2E, GitHub Actions CI)
**Researched:** 2026-10-11
**Confidence:** MEDIUM overall. Repo facts below were read from the repo (HIGH). Claims about dead-code tool behaviour (knip 6.41.0) come from its official docs via fetch (classified LOW by the confidence seam until cross-checked) and are marked "verify by canary" wherever the roadmap should not trust them blind.

This document does not re-describe the Hearth runtime (see `.planning/codebase/ARCHITECTURE.md`). It describes the architecture of the cleanup effort itself and how its tools, safety nets, and gates attach to the existing monorepo.

## Standard Architecture

### System Overview

```
 EXISTING SYSTEM (read-only input, behaviour must not change)
 apps/web  apps/service  packages/{shared,matching,recurrence}  e2e  supabase/seed
 docker/  supabase/migrations  .github/workflows  scripts/
                                  |
                                  v
+--------------------------------------------------------------------------+
| STAGE 1  ANALYSIS (additive only; no production file changes)            |
|  knip per-workspace   duplicate scan   stale-reference scan              |
|  config-surface reconcile (env.ts / compose / .env.example / docs)       |
|  committed-artifact inventory                                            |
|             |  raw findings                                              |
|             v                                                            |
|  TRIAGE LEDGER  (.planning/, never docs/)                                |
|   PROVEN-DEAD | CONFIG-GAP | TEST-ONLY | UNCERTAIN(owner list)          |
+--------------------------------------------------------------------------+
        | PROVEN-DEAD only                      | CONFIG-GAP back to knip config
        v                                       |
+--------------------------------------------------------------------------+
| STAGE 2  SAFE REMOVAL  (waves, consumers before producers)               |
|  wave N: files -> exports -> dependencies -> re-run analysis (fixpoint)  |
|  each wave passes the TRIPWIRE LADDER for the layers it touched          |
+--------------------------------------------------------------------------+
        |                                       ^
        v                                       | regression catches
+--------------------------------------------------------------------------+
| STAGE 3  ENFORCEMENT (ratchet: report-only -> blocking)                  |
|  CI job(s) in the existing "CI" workflow -> deploy.yml workflow_run gate |
|  freshness checks, migration immutability, dedupe, stale-ref check       |
+--------------------------------------------------------------------------+

 SPINE under every stage: the safety net
   T0 typecheck | T1 lint+format | T2 unit/component | T3 build | T4 integration | T5 E2E
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation (here) |
|-----------|----------------|-------------------------------|
| Safety net | Prove behaviour is unchanged after each change. Must be deterministic first, or failures cannot be attributed. | The existing six gates (T0 to T5, see Tripwire Ladder); date/timezone tests made deterministic before any removal wave |
| Baseline snapshot | A recorded green reference: test counts, coverage numbers, web shell size, raw knip output at the starting commit | One file under `.planning/` (not `docs/`, per the project rule) |
| Dead-code analyzer | Reachability from declared entry points, per workspace, for files, exports, types, dependencies, binaries | `knip` at the repo root, one `knip.json`, per-workspace blocks |
| Stale-reference scanner | Finds references to things that no longer exist (deleted spec names, deleted files in ignore lists, scripts that import uninstalled packages) | A small grep-based script plus knip "unlisted dependency" output; not a framework |
| Config-surface reconciler | Cross-checks env variable names across `apps/service/src/env.ts`, `docker/docker-compose.yml`, `e2e/docker-compose.e2e.yml`, `.env.example`, `scripts/generate-secrets.sh`, `docs/deploy.md` | One-off analysis pass first; cheap check later if it earns it |
| Duplicate scanner | Reports copy-paste duplication in code, fixtures, scripts, CI YAML | `jscpd` as an advisory report only; never a gate |
| Triage ledger | Single place where each finding gets a class and a decision | A planning file; becomes the owner-review list for UNCERTAIN items |
| Removal executor | Applies PROVEN-DEAD deletions in dependency-ordered waves, one reviewable commit per wave per workspace | Plans executed sequentially for shared files |
| Enforcement | Keeps the tree clean after cleanup ends | New jobs in `.github/workflows/ci.yml`; root `package.json` scripts; no pre-commit additions |
| Protected zones | Paths cleanup tooling must never auto-modify | `supabase/migrations/**`, `e2e/fixtures/**`, `apps/service/bin/hearth-admin`, `docker/**`, `scripts/deploy.sh` |

## Recommended Project Structure

New cleanup artifacts and where they belong (nothing here changes application source layout):

```
hearth/
├── knip.json                          # single dead-code config, one block per workspace
├── package.json                       # + scripts: knip, knip:production (devDependency: knip, exact-pinned)
├── .github/
│   ├── actions/setup/action.yml       # composite: checkout-independent pnpm+node+install preamble (redundancy fix)
│   └── workflows/ci.yml               # + job(s); workflow `name: CI` must not change
├── scripts/
│   └── checks/                        # tiny node .mjs checks (precedent: apps/web/scripts/check-build.mjs)
└── .planning/
    └── cleanup/                       # baseline, triage ledger, owner-review list (NOT docs/)
```

### Structure Rationale

- **One root `knip.json`:** knip discovers workspaces from `pnpm-workspace.yaml` and takes per-workspace blocks from a single config; splitting configs per workspace multiplies drift for no gain. Root-level `entry`/`project` are ignored once `workspaces` is used, so the root itself needs a `"."` block (LOW, from knip docs; verify with `knip --debug`).
- **`.planning/cleanup/`, not `docs/`:** the project rule is that `docs/` specs are the only source of truth and no review, decision-log, or ADR files go there (PROJECT.md, memory note).
- **`scripts/checks/*.mjs`:** repo already uses plain node `.mjs` build checks in `apps/web/scripts/`. Do not add a task runner. Run `pnpm lint` once after adding the first one, because `eslint.config.js` lists `allowDefaultProject` globs (`*.js`, `*.mjs`, `apps/web/scripts/*.mjs`) and a new directory may need adding.
- **Composite setup action:** `ci.yml` repeats the same five-line preamble (checkout, pnpm/action-setup, setup-node with `.nvmrc`, `pnpm install --frozen-lockfile`) in six jobs. Collapsing it is both a redundancy fix and the cheapest way to add new jobs without copying it again.

## Architectural Patterns

### Pattern 1: Evidence ladder (three signals before any deletion)

**What:** A candidate is deleted only if all three hold: (1) the static graph says unreachable from declared entries (knip default mode); (2) a repo-wide text search of the symbol or path, including non-TypeScript files, finds no live reference; (3) the removal passes the tripwire gates for the layers touched.
**When to use:** Every deletion. This is the operational form of the PROJECT.md constraint "removal requires tooling or test proof; ambiguous cases are reported".
**Trade-offs:** Slower than "delete what knip says", but the repo has several consumers static analysis cannot see (see the matrix below): Docker COPY paths, the Compose overlay volume mounts, the service worker named only in `vite.config.ts`, a shell shim for the CLI, SQL files, and fixture lookup by computed filename.

**Second-signal grep scope (must include):** `docker/`, `e2e/docker-compose.e2e.yml`, `.github/`, `scripts/`, `supabase/`, `*.json`, `*.yml`, `*.sh`, `*.sql`, `docs/`, `README.md`.

### Pattern 2: Reverse-dependency removal waves with a fixpoint

**What:** Remove from consumers toward producers, and iterate until the analyzer reports nothing new. Workspace graph (arrows are "imports"):

```
 e2e ----------------------------> (HTTP only; reads e2e/fixtures also via service)
 apps/web ---> packages/shared, packages/recurrence
 apps/service -> packages/shared, packages/recurrence, packages/matching
 supabase/seed -> packages/matching
```

Wave order: `apps/web`, `apps/service`, `e2e`, `supabase/seed`, then `packages/recurrence`, `packages/matching`, `packages/shared`. Within each wave: files, then exports/types, then dependencies, then re-run.
**When to use:** Always. An export in `packages/shared` becomes unused only after the screen or route using it is deleted, so pruning producers first just hides findings until the next run.
**Trade-offs:** Needs 2 to 3 analyzer iterations. Cheap, because knip on a 668-file repo takes seconds.

### Pattern 3: Calibrate before trusting (canary and positive controls)

**What:** Before any finding is acted on, prove the analyzer sees each workspace the way the build does. Negative control: a temporary unused file, a temporary unused barrel export, and a temporary unused devDependency per workspace must each be reported. Positive control: known-live dynamic entries (`apps/web/src/sw.ts`, `apps/service/src/cli.ts`, `supabase/seed/seed-users.ts`, `e2e/global-setup.ts`) must not appear as unused, and `knip --debug` shows the resolved entry set.
**When to use:** Once, at the start of Stage 1, and again whenever `knip.json` or a plugin version changes.
**Trade-offs:** Half a day of work that prevents deleting a live service worker or a missing-exports blind spot (see packages below).

### Pattern 4: Ratchet gating

**What:** Add the analyzer to CI early as a non-blocking job so findings are visible; make it blocking only when the tree is clean. Items the owner has not yet judged (UNCERTAIN) are encoded as an explicit, commented `ignore` block in `knip.json`, so CI is green and the list stays in one place; removing an entry later is a one-line change.
**When to use:** For every new gate (knip, dedupe, freshness).
**Trade-offs:** The `ignore` block must not become a dumping ground. Rule: each entry carries a reason; PROVEN-DEAD items are deleted, never ignored.
**Why it matters here:** `deploy.yml` fires on `workflow_run` of the workflow named `CI` and requires conclusion `success` on `main`. A blocking gate that is red on `main` blocks deploys of everything, including bug fixes.

### Pattern 5: Single-writer files and typed commits

**What:** Some files are shared mutable state across work streams: `pnpm-lock.yaml`, root and workspace `package.json`, `knip.json`, `.github/workflows/ci.yml`, `eslint.config.js`, `pnpm-workspace.yaml`. Assign each wave exactly one owner at a time (config has `parallelization: true`, so this must be explicit). Keep commits typed: mechanical (comment or config only), deletion, behaviour fix, refactor. Never mix mechanical sweeps with behaviour changes.
**Proof for comment-only sweeps:** transform each changed file at the base commit and at the head with the repo's pinned esbuild (override `0.28.2`, comments stripped) and require byte-identical output. Any diff means the sweep changed code.

### Pattern 6: Tripwire ladder keyed to change type

**What:** Each change type declares the minimum gates it must pass. Gates are cumulative in cost.

| Gate | Command | What it catches that cheaper gates cannot |
|------|---------|--------------------------------------------|
| T0 | `pnpm typecheck` (all workspaces, plus `supabase/seed`) | Deleted export still imported |
| T1 | `pnpm lint` and `pnpm format:check` | `privileged/` fence, stale `eslint-disable` (warn plus `--max-warnings=0`), a11y rules |
| T2 | `pnpm test` | Behavioural regressions in pure packages, web components, service units |
| T3 | `pnpm build` | tsup entries, `write-openapi.ts`, Vite plus PWA manifest injection, `check-build.mjs` (200 KB shell budget; magic-link copy looked up by literal source paths) |
| T4 | `supabase start` then `pnpm --filter @hearth/service test:coverage` | SQL, RLS, routes against real Postgres; coverage floors (service 95/83/96/97; web 82/78/74/84) |
| T5 | `pnpm test:e2e` | Compose-only wiring: both Docker image builds, fixture mounts, Caddy and Kong routing, service worker and offline in a real browser |

| Change type | Minimum gates |
|-------------|---------------|
| Delete unused file or export in `apps/web` | T0, T1, T2, T3 |
| Same, touching `sw.ts`, push, offline, realtime | T0 to T3 plus T5 (service worker only truly runs in a browser; sw.test.ts is a unit proxy) |
| Delete unused file or export in `apps/service` | T0 to T4; add T5 if it is wiring in `main.ts`, a fixture transport, or the push test seam |
| Remove a dependency from `apps/service` or `apps/web` | T0 to T3 plus T5 (the images install with `--frozen-lockfile --prod --filter`; a runtime-only load fails nowhere earlier) |
| Delete export in `packages/*` | T0 to T4 (two consumers, plus seed typecheck) |
| `e2e/` only | T0, T1, T5 (type and lint cannot prove a journey) |
| `docker/`, Caddy, Kong, `scripts/*.sh` | T5, plus review; `deploy.sh` runs only on the self-hosted production runner and cannot be exercised in CI |
| Comments and docs only | T1 plus the esbuild transform-equality proof |
| `ci.yml` / composite action | Only a PR run validates it; keep the `CI` name and existing job ids |

## Per-Workspace Entry-Point Matrix

This answers "where do dead-code tools need per-workspace entry-point configuration". Key knip behaviours that drive it (LOW until canary-confirmed): a configured `entry` **replaces** the defaults (`{index,cli,main}.*` in root and `src/`) rather than merging; plugins add entries and config files; `package.json` `main`, `bin`, `exports`, and `scripts` are parsed; `exports` that point at source outside an `outDir` are treated as entry files; exports of entry files are **not** reported unless `includeEntryExports` is true.

| Workspace | Auto-detected (expected) | Must declare explicitly | Hidden consumers and traps | Expected false positives to pre-seed |
|-----------|--------------------------|-------------------------|-----------------------------|---------------------------------------|
| Root `.` | ESLint, commitlint, husky, lint-staged, prettier, typescript plugins; `.github/workflows/*.yml` `run:` commands | `ignoreBinaries` for `supabase`, `docker`, `psql` (installed by actions or the host, not npm) | `scripts/*.sh` and `docker/*.sh` are not code and are never analyzed; `.dockerignore` and `.prettierignore` name a file (`BUILD_PROMPT.md`) that no longer exists | `@types/node` at root with no root TypeScript; verify before removing |
| `apps/service` | `src/main.ts`, `src/cli.ts` (default entry names); script targets (`tsx src/write-openapi.ts`, `tsx scripts/normalize-fixtures.ts`, `tsx watch src/main.ts`); vitest plugin test globs; `tsup.config.ts` as config | Re-list `src/main.ts`, `src/cli.ts` if any `entry` is set (replace semantics); `vitest.coverage.config.ts` and `vitest.integration.config.ts` (default glob only matches `vitest.config.*`; reached only via `--config` in scripts, verify); `src/push/web-push.d.ts` (ambient module declaration, no importer) | `bin/hearth-admin` is a hand-written shell shim (not generated, despite `.planning/codebase/STRUCTURE.md`) that execs `dist/cli.js`, which only exists via the tsup entry list; the Dockerfile copies it by path. `dist/openapi.json` is produced at build and read at runtime via `import.meta.url`. Fixture transports read `e2e/fixtures/**` via `new URL('../../../../../e2e/fixtures/...', import.meta.url)` and the E2E overlay mounts them: data coupling across workspaces that no import graph shows. `app.ts` registers the push test seam only when `HEARTH_PUSH_TRANSPORT=test-double`, a runtime switch | `src/db/types.ts` (kysely-codegen output: every table interface is an "unused export"; use `ignore` for this file, never prune it); `src/jobs/index.ts` barrel (re-exports consumed only by `main.ts`) |
| `apps/web` | `src/main.tsx` (matches default `main`); lazy route targets (literal `import('./screens/...tsx')` are static and traced); `scripts/*.mjs` via `package.json` scripts; vite and vitest plugins; Tailwind via CSS `@import 'tailwindcss'` | **`src/sw.ts`**: referenced only as `filename: 'sw.ts'` and `strategies: 'injectManifest'` inside `vite.config.ts`, never imported, so it and everything only it imports (`lib/push/service-worker-handlers.ts`, all `workbox-*` packages) look dead without it. Also re-list `src/main.tsx` if `entry` is set | `virtual:pwa-register/react` is a virtual module from vite-plugin-pwa, likely an unresolved import; `check-build.mjs` looks up four copy strings in named source files (`SignInScreen.tsx`, `magic-link.ts`), so renaming those files breaks T3 (a good tripwire, not a finding) | `workbox-window` (in `dependencies`, never imported in source; consumed by the virtual module, grep confirms zero source imports): `ignoreDependencies`. `@testing-library/dom` (peer of `@testing-library/react`): `ignoreDependencies`. `jsdom` (selected by `environment: 'jsdom'` string) |
| `packages/shared`, `recurrence`, `matching` | `exports` map to `./src/index.ts` (entry); `packages/shared` also exports `./common-passwords`; per-package `vitest.config.ts` | **`includeEntryExports: true` on all three.** Without it every barrel symbol (`export *` in shared, 35 lines in recurrence) counts as used by definition and dead exports stay invisible; this is the single highest-value setting for the "unused exports" requirement | `packages/matching/scripts/fuzzy-benchmark.ts` imports `fuse.js`, which is not installed (the file's own header says it "no longer runs as committed"); it is referenced from `package.json` (`bench:fuzzy`, plus `tsx` devDependency used only for it), `eslint.config.js` ignore list, a comment in `src/similarity.ts`, and `CONVENTIONS.md`. Remove as one cluster or not at all | Barrel exports used only by their own tests (default mode counts test imports as usage; production mode will list them as TEST-ONLY) |
| `e2e` | playwright plugin: `playwright.config.ts`, `**/*.spec.ts`; `node --test support/run-identity.test.ts` from the `test` script | `global-setup.ts`, `global-teardown.ts` (named as strings in `playwright.config.ts`; verify the plugin follows them), `setup/**` and `support/**` are reached through them | Specs are numbered and order-coupled (`20-remove-member.spec.ts` must stay last; there is no `04-`). `docker-compose.e2e.yml` is consumed by string path from `support/compose.ts`. `e2e/fixtures/**` is non-code data selected by URL-to-filename mapping, so "no reference to this file name" does not prove it unused | Genuine findings are likely here: unused helper exports in `support/*.ts` |
| `supabase/seed` | Script reference from `apps/service` (`db:seed` runs `tsx ../../supabase/seed/seed-users.ts`, a cross-workspace relative path) | **`seed-users.ts`** as an explicit entry; `compute-readiness.ts` is then reached by import | `seed.sql` and `e2e/fixtures/e2e-seed.sql` are not code; `apps/service` typecheck also runs `tsc -p ../../supabase/seed`, so the seed is type-checked twice (its own `typecheck` plus the service's) | None expected |

### Knip configuration sketch (starting point, not final)

Mark production entries with `!` so one config serves both the default run and `knip --production`. Verify every line with `knip --debug` and the canaries.

```jsonc
{
  "workspaces": {
    ".": { "ignoreBinaries": ["supabase", "docker", "psql"] },
    "apps/service": {
      "entry": ["src/main.ts!", "src/cli.ts!", "src/write-openapi.ts", "scripts/normalize-fixtures.ts",
                "vitest.coverage.config.ts", "vitest.integration.config.ts"],
      "project": ["src/**/*.ts!", "scripts/**/*.ts", "!src/test/**!"],
      "ignore": ["src/db/types.ts"]
    },
    "apps/web": {
      "entry": ["src/main.tsx!", "src/sw.ts!", "scripts/*.mjs"],
      "project": ["src/**/*.{ts,tsx}!", "scripts/*.mjs"],
      "ignoreDependencies": ["workbox-window", "@testing-library/dom"]
    },
    "packages/*": { "includeEntryExports": true },
    "e2e": { "entry": ["global-setup.ts", "global-teardown.ts"] },
    "supabase/seed": { "entry": ["seed-users.ts"] }
  }
}
```

Two runs, both in CI eventually: default mode (broad; test imports count as usage) and `--production` (what ships; surfaces code reachable only from tests). Default-mode findings drive deletions. Production-only findings are TEST-ONLY and go to the owner list, since deleting them means deleting their tests.

## Data Flow

### Finding lifecycle (information flow)

```
knip reports + dup report + stale-ref scan + config reconcile + artifact inventory
        |
        v
  [classify]
   |-- CONFIG-GAP  (live code reported as dead) --> edit knip.json, re-run   (no code change)
   |-- PROVEN-DEAD (3 signals agree)            --> removal wave queue
   |-- TEST-ONLY   (production-mode only)       --> owner list
   `-- UNCERTAIN   (dynamic, string, Docker, SQL, SW, fixture, public contract)
                                                --> owner list + commented knip `ignore`
        |
removal wave:  delete -> T0..Tn for touched layers -> commit (typed) -> re-run knip
        |
        v
  fixpoint (no new PROVEN-DEAD)  -->  flip gate from report-only to blocking
```

### Dependency direction of the cleanup tooling

```
 pnpm-workspace.yaml --> knip workspace discovery --> per-workspace entry graph
 package.json scripts, vite.config.ts, tsup.config.ts, playwright.config.ts
        --(plugins)--> entries and config files
 pnpm-lock.yaml <--  `pnpm remove` (never hand-edit package.json)  --> Dockerfiles (pnpm fetch --frozen-lockfile)
 ci.yml (job added) --> workflow "CI" conclusion --> deploy.yml workflow_run gate
```

### Key Data Flows

1. **Dependency removal flow:** analyzer report, `pnpm remove <pkg> --filter <ws>`, lockfile diff reviewed, `pnpm install --frozen-lockfile` clean, T0 to T3, then T5 so both Dockerfiles resolve (`service.Dockerfile` installs `--filter @hearth/service...` and `--prod`; `caddy.Dockerfile` installs `--filter @hearth/web...`). The service bundles `@hearth/*` workspace sources (`noExternal`) and leaves its own listed dependencies external, so a package dropped from `apps/service/package.json` that is still imported anywhere in the bundle is bundled rather than missing, which can mask a wrong removal as a size change. Check bundle diff in T3.
2. **Generated-file flow:** migrations to `pnpm db:types` to committed `apps/service/src/db/types.ts`; raw fixtures to `pnpm fixtures:normalize` to committed `e2e/fixtures/flipp/normalized/` (reads disk only, no network or DB). These are "must be fresh", not "delete": enforcement is a regenerate-and-diff check, never removal.
3. **Reference-sync flow (comments and docs):** 262 tracked files cite specs that no longer exist (`Technical Architecture`, `Engineering Practices`, `Handoff non-negotiable N`; commit `08936e7` replaced those docs with as-built references), including 7 of the 8 migration files and `README.md`. Plus 38 files citing "Phase N". This is a mechanical sweep, processed after deletions so it touches fewer files, and kept out of `supabase/migrations/` unless the owner explicitly accepts editing applied migration files.

## Suggested Build Order

Ordering principle: make the net trustworthy, then observe, then delete, then fix behaviour, then reduce redundancy, then sync text, then lock in. Each arrow is a real dependency.

```
 WS1 Stabilize net ----+
                       +--> WS3 Removal waves --> WS4 Bug fixes --> WS5 Redundancy --> WS6 Text sync --> WS7 Lock-in
 WS2 Analysis (report) +                                  ^
        (parallel with WS1; disjoint files)               |
                                    regression tests from WS4 widen the net for WS5
```

| # | Work stream | Depends on | Why this position | Touches (single-writer files) |
|---|-------------|-----------|-------------------|--------------------------------|
| WS1 | Stabilize the net: deterministic clock and timezone in unit, component, and E2E tests; run the suite under a Saturday and a non-default `TZ`; capture baseline | none | A flaky net cannot attribute a failure to a removal. The recent `firstMealOn()` weekday flake proves failures appear with the calendar | test files only |
| WS2 | Analysis only: `knip.json`, canaries, calibration, raw reports, triage ledger, owner-list seed; non-blocking CI job | none (parallel with WS1) | Additive and behaviour-free; produces the work queue and proves tool trust before any deletion | `knip.json`, root `package.json`, `ci.yml` |
| WS3 | Safe removal waves (see Pattern 2): committed leftovers and orphan scripts, then exports and types, then dependencies, iterate to fixpoint | WS1, WS2 | Needs a trustworthy net and a calibrated analyzer. Reverse-dependency order so findings surface in one pass | `package.json` files, `pnpm-lock.yaml` (serialize) |
| WS4 | Known bug fixes, one regression test each: PATCH-schema rule in shared contracts, `RotationEditor` a11y suppression, offline replay duplicate, Kong/Caddy GoTrue path coverage, deploy-script password exposure, service-role scope | WS1 (deterministic tests to write against), WS3 (do not fix dead code) | Behaviour changes isolated from deletions so a red build has one cause. Their tests then protect WS5 | specific feature files, `docker/`, `scripts/deploy.sh` |
| WS5 | Redundancy: composite CI setup action, duplicate `typecheck` of `supabase/seed`, repeated devDependency versions (`typescript`, `vitest`, `@vitest/coverage-v8`, `@types/node`, `zod` across workspaces; pnpm catalogs), duplicated fixtures and harness helpers, oversized integration test files | WS3 (do not dedupe code about to be deleted), WS4 (regression tests exist first) | Refactors are the riskiest non-behaviour change; do them with the widest net and the smallest surface | `pnpm-workspace.yaml`, `ci.yml`, many `package.json` |
| WS6 | Text sync: stale spec citations in code and config comments, `docs/file-map.md`, `README.md`, stale `BUILD_PROMPT.md` ignore entries, `.planning/codebase/` maps | WS3 to WS5 (the file set must be final) | Largest file count (262) but zero behaviour; shrinks after deletions; comment-only proof applies | many files, mechanical |
| WS7 | Lock-in: flip knip to blocking (default and `--production`), `pnpm dedupe --check`, generated-file freshness, migration immutability, stale-reference check, optional `pnpm audit --prod` with an allow-list | WS1 to WS6 | A gate turned on before the tree is clean is either red or papered over with a baseline | `ci.yml`, `package.json` |

### Suggested phase grouping for the roadmap

1. **Net and analysis** (WS1 plus WS2): foundation, no production risk.
2. **Removal** (WS3): the headline value; high-evidence, wave-by-wave.
3. **Bug fixes** (WS4): own phase because each needs regression tests and several are infra (E2E-validated).
4. **Redundancy and text sync** (WS5 plus WS6): refactor then mechanical sweep.
5. **Enforcement** (WS7): short, last, includes verifying `deploy.yml` still fires.

## Scaling Considerations

The relevant scale is tooling cost and review load, not users.

| Concern | Now (668 tracked files, 7 workspaces) | If the repo doubles |
|---------|----------------------------------------|---------------------|
| knip runtime | Seconds; run as its own CI job in parallel with lint; no build or database needed | Add `--cache`; still its own job |
| Review load of deletions | Hundreds of candidates in an LLM-built codebase; one commit per wave per workspace keeps each diff reviewable | Cap wave size; owner list absorbs ambiguity |
| E2E cost (T5) | Slow: two image builds from cold; run T5 once per wave, not per commit | Batch waves per phase |
| Mechanical sweep size | 262 files | Scripted, verified by transform equality |

### Scaling Priorities

1. **First bottleneck:** owner attention on the UNCERTAIN list. Mitigation: group by reason (dynamic load, Docker or SQL consumer, test-only, public contract) so one decision clears many items.
2. **Second bottleneck:** T5 wall time. Mitigation: wave batching and running T0 to T4 per commit locally.

## Anti-Patterns

### Anti-Pattern 1: Treating descriptions as the removal oracle

**What people do:** Delete based on `.planning/codebase/*.md` or doc prose.
**Why it's wrong:** The maps already contain errors. `STRUCTURE.md` says `apps/service/bin/` is "generated by `pnpm --filter @hearth/service build`", but tsup emits only `dist/`; `bin/hearth-admin` is a committed hand-written shim that the Dockerfile and the `bin` field both depend on.
**Do this instead:** Evidence ladder (Pattern 1). Tooling plus text search plus gates, never prose.

### Anti-Pattern 2: Blocking gate before the tree is clean

**What people do:** Add `knip` as a required check on day one, then baseline-suppress hundreds of findings to get green.
**Why it's wrong:** Either `main` is red (and `deploy.yml` stops deploying, including bug fixes) or the suppressions hide exactly the findings the milestone exists to resolve.
**Do this instead:** Ratchet (Pattern 4): report-only, delete, then block; leftovers only as a commented owner list.

### Anti-Pattern 3: Default-mode knip only

**What people do:** Run one pass. Test files are entries, so any export imported only by a test counts as used.
**Why it's wrong:** Test-only reachable code (and test helpers that only other tests use) never surfaces.
**Do this instead:** Run default mode for deletions and `--production` for TEST-ONLY classification.

### Anti-Pattern 4: Unlisted barrel blind spot

**What people do:** Configure workspace `entry` and consider packages covered.
**Why it's wrong:** Package `exports` point at `./src/index.ts`, so the barrel is an entry and its exports are never reported without `includeEntryExports`.
**Do this instead:** Enable `includeEntryExports` on `packages/*` and prove it with a canary export.

### Anti-Pattern 5: Touching protected zones with generic tooling

**What people do:** Prune "unreferenced" fixtures, normalize SQL, or edit comments in applied migrations.
**Why it's wrong:** `supabase/migrations/**` is forward-only and applied by `scripts/deploy.sh` to production; fixtures are chosen by computed filename and mounted by the Compose overlay; neither shows up in an import graph.
**Do this instead:** Keep them out of every sweep. Add a CI check that migrations are append-only relative to `main` (no modified or deleted files under `supabase/migrations/`), and list fixtures for the owner rather than deleting.

### Anti-Pattern 6: Renaming workflows or jobs while adding gates

**What people do:** Restructure `ci.yml` and rename `name: CI` or job ids for tidiness.
**Why it's wrong:** `deploy.yml` matches `workflows: [CI]` by name, and branch protection may require specific job names (not visible from the repo; check GitHub settings). A rename silently disables deploy or leaves a required check pending forever.
**Do this instead:** Add jobs, keep existing names and ids, and verify on a throwaway PR that a docs-only and a code change both reach the expected deploy decision.

### Anti-Pattern 7: Parallel streams editing the lockfile

**What people do:** Run dependency removal, catalog adoption, and a Dependabot-style bump concurrently.
**Why it's wrong:** `pnpm-lock.yaml` conflicts are resolved by regeneration, which can silently change resolved versions of unrelated packages.
**Do this instead:** Single-writer rule (Pattern 5); one dependency-touching wave at a time; diff the lockfile in review.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub Actions `CI` workflow | New jobs added to existing workflow; composite action for the shared preamble | `test-e2e` is skipped on non-main pushes; skipped counts as success, so new always-run jobs are the only ones that gate those pushes |
| `deploy.yml` | Reads CI `conclusion == success` on `main` via `workflow_run` | Docs-only commits skip deploy (`git diff` check); cleanup waves that touch only `docs/` will not deploy, others will deploy to production, so each merged wave is a real deploy |
| Docker builds | `service.Dockerfile` and `caddy.Dockerfile` run `COPY . .` and `pnpm install --frozen-lockfile --offline --filter <pkg>...` | Lockfile must stay consistent with every `package.json`; `.dockerignore` keeps `docs`, `docker`, `supabase`, `e2e/fixtures` out of build context |
| Supabase CLI 2.117.0 | `supabase start` in `test-integration`; `migration up` in `deploy.sh` | Immutability of applied migrations is an operational rule, not a tooling guarantee (verify exact CLI behaviour on changed content before ever editing one) |
| Dependabot | Weekly grouped npm, actions, and docker PRs | If pnpm catalogs are adopted in WS5, confirm Dependabot still updates catalog entries first; otherwise skip catalogs (LOW, not verified) |
| pnpm audit | Optional `--prod` gate | The one known advisory (`braces`) is a transitive dev dependency with no patch; gate only production scope or maintain an explicit allow-list, else CI is red permanently |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| knip config to workspaces | One config, per-workspace blocks | Add or remove a workspace in `pnpm-workspace.yaml` and `knip.json` together |
| Cleanup tooling to application | Read-only until a removal wave; never runtime imports | No new runtime dependency anywhere; all tools are root devDependencies |
| `apps/service` to `e2e/fixtures` | File path via `import.meta.url` and Compose volume mount | Protected data; coupling invisible to import analysis |
| `apps/web` build to source file names | `check-build.mjs` greps built output and checks named source files | A rename without updating the script fails T3; intentional |
| Generated files to their generators | `db:types`, `fixtures:normalize` | Freshness check (regenerate, `git diff --exit-code`); needs DB for the first only, so the first belongs in `test-integration`, the second in unit CI. Determinism of kysely-codegen output is unverified (MEDIUM) |
| Pre-commit hook | `lint-staged` plus `pnpm typecheck` | Do not add knip here: it is whole-repo and would slow every commit; CI only |

## Items the Roadmap Should Flag for Phase-Level Research

| Item | Why | Resolve by |
|------|-----|------------|
| knip plugin coverage for `vite-plugin-pwa` (`sw.ts`, virtual module), `tsup` entries, Playwright `globalSetup`, vitest `--config` custom files | Docs list plugins but not these edge behaviours | Canary plus `knip --debug` in WS2 |
| `packages/*` glob key and `includeEntryExports` per workspace | Documented as per-workspace; glob key form not confirmed | Canary export in each package |
| `db:types` determinism for a freshness gate | Output depends on kysely-codegen and Postgres version | Run twice in CI environment before gating |
| Branch protection required checks | Not visible from the repo | Owner confirms before any job rename or removal |
| pnpm catalogs with Dependabot | Possible loss of automated bumps | Check Dependabot catalog support before WS5 |
| Editing comments in applied migrations | Supabase CLI content-hash behaviour not verified | Default to leaving migrations untouched |

## Sources

- Repo files read directly (HIGH): `package.json`, `pnpm-workspace.yaml`, `apps/*/package.json`, `packages/*/package.json`, `e2e/package.json`, `supabase/seed/package.json`, `apps/web/vite.config.ts`, `apps/service/tsup.config.ts`, `apps/service/vitest*.ts`, `e2e/playwright.config.ts`, `e2e/docker-compose.e2e.yml`, `docker/service.Dockerfile`, `docker/caddy.Dockerfile`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/dependabot.yml`, `eslint.config.js`, `.dockerignore`, `.prettierignore`, `.husky/*`, `apps/service/bin/hearth-admin`, `apps/web/scripts/check-build.mjs`, `packages/matching/scripts/fuzzy-benchmark.ts`
- knip documentation, fetched 2026-10-11 (LOW until canary-confirmed): https://knip.dev/features/monorepos-and-workspaces, https://knip.dev/explanations/entry-files, https://knip.dev/features/production-mode, https://knip.dev/features/source-mapping, https://knip.dev/features/rules-and-filters, https://knip.dev/guides/handling-issues, https://knip.dev/guides/using-knip-in-ci, https://knip.dev/reference/configuration, https://knip.dev/reference/plugins and plugin pages for vite, vitest, playwright, tsup
- npm registry (HIGH, version facts): knip 6.41.0 requires Node `^20.19.0 || >=22.12.0`, uses oxc-parser and oxc-resolver, no TypeScript peer dependency

---
*Architecture research for: cleanup and hardening of the Hearth pnpm monorepo*
*Researched: 2026-10-11*
