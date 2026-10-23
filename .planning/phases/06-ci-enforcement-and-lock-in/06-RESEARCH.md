# Phase 6: CI Enforcement and Lock-in - Research

**Researched:** 2026-10-22
**Domain:** GitHub Actions CI gating (knip, jscpd, pnpm audit, git-metadata checks, coverage, date/timezone sweep) on a pnpm monorepo whose `CI` workflow triggers a production deploy
**Confidence:** HIGH for everything measured on this tree and the GitHub REST API; MEDIUM for GitHub Actions semantics taken from docs; the few design choices that rest on training knowledge are in the Assumptions Log

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Carried forward (still binding)
- **D-01:** The workflow stays named `CI` and its job ids (`lint`, `typecheck`, `test-unit`, `test-integration`, `test-e2e`, `build`) do not change, because `deploy.yml` triggers on `workflow_run` for the workflow named `CI` (Phase 5 D-13). New jobs may be added.
- **D-02:** Land work as pull requests, squash-merged per `CONTRIBUTING.md`; never push to `main` directly or rewrite published history. Every merge to `main` runs CI and deploys, except `docs/`-only tips. `.planning/` files are included in the PRs (Phase 5 D-04).
- **D-03:** Nothing review-like (review, decision-log, ADR files) goes under `docs/`. `docs/testing.md` is updated where behavior changes. `supabase/migrations/` is never edited. Ledgers live under `.planning/cleanup/`.
- **D-04:** The date/timezone matrix reuses `HEARTH_TEST_NOW`, `TZ` and `scripts/test-sweep.mjs` (Phase 2 D-02); the six fixed unit cells are the matrix.
- **D-05:** The jscpd baseline is the test-inclusive Phase 2 scan: 96 clones, 1.87% of lines (Phase 2 D-13), as reduced by Phase 5.

#### Gate wiring (CI-01, CI-02, CI-04)
- **D-06:** One new parallel job named `hygiene` in `ci.yml` runs the knip, jscpd, audit, tracked-ignored, script-mode and migration-append-only checks, using the `.github/actions/setup` composite action. Not one job per check, not folded into `lint`.
- **D-07:** knip blocks in both default and `--production` modes. Production mode has 28 owner-listed kept items (test-only, config-reachable), so it blocks against a committed baseline file: any finding not in the baseline fails CI. Default mode runs at zero findings. The baseline format and its normalizer (reuse `scripts/knip-summary.mjs`) are for the planner; the baseline must not become a way to hide real candidates (Phase 2 D-10). — **Reversibility:** reversible — a config and one file.
- **D-08:** jscpd blocks on the **test-inclusive** percentage with the limit set at **2%** (owner choice; baseline 1.87%, so headroom is small). The command uses the Phase 2 parameters (`--min-tokens 60 --min-lines 8`) and a committed `.jscpd.json`; the planner must confirm the post-Phase-5 figure is under 2% and that the check is deterministic. This departs from the roadmap's "source duplication" wording; the planner records the final figure and notes the wording difference.
- **D-09:** The audit step is a small tested script that runs `pnpm audit --prod --json`, ignores only advisories listed in a committed allowlist file with an expiry date each, and fails when an unlisted advisory appears or a listed one has expired. `pnpm audit --prod` is clean today ("No known vulnerabilities"), so the allowlist starts without a `braces` entry; the mechanism and a test must show an entry working and expiring. The planner checks whether `braces` is dev-only (then outside `--prod`) and says so.

#### Drift and hygiene checks (CI-03)
- **D-10:** `db:types` drift runs inside the existing `test-integration` job, which already has `supabase start` with the migrations applied: run `pnpm db:types`, then `git diff --exit-code apps/service/src/db/types.ts`. Before gating, the planner proves `db:types` is deterministic (two consecutive runs, identical bytes, on Node 24 as in CI). Per STATE.md this was unverified.
- **D-11:** Migration append-only is a diff against the base: only added files under `supabase/migrations/` are allowed; modify, delete and rename fail. On pull requests compare to the PR base; on a push to `main` compare to the previous commit. The hygiene job needs enough fetch depth for the base ref. An escape hatch is not provided (no label or trailer override).
- **D-12:** Tracked-ignored files, script mode and line endings are one tested Node script (for example `scripts/check-repo-hygiene.mjs`) run by the `hygiene` job, with a `node:test` file wired into `test:harness` like `scripts/deploy.test.mjs`. It uses `git ls-files -ci --exclude-standard`, `git ls-files -s` and a CRLF scan. Not inline shell in `ci.yml`; no pre-commit hook.
- **D-13:** "Script" means every tracked file that starts with a shebang, plus every `*.sh`. Both must be mode `100755` and LF. This catches extensionless scripts such as `apps/service/bin/hearth-admin`.

#### Date/timezone matrix (TIME-06)
- **D-14:** A new workflow file `.github/workflows/sweep.yml`, not named `CI`, with triggers: push to `main`, a nightly `schedule`, and `workflow_dispatch`. Not on pull requests. It does not gate or trigger deploys (`deploy.yml` listens only to `CI`). It runs on GitHub-hosted runners with the composite setup action and has a job timeout.
- **D-15:** Suites: unit and component tests via `pnpm test:sweep`, all six fixed cells on both the push and nightly triggers. The nightly additionally runs one extra "today" cell: the real current date with a rotating zone. Exact zone-rotation rule and how the cell is passed to `scripts/test-sweep.mjs` (a new `--cell` form or env) are for the planner. The integration sweep stays local (it needs Supabase). — **Reversibility:** reversible.
- **D-16:** A failing nightly cell is a red workflow run (GitHub emails the repository owner on scheduled-workflow failure) plus per-cell logs uploaded as an artifact via the sweep's `--log-dir`. No tracking issue is opened.
- **D-17:** Proof before merge: a `workflow_dispatch` run on the PR branch (green run link recorded) plus a local `pnpm test:sweep` on Node 24. The cron itself is confirmed after merge by the first nightly run.

#### Coverage, timeouts, review, deploy proof (CI-05, CI-06, CI-07)
- **D-18:** Web coverage thresholds are **enforced**: the `test-unit` job runs web with `pnpm --filter @hearth/web test:coverage` instead of a second plain web run. Planning re-measures the current coverage and adjusts the thresholds in `apps/web/vite.config.ts` (82/78/74/84 today) to sit just under the measured values, and rewrites the `docs/testing.md` Coverage section, which currently says web has no coverage configuration, so config and docs agree. — **Reversibility:** reversible.
- **D-19:** Every job gets a `timeout-minutes` sized to observed run durations (about 2 to 3 times the p95 of recent runs; `test-e2e` keeps 40). The planner reads recent Actions run durations; any job with no history gets a conservative value and a note.
- **D-20:** The CI-05 correctness review of `ci.yml`, `deploy.yml` (and the new `sweep.yml`) is a checklist ledger under `.planning/cleanup/`: concurrency, permissions, triggers, secrets use, `workflow_run` safety (head SHA, fork PRs, the main-only guard), action pinning, caching, artifacts. Each finding is fixed in the PR or recorded as kept with a reason. A fix that changes deploy behavior is flagged to the owner before merge.
- **D-21:** CI-07 is proven on the real Phase 6 merge: a small non-docs change merged after the CI changes land, confirming a `Deploy` run is triggered by `CI`'s `workflow_run` and reaches the deploy job (running, or queued if no self-hosted runner is registered; `CONTRIBUTING.md` notes that case). The merge deploys, so the owner confirms before it. The run link goes in the ledger. — **Reversibility:** costly — the merge deploys to production.

### Claude's Discretion
- Baseline file format for knip production mode and how it is normalized (D-07).
- Names and locations of the hygiene script, audit script, allowlist file and `.jscpd.json` (D-08, D-09, D-12).
- The rotation rule and invocation of the nightly "today" cell (D-15).
- PR split and order (suggested: the `hygiene` job and its scripts; coverage and timeouts; `sweep.yml`; the deploy-proof change), commit grouping, ledger layout.

### Deferred Ideas (OUT OF SCOPE)
- Integration date/timezone sweep in CI (needs `supabase start` in the nightly): left local.
- Automatic Kong recreate on `kong.yml` change in `deploy.sh`: raised in Phase 4 D-15, not taken up here.
- GitHub branch protection, required status checks and squash-only merge settings: owner repository settings, not code (listed under "Not yet enforced" in `CONTRIBUTING.md`).
- A tracking issue for failing nightly runs; a migration-check override label: not wanted now.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CI-01 | knip is blocking in CI once the tree is clean | Verified config that takes default mode to 0 findings and leaves production mode identical to the 28-line baseline (see "knip" and Code Examples). New scripts must be `!` entries or the baseline grows. |
| CI-02 | A jscpd duplication threshold is enforced | jscpd 5.4.1 measured at 66 clones, 858 lines, 1.11% test-inclusive; `--threshold`/`.jscpd.json` verified to exit 1 over the limit; deterministic across two runs and a clean clone. |
| CI-03 | CI checks tracked-ignored files, `db:types` drift, migration append-only, script modes | Day-one status of each check measured; 3 tracked `.planning/*.sh` files are mode 100644 and would fail D-13 on day one; db:types placement and determinism evidence; migration diff design. |
| CI-04 | `pnpm audit --prod` with an expiring allowance for `braces` | `--prod` is clean; `braces` is dev-only via `kysely-codegen`; JSON shapes, and the exit-0-on-registry-failure trap, verified. |
| CI-05 | Jobs have timeouts, both workflows get a correctness review | Per-job duration percentiles from 324 job records; candidate findings with evidence (actionlint, zizmor, reading); workflow-scope push constraint. |
| CI-06 | Web coverage thresholds enforced or removed, config and docs agree | Measured 85.38/81.83/78.59/86.96; recommended thresholds; exact `ci.yml` and `docs/testing.md` edits. |
| CI-07 | A PR confirms `CI` still triggers deploy | Existing Deploy runs observed via REST; exact API check that distinguishes "queued for runner" from "skipped by guard"; concurrency replacement caveat. |
| TIME-06 | Date/timezone matrix on `main` and nightly | Local `pnpm test:sweep` 36/36 on Node 24 in 10m24s; `workflow_dispatch` cannot run a never-merged workflow; today-cell design and dry-run results. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Source: `/home/user/hearth/.claude/CLAUDE.md` (read this session). The planner must treat these as locked.

- **Behavior:** existing app behavior must not change; this phase touches no product code.
- **Evidence:** dead-code removal needs tool or test proof; ambiguous cases are reported, not deleted (applies to the knip baseline: it must not hide real candidates).
- **Verification:** full suite and CI stay green.
- **Tech stack:** pnpm 10.34.5, Node 24, TypeScript, existing stack; no framework migration. `saveExact: true`: every new dependency is exact-pinned.
- **Git:** `main` is curated and published; every push to it runs CI and a deploy (only `docs/` exempt). Branches or worktrees plus pull requests per `CONTRIBUTING.md`; never force-push.
- **Docs:** specs in `docs/` are the only source of truth; no review, decision-log or ADR files in `docs/`.
- **Lint and format:** `pnpm lint` is `eslint --max-warnings=0 .`; Prettier (`singleQuote`, `printWidth: 100`) covers `.yml` and `.json` as well, so workflow YAML must be Prettier-clean. Husky pre-commit runs lint-staged and `pnpm typecheck`; never `--no-verify`.
- **Clock fence:** ESLint `no-restricted-syntax` bans bare `new Date()` and `Date.now()` in `*.test.*`, `e2e/`, test helpers and `test/**/*.mjs`. New `scripts/*.test.mjs` files must pass an explicit instant (an audit-expiry test passes `--today` or a function argument). `scripts/*.mjs` (non-test) are not fenced.
- **Commits:** Conventional Commits, scopes `web, service, shared, recurrence, matching, db, e2e, docker` or none, subject at most 71 characters, body lines at most 100.
- **Comments:** explain why, not what; a lint-suppression comment carries a `-- reason`.
- **Module style:** ESM, named exports only (outside runner-required defaults), explicit return types on exported TS functions (not enforced for `.mjs`).
- **Cloud sandbox:** running E2E locally needs the CA workaround described in CLAUDE.md; never commit it.

## Summary

The tree after Phase 5 is close to ready for every gate in this phase; only a handful of day-one reds exist and they are all cheap to remove first. Measured this session on `ca0e3d4` (Node 24.21.0, pnpm 10.34.5): default `pnpm knip` reports 7 findings (the known `tailwindcss` false positive plus six `.planning/cleanup/tools/*.mjs` proof tools), production mode reports 34 (the owner's 28 plus the same six tools). A `knip.json` edit (`ignore: [".planning/**"]`, a `tailwindcss` ignore, `node: false`, entry `test/**/*.mjs!`) takes default to 0 and leaves production **byte-identical to the 28-line baseline**, and as a bonus closes the Phase 3 "hidden test-directory entry" blind spot (a dead export in `apps/web/src/test/` was invisible before and is caught with `node: false`). jscpd 5.4.1 measures **66 clones, 858 duplicated lines, 1.11%** test-inclusive (not 1.87%), identical in two runs and in a clean clone, so the 2% limit has 0.89 points of headroom, not 0.13. `pnpm audit --prod` is clean; `braces` is reachable only through `kysely-codegen`, a devDependency of `@hearth/service`. Web coverage measures 85.38/81.83/78.59/86.96 against thresholds 82/78/74/84. `pnpm test:sweep` passes 36/36 locally in 10m24s. `pnpm db:types` is deterministic: two runs on Node 24.21.0 against a fresh `supabase start` (CLI 2.117.0) were byte-identical and equal to the committed `types.ts`.

Four things will bite the planner if not planned for. (1) **Script modes:** D-13 as written fails on day one, because three tracked files under `.planning/` (`cloud-check.sh`, `cloud-setup.sh`, `comment-only-controls.sh`) are mode 100644; fix them with `git update-index --chmod=+x` before the check lands. (2) **`workflow_dispatch` cannot run a workflow that has never been merged** (GitHub docs: the file must exist on the default branch), so D-17's "dispatch on the PR branch" is impossible for the new `sweep.yml`; and the session token has no `workflow` scope (`X-Oauth-Scopes: gist, read:org, repo`), so every PR touching `.github/workflows/` needs the owner's `apply.sh` hand-off used in Phase 5. (3) **`pnpm audit --json` exits 0 with `{"error":{...}}` and no `advisories` key when the registry is unreachable**, so the audit script must fail closed on a missing `advisories` object. (4) **Every new non-test `scripts/*.mjs` is reported by `knip --production`** (verified with a canary referenced from `package.json` and from a workflow), so each must be added to `knip.json` as a `!` entry or the 28-line baseline grows.

**Primary recommendation:** land in three PRs ordered to keep `main` green and to minimize workflow-scope hand-offs: PR 1 adds the scripts, tests, `knip.json`, `.jscpd.json`, baseline, `jscpd` devDependency, the three file-mode fixes and doc edits (no workflow file touched, so the token can push it); PR 2 is the single `ci.yml` change (hygiene job, db:types drift step, web coverage in `test-unit`, timeouts, review fixes) plus `sweep.yml`, pushed by the owner; PR 3 is the CONTRIBUTING and ledger update that doubles as the CI-07 deploy proof.

## Measured Pre-flight: Day-one Status of Every Gate

All rows run this session on branch `claude/confident-dirac-10eu0a` at `ca0e3d4` (one commit above `origin/main` `cb808e6`). Raw outputs are in the session scratchpad; commands are reproducible.

| Gate | Command | Result today | Day-one red? |
|------|---------|--------------|--------------|
| knip default | `pnpm --silent knip --reporter json` then `node scripts/knip-summary.mjs` | 7 lines: `devDependencies apps/web/package.json tailwindcss` and 6 `files .planning/cleanup/tools/*.mjs` [VERIFIED: command output] | Yes, until `knip.json` is edited |
| knip production | `pnpm --silent knip:production --reporter json` | 34 lines = the 28 owner-listed + the same 6 `.planning` tools [VERIFIED: command output] | Yes, until `knip.json` ignores `.planning/**` |
| knip with proposed config | temp config: `ignore: [".planning/**"]`, `ignoreDependencies: ["tailwindcss"]`, `node: false`, root entry `["test/**/*.mjs!","scripts/test-sweep.mjs!"]` | default **0**; production **diff against the 28-line file is empty** [VERIFIED: command output] | No |
| jscpd | `pnpm dlx jscpd@5.4.1 apps packages e2e supabase/seed --format typescript,tsx --min-tokens 60 --min-lines 8 --ignore "**/node_modules/**,**/dist/**,**/coverage/**,**/db/types.ts"` | 524 files, 76,982 lines, **66 clones, 858 duplicated lines (1.11%)**; two runs give identical clone sets and a fresh `git clone` gives identical totals [VERIFIED: command output] | No (limit 2%) |
| pnpm audit prod | `pnpm audit --prod --json` | `{"advisories":{}, ... "totalDependencies":218}`, exit 0 [VERIFIED: command output] | No |
| tracked-ignored | `git ls-files -ci --exclude-standard` | empty [VERIFIED: command output] | No |
| script modes | scan of first 2 bytes of every tracked blob + `*.sh`, with `git ls-files -s` | 12 files qualify; **3 are 100644**: `.planning/cleanup/tools/comment-only-controls.sh`, `.planning/environment/cloud-check.sh`, `.planning/environment/cloud-setup.sh` [VERIFIED: command output] | **Yes** |
| CRLF in index | `git ls-files --eol` filtered for `crlf`/`mixed` | none [VERIFIED: command output] | No |
| web coverage | `pnpm --filter @hearth/web test:coverage` | 728 tests pass; Statements 85.38% (3884/4549), Branches 81.83% (2401/2934), Functions 78.59% (1212/1542), Lines 86.96% (3616/4158); 119 s vs about 78 s for the plain run [VERIFIED: command output] | No |
| sweep | `node scripts/test-sweep.mjs --log-dir <dir>` | `sweep: 36/36 passed`, real 10m24s on Node 24.21.0 [VERIFIED: command output] | No |
| actionlint | `docker run rhysd/actionlint` on `.github` | only `deploy.yml:25` "label hearth is unknown" (needs a config for the self-hosted label) [VERIFIED: command output] | No |
| db:types determinism | `supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,mailpit,storage-api,postgrest,postgres-meta` (CLI 2.117.0, 8 migrations applied), then `pnpm db:types` twice on Node 24.21.0 | both runs exit 0 and print "Introspected 25 tables"; sha256 of `apps/service/src/db/types.ts` after each run is `81209804cfa662518d6e0546e38ba4b02ca0bb467a1fc463400cf07867b7ffdb`; `cmp` run1 vs run2 equal; `git diff --exit-code -- apps/service/src/db/types.ts` clean [VERIFIED: command output]. Matches the Phase 3 local evidence [CITED: .planning/cleanup/REMOVAL-LEDGER.md:176-179] | No locally; still confirm once on the CI runner |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Blocking checks (knip, jscpd, audit, repo hygiene, migrations) | CI workflow (`hygiene` job in `ci.yml`) | Tested Node scripts in `scripts/` | The workflow only sequences; logic lives in scripts that `node --test` can exercise (D-12 pattern). |
| `db:types` drift | CI `test-integration` job | `apps/service` `db:types` script | The job already owns `supabase start` with migrations applied (D-10). |
| Migration append-only | CI `hygiene` job | git history (base ref) | Needs the base commit, so the job checks out full history; the script takes the base as an argument. |
| Date/timezone matrix | Separate workflow `sweep.yml` | `scripts/test-sweep.mjs` | Slow and non-gating; must not be named `CI` so Deploy never listens to it (D-14). |
| Deploy trigger | `deploy.yml` (`workflow_run` on `CI`) | Self-hosted runner | Unchanged contract (D-01). New jobs only change the CI conclusion. |
| Coverage thresholds | `apps/web/vite.config.ts` | `test-unit` job | Thresholds live with the Vitest config; CI only calls `test:coverage`. |
| Baselines and allowlists | Committed text/JSON files next to the scripts | Ledger under `.planning/cleanup/` | Reviewable diffs; reasons for kept items stay in `OWNER-CANDIDATES.md`. |
| CI-05 review and CI-07 proof | `.planning/cleanup/` ledger | GitHub REST API evidence | Nothing review-like under `docs/` (D-03). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| knip | 6.41.0 (already a root devDependency) | Dead file/export/dependency detection, blocking in two modes | Already configured and calibrated in Phase 2/3; no new dependency. [VERIFIED: package.json:40] |
| jscpd | 5.4.1 (new root devDependency, exact pin) | Duplication percentage with `--threshold` and `.jscpd.json` | The tool Phase 2 used for the baseline (owner-approved 2026-10-13, `TRIAGE.md` line 6); `latest` is 5.4.2 published 2026-10-20 with identical numbers, but the legitimacy seam flags it `too-new`. [VERIFIED: npm registry + command output] |
| pnpm | 10.34.5 | `pnpm audit --prod --json`, `pnpm --filter` | Pinned by `packageManager`. [VERIFIED: package.json] |
| Node `node:test` | Node 24 built-in | Tests for every new CI script, wired into `test:harness` | The repo pattern for `scripts/*.test.mjs`. [VERIFIED: package.json:16] |
| Vitest `@vitest/coverage-v8` | 5.0.1 | Web coverage thresholds via `test:coverage` | Already installed for web. [VERIFIED: apps/web/package.json] |
| Supabase CLI | 2.117.0 | Already in `test-integration` | `db:types` drift reuses its running stack. [VERIFIED: ci.yml, `supabase --version`] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| yaml | 2.9.1 (already in the lockfile as an `apps/service` devDependency) | Parse workflow YAML in an optional contract test (name is `CI`, job ids unchanged, every job has `timeout-minutes`) | Only if the planner adds the optional structural workflow test; it would need `yaml` added to the root `devDependencies`, because pnpm does not hoist it to the root. Package already owner-approved in Phase 4 (`STATE.md` 04-05). |
| actionlint, zizmor | latest via Docker, **not added to the repo** | One-off evidence for the CI-05 ledger | Adoption in CI is CIX-01 (v2, deferred). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pnpm dlx jscpd@5.4.1` in CI | devDependency | `dlx` needs no lockfile change but fetches the native binary (46 MB unpacked) on every run and is not pinned by the lockfile; CONTEXT's established pattern is an exact-pinned devDependency. Use the devDependency. |
| A matrix job per sweep cell | One serial job running `pnpm test:sweep` | Matrix gives per-cell red/green in the UI but duplicates the cell ids in YAML (drift risk when `UNIT_CELLS` changes) and costs 6x setup minutes. Recommend the single job; the sweep prints `cell=... result=...` lines and uploads the logs. |
| jscpd's own `--baseline`/`--fail-on-new-clones` | `--threshold` | D-08 locked a percentage limit. Not used. |

**Installation (PR 1):**
```bash
pnpm add -Dw --save-exact jscpd@5.4.1   # root devDependency; also add a root script "jscpd": "jscpd"
```
Registry check run: `npm view jscpd version` returned 5.4.2 (latest); `npm view jscpd@5.4.1 version` returned 5.4.1; `scripts.postinstall`, `preinstall`, `install` are all empty for both the main package and `jscpd-linux-x64-gnu` [VERIFIED: npm registry]. License MIT, repository `github.com/kucherenko/jscpd`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| jscpd | npm | first published 2013-06-03 (13 yrs); 5.4.1 published 2026-10-09, 5.4.2 on 2026-10-20 | 2,125,963/wk | github.com/kucherenko/jscpd | SUS (reason `too-new`, driven by the 2-day-old `latest` 5.4.2) | Approved at **5.4.1** only: the owner approved `jscpd@5.4.1` on 2026-10-13 in `TRIAGE.md`, it produced the Phase 2 baseline, and this session's numbers match. Planner still inserts one `checkpoint:human-verify` before the install because the seam flags the package; do not float to 5.4.2. |
| yaml | npm | established; already in `pnpm-lock.yaml` | high | github.com/eemeli/yaml | OK | Approved (only relevant if the optional workflow contract test is adopted) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `jscpd` [WARNING: flagged as suspicious (too-new) by `gsd-tools query package-legitimacy check` - the flag is about the 5.4.2 release; verify the 5.4.1 pin before installing]. jscpd 5.x ships a native binary through eight `optionalDependencies` platform packages (`jscpd-linux-x64-gnu` unpacked size 46 MB); the lockfile will gain entries for all eight, only the host platform is installed.

## Architecture Patterns

### System Architecture Diagram

```
 push to main / pull_request                      push to main / nightly cron / workflow_dispatch
          |                                                         |
          v                                                         v
  +---------------- workflow "CI" (ci.yml) ----------------+   +-- workflow "Sweep" (sweep.yml, NOT named CI) --+
  | lint  typecheck  build                                  |   | job sweep (timeout, GitHub-hosted)             |
  | test-unit: harness -> packages/service/e2e-support ->   |   |   setup action -> pnpm test:sweep              |
  |            web test:coverage (thresholds enforced)      |   |   6 fixed cells (+ "today" cell on schedule)   |
  | test-integration: supabase start                        |   |   --log-dir -> upload-artifact on failure      |
  |            -> pnpm db:types + git diff --exit-code      |   |   red run => GitHub notifies cron author       |
  |            -> service test:coverage                     |   +------------------------------------------------+
  | test-e2e (unchanged, timeout 40)                        |        (no link to Deploy: deploy.yml never listens)
  | hygiene (new): checkout fetch-depth 0 -> setup action   |
  |   knip default (exit code)                              |
  |   knip production vs committed baseline                 |
  |   jscpd (.jscpd.json, threshold 2)                      |
  |   audit script (pnpm audit --prod --json + allowlist)   |
  |   repo-hygiene script (tracked-ignored, modes, CRLF)    |
  |   migrations append-only (base = PR base sha / before)  |
  +----------------------------+----------------------------+
                               | all jobs success?  (any red job => CI conclusion failure)
                               v
              workflow_run (completed, branches: [main])
                               v
        deploy.yml guard: conclusion==success && event==push && head_branch==main
                               v
        job deploy on [self-hosted, hearth]  (queued if no runner is registered)
```

### Recommended Project Structure
```
.github/workflows/
├── ci.yml                      # + hygiene job, db:types step, web coverage step, timeouts (job ids unchanged)
├── sweep.yml                   # new, name: Sweep
└── deploy.yml                  # review only; any behavior change is flagged to the owner (D-20)
.jscpd.json                     # new; Phase 2 parameters + threshold 2
knip.json                       # edited (see Code Examples)
scripts/
├── check-repo-hygiene.mjs      # tracked-ignored, shebang/.sh modes, CRLF (reads the index)
├── check-repo-hygiene.test.mjs # temp git repos
├── check-migrations-append-only.mjs (+ .test.mjs)
├── audit-prod.mjs (+ .test.mjs)
├── audit-allowlist.json        # {"allow":[]} to start; entries need id, expires, reason
├── check-knip-baseline.mjs (+ .test.mjs)
├── knip-production-baseline.txt  # kind<TAB>path<TAB>symbol, the 28 lines
├── knip-summary.mjs            # refactor to export summarize() behind a main guard (currently runs on import)
└── test-sweep.mjs              # + today cell (pure rotation helper, --list shows it)
```
Names are Claude's-discretion suggestions; the contracts (not the names) matter.

### Pattern 1: Tested CI script with injected inputs
**What:** Each gate is a Node script with a pure core function (`evaluateAudit(report, allowlist, today)`, `compareBaseline(current, baseline)`, `findHygieneViolations(entries)`) and a thin CLI. Tests call the core with fixtures and run the CLI against temp git repos, the way `scripts/deploy.test.mjs` runs `deploy.sh` against stubs.
**When to use:** all of D-09, D-07, D-12, D-11.
**Why:** the clock fence forbids `new Date()` in `*.test.mjs`; passing `today` as an argument also makes expiry deterministic.

### Pattern 2: Read git metadata from the index, not the working tree
**What:** `git ls-files -s` (mode), `git ls-files --eol` (the `i/` column is the index EOL), and blob bytes via `git cat-file --batch` for the first-two-bytes shebang test.
**Why:** `.gitattributes` is `* text=auto eol=lf`, so a checkout rewrites line endings; a file committed through the GitHub API (the cloud tooling does this) bypasses the normalization and can carry CRLF into the index. The working tree can look clean while the index is not. [VERIFIED: .gitattributes read this session]

### Pattern 3: Pass untrusted values through `env:`, never inline `${{ }}` in `run:`
Workflow values such as `github.event.before`, `github.base_ref`, and branch names go to scripts through `env:` and are passed to `git` as argument arrays (`spawnSync('git', [...])`, no shell).

### Anti-Patterns to Avoid
- **Gating on `pnpm audit` exit status alone:** exit is 1 for found advisories, but 0 on a registry error (verified below).
- **Treating `knip` exit 1 as a crash:** it means "findings"; the baseline script must parse JSON and decide.
- **Adding the new job and its first red run on `main`:** each gate's green status must be proven on the PR's own CI run before merge.
- **Hand-editing `apps/service/src/db/types.ts` to make drift go away.**
- **Renaming `CI` or any existing job id** (D-01).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duplication detection | A token-diff script | `jscpd --threshold` via `.jscpd.json` | Verified exit code 1 above threshold; deterministic. |
| Unused code detection | grep-based dead-code checks | knip (default exit code + normalized baseline compare) | Already calibrated. |
| Report normalization | A second normalizer | `scripts/knip-summary.mjs` logic (export it) | D-07 says reuse. |
| Advisory lookup | Direct registry calls | `pnpm audit --prod --json` | Same data source, same package set as `--prod`. |
| Tracked-ignored detection | A hand-written ignore matcher | `git ls-files -ci --exclude-standard` | Git's own rules, including nested `.gitignore`. |
| Rename/delete detection for migrations | Parsing `git log` | `git diff --name-status --no-renames <base>...HEAD -- supabase/migrations` | With `--no-renames` a rename shows as `D` plus `A`, so it fails like a delete. |
| Timezone validation for the today cell | Own IANA checks | `test/global-tz.mjs` + the sweep's existing `childZone` check | Already rejects unknown zones, wrong case and POSIX offsets. |
| YAML parsing in a contract test | Regex over `ci.yml` | `yaml` package | Only if the optional test is adopted. |

**Key insight:** every gate here is a thin wrapper over a tool that already returns a trustworthy answer; the custom code is only input handling (fail closed on errors) and baseline comparison.

## Common Pitfalls

### Pitfall 1: D-13 fails on day one (script modes)
**What goes wrong:** the check would be red on its own PR. Three tracked `.planning` scripts are 100644: `.planning/cleanup/tools/comment-only-controls.sh`, `.planning/environment/cloud-check.sh`, `.planning/environment/cloud-setup.sh`. [VERIFIED: `git ls-files -s` scan]
**How to avoid:** make them 100755 with `git update-index --chmod=+x <paths>` in PR 1 (mode-only, no content change; `.planning` is in the PRs per D-02). STATE.md warns that path-limited commits reset the bit, so check `git ls-tree` after committing. Keep the rule universal (do not exempt `.planning/`).
**Warning signs:** the hygiene script lists any path in its failure output.

### Pitfall 2: pnpm's banner corrupts JSON
`pnpm knip --reporter json` prints `> hearth@ knip /home/user/hearth` first, so `JSON.parse` fails (observed). Use `pnpm --silent <script> --reporter json` or `pnpm exec knip`. [VERIFIED: command output]

### Pitfall 3: `pnpm audit --json` exits 0 when the registry is unreachable
Observed with `--registry http://127.0.0.1:9/`: stdout is `{"error":{"code":"ECONNREFUSED","message":"request to ... failed ..."}}`, exit status 0, no `advisories` key. A gate that only checks the exit code would pass silently. The script must fail closed when `advisories` is not an object, print the error, and (recommended) retry a few times with backoff before failing, so a transient outage does not block a deploy for long. [VERIFIED: command output]

### Pitfall 4: Every new non-test script becomes a production-mode knip finding
Verified with a canary `scripts/zz-canary.mjs`: referenced from a `package.json` script or from a workflow `run:` it is reachable in default mode (0 findings) but `knip --production` adds `files scripts/zz-canary.mjs` (29 lines). The same mechanism is why `scripts/knip-summary.mjs` is already in the baseline. Add each new script as a `!` entry in the root workspace of `knip.json` (for example `"scripts/audit-prod.mjs!"`). Test files (`*.test.mjs`) are not reported. Whether to also add `scripts/knip-summary.mjs!` (baseline 28 to 27) is an owner question left open in `OWNER-CANDIDATES.md`; the 28-line baseline keeps it. [VERIFIED: command output]

### Pitfall 5: The hidden-entry blind spot
With the `node` plugin enabled (the current state), `test:harness` runs `node --test`, so knip treats every `**/test/**` file as an entry and never reports dead files or exports inside them. Canary result: with `node: false`, `apps/web/src/test/zz-canary.ts` (unused file) and its `deadExport` (an unused export in a used helper) are both reported; with the plugin on, neither is. With `node: false` the production run needs entry `test/**/*.mjs!` (otherwise `test/support/vitest-project.mjs` appears as a 29th line). The final config was verified to give default 0 and production equal to the baseline. [VERIFIED: command output]

### Pitfall 6: `workflow_dispatch` on a never-merged workflow, and the missing `workflow` scope
Docs: "This event will only trigger a workflow run if the workflow file exists on the default branch" and "Once a workflow has run at least once, you can dispatch it against any branch." So D-17's pre-merge dispatch of the new `sweep.yml` is impossible. The token scopes are `gist, read:org, repo` (REST header), so pushing any change under `.github/workflows/` is refused. [CITED: docs.github.com events-that-trigger-workflows] [VERIFIED: `gh api -i` X-Oauth-Scopes]
**How to avoid:** (a) the local `pnpm test:sweep` run (done here: 36/36) is the pre-merge proof; (b) the merge itself triggers `sweep.yml` through its `push: [main]` trigger, which is the first CI run of the file and the proof that the workflow is valid; (c) later edits to `sweep.yml` can be dispatched on a branch. Alternatively a temporary `pull_request` trigger limited by `paths:` on `sweep.yml` would run the file on the PR itself but contradicts D-14 ("not on pull requests"); leave that choice to the owner (Open Question 2). Use the Phase 5 `apply.sh` hand-off (`.planning/cleanup/patches/ci-setup-action/apply.sh`) for every PR that touches `.github/workflows/`; Windows Git Bash needs `MSYS_NO_PATHCONV=1`.

### Pitfall 7: db:types drift step placement and determinism
Run the drift step immediately after `supabase start` and **before** `test:coverage`, so the database holds only the migrated schema (no test-created objects). `db:types` is `kysely-codegen --dialect postgres --url "${HEARTH_DB_ADMIN_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}" --include-pattern "public.*" --date-parser string --out-file src/db/types.ts && prettier --write src/db/types.ts`; `supabase/config.toml` sets `[db] port = 54322`, matching the default URL. [VERIFIED: apps/service/package.json:17, supabase/config.toml:14]
**Determinism proof:** done locally in this research on Node 24.21.0 with CLI 2.117.0: two consecutive `pnpm db:types` runs gave byte-identical output (same sha256) equal to the committed file, on the exact migration set `20260919060000` to `20261004090100`. That satisfies the local half of D-10. The CI half is cheap: add a temporary second `pnpm db:types` plus `cmp` to the PR's `test-integration` run so the runner image proves it too, then remove the temporary step before merge. The executor's sandbox has Docker, the CLI and image pulls through the proxy (the stack started in this session without rate limiting), so it can repeat the local run; remember `supabase stop --no-backup` afterwards.

### Pitfall 8: Migration base ref and checkout depth
`actions/checkout` defaults to depth 1. The hygiene job needs `fetch-depth: 0` (the repo pack is 3.7 MB, 50 commits on `main`). Base: pull request = `github.event.pull_request.base.sha`; push = `github.event.before`. Use a three-dot diff so only the PR's own changes count. Fail closed with a clear message when the base cannot be resolved (for example `before` is the all-zero SHA). `persist-credentials: false` (a zizmor suggestion) must not be combined with a later `git fetch` in a private repo; with `fetch-depth: 0` at checkout time no later fetch is needed. [ASSUMED: PR checkout is the merge commit `refs/pull/N/merge`]

### Pitfall 9: Concurrency replacement can drop a Deploy and confuse CI-07
GitHub docs: "At most one job or workflow run can be pending in the concurrency group"; a newer queued run cancels and replaces the pending one. Observed in this repo: Deploy runs 39721751275, 39720541360, 39719463322 (all for `a5c4384`) and ten others are `cancelled`, while the two newest (`c36ce92` queued, `cb808e6` pending) wait on the unregistered runner. For CI-07, capture the evidence (run id, `event: workflow_run`, job `deploy` status `queued`, labels `["self-hosted","hearth"]`) immediately after the merge, before another merge replaces it. A `skipped` job conclusion means the guard rejected the run; `queued` or `in_progress` means it was accepted. [VERIFIED: gh api] [CITED: docs.github.com using-concurrency]

### Pitfall 10: Date-dependent gates are deliberately day-dependent
`pnpm audit` results change with new advisories; an allowlist entry flips CI red when it expires; the nightly "today" cell sees a new date every night. All three turn `main` or the nightly red without a code change, by design. Because the `hygiene` job is part of the `CI` conclusion, a newly published advisory on a production dependency blocks the next deploy until fixed or allowlisted. Say so in the plan and in `CONTRIBUTING.md` so the owner expects it.

### Pitfall 11: Runner minutes in a private repository
The repository is private (`gh api repos/...` returned `"private": true`). Docs list 2,000 (Free) or 3,000 (Pro/Team) included Linux minutes per month. Current CI is about 24 job-minutes per run (medians 0.5+1.4+0.8+4.0+6.6+10.8) and there were 68 runs in 11 days. The sweep adds an estimated 20 to 25 minutes per run (locally 10.4 min; CI test-unit is about 4 min against 1.7 min locally per cell). Nightly alone is about 600 to 750 minutes per month; push-to-main runs add more, and `.planning/`-only direct pushes to `main` would each trigger one. Consider `paths-ignore: ['docs/**', '.planning/**']` on the sweep's `push` trigger and confirm the plan tier with the owner. [ASSUMED: owner's plan tier and quota use]

### Pitfall 12: Test files for git-based scripts leak the host's git config
Tests that build temp repos must set `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_NOSYSTEM`, pass `-c user.name=... -c user.email=... -c commit.gpgsign=false`, and delete `GIT_DIR`/`GIT_INDEX_FILE` from the child environment. To plant CRLF in the index despite `.gitattributes`, use `git hash-object -w --no-filters` plus `git update-index --add --cacheinfo`. Temp repos have no `.gitattributes`, so the simplest CRLF fixture is a file written with `\r\n` and added with `core.autocrlf=false` in a repo without the attribute.

### Pitfall 13: Windows owner runs
The owner works from Windows Git Bash. The baseline compare should normalize `\` to `/` in knip paths, and any shell snippet in docs should avoid bashisms the owner cannot run. CI is the source of truth (Linux).

## Code Examples

### knip.json changes (verified to give default 0 and production == the 28-line baseline)
```jsonc
// Source: verified this session with a temp config in the scratchpad (knip 6.41.0)
{
  "ignore": [".planning/**"],            // proof tools and ledgers are not product code
  "ignoreDependencies": ["tailwindcss"], // used by `@import 'tailwindcss'` in index.css; knip does not follow CSS imports
  "node": false,                         // closes the hidden-entry blind spot for **/test/** files
  "workspaces": {
    ".": { "entry": ["test/**/*.mjs!", "scripts/test-sweep.mjs!", "scripts/audit-prod.mjs!" /* + each new non-test script */] }
  }
}
```
Keep the existing `ignoreExportsUsedInFile` and `ignoreBinaries`. Prefer a workspace-scoped `ignoreDependencies` under `apps/web` if the planner wants the ignore as narrow as possible (not tested).

### .jscpd.json (verified: auto-discovered from the repo root, exit 0 at threshold 2, exit 1 at threshold 1)
```json
{
  "path": ["apps", "packages", "e2e", "supabase/seed"],
  "format": ["typescript", "tsx"],
  "minTokens": 60,
  "minLines": 8,
  "ignore": ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/db/types.ts"],
  "reporters": ["console"],
  "threshold": 2
}
```
`jscpd --help` also lists `--fail-on-empty` ("Exit 1 when the scan analyzes no files"), a cheap guard against a mis-pathed scan passing; its config-file key was not verified. jscpd respects `.gitignore` by default.

### pnpm audit JSON shape (verified)
```json
{ "actions": [], "advisories": { "1240992": { "id": 1240992, "github_advisory_id": "GHSA-vfj7-8cjw-p6xm",
  "module_name": "braces", "severity": "high", "vulnerable_versions": "<=3.0.3", "patched_versions": "<0.0.0",
  "findings": [{ "version": "3.0.3", "paths": ["apps__service>kysely-codegen>micromatch>braces"] }] } },
  "muted": [], "metadata": { "vulnerabilities": { "info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0 }, "totalDependencies": 218 } }
```
Failure shape: `{ "error": { "code": "ECONNREFUSED", "message": "..." } }` with exit 0. Allowlist key recommendation: the `GHSA-` id (stable across registries), `expires` as `YYYY-MM-DD` compared with an injected UTC `today`, plus `reason`. An allowlist entry that matches nothing should print a note (not fail), so deleting a fixed dependency does not force a second edit; an expired entry fails whether or not it matches.

### Audit decision core (sketch, not run)
```js
// Source: design sketch; JSON keys verified above
export function evaluateAudit(report, allowlist, today) {
  if (report === null || typeof report !== 'object' || typeof report.advisories !== 'object' || report.error !== undefined) {
    return { ok: false, problems: ['audit unavailable: ' + JSON.stringify(report?.error ?? 'no advisories object')] };
  }
  const problems = [];
  const byId = new Map(allowlist.allow.map((entry) => [entry.id, entry]));
  for (const advisory of Object.values(report.advisories)) {
    const entry = byId.get(advisory.github_advisory_id);
    if (entry === undefined) problems.push(`${advisory.github_advisory_id} ${advisory.module_name} (${advisory.severity}) is not allowlisted`);
    else if (entry.expires < today) problems.push(`${entry.id} allowance expired on ${entry.expires}`);
  }
  for (const entry of allowlist.allow) if (entry.expires < today) problems.push(`${entry.id} allowance expired on ${entry.expires}`);
  return { ok: problems.length === 0, problems };
}
```

### Repo-hygiene detection (commands verified; assembly is a sketch)
```bash
git ls-files -ci --exclude-standard        # tracked-but-ignored: must print nothing
git ls-files -s                            # "<mode> <sha> <stage>\t<path>"
git ls-files --eol                         # "i/lf    w/lf    attr/text=auto eol=lf\t<path>"; fail on i/crlf or i/mixed
```
Shebang test: read the first two bytes of each blob (`git cat-file --batch` once, or `git show :<path>`), not `git grep '^#!'` (which matches a `#!` on any line). Qualifying files: first two bytes `#!`, or path ends in `.sh`. Each must be `100755` and have index EOL `lf`. Empty and binary blobs need no special case.

### Migration append-only (sketch)
```bash
git diff --name-status --no-renames "$BASE"...HEAD -- supabase/migrations
# every line must start with "A"; any M, D, T (type change), or U fails. A rename shows as D + A with --no-renames.
```

### ci.yml additions (sketch, Prettier style)
```yaml
  hygiene:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0 # the migration check diffs against the PR base or the previous push tip
      - uses: ./.github/actions/setup
      - run: pnpm knip
      - run: node scripts/check-knip-baseline.mjs
      - run: pnpm jscpd
      - run: node scripts/audit-prod.mjs
      - run: node scripts/check-repo-hygiene.mjs
      - run: node scripts/check-migrations-append-only.mjs --base "$BASE_SHA"
        env:
          BASE_SHA: ${{ github.event_name == 'pull_request' && github.event.pull_request.base.sha || github.event.before }}
```
`test-unit` (D-18), replacing the single `pnpm test` step:
```yaml
      - run: pnpm test:harness
      - run: pnpm -r --filter '!@hearth/web' test # verified to select matching, recurrence, shared, e2e, seed, service
      - run: pnpm --filter @hearth/web test:coverage
```
`test-integration` (D-10), between `Start Supabase` and the coverage step:
```yaml
      - name: db:types matches the migrated schema
        run: |
          pnpm db:types
          git diff --exit-code -- apps/service/src/db/types.ts
```
Leave `apps/web` `test` unchanged: `test:sweep` runs `pnpm --filter @hearth/web test`, and coverage there would slow six cells and tie thresholds to every zone.

### sweep.yml (sketch)
```yaml
name: Sweep # must never be named CI: deploy.yml listens to the workflow named CI

on:
  push:
    branches: [main]
  schedule:
    - cron: '17 5 * * *' # off the top of the hour, when scheduled runs are delayed most
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: sweep-${{ github.ref }}
  cancel-in-progress: false

jobs:
  sweep:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v7
      - uses: ./.github/actions/setup
      - run: pnpm test:sweep --log-dir sweep-logs # nightly/dispatch also pass the today cell (see below)
      - uses: actions/upload-artifact@v7
        if: failure()
        with:
          name: sweep-logs
          path: sweep-logs/
          retention-days: 14
```

### The "today" cell (design; the rotation helper and a dry run are in the next section)
`test-sweep.mjs` currently selects cells by id from a fixed array and `--cell` rejects unknown ids (lines 27-35 and 180-185). Add one cell that is resolved at run time: `now` = the real instant at sweep start (ISO with `Z`), `tz = ZONES[floor(epochMs / 86400000) % ZONES.length]`. Print `now=` and `tz=` on its summary line so a red nightly can be reproduced with `HEARTH_TEST_NOW=<now> TZ=<tz> pnpm -r test`. Expose it as a flag such as `--with-today` (adds it to the default six) or `--cell today`; keep the pure rotation function importable or testable through `--list`/an injected `--now` so `test-sweep.test.mjs` never reads the clock. Choose a zone count that is not a multiple of 7 (for example 11) so a weekday does not always map to the same zone.

## Web coverage thresholds (CI-06)

Measured on this tree (728 tests passing): Statements 85.38%, Branches 81.83%, Functions 78.59%, Lines 86.96% [VERIFIED: command output]. Current thresholds `thresholds: { statements: 82, branches: 78, functions: 74, lines: 84 }` [VERIFIED: apps/web/vite.config.ts:86]. The measured values leave 3.4, 3.8, 4.6 and 3.0 points of slack. Recommended "just under" values (D-18): `statements: 84, branches: 80, functions: 77, lines: 85`, which leave 1.4, 1.8, 1.6 and 2.0 points. Every number goes up, so the earlier-research rule "do not lower a threshold to land a change" is satisfied. The comment above the thresholds in `vite.config.ts` ("Measured on this branch after closing the worst coverage gaps ...") should be refreshed with the new measurement date and the line "Enforced by `pnpm --filter @hearth/web test:coverage`" becomes "Enforced by CI's `test-unit` job". Confirm on the PR's own CI run that the runner reproduces the numbers before merge (A6).

Do not move `--coverage` into `apps/web`'s `test` script: `scripts/test-sweep.mjs` runs `pnpm --filter @hearth/web test` in every cell, so coverage would cost about 40 s more per cell and bind the thresholds to every zone and instant.

`docs/testing.md` Coverage section rewrite: the web bullet states the new thresholds and that CI's `test-unit` job runs `test:coverage`. The `packages/matching` and `packages/shared` thresholds stay unenforced in CI (their `test` scripts are plain `vitest run`); the existing bullet already says so, and CI-06 covers web only (mention this to the owner as a known remaining gap, not a defect of this phase).

## Today-cell dry run

Purpose: find out whether a "real date, rotating zone" cell would be red on its first nights. A throwaway script (in the session scratchpad, not in the repo) ran `pnpm --filter @hearth/<ws> test` with `HEARTH_TEST_NOW=<instant>` and `TZ=ZONES[floor(epochMs/86400000) % 11]`, with `ZONES = Pacific/Kiritimati, America/Los_Angeles, Asia/Kolkata, Europe/London, Pacific/Pago_Pago, Australia/Lord_Howe, America/New_York, Asia/Kathmandu, Pacific/Auckland, America/St_Johns, Asia/Tokyo` [ASSUMED design, see A5].

- **Non-web (shared, recurrence, matching, service), 12 instants, 48 runs, all exit 0:** 2026-10-22T14:00Z (Asia/Kolkata), 2026-10-25T01:30Z (EU DST end, Australia/Lord_Howe), 2026-10-31T23:30Z (Pacific/Kiritimati), 2026-11-01T06:30Z (US DST end, America/Los_Angeles), 2026-11-30T23:59Z (Pacific/Auckland), 2026-12-31T23:45Z (America/New_York), 2027-01-01T00:15Z (Asia/Kathmandu), 2027-02-28T23:30Z (Asia/Tokyo), 2027-03-14T09:30Z (US DST start, Asia/Kolkata), 2027-03-28T01:30Z (Australia/Lord_Howe), 2028-02-29T12:00Z (leap day, Asia/Kolkata), 2028-03-01T00:30Z (Europe/London) [VERIFIED: command output].
- **Web, 5 instants, all exit 0:** 2026-10-22T14:00Z (Asia/Kolkata), 2026-10-31T23:30Z (Pacific/Kiritimati), 2026-12-31T23:45Z (America/New_York), 2027-03-14T09:30Z (Asia/Kolkata), 2028-02-29T12:00Z (Asia/Kolkata) [VERIFIED: command output].
- **Reading:** the suite is not sensitive to the real date or to these rotating zones across month ends, year end, a leap day and several DST boundaries, so a nightly "today" cell is expected to start green. The e2e support tests were exercised by the fixed-cell sweep (36/36), not by this dry run. The point of the cell stays: it fails on the first real date the suite cannot handle, and the log line must carry the instant and zone to reproduce it.

Rotation helper sketch (pure; takes the instant as an argument so tests never read the clock):
```js
// Source: design sketch exercised by the dry run above
const TODAY_ZONES = [/* the 11 zones above */];
export function todayCell(instant /* Date */) {
  const day = Math.floor(instant.getTime() / 86_400_000);
  return { id: 'today', now: instant.toISOString(), tz: TODAY_ZONES[day % TODAY_ZONES.length] };
}
```
`scripts/test-sweep.mjs` is not under the clock-ban lint rule (only `*.test.*`, `e2e/`, test helpers and `test/**/*.mjs` are), so it may read the real clock once at start; `scripts/test-sweep.test.mjs` is fenced and must call `todayCell(new Date('2026-10-22T14:00:00.000Z'))` style with an explicit instant.

## CI-05 Candidate Findings (inputs for the ledger)

Evidence sources: reading `ci.yml`/`deploy.yml`/`action.yml`; actionlint (Docker `rhysd/actionlint`); zizmor 1.31.1 offline (Docker `ghcr.io/zizmorcore/zizmor`, 42 findings, 11 suppressed); GitHub REST. None of these tools is added to the repo.

| # | Area | Finding | Evidence | Suggested disposition |
|---|------|---------|----------|----------------------|
| F1 | Timeouts | Five of six jobs have no `timeout-minutes` (360-minute default); only `test-e2e` has 40 | `ci.yml` (only line 60 matches) | Fix (CI-05). Sizes below. |
| F2 | Concurrency | CI group `ci-${{ github.ref }}`, cancel only for PRs: main runs queue, but a newer pending run replaces an older pending one (push run #18 on main ended `cancelled`, consistent with replacement; the cause was not confirmed) | `ci.yml:11-13`; run list | Kept: correct for deploy ordering; note in ledger |
| F3 | Concurrency + docs-only rule | Deploy group `deploy` (cancel false) keeps one pending run. If a code commit's Deploy is replaced by a later docs-only commit's run, that run's tip-only diff (`HEAD~1..HEAD`) finds only `docs/` and skips, so the code commit is never deployed until the next code push | `deploy.yml:15-17` and the `git diff --name-only HEAD~1 HEAD` step; 13 cancelled Deploy runs observed | Changes deploy behavior: flag to owner before any fix (for example diff against the last deployed SHA) |
| F4 | Deploy triggers | By the step logic, `.planning/`-only pushes deploy, because only `^docs/` is exempt (`grep -qv '^docs/'`). The exemption step runs on the self-hosted runner, so its result is not observable today; the REST data only shows the `deploy` job accepted (queued) for `cb808e6` and `c36ce92` | `deploy.yml` step `changes`; REST | Owner decision (D-02 documents the current rule); not changed here unless the owner asks |
| F5 | `workflow_run` safety | Guard checks `conclusion == 'success'`, `event == 'push'`, `head_branch == 'main'`, and checks out `workflow_run.head_sha`; trigger also filtered by `branches: [main]`. A fork PR run has event `pull_request` and is rejected. zizmor flags `dangerous-triggers` (High/Medium) at `deploy.yml:7` | `deploy.yml:7-30`; zizmor | Kept with reason (the guard is the mitigation) |
| F6 | Stale deploy order | A re-run of an older CI run on `main` completing after a newer one would deploy the older `head_sha` (this is why the owner declined re-runs, STATE.md Phase 3) | `deploy.yml`, STATE.md | Changes deploy behavior: flag; possible fix is an ancestor check against `origin/main` |
| F7 | Pinning | All actions are tag-pinned (`@v7`, `@v6`, `@v3`, `@v4`); zizmor `unpinned-uses` x14 (High) | zizmor | Kept: SHA pinning is CIX-01 (v2); Dependabot covers actions weekly |
| F8 | Credentials | zizmor `artipacked` (Low) x7: `actions/checkout` persists the token in `.git/config`. No job pushes. `persist-credentials: false` is safe for CI jobs; the deploy job runs on a self-hosted runner | zizmor | Fix in `ci.yml` (hygiene needs the credential only during checkout); `deploy.yml` change is a deploy-behavior change, flag |
| F9 | Permissions | Workflow-level `contents: read`; `test-e2e` adds `packages: read`. New jobs inherit read-only | `ci.yml:8-9` | Kept; give `sweep.yml` the same block |
| F10 | Secrets | Only `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` (optional login) and `GITHUB_TOKEN`; logins are `continue-on-error` | `ci.yml` | Kept |
| F11 | Caching | `actions/setup-node` with `cache: pnpm`; Playwright browsers are re-installed every run | `action.yml`; `ci.yml` | Kept (perf, not correctness) |
| F12 | Artifacts | Playwright report uploaded on failure, 7 days; no other artifact | `ci.yml` | Kept; sweep logs follow the same pattern |
| F13 | actionlint | `deploy.yml:25` label `hearth` unknown (self-hosted label) | actionlint | Kept (needs a config file if actionlint is ever adopted) |
| F14 | Dependabot | zizmor `dependabot-cooldown` (Medium) x3 | zizmor | Kept (not CI correctness; owner may add `cooldown`) |
| F15 | Merge policy | Repository allows merge commits and rebase merges as well as squash (`allow_merge_commit: true`, `allow_rebase_merge: true`); the deploy docs-only check looks only at the tip commit | `gh api repos/...` | Already listed under "Not yet enforced" |
| F16 | Branch protection | `main` is not protected; no rulesets (`[]`) | `gh api` | Deferred (owner setting) |
| F17 | E2E reliability | `test-e2e` is the failing job in nearly all red runs (25 failed job records vs 2 to 4 for other jobs): registry flakes and notification specs | job records | Outside CONTEXT scope; see Open Question 8 |

## Timeouts (D-19 evidence)

From `GET /repos/alex-tanton/hearth/actions/runs/{id}/jobs` for the 40 most recent CI runs (324 job records, 2026-10-13 to 2026-10-22), successful jobs only [VERIFIED: gh api]:

| Job | n | median (min) | p95 (min) | max (min) | Recommended `timeout-minutes` |
|-----|---|--------------|-----------|-----------|------------------------------|
| lint | 50 | 1.4 | 1.6 | 8.4 | 10 |
| typecheck | 50 | 0.8 | 1.0 | 7.8 | 10 |
| build | 53 | 0.5 | 0.6 | 7.5 | 10 |
| test-unit | 50 | 4.0 | 4.5 | 9.6 | 15 (web coverage adds about 40 s) |
| test-integration | 52 | 6.6 | 7.3 | 12.2 | 25 (db:types adds seconds) |
| test-e2e | 29 | 10.8 | 12.2 | 17.8 | 40 (keep) |
| hygiene (new, no history) | - | - | - | - | 10 (conservative; install about 1 min, knip about 5 s x2, jscpd under 1 s) |
| sweep (new, no history) | - | - | - | - | 60 (local run 10.4 min, CI about 2x slower, plus install) |

The floor of 10 for the quick jobs sits above their observed maxima (the 7.5 to 9.6 maxima look like one-off slow runs); 2 to 3 times p95 alone would give 3 to 5 minutes, which would fail those outliers.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jscpd 4.x (JavaScript) | jscpd 5.x (native binary via platform `optionalDependencies`, clap-style CLI, `--baseline`, `--fail-on-empty`) | 5.x line, 2026 | `--gitignore` is rejected by 5.4.1 (gitignore respected by default); lockfile gains eight platform entries |
| `pnpm audit` for dev and prod together | `pnpm audit --prod` scoped to production deps | existing flag | `braces`, 6 `vite` and 2 `@vitest/mocker` advisories appear only in the full audit (dev-only) |
| Whole-job `continue-on-error` for new gates | Prove green on the PR's own CI run, then block | project decision | Avoids a red first run on `main` |

**Deprecated/outdated:** the CONTEXT line that D-08 headroom is "only about 0.13 points above the 1.87% baseline" is outdated; Phase 5 took the figure to 1.11% (`REDUNDANCY-LEDGER.md`, reproduced here). The CONTEXT note that Phase 5 is still executing is also outdated: STATE.md shows 44 of 44 plans complete and all four PRs merged.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Failure emails for scheduled runs reach the owner: GitHub docs say they go to "the user who last modified the cron syntax"; D-16 assumes that is the owner | Summary, Pitfall 6 | A red nightly goes unnoticed. Confirm the owner (not a bot or session identity) authors the commit that last touches the `cron:` line and has Actions notifications on. |
| A2 | The owner's plan is Free/Pro/Team with the included-minutes figures above, and the sweep fits | Pitfall 11 | The nightly could exhaust the monthly allowance and stall CI. |
| A3 | `pnpm fetch --frozen-lockfile` in the Docker builds fetches only host-platform optional dependencies, so adding jscpd costs one native tarball in the BuildKit cache mount and nothing in the runtime image | Standard Stack | Longer E2E image builds (cold cache). Measure in the PR. |
| A4 | The npm audit endpoint pnpm 10.34.5 uses (`/-/npm/v1/security/audits/quick`, from the error message) stays available | Pitfall 3 | `hygiene` goes red permanently with "audit unavailable"; fix by upgrading pnpm. |
| A5 | The 11-zone rotation list in the dry run is a good default; any set of IANA zones with distinct offsets and a count not divisible by 7 works | Code Examples | None for correctness; coverage of offsets differs. |
| A6 | Recommended web thresholds 84/80/77/85 hold on the CI runner (v8 coverage is the same on Linux) | CI-06 below | A first CI run below a threshold; adjust in the PR before merge. |
| A7 | For `pull_request`, `actions/checkout` checks out the merge commit of the PR into the base | Pitfall 8 | The three-dot diff from `base.sha` is still correct either way. |
| A8 | Pushing files under `.github/actions/` does not need the `workflow` scope (only `.github/workflows/` does) | Pitfall 6 | PR 1 would also need the hand-off if the composite action is edited; this plan does not edit it. |
| A9 | `persist-credentials: false` is safe for all `ci.yml` jobs (none push) | CI-05 F8 | A job fails at a later git operation; the hygiene job uses full history from checkout. |

## Open Questions

1. **CI-04 wording versus D-09 (`braces`).**
   - What we know: the requirement and success criterion 3 say the audit "passes with an expiring allowance for `braces`"; `pnpm audit --prod` has no `braces` finding because it is reachable only via `apps__service>kysely-codegen>micromatch>braces` (devDependency; `pnpm -r why braces` confirms); GHSA-vfj7-8cjw-p6xm has `patched_versions: "<0.0.0"` (no fix).
   - What's unclear: whether the owner wants a literal `braces` entry anyway.
   - Recommendation: follow D-09 (empty allowlist, mechanism proven by tests using the braces GHSA as the fixture) and record in the ledger that the allowance is unnecessary under `--prod` and why; a stale-entry note instead of a failure makes adding one later harmless.

2. **D-17 pre-merge `workflow_dispatch` is impossible for a new workflow file.**
   - Recommendation: replace it with (a) the local `pnpm test:sweep` (already green here), (b) the first `push` run of `sweep.yml` on the merge commit as the first CI proof, (c) a `workflow_dispatch` run afterwards for the today cell. Ask the owner whether a temporary path-filtered `pull_request` trigger is preferred instead.

3. **Tighten the jscpd limit?** The owner chose 2%; current is 1.11% (headroom about 680 duplicated lines). Keep 2% unless the owner wants a ratchet such as 1.5%.

4. **knip.json scope (Phase 3 open question):** adopt `node: false` (closes the test-directory blind spot) and whether to add `scripts/knip-summary.mjs!` (baseline 28 to 27). Recommendation: adopt `node: false`; leave `knip-summary.mjs` reported to honor the recorded `keep-reported` decision unless the owner changes it.

5. **Sweep cost and trigger scope:** add `paths-ignore` for `docs/**` and `.planning/**` on the push trigger? Confirm the plan tier (A2).

6. **Deploy-behavior fixes (F3, F4, F6, F8 on `deploy.yml`):** per D-20 these are flagged, not applied. The owner decides which become changes; the CI-07 proof must run on the final `deploy.yml`.

7. **Optional structural workflow test** (name is `CI`, job ids unchanged, `timeout-minutes` on every job, `deploy.yml` listens to `CI`) needs `yaml` at the root. It is the cheapest lock-in for D-01 and CI-05; not required by CONTEXT, so confirm with the planner.

8. **E2E flakiness** (notification specs at `19-notifications.spec.ts:140` and `17-accessibility-states.spec.ts:497,526`, a midnight-America/New_York hypothesis) is listed in STATE.md as "look at in Phase 6" but no CONTEXT decision covers it. Treat as out of scope unless the owner adds it; the new `hygiene` job does not touch E2E.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 24 | all scripts, sweep | yes | v24.21.0 | - |
| pnpm | all | yes | 10.34.5 | - |
| git | hygiene scripts and their tests | yes | 2.43.0 | - |
| Docker daemon | local db:types proof, actionlint/zizmor evidence | yes (pulls work through the proxy) | 29.9.1 | CI runner |
| Supabase CLI | db:types determinism (local) | yes | 2.117.0 (matches CI pin) | CI run |
| psql | `pnpm db:seed` only | yes | 16.15 | - |
| GitHub REST (`gh api`) | run durations, Deploy evidence | yes for REST; GraphQL blocked by the session proxy; Actions runners/permissions paths return 403 through the proxy | gh 2.89.0 | use REST paths only |
| GitHub token `workflow` scope | pushing `.github/workflows/*` | **no** (scopes `gist, read:org, repo`) | - | owner `apply.sh` hand-off |
| Self-hosted runner `hearth` | Deploy job | not registered (job sits `queued`) | - | CI-07 accepts `queued` |
| npm registry | audit, version checks | yes | - | - |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the `workflow` scope (hand-off), the self-hosted runner (queued state accepted by D-21).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node `node:test` (CI scripts, harness) and Vitest 5.0.1 (workspaces) |
| Config file | none for `node --test`; list in root `package.json` `test:harness` |
| Quick run command | `node --test scripts/<new-script>.test.mjs` |
| Full suite command | `pnpm test` (harness first, then workspaces); plus `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm knip` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CI-01 | default knip is 0; a new production finding fails; a stale baseline row fails; CRLF/backslash paths normalize | unit + live | `node --test scripts/check-knip-baseline.test.mjs`; `pnpm knip` | Wave 0 |
| CI-02 | gate fails above threshold, passes below (canary on a tiny temp tree with a duplicated block) and the live tree is under 2% | unit + live | `node --test scripts/jscpd-gate.test.mjs` (or inside another test); `pnpm exec jscpd` | Wave 0 |
| CI-03a | tracked-ignored, 100644 shebang file, 100644 `.sh`, CRLF in index each fail; clean repo passes | unit (temp git repos) | `node --test scripts/check-repo-hygiene.test.mjs` | Wave 0 |
| CI-03b | migrations: add passes; modify, delete, rename, type change fail; unresolved base fails | unit (temp git repos with commits) | `node --test scripts/check-migrations-append-only.test.mjs` | Wave 0 |
| CI-03c | db:types drift: a deliberate edit to `types.ts` turns the step red | CI throwaway commit | PR run evidence | n/a |
| CI-04 | clean passes; unlisted advisory fails; listed unexpired passes; listed expired fails; `{error}` and missing `advisories` fail; malformed JSON fails | unit | `node --test scripts/audit-prod.test.mjs` | Wave 0 |
| CI-05 | every job has `timeout-minutes`; workflow name and ids unchanged | optional contract test or ledger evidence | `node --test scripts/workflows.test.mjs` | Wave 0 (optional) |
| CI-06 | web thresholds pass at the new values; docs mention the same numbers | live + docs check | `pnpm --filter @hearth/web test:coverage`; `node .planning/cleanup/tools/docs-claims-check.mjs` | exists |
| CI-07 | Deploy run for the merge SHA has event `workflow_run` and job `deploy` queued or in progress | API evidence | `gh api repos/alex-tanton/hearth/actions/workflows/382163742/runs` then `.../runs/{id}/jobs` | n/a |
| TIME-06 | today-cell resolution is a pure function of the instant (known instants map to known zones); `--list` shows it; `pnpm test:sweep` green; first `push` run of `sweep.yml` green | unit + live | `node --test scripts/test-sweep.test.mjs`; `pnpm test:sweep` | extend existing |

### Sampling Rate
- **Per task commit:** the single new `*.test.mjs` plus `pnpm lint` on the touched files (lint-staged and the hook do part of this).
- **Per wave merge:** `pnpm test:harness && pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`.
- **Phase gate:** full `pnpm test`, `pnpm test:sweep`, all hygiene commands green locally, then the PR's six-plus-one CI jobs green before each merge.

### Wave 0 Gaps
- [ ] Test files listed above (none exist); append each to `test:harness` in `package.json`.
- [ ] `docs/testing.md` harness counts: line 28-31 says "The other seven are the harness tests" and lists them; every new harness test changes the count and the list.
- [ ] Dry-run of the hygiene script against the real tree after the three mode fixes (expected: no findings).

## Security Domain

### Applicable ASVS Categories (ASVS level 1, `security_enforcement` enabled)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | - |
| V3 Session Management | no | - |
| V4 Access Control | yes (workflow permissions, token scope) | least-privilege `permissions: contents: read`; no `pull_request_target`; deploy guard on `event`/`head_branch` |
| V5 Input Validation | yes (script arguments, refs, advisory JSON, allowlist file) | validate `--base` against a SHA/ref pattern; spawn `git` with argument arrays (no shell); parse JSON with explicit shape checks; fail closed |
| V6 Cryptography | no | - |
| V10 Malicious Code / V14 Configuration (supply chain) | yes | exact-pinned devDependency; legitimacy check on jscpd; actions tag-pinned and Dependabot-covered (SHA pinning deferred to CIX-01) |

### Known Threat Patterns for GitHub Actions plus Node CI scripts

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Script injection through `${{ github.event... }}` inside `run:` | Tampering / Elevation | pass through `env:`, quote in shell, validate in the script (Pattern 3) |
| `workflow_run` executing untrusted PR code with secrets or a self-hosted runner | Elevation | existing three-part guard plus `branches: [main]`; do not weaken (F5) |
| Allowlist used to hide real findings | Repudiation / Tampering | per-entry `expires` and `reason`; fail on expired; consider a maximum horizon (for example 180 days) enforced by the script; knip baseline fails on stale rows too |
| Silent pass when the audit backend is down | Tampering | detect missing `advisories`/`error` and fail closed (Pitfall 3) |
| Credential persistence in `.git/config` on a self-hosted runner | Information disclosure | `persist-credentials: false` where no later git network operation exists (F8; deploy change is flagged) |
| Native binary supply chain (jscpd platform packages) | Tampering | exact pin to the owner-approved 5.4.1, lockfile integrity, no install scripts (verified) |
| Secrets in uploaded artifacts | Information disclosure | sweep logs hold only test output and `[test-clock]` lines; upload `sweep-logs/` only, never the workspace |
| Scheduled workflow with write token | Elevation | `permissions: contents: read` at workflow level |

## Documentation and File Touch List (so the planner can schedule docs)

- `docs/testing.md`: Coverage section (lines 702-729; the web bullet at 724-729 says CI does not run it and the `test` script has no `--coverage`; the `packages/*` bullet at 705-713 stays true: matching and shared thresholds remain unenforced in CI); Analysis tools (lines 731-745: "Neither is part of `pnpm test` or CI" becomes false for knip and jscpd; jscpd is now a devDependency, not `pnpm dlx`); sweep section (add the today cell and `sweep.yml`); harness list (lines 28-31 and 139+ with the new tests).
- `docs/file-map.md`: the `scripts/` row (line 18) and the per-file table (lines 150-160), the `knip.json` row (line 29 says "report-only"), the `.github/` row (line 21) and the CI row (line 189: "each of its six jobs").
- `CONTRIBUTING.md`: add what CI blocks now; "Not yet enforced" stays true for branch protection. `README.md` and `CONTRIBUTING.md` are outside `docs/`, so editing them deploys (this is what makes PR 3 a valid CI-07 proof).
- `.claude/CLAUDE.md` and `.planning/codebase/STACK.md`, `CONCERNS.md`, `TESTING.md`: knip "report-only ... (CI does not run it)", the CI job list, the jscpd mention; the project rule is to keep these maps in line with the code (Phase 5 RED-05).
- Run `node .planning/cleanup/tools/docs-claims-check.mjs` after doc edits (Phase 5 left it at 0 misses; new script names must either exist or be added to its allowlist with a reason).
- Ledger: `.planning/cleanup/` file for CI-05 (checklist above), CI-07 (run link), the final jscpd figure, and the roadmap-wording note (D-08).

## Sources

### Primary (HIGH confidence)
- Local files read this session: `.github/workflows/ci.yml`, `deploy.yml`, `.github/actions/setup/action.yml`, `.github/dependabot.yml`, `knip.json`, `package.json`, `scripts/test-sweep.mjs`, `scripts/knip-summary.mjs`, `apps/web/vite.config.ts`, `apps/service/vitest.coverage.config.ts`, `docs/testing.md`, `CONTRIBUTING.md`, `eslint.config.js`, `.gitattributes`, `.gitignore`, `supabase/config.toml`, `.planning/cleanup/{REDUNDANCY-LEDGER,OWNER-CANDIDATES,TRIAGE,REMOVAL-LEDGER}.md`, `.planning/research/PITFALLS.md`.
- Command output from this session: knip (default, production, canaries), jscpd 5.4.1 (and 5.4.2), `pnpm audit` (`--prod`, full, forced failure), `pnpm -r why braces`, `pnpm --filter @hearth/web test:coverage`, `node scripts/test-sweep.mjs`, git index scans, actionlint, zizmor.
- GitHub REST via `gh api` (`alex-tanton/hearth`): workflow list, 60 CI runs, 324 job records, Deploy runs and job state, repository settings, branch protection (404), rulesets (`[]`).
- npm registry: `npm view jscpd`, `jscpd@5.4.1`, `jscpd-linux-x64-gnu@5.4.1`.

### Secondary (MEDIUM confidence)
- docs.github.com "Events that trigger workflows" (schedule, workflow_dispatch, workflow_run), "Using concurrency" (pending replacement), "About billing for GitHub Actions" (included minutes), fetched this session through WebFetch (summarized by the fetch tool; quotes above are as returned).

### Tertiary (LOW confidence)
- None used as authoritative; see the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, every tool run against this tree; jscpd carries a seam SUS flag handled above.
- Architecture: HIGH for gates and job layout; MEDIUM for GitHub semantics (docs via fetch tool).
- Pitfalls: HIGH for the six that were reproduced (banner, audit exit 0, knip production entries, blind spot, script modes, dispatch rule); MEDIUM for quota and notification behavior.

**Research date:** 2026-10-22
**Valid until:** about 2026-11-05 for the numbers (Dependabot and Phase 6 PRs move the tree); GitHub semantics are stable for months.
