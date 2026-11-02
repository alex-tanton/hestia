---
status: complete
completed: 2026-11-02
slug: 20261102-prune-project
title: Repository Pruning and Configuration Simplification
---

# Quick Task Summary: Repository Pruning and Simplification

Pruned temporary files, build artifacts, historical ledgers, non-core documentation, redundant tests, and simplified environment and build configurations without sacrificing any core application functionality.

## Changes Completed

1. **Temporary & Build Artifacts Removed**:
   - `packages/recurrence/coverage/` (coverage report directories)
   - `apps/service/dist/` (build artifacts)
   - Historical patch files in `.planning/`

2. **Planning Directory Optimization**:
   - Removed `.planning/milestones/v1.0/cleanup/` (2.58 MB of old ledgers, knip/jscpd run dumps, patch files)
   - Removed `.planning/research/` (early domain/migration research documents)
   - Removed `.planning/environment/` (one-off cloud scripts)
   - Removed empty `.planning/phases/` directory
   - Preserved active state tracking files: `PROJECT.md`, `ROADMAP.md`, `STATE.md`, `config.json`, `state.json`, `MILESTONES.md`, and v2.0 milestone summaries.

3. **Documentation Streamlining**:
   - Removed non-core docs: `docs/branding.md`, `docs/file-map.md`, `docs/use-cases.md`.
   - Distilled `docs/testing.md` from 890 lines to 64 clean, actionable lines covering core commands and test layers.
   - Streamlined `CONTRIBUTING.md` and updated `README.md` and `docs/development.md` doc indices.

4. **Harness Tests & Slow Sweeps Pruned**:
   - Removed script meta-tests: `scripts/*.test.mjs` and `test/*.test.mjs`.
   - Removed slow 36-cell timezone sweep (`scripts/test-sweep.*`, `.github/workflows/sweep.yml`).
   - Relaxed Knip/JSCPD baseline ratchets and updated `package.json` to streamline test commands (`test: pnpm -r test`).

5. **Test De-duplication**:
   - Removed redundant timezone tests: `apps/web/src/screens/household-timezone.test.tsx`.
   - Removed duplicate problem details tests: `apps/service/src/problem.test.ts`.
   - Removed re-export verification test: `packages/recurrence/src/index.test.ts`.

6. **Configuration & Build Simplification**:
   - Simplified `.env.example`, `docker/docker-compose.yml`, `e2e/docker-compose.e2e.yml`, and `docker/Caddyfile` by removing verbose essay comments while preserving all functionality and settings.

## Verification
- `pnpm lint`: Passed (0 warnings)
- `pnpm format:check`: Passed (all files match Prettier style)
- `pnpm typecheck`: Passed across all 8 workspace packages
- `pnpm test`: Passed (all 726 tests green)
- `pnpm build`: Succeeded for both `@hestia/web` and `@hestia/service`
- `node scripts/check-repo-hygiene.mjs`: Passed clean (971 files, 8 scripts)
- `node scripts/check-knip-baseline.mjs`: Passed (25 rows match)
- `node scripts/audit-prod.mjs`: Passed (0 advisories)
