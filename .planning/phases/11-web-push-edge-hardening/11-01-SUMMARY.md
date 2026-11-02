---
phase: "11"
plan: "01"
subsystem: "service"
tags: [vapid, push, env, rfc8292, docker, config]
requires: []
provides:
  - strict-vapid-subject-validation
  - rfc8292-contact-uri-refinement
  - compose-vapid-subject-forwarding
  - secrets-generator-vapid-subject
  - e2e-harness-vapid-subject
affects:
  - apps/service
  - docker
  - e2e
  - docs
tech-stack:
  - zod
  - vitest
  - docker-compose
  - typescript
key-files:
  modified:
    - apps/service/src/env.ts
    - apps/service/src/env.test.ts
    - .env.example
    - docker/docker-compose.yml
    - scripts/generate-secrets.sh
    - e2e/setup/stack.ts
    - docs/deployment.md
commits:
  - sha: "02f8142"
    subject: "feat(service): strictly require RFC 8292 VAPID_SUBJECT in service environment"
  - sha: "bf16510"
    subject: "chore(docker): wire VAPID_SUBJECT across Compose, secrets, harness, and docs"
verification: PASSED
---

# Plan 11-01 Summary: Strict RFC 8292 VAPID_SUBJECT Validation & Configuration Wiring

## What Was Built

Establishes strict RFC 8292 contact URI compliance (`PUSH-01`) across Hestia's backend service, Docker Compose manifests, secrets generation scripts, E2E test harness, and deployment documentation:

1. **Strict VAPID_SUBJECT Environment Schema & Validation (`apps/service/src/env.ts`)**:
   - Implemented `isContactUri(value: string): boolean` helper validating that `VAPID_SUBJECT` is either a valid `mailto:<email>` URI or an `https:` URI.
   - Refined `envSchema.VAPID_SUBJECT` as strictly required (not optional) with `isContactUri` and clear error messaging: `"VAPID_SUBJECT must be a mailto: or https: URI"`.
   - Updated `Env` type to directly infer `envSchema`.
   - Retired obsolete fallback derivation logic in `vapidSubjectFor`, updating `parseEnv` to parse and return `envSchema` directly.
   - Extended `cliEnvSchema` with optional `DATABASE_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` fields in preparation for administrative CLI commands.

2. **Unit Test Suite Hardening (`apps/service/src/env.test.ts`)**:
   - Added `VAPID_SUBJECT: 'mailto:admin@aberrance.app'` to `REQUIRED` test fixtures.
   - Asserted that missing or empty `VAPID_SUBJECT` fails fast at startup naming the variable.
   - Asserted that invalid or non-contact URIs (`http://127.0.0.1:8080`, `not-a-uri`, `mailto:not-an-email`) are rejected without echoing sensitive values or test inputs.
   - Verified valid `mailto:admin@aberrance.app` and `https://hestia.aberrance.app` pass validation cleanly.
   - Verified `parseCliEnv` accepts optional database and VAPID fields.
   - Removed obsolete fallback derivation test cases.

3. **Infrastructure & Environment Propagation (`.env.example`, `docker/docker-compose.yml`, `scripts/generate-secrets.sh`, `e2e/setup/stack.ts`, `docs/deployment.md`)**:
   - Pre-populated default `VAPID_SUBJECT=mailto:admin@aberrance.app` with descriptive comment in `.env.example`.
   - Forwarded `VAPID_SUBJECT: ${VAPID_SUBJECT:?set in .env}` to `hestia-service` in `docker/docker-compose.yml`.
   - Added `'VAPID_SUBJECT'` to `fromEnvironment` array in `scripts/generate-secrets.sh` to allow environment overrides while defaulting to `.env.example`.
   - Configured `VAPID_SUBJECT: 'mailto:admin@aberrance.app'` in `writeEnvFile()` in `e2e/setup/stack.ts`.
   - Updated environment variables table in `docs/deployment.md` documenting `VAPID_SUBJECT` as strictly required and removed obsolete fallback paragraphs.

## Verification Results

- `pnpm --filter @hestia/service exec vitest run src/env.test.ts`:
  Passed (22 tests passed, 0 failures).
- `pnpm --filter @hestia/service test`:
  Passed (58 test files, 768 tests passed, 0 failures).
- `pnpm --filter @hestia/service typecheck`:
  Passed (0 errors).
- Configuration alignment automated check:
  Passed verification across `.env.example`, `docker-compose.yml`, `generate-secrets.sh`, `stack.ts`, and `deployment.md`.
- `node scripts/check-repo-hygiene.mjs`:
  Passed (clean across 1086 files).

## Self-Check: PASSED
