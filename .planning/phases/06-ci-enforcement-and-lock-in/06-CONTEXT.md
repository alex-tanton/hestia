# Phase 6: CI Enforcement and Lock-in - Context

**Gathered:** 2026-10-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Make CI block regressions of everything this milestone cleaned, without turning `main` red and without breaking the `CI`-triggers-`Deploy` contract. Requirements CI-01 to CI-07 and TIME-06: blocking knip and jscpd checks, repo drift checks (tracked-ignored files, `db:types`, migration append-only, script modes and line endings), `pnpm audit --prod` with an expiring `braces` allowance, job timeouts plus a correctness review of both workflows, the web coverage decision, a date/timezone matrix on `main` and nightly, and proof that a merge to `main` still fires `deploy.yml`. No product code changes. Phase 5 is still executing (plans 05-09 to 05-13 pending); Phase 6 planning must start from the `ci.yml` and docs as Phase 5 leaves them.

</domain>

<decisions>
## Implementation Decisions

### Carried forward (still binding)
- **D-01:** The workflow stays named `CI` and its job ids (`lint`, `typecheck`, `test-unit`, `test-integration`, `test-e2e`, `build`) do not change, because `deploy.yml` triggers on `workflow_run` for the workflow named `CI` (Phase 5 D-13). New jobs may be added.
- **D-02:** Land work as pull requests, squash-merged per `CONTRIBUTING.md`; never push to `main` directly or rewrite published history. Every merge to `main` runs CI and deploys, except `docs/`-only tips. `.planning/` files are included in the PRs (Phase 5 D-04).
- **D-03:** Nothing review-like (review, decision-log, ADR files) goes under `docs/`. `docs/testing.md` is updated where behavior changes. `supabase/migrations/` is never edited. Ledgers live under `.planning/cleanup/`.
- **D-04:** The date/timezone matrix reuses `HEARTH_TEST_NOW`, `TZ` and `scripts/test-sweep.mjs` (Phase 2 D-02); the six fixed unit cells are the matrix.
- **D-05:** The jscpd baseline is the test-inclusive Phase 2 scan: 96 clones, 1.87% of lines (Phase 2 D-13), as reduced by Phase 5.

### Gate wiring (CI-01, CI-02, CI-04)
- **D-06:** One new parallel job named `hygiene` in `ci.yml` runs the knip, jscpd, audit, tracked-ignored, script-mode and migration-append-only checks, using the `.github/actions/setup` composite action. Not one job per check, not folded into `lint`.
- **D-07:** knip blocks in both default and `--production` modes. Production mode has 28 owner-listed kept items (test-only, config-reachable), so it blocks against a committed baseline file: any finding not in the baseline fails CI. Default mode runs at zero findings. The baseline format and its normalizer (reuse `scripts/knip-summary.mjs`) are for the planner; the baseline must not become a way to hide real candidates (Phase 2 D-10). — **Reversibility:** reversible — a config and one file.
- **D-08:** jscpd blocks on the **test-inclusive** percentage with the limit set at **2%** (owner choice; baseline 1.87%, so headroom is small). The command uses the Phase 2 parameters (`--min-tokens 60 --min-lines 8`) and a committed `.jscpd.json`; the planner must confirm the post-Phase-5 figure is under 2% and that the check is deterministic. This departs from the roadmap's "source duplication" wording; the planner records the final figure and notes the wording difference.
- **D-09:** The audit step is a small tested script that runs `pnpm audit --prod --json`, ignores only advisories listed in a committed allowlist file with an expiry date each, and fails when an unlisted advisory appears or a listed one has expired. `pnpm audit --prod` is clean today ("No known vulnerabilities"), so the allowlist starts without a `braces` entry; the mechanism and a test must show an entry working and expiring. The planner checks whether `braces` is dev-only (then outside `--prod`) and says so.

### Drift and hygiene checks (CI-03)
- **D-10:** `db:types` drift runs inside the existing `test-integration` job, which already has `supabase start` with the migrations applied: run `pnpm db:types`, then `git diff --exit-code apps/service/src/db/types.ts`. Before gating, the planner proves `db:types` is deterministic (two consecutive runs, identical bytes, on Node 24 as in CI). Per STATE.md this was unverified.
- **D-11:** Migration append-only is a diff against the base: only added files under `supabase/migrations/` are allowed; modify, delete and rename fail. On pull requests compare to the PR base; on a push to `main` compare to the previous commit. The hygiene job needs enough fetch depth for the base ref. An escape hatch is not provided (no label or trailer override).
- **D-12:** Tracked-ignored files, script mode and line endings are one tested Node script (for example `scripts/check-repo-hygiene.mjs`) run by the `hygiene` job, with a `node:test` file wired into `test:harness` like `scripts/deploy.test.mjs`. It uses `git ls-files -ci --exclude-standard`, `git ls-files -s` and a CRLF scan. Not inline shell in `ci.yml`; no pre-commit hook.
- **D-13:** "Script" means every tracked file that starts with a shebang, plus every `*.sh`. Both must be mode `100755` and LF. This catches extensionless scripts such as `apps/service/bin/hearth-admin`.

### Date/timezone matrix (TIME-06)
- **D-14:** A new workflow file `.github/workflows/sweep.yml`, not named `CI`, with triggers: push to `main`, a nightly `schedule`, and `workflow_dispatch`. Not on pull requests. It does not gate or trigger deploys (`deploy.yml` listens only to `CI`). It runs on GitHub-hosted runners with the composite setup action and has a job timeout.
- **D-15:** Suites: unit and component tests via `pnpm test:sweep`, all six fixed cells on both the push and nightly triggers. The nightly additionally runs one extra "today" cell: the real current date with a rotating zone. Exact zone-rotation rule and how the cell is passed to `scripts/test-sweep.mjs` (a new `--cell` form or env) are for the planner. The integration sweep stays local (it needs Supabase). — **Reversibility:** reversible.
- **D-16:** A failing nightly cell is a red workflow run (GitHub emails the repository owner on scheduled-workflow failure) plus per-cell logs uploaded as an artifact via the sweep's `--log-dir`. No tracking issue is opened.
- **D-17:** Proof before merge: a `workflow_dispatch` run on the PR branch (green run link recorded) plus a local `pnpm test:sweep` on Node 24. The cron itself is confirmed after merge by the first nightly run.

### Coverage, timeouts, review, deploy proof (CI-05, CI-06, CI-07)
- **D-18:** Web coverage thresholds are **enforced**: the `test-unit` job runs web with `pnpm --filter @hearth/web test:coverage` instead of a second plain web run. Planning re-measures the current coverage and adjusts the thresholds in `apps/web/vite.config.ts` (82/78/74/84 today) to sit just under the measured values, and rewrites the `docs/testing.md` Coverage section, which currently says web has no coverage configuration, so config and docs agree. — **Reversibility:** reversible.
- **D-19:** Every job gets a `timeout-minutes` sized to observed run durations (about 2 to 3 times the p95 of recent runs; `test-e2e` keeps 40). The planner reads recent Actions run durations; any job with no history gets a conservative value and a note.
- **D-20:** The CI-05 correctness review of `ci.yml`, `deploy.yml` (and the new `sweep.yml`) is a checklist ledger under `.planning/cleanup/`: concurrency, permissions, triggers, secrets use, `workflow_run` safety (head SHA, fork PRs, the main-only guard), action pinning, caching, artifacts. Each finding is fixed in the PR or recorded as kept with a reason. A fix that changes deploy behavior is flagged to the owner before merge.
- **D-21:** CI-07 is proven on the real Phase 6 merge: a small non-docs change merged after the CI changes land, confirming a `Deploy` run is triggered by `CI`'s `workflow_run` and reaches the deploy job (running, or queued if no self-hosted runner is registered; `CONTRIBUTING.md` notes that case). The merge deploys, so the owner confirms before it. The run link goes in the ledger. — **Reversibility:** costly — the merge deploys to production.

### Claude's Discretion
- Baseline file format for knip production mode and how it is normalized (D-07).
- Names and locations of the hygiene script, audit script, allowlist file and `.jscpd.json` (D-08, D-09, D-12).
- The rotation rule and invocation of the nightly "today" cell (D-15).
- PR split and order (suggested: the `hygiene` job and its scripts; coverage and timeouts; `sweep.yml`; the deploy-proof change), commit grouping, ledger layout.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` (Phase 6) - goal and five success criteria
- `.planning/REQUIREMENTS.md` - CI-01 to CI-07, TIME-06
- `.planning/PROJECT.md` and `.claude/CLAUDE.md` Constraints - no behavior change, `main` deploys, nothing review-like under `docs/`
- `.planning/STATE.md` ("Blockers/Concerns") - `db:types` determinism unverified, `braces` advisory, web coverage decision, no branch protection

### Prior decisions
- `.planning/phases/02-baseline-net-stabilization-and-analysis/02-CONTEXT.md` - D-02 sweep env vars, D-08 to D-10 knip scope, D-13 test-inclusive jscpd baseline
- `.planning/phases/05-redundancy-reduction-and-text-sync/05-CONTEXT.md` - D-04 planning files in PRs, D-12 to D-15 composite action and `CI` name and job ids
- `.planning/phases/04-bug-fixes-with-regression-tests/04-CONTEXT.md` - D-15 manual Kong recreate step (automatic recreate was floated as a Phase 6 idea)
- `.planning/phases/03-evidence-gated-removal/03-CONTEXT.md` - landing pattern and ledger approach

### CI and tooling
- `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/actions/setup/action.yml`, `.github/dependabot.yml`
- `knip.json`, `package.json` scripts (`knip`, `knip:production`, `knip:summary`, `test:harness`, `test:sweep`, `test:sweep:integration`), `scripts/knip-summary.mjs`
- `scripts/test-sweep.mjs`, `test/clock-setup.mjs`, `test/global-tz.mjs` - the matrix cells and env contract
- `.planning/cleanup/TRIAGE.md` ("Duplication baseline"), `.planning/cleanup/OWNER-CANDIDATES.md`, `.planning/cleanup/knip/` - jscpd command and knip findings
- `apps/service/package.json` (`db:types` script), `apps/service/src/db/types.ts`, `supabase/migrations/`
- `apps/web/vite.config.ts` (coverage block), `apps/web/package.json` (`test:coverage`)
- `scripts/deploy.test.mjs`, `scripts/ci-prepull-images.test.mjs` - style for tested CI/deploy scripts

### Docs
- `docs/testing.md` ("Coverage", sweep sections) - must agree with the final config
- `CONTRIBUTING.md` ("Deploys", "Scripts", "Not yet enforced") - landing rules; update where Phase 6 changes what is enforced
- `docs/deploy.md` - deploy contract

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.github/actions/setup` composite action (checkout, pnpm, Node, install) - every new job uses it.
- `scripts/test-sweep.mjs` with `--cell`, `--log-dir`, `--list`; fixed `UNIT_CELLS` and `INTEGRATION_CELLS`.
- `scripts/knip-summary.mjs` - report normalizer for the production baseline.
- `test-integration` job - already boots `supabase start`, the right place for the `db:types` drift step.
- `test:harness` script - where tests for new CI scripts are registered.

### Established Patterns
- CI scripts are plain Node `.mjs` with a sibling `*.test.mjs` run by `node --test` through `test:harness`.
- Pinned exact versions everywhere (`saveExact`); tooling like jscpd is added as an exact-pinned devDependency through a PR.
- Only `test-e2e` has `timeout-minutes` today (40).

### Integration Points
- `deploy.yml` listens to `workflow_run` of `CI` on `main` with a head-branch and event guard; a new workflow does not interact with it.
- Script checks rely on git index metadata (`git ls-files -s`), which needs a real checkout, not a source tarball.
- Dependabot already covers `/.github/actions/setup`.

</code_context>

<specifics>
## Specific Ideas

- `pnpm audit --prod` currently reports no vulnerabilities, so the `braces` allowance is a mechanism with an expiry test rather than a live exemption.
- `apps/web/vite.config.ts` already enforces thresholds (82/78/74/84) but nothing runs them in CI and `docs/testing.md` says web has no coverage at all; the fix is making CI, config and doc agree.
- The 2% jscpd limit sits only about 0.13 points above the 1.87% baseline; Phase 5 is expected to lower it.

</specifics>

<deferred>
## Deferred Ideas

- Integration date/timezone sweep in CI (needs `supabase start` in the nightly): left local.
- Automatic Kong recreate on `kong.yml` change in `deploy.sh`: raised in Phase 4 D-15, not taken up here.
- GitHub branch protection, required status checks and squash-only merge settings: owner repository settings, not code (listed under "Not yet enforced" in `CONTRIBUTING.md`).
- A tracking issue for failing nightly runs; a migration-check override label: not wanted now.

</deferred>

---

*Phase: 6-CI Enforcement and Lock-in*
*Context gathered: 2026-10-22*
