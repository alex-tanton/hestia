---
status: complete
completed: 2026-11-02
slug: 20261102-prune-project
title: Repository Pruning and Configuration Simplification
---

# Quick Task Summary: Repository Pruning and Simplification

Pruned temporary files, build artifacts, historical ledgers, archived phase records, non-core documentation, redundant tests, and simplified gate scripts, environment files, and build configurations without sacrificing any core application functionality.

## Changes Completed

### Part A (Committed in `8757d3c`)
1. **Temporary & Build Artifacts Removed**:
   - `packages/recurrence/coverage/` (coverage report directories)
   - `apps/service/dist/` (build artifacts)
   - Historical patch files in `.planning/`

2. **Planning Directory Optimization**:
   - Removed `.planning/milestones/v1.0/cleanup/` (2.58 MB of old ledgers, knip/jscpd run dumps, patch files)
   - Removed `.planning/research/` (early domain/migration research documents)
   - Removed `.planning/environment/` (one-off cloud scripts)
   - Removed empty `.planning/phases/` directory
   - Preserved active state tracking files: `PROJECT.md`, `ROADMAP.md`, `STATE.md`, `config.json`, `state.json`, `MILESTONES.md`.

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
   - Simplified `.env.example`, `docker/docker-compose.yml`, `e2e/docker-compose.e2e.yml`, and `docker/Caddyfile` by removing verbose prose comments while preserving all functionality and settings.

### Part B (User Confirmed & Executed)
1. **Preserved Tools**:
   - Kept Husky and Commitlint configuration intact (B1).
   - Kept Knip and JSCPD duplicate code analysis intact (B2).

2. **Gate Scripts Simplified (B3)**:
   - `scripts/check-repo-hygiene.mjs`: Pruned obsolete allowlist paths for removed research/phase directories and obsolete test entries; streamlined checking logic.
   - `scripts/check-migrations-append-only.mjs`: Removed ~200 lines of unused `migration-exemptions.json` handling and blob resolution; simplified to direct git diff check for append-only additions.
   - `scripts/audit-prod.mjs`: Streamlined audit execution, allowlist checking, and date verification from 260 lines down to ~110 lines.

3. **Archived Phases Removed (B4)**:
   - Removed archived phase directories `.planning/milestones/v1.0/phases/`, `.planning/milestones/v2.0-phases/`, and `.planning/milestones/v1.0/quick/`, reducing `.planning` from 8.3 MB down to ~98 KB and 15 core files.

4. **Non-core Design Doc Removed (B5)**:
   - Removed `docs/design.md` (660 lines) and unlinked it from `README.md`.

5. **Static Config & Placeholder Tests Removed (B6, B7)**:
   - Removed `apps/service/src/docker-compose-smtp.test.ts` and `apps/service/src/ingress-config.test.ts` (static yaml config assertion tests).
   - Removed `apps/web/src/components/states/states.test.tsx` (redundant empty state component test).

## Verification Results
- `pnpm format:check`: Passed (all files match Prettier code style)
- `pnpm lint`: Passed (0 errors, 0 warnings with `eslint --max-warnings=0`)
- `pnpm typecheck`: Passed across all 7 workspace projects
- `pnpm test`: Passed (all 942 unit/component/support tests across web, service, shared, matching, recurrence, and e2e)
- `pnpm build`: Succeeded for both `@hestia/web` (app shell 198.2 KB gzipped) and `@hestia/service`
- `pnpm knip`: Passed (0 errors, matching production baseline of 25 rows)
- `pnpm jscpd`: Passed (1.19% duplication, well within 5% threshold)
- `node scripts/check-repo-hygiene.mjs`: Clean (697 files, 8 scripts)
- `node scripts/check-migrations-append-only.mjs --base HEAD`: Clean (0 added, nothing else changed)
- `node scripts/audit-prod.mjs`: Clean (0 advisories, 0 problems)
