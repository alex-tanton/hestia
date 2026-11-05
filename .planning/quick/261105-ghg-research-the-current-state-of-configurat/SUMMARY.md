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

## Proposed Architecture
- Centralize shared constants and schemas in `@hestia/shared/config`.
- Configure `apps/web/vite.config.ts` with `envPrefix: ['VITE_', 'HESTIA_']` to eliminate Dockerfile environment bridging.
- Introduce `parseClientConfig` with Zod in `@hestia/shared/config` for typed frontend access.
- Prune dead environment variables from Docker Compose.
- Deduplicate test and seed constants across the monorepo.
