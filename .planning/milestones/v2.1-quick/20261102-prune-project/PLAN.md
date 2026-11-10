---
slug: 20261102-prune-project
title: Prune temporary files, non-core docs, obsolete planning files, redundant tests, and simplify configurations
date: 2026-11-02
status: complete
---

# Quick Task: Prune Repository

## Objectives
1. Remove all temporary, build-generated, and coverage files (`packages/recurrence/coverage`, `apps/service/dist`, `.patch` files).
2. Prune obsolete `.planning/` files (v1.0 cleanup ledgers, test dumps, patches, empty `phases/`, research, environment) while preserving active milestone tracking state.
3. Remove non-core documentation files (`docs/branding.md`, `docs/file-map.md`, `docs/use-cases.md`) and distill `docs/testing.md` and `CONTRIBUTING.md`.
4. Prune redundant harness tests for scripts (`scripts/*.test.mjs`, `test/*.test.mjs`), remove the slow 36-cell timezone sweep (`scripts/test-sweep.*`, `.github/workflows/sweep.yml`), and update `package.json` and CI workflows.
5. Remove tests that duplicate coverage (`apps/web/src/screens/household-timezone.test.tsx`, `apps/service/src/problem.test.ts`, `packages/recurrence/src/index.test.ts`).
6. Simplify `.env.example`, `docker/docker-compose.yml`, `e2e/docker-compose.e2e.yml`, and `docker/Caddyfile` by removing verbose essay comments while preserving all functionality.
7. Verify all remaining tests, typechecks, and linters pass cleanly.
