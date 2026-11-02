---
phase: "10"
plan: "01"
subsystem: "infrastructure"
tags: [gotrue, smtp, inbucket, e2e, caddy, resend]
requires: []
provides:
  - gotrue-smtp-config
  - inbucket-test-double
  - static-email-template
  - dynamic-inbucket-port
affects:
  - docker
  - e2e
  - apps/service
  - apps/web
tech-stack:
  - docker-compose
  - inbucket
  - caddy
  - vitest
requirements-completed: [AUTH-01, AUTH-03, AUTH-04]
key-files:
  created:
    - apps/web/public/templates/magic_link.html
    - apps/service/src/docker-compose-smtp.test.ts
  modified:
    - docker/docker-compose.yml
    - e2e/docker-compose.e2e.yml
    - .env.example
    - scripts/generate-secrets.sh
    - supabase/config.toml
    - e2e/support/env.ts
    - e2e/setup/stack.ts
    - apps/service/src/ingress-config.test.ts
commits:
  - sha: "b6ba6b3"
    subject: "feat(docker): configure GoTrue SMTP, disable signup, and add Inbucket E2E test-double"
  - sha: "9b70757"
    subject: "feat(e2e): allocate dynamic Inbucket port and include in E2E stack services"
  - sha: "fe98604"
    subject: "test(service): pin GoTrue SMTP and Inbucket E2E configuration in static Vitest test"
verification: PASSED
---

# Plan 10-01 Summary: GoTrue SMTP and Inbucket Mail-Catcher Infrastructure

## What Was Built

Establishes GoTrue transactional email and SMTP infrastructure for passwordless magic links across production, local development, and isolated E2E test environments:

1. **GoTrue SMTP Configuration & Signup Lockdown (`docker/docker-compose.yml`, `.env.example`, `supabase/config.toml`)**:
   - Configured production GoTrue SMTP targeting Resend (`smtp.resend.com:465`) under sender `auth@aberrance.app` and sender name `Hestia`.
   - Used default empty fallback `${GOTRUE_SMTP_PASS:-}` so developer environments without credentials can boot the stack without crashing.
   - Disabled public visitor account registration (`GOTRUE_DISABLE_SIGNUP: 'true'` / `enable_signup = false`) while preserving administrative user provisioning via `service_role`.
   - Tightened OTP code expiry to 15 minutes (`GOTRUE_MAILER_OTP_EXP: 900`).
   - Configured static magic link email template URL served by Caddy at `http://caddy:8080/templates/magic_link.html`.

2. **Static Email Template (`apps/web/public/templates/magic_link.html`)**:
   - Authored clean, self-contained HTML email template rendering both the direct confirmation link (`{{ .ConfirmationURL }}`) and the 6-digit numeric OTP code (`{{ .Token }}`).
   - Served directly by Caddy's existing static file server with zero extra Docker volumes or containers.

3. **Inbucket E2E Test-Double Container & Harness Orchestration (`e2e/docker-compose.e2e.yml`, `e2e/support/env.ts`, `e2e/setup/stack.ts`)**:
   - Added `inbucket/inbucket:3.1.0` service to the E2E Compose overlay on the isolated `hestia` network with dynamic loopback port mapping `127.0.0.1:${HESTIA_E2E_INBUCKET_PORT:?}:9000`.
   - Added `auth` override routing GoTrue outbound SMTP to `inbucket:2500` with dependency on healthy Inbucket.
   - Generalized `distinctFreePort(...avoid)` in `e2e/support/env.ts` to allocate non-colliding loopback ports for parallel E2E runs.
   - Added `inbucket` to `DATA_SERVICES`, passed `HESTIA_MAGIC_LINK_ENABLED: 'true'` in `writeEnvFile()`, and appended `HESTIA_E2E_INBUCKET_PORT` to run environment.

4. **Static Quality Assertions (`apps/service/src/docker-compose-smtp.test.ts`, `apps/service/src/ingress-config.test.ts`)**:
   - Created static Vitest test suite `apps/service/src/docker-compose-smtp.test.ts` validating production SMTP settings, signup lockdown, OTP validity, template URLs, and E2E Inbucket overlay bindings.
   - Updated published ports assertion in `ingress-config.test.ts` to expect `['caddy', 'db', 'inbucket']`.

## Verification Results

- Automated test run:
  `pnpm --filter @hestia/service exec vitest run src/docker-compose-smtp.test.ts src/ingress-config.test.ts`
  Result: 2 test files passed, 11 tests passed (0 failures).
- Automated template check:
  Verified `{{ .ConfirmationURL }}` and `{{ .Token }}` are present in `apps/web/public/templates/magic_link.html`.
- Automated E2E harness typecheck:
  `pnpm --filter @hestia/e2e exec tsc --noEmit`
  Result: 0 errors.

## Self-Check: PASSED
