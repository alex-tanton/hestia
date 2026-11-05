---
status: complete
completed: 2026-11-05
slug: 261105-ghg-research-the-current-state-of-configurat
title: Research Configuration Sprawl and Single Source of Truth Proposal
---

# Quick Task Summary: Configuration Research & Proposal

Completed an exhaustive audit of all configuration across the Hestia repository and developed a comprehensive single-source-of-truth proposal.

## Key Findings
1. **8 Configuration Layers**: Configuration is fragmented across `.env.example`, `generate-secrets.sh`, `docker-compose.yml`, `caddy.Dockerfile`, `Caddyfile`, `apps/service/src/env.ts`, `apps/web` (`import.meta.env`), and `supabase/config.toml`.
2. **Translation Gymnastics**: `docker/caddy.Dockerfile` renames `HESTIA_MAGIC_LINK_ENABLED` -> `VITE_MAGIC_LINK_ENABLED`, `ANON_KEY` -> `VITE_SUPABASE_ANON_KEY`, and `VAPID_PUBLIC_KEY` -> `VITE_VAPID_PUBLIC_KEY`. Vite natively supports `envPrefix: ['VITE_', 'HESTIA_']` which renders this translation layer obsolete.
3. **Dead Pass-throughs**: `HESTIA_MAGIC_LINK_ENABLED` is passed to `hestia-service` in `docker-compose.yml`, but `apps/service/src/env.ts` does not define or consume it.
4. **Auth Policy Drift Risk**: JWT expiry, minimum password length, and OTP rules are independently declared in `docker-compose.yml`, `supabase/config.toml`, and `packages/shared/src/password.ts`.
5. **Duplicated Constants**: Values like `SEED_PASSWORD` and `DEFAULT_RATE_LIMIT_PER_MINUTE` are copy-pasted across seed scripts, test harnesses, and environment definitions.

## Implementation Completed
Following owner decision (Client Prefix Strategy: Option B `HESTIA_PUBLIC_*`, Schema Location: Unified Zod schemas in `@hestia/shared/src/config/`, Execution Scope: entire repo), all changes were implemented and verified across the monorepo:

1. **`@hestia/shared/src/config/` Package Module:**
   - `constants.ts`: Defined `AUTH_CONFIG`, `RATE_LIMIT_CONFIG`, `TEST_CONFIG` (`SEED_PASSWORD`, `DEFAULT_TEST_NOW`, dev URLs), and `DEFAULT_RATE_LIMIT_PER_MINUTE`.
   - `client.ts`: Defined `clientConfigSchema` and `parseClientConfig(source)`.
   - `server.ts`: Defined `serverEnvSchema`, `cliEnvSchema`, `parseServerEnv`, and `parseCliEnv`.
   - `index.ts`: Re-exported all constants, schemas, and parser functions.
   - `config.test.ts`: Comprehensive test suite verifying client and server parsing and defaults.
   - `packages/shared/src/password.ts`: Replaced hardcoded password lengths with `AUTH_CONFIG.PASSWORD_MIN_LENGTH` and `AUTH_CONFIG.PASSWORD_MAX_LENGTH`.

2. **Backend Service (`apps/service`):**
   - Refactored `apps/service/src/env.ts` to delegate directly to `@hestia/shared`, maintaining `parseEnv`, `parseCliEnv`, and `DEFAULT_RATE_LIMIT_PER_MINUTE` without breaking service entry points.
   - Sourced database and auth URLs in `integration-db.ts` and `service-stack.ts` from `TEST_CONFIG`.

3. **Frontend Client (`apps/web`):**
   - Configured `envPrefix: ['VITE_', 'HESTIA_PUBLIC_']` in `vite.config.ts`.
   - Created typed runtime accessor in `apps/web/src/lib/config.ts`.
   - Updated `main.tsx` and `src/lib/push/push-port.ts` to consume typed configuration.
   - Sourced `HESTIA_PUBLIC_MAGIC_LINK_ENABLED` with `VITE_MAGIC_LINK_ENABLED` fallback in route declarations while maintaining static evaluation for Vite build-time dead-code elimination (DCE) budget (<200 KB).
   - Updated `apps/web/scripts/check-build.mjs` to recognize `HESTIA_PUBLIC_MAGIC_LINK_ENABLED`.

4. **Docker & Ingress Infrastructure:**
   - Updated `docker/caddy.Dockerfile` to accept `HESTIA_PUBLIC_*` build arguments directly, eliminating the previous renaming gymnastics.
   - Updated `docker/docker-compose.yml` to supply `HESTIA_PUBLIC_*` args to Caddy and eliminated the dead `HESTIA_MAGIC_LINK_ENABLED` pass-through from `hestia-service`.

5. **Seeds, E2E, and Documentation:**
   - Updated `supabase/seed/seed-users.ts` to consume `TEST_CONFIG.SEED_PASSWORD` and URLs from `@hestia/shared`.
   - Updated `e2e/support/env.ts`, `e2e/setup/stack.ts`, and `e2e/tests/07-magic-link.spec.ts` to use `TEST_CONFIG.SEED_PASSWORD` and `HESTIA_PUBLIC_MAGIC_LINK_ENABLED`.
   - Updated `.env.example`, `scripts/generate-secrets.sh`, `docs/deployment.md`, and `.claude/CLAUDE.md`.
   - Updated `scripts/knip-production-baseline.txt` with owner-reviewed `TEST_CONFIG`.


