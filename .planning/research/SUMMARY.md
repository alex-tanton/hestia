# Project Research Summary

**Project:** Hearth - Cleanup and Hardening
**Domain:** Cleanup, test stabilization, and hardening of an LLM-generated TypeScript pnpm monorepo (Fastify service, React/Vite PWA, Supabase/Postgres, Playwright E2E, GitHub Actions CI with deploy-on-merge)
**Researched:** 2026-10-11
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a brownfield cleanup milestone, not a feature build. Experts run it as an evidence-gated pipeline:
1. Make the test net deterministic.
2. Observe with a calibrated analyzer in report-only mode.
3. Delete only what three independent signals agree is dead.
4. Fix known bugs in isolation, each red-then-green.
5. Reduce redundancy with the widest net.
6. Sync text.
7. Turn enforcement gates on last.

The repo is small (668 tracked files, 7 workspaces) and tidy on the surface:
- No tracked build artifacts, and `tsc --noUnusedLocals` reports zero.
- Measurable debris is modest: about 1 unused file, 6 unused exports, 13 unused types, 1 unused devDependency, and 1 broken script in default mode.
- 7 web test files are time-dependent.

The larger risk is false confidence. Static analysis cannot see the service worker, the CLI shim, Docker/Compose/Kong wiring, SQL, or fixtures selected by computed filename.

The recommended stack is knip 6.41.0 (default and `--production` runs, with a verified `knip.json`) and jscpd 5.4.1 (source-only threshold). Determinism uses Vitest `vi.setSystemTime` plus a `globalSetup` `TZ` hook. E2E stays on the real clock, since the browser clock cannot move the server or Postgres. No other dependencies are added. Enforcement lands last as a ratchet, because `deploy.yml` fires on the workflow named `CI` and a red gate on `main` blocks every deploy.

Three findings change the scoping:
1. **The offline-duplicate bug is likely misdiagnosed.** Server dedupe already exists (`ON CONFLICT (id) DO NOTHING`, client-minted ids). The real leak candidate is `useAddDealToList`, which mints `crypto.randomUUID()` inside `mutationFn`, so every retry gets a new id. Reproduce before fixing.
2. **The service-role ESLint fence already exists.** The work is auditing the allowlisted files and proving the rule fails when violated.
3. **Every merge to `main` is a production deploy.** Only `docs/` is exempt. This ties directly to the PROJECT.md git requirement: curate and publish history first, then use branches and squash-merged PRs so each PR causes one deploy and `.planning/` commits do not trigger deploys.

## Key Findings

### Recommended Stack
Two new root devDependencies, exact-pinned. Everything else is built-in or already installed.

- **knip 6.41.0:** the only maintained workspace-aware tool covering files, exports, types, dependencies, and binaries. Zero-config default mode falsely reports 0 unused files; `--production` exposes dead modules.
- **jscpd 5.4.1:** duplication is 0.46% today (11 clones). Gate source only, with `threshold: 1`.
- **Vitest `vi.setSystemTime` + `globalSetup` `TZ`:** Date-only pin that does not stall `waitFor`. It works under `forks` and `threads` and on Windows. Never use blanket `useFakeTimers()` or a global `TZ=UTC` in CI.
- **Playwright `page.clock`, `timezoneId`, `locale`:** client-only assertions. Do not bump Playwright during cleanup.
- **Built-ins:**
  - `git ls-files -ci --exclude-standard` guard
  - `db:types` drift check in `test-integration`
  - ESLint `no-restricted-syntax` ban on bare `new Date()` and `Date.now()` in tests and `e2e/`
  - GitHub composite setup action
  - optional actionlint and zizmor
- **Avoid:** `knip --fix`, zero-config knip as a gate, mockdate/timekeeper, cross-env, jscpd `--semantic`, a TypeScript 7 migration, and `pnpm update`.

### Expected Features
**Must have:**
- Baseline snapshot on untouched `main`.
- Report-only analysis, three-bucket triage, atomic removal commits, and an owner list in `.planning/`.
- Generated-file verification and a docs-match-code pass.
- Date/timezone determinism, with E2E expectations derived from seed data.
- Bug fixes, each with a red-then-green test:
  - offline replay (reproduce first)
  - PATCH-schema structural guard over the `endpoints` registry
  - `RotationEditor` a11y
  - service-role scope audit with a fence test
  - deploy-script password exposure
  - Kong/Caddy GoTrue path coverage
- CI: dead-code and audit checks (with an expiring `braces` allowance), job timeouts, and a correctness review of both workflows.

**Should have:**
- Date lint ban, TZ/date matrix (UTC on PRs; matrix on `main` and nightly), and DST cases in `packages/recurrence`.
- Drift checks, migration append-only check, and script mode/CRLF check.
- Composite action, actionlint, SHA pinning, and duplication-driven fixture dedupe.

**Defer:**
- Test-file splitting, CSP hardening, rate-limit E2E, off-host backups, Flipp replacement, and scaling.

**Anti-features to refuse:**
- bulk deletion on tool say-so
- editing applied migrations
- retries/timeouts/sleeps
- weakened assertions
- global `TZ=UTC`
- lowering coverage thresholds
- review or decision files under `docs/`
- coverage-chasing
- major upgrades

### Architecture Approach
Three stages over a safety-net spine (T0 typecheck through T5 cold E2E):
1. **Analysis (additive only):** calibrated knip with canaries, duplicate scan, and a triage ledger (PROVEN-DEAD / CONFIG-GAP / TEST-ONLY / UNCERTAIN).
2. **Removal:** reverse-dependency waves (web, service, e2e, seed, recurrence, matching, shared). Within each wave: files, then exports, then dependencies, iterating to a fixpoint.
3. **Enforcement:** a ratchet of report-only, then delete, then block.

Other rules:
- One root `knip.json`.
- `includeEntryExports` on `packages/*` is the highest-value setting for unused exports.
- `sw.ts`, `seed-users.ts`, and e2e global setup need explicit entries.
- Single-writer discipline applies to the lockfile, `package.json`, `knip.json`, `ci.yml`, and `eslint.config.js`.
- Protected zones: `supabase/migrations/**`, `e2e/fixtures/**`, `db/types.ts` (regenerate only), `bin/hearth-admin`, `docker/**`, `scripts/deploy.sh`.
- Prefer the executed STACK.md knip config over ARCHITECTURE.md's sketch. `ignoreExportsUsedInFile` makes an `ignore` entry for `db/types.ts` unnecessary.

### Critical Pitfalls
1. **Deleting config- or string-reachable code** (`sw.ts`, `cli.ts`, route `Component` exports, Compose-mounted fixtures, `workbox-*`, `esbuild`). Require a three-part proof: no importer, a repo-wide text search across all file types, and the relevant build/test passing.
2. **Trusting the dead-code tool.** A growing `ignore` list is the warning sign. A first-run flood means missing entries. Production-only findings are TEST-ONLY and go to the owner.
3. **A merge to `main` is a production deploy.** Use branches and squash PRs, keep `.planning/` off `main` until the squash (`gsd-pr-branch`), and do not casually edit `deploy.yml`.
4. **Masking flakes and half-pinned clocks.** There are four independent clocks plus process `TZ`.
   - Use `toFake: ['Date']` and re-apply pins in `beforeEach`, because existing `useRealTimers()` teardown drops them.
   - Watch the UTC-vs-household date helper in `bills.integration.test.ts`; it is a time-of-day flake that a weekday matrix will not find.
5. **Misdiagnosed offline bug or vacuous tests.** Reproduce first and fix at action time. Cover unit, integration, and E2E (`route.fetch()` then `route.abort()` once).
6. **CI/deploy contract breakage.** Never rename `CI` or job ids. A red-on-day-one job blocks deploys. `braces` has no patch. Web coverage thresholds are not enforced in CI.
7. **Windows commit traps.** The commitlint scope list is closed. Never use `--no-verify`. `core.fileMode=false` means new scripts need `git update-index --chmod=+x`. Watch for CRLF in `*.sh`.

## Implications for Roadmap

### Phase 1: Git History Curation and Branch Policy
**Rationale:** PROJECT.md requires curating the ~55 local commits onto the remote's initial commit and pushing before cleanup lands. Pushes and merges to `main` deploy.
**Delivers:** Curated history on `origin`; a written branch/PR policy (PRs for removal, bug fixes, and CI; direct-to-main only for minor mechanical or docs-only changes); a commit conventions note.
**Avoids:** Pitfalls 3 and 12. Confirm the rewrite plan, any force-push, and first-push deploy behavior with the owner.

### Phase 2: Baseline, Net Stabilization, and Analysis
**Rationale:** A flaky net cannot attribute failures, and the analyzer must be calibrated first. Determinism and analysis touch disjoint files, so they can run in parallel.
**Delivers:**
- Baseline snapshot in `.planning/cleanup/`.
- `global-tz.ts` and `clock-sweep.ts` wired into every workspace.
- The 7 failing web test files fixed.
- Date lint ban, and E2E Date sites replaced with seed-derived expectations.
- Pinned Playwright `timezoneId` and `locale`.
- Verified `knip.json` with canaries, plus raw reports and a triage ledger.
**Avoids:** Pitfalls 2, 5, 6, 10.

### Phase 3: Evidence-Gated Removal
**Rationale:** The headline value, and it needs the stable net and calibrated analyzer.
**Delivers:**
- Proven-dead files, exports, types, and dependencies removed in waves, with the lockfile in the same commit.
- Specific cleanups: the `fuzzy-benchmark.ts` cluster, relocating `normalized-fixtures.ts`, the `BILLS_*_EMPTY_COPY` duplicate, and stale ignore-file entries.
- An owner-review list.
**Gates:** T0-T5, including both Docker builds and a cold E2E. No diff under `supabase/migrations/` or `db/types.ts`.
**Avoids:** Pitfalls 1, 4, 14, 16, 17.

### Phase 4: Bug Fixes With Regression Tests
**Rationale:** Isolating behavior changes gives a red build one cause. Items are independent and can be split into separate PRs.
**Delivers:**
- Offline replay reproduction and fix (likely `useAddDealToList`).
- Generic PATCH contract test.
- Service-role fence audit and test.
- `RotationEditor` a11y fix with a keyboard test.
- Deploy password fix with a stub-argv test.
- Kong/Caddy deny-list, with positive-flow tests written first.
**Avoids:** Pitfalls 7, 8, 11, 15.

### Phase 5: Redundancy Reduction and Text Sync
**Rationale:** Refactor after deletions and after regression tests exist. Sync text last, once the file set is final.
**Delivers:**
- CI composite action and duplicate seed typecheck removal.
- jscpd-driven dedupe.
- Stale spec-citation sweep (262 files, comment-only, esbuild transform-equality proof, migrations excluded).
- Docs and `.planning/codebase/` corrections, such as `hearth-admin` being hand-written.
**Avoids:** Pitfalls 13, 14, 17.

### Phase 6: CI Enforcement and Lock-in
**Rationale:** Short and last. A gate enabled early is red or papered over.
**Delivers:**
- Blocking knip (both modes) and the jscpd threshold.
- `git ls-files -ci`, `db:types`, migration append-only, and script-mode checks.
- `pnpm audit --prod` with a `braces` allowance.
- `timeout-minutes` and an explicit web-coverage decision.
- TZ matrix on `main` and nightly.
- A throwaway-PR check that `CI` still triggers deploy correctly.
**Avoids:** Pitfalls 9 and 18.

### Phase Ordering Rationale
- Git comes first because merges deploy and history must be clean before cleanup lands.
- Determinism comes before removal for attribution.
- Removal precedes fixes and dedupe so nothing fixed or deduped is later deleted.
- Text sync follows deletion, and enforcement is last so `main` is never red.
- Each phase ships as a PR, so each merge causes one deploy.

### Research Flags
**Needs deeper research (`/gsd-plan-phase --research-phase <N>`):**
- **Phase 1:** first-push deploy behavior, branch protection and required checks (not visible from the repo), and the rewrite plan with the owner.
- **Phase 2:**
  - knip plugin edge behavior (vite-plugin-pwa, tsup, Playwright globalSetup, custom vitest configs) via canaries.
  - E2E weekday strategy: seed-derived expectations versus adding a server clock seam, which is a behavior change.
  - Sweeping the unswept service, package, and integration suites.
- **Phase 4:**
  - GoTrue route enumeration against `kong.yml`.
  - Supabase CLI password handling.
  - Whether `routes/users.ts` and `http/context.ts` actually hold a privileged client.
  - TanStack in-flight mutation dehydration.

**Standard patterns (skip research):** Phases 3, 5, and 6, provided Phase 1 resolves the branch-protection question.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | knip, jscpd, and Vitest TZ/clock behavior were executed on a scratch copy of HEAD. The `.jscpd.json` keys, actionlint/zizmor, and the pnpm 10 audit-ignore key are MEDIUM. |
| Features | MEDIUM-HIGH | Repo facts were read directly; practice claims are MEDIUM. |
| Architecture | MEDIUM | Repo facts are HIGH. Knip entry and `includeEntryExports` semantics need canary confirmation. |
| Pitfalls | MEDIUM | Repo reads are HIGH. External doc claims were rated LOW by the research seam and flagged for verification. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address
- **Offline duplicate root cause is unproven.** Reproduce `useAddDealToList`, `add-to-list`, and chore completion first. Delete is not queued, so decide on resurrect-after-delete without adding tombstones.
- **Only the web suite (715 tests) was swept** for TZ/date dependence. Sweep the service and package suites before enabling the matrix. Integration tests stay out of the matrix.
- **`workbox-window` necessity is unverified.** Prove removal with a build plus a registration check, or put it on the owner list.
- **Branch protection and required checks** are GitHub settings. The owner must confirm them.
- **`db:types` determinism** is unverified. Run it twice in CI before gating.
- **The stale-as-of tests** (favorites, deal-search, flyers, suggestions) fail at every pinned instant. Fix them by pinning "now" inside the test.
- **Web coverage thresholds** exist but CI does not enforce them, and `docs/testing.md` disagrees. This needs a decision.
- **Probes ran on Node 26.10.0;** CI pins Node 24 (`Temporal` may differ). Re-run the clock probes on Node 24.
- **`deploy.yml` inspects only the last commit.** Changing that is a production-safety decision for the owner.

## Sources

### Primary (HIGH)
- Local executed runs on HEAD `224b93b`: knip (all modes), jscpd, Vitest TZ/clock probes, web-suite sweep, `tsc --noUnusedLocals`, sherif, `pnpm dedupe --check`.
- First-hand repo reads: PROJECT.md, `.planning/codebase/*`, CI and deploy workflows, ESLint, commitlint, vite config, `sw.ts`, services, shared contracts, `deploy.sh`, `docs/testing.md`, git history `1030b35`, `95b0bd2`, `b96ca32`.
- npm registry metadata.

### Secondary (MEDIUM)
- knip.dev, vitest.dev, and playwright.dev docs, cross-checked by probes or repo usage.
- Playwright `clock.ts` source.
- GitHub releases for actionlint and zizmor.

### Tertiary (LOW)
- Zod 4 changelog, TanStack mutation persistence, GitHub `workflow_run` and required-checks docs, Supabase `migration repair`, and the pnpm audit ignore key (pnpm 12 docs; the repo is on pnpm 10).

---
*Research completed: 2026-10-11*
*Ready for roadmap: yes*
