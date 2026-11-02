---
phase: "11"
plan: "03"
subsystem: "service"
tags: [cli, push-notifications, web-push, vapid, mobile, pwa, runbook]
requires: ["11-01", "11-02"]
provides:
  - hestia-admin-test-push-subcommand
  - push-ops-interface
  - expired-subscription-cleanup
  - mobile-web-push-verification-runbook
  - hestia-admin-script-shortcut
affects:
  - apps/service
  - package.json
  - docs
tech-stack:
  - node
  - typescript
  - vitest
  - web-push
  - kysely
requirements-completed: [PUSH-02]
key-files:
  modified:
    - apps/service/src/cli.ts
    - apps/service/src/cli.test.ts
    - package.json
    - docs/deployment.md
commits:
  - sha: "f251721"
    subject: "feat(service): implement hestia-admin test-push subcommand"
  - sha: "750b690"
    subject: "test(service): add unit tests for hestia-admin test-push subcommand"
  - sha: "06a6418"
    subject: "docs(service): expose hestia:test-push script and document runbook"
verification: PASSED
---

# Plan 11-03 Summary: hestia-admin test-push Subcommand & Standalone Mobile PWA Runbook

## What Was Built

Implements operator push verification tooling and mobile Web Push runbook documentation (`PUSH-02`):

1. **`hestia-admin test-push` Subcommand & PushOps Interface (`apps/service/src/cli.ts`)**:
   - Added `test-push` subcommand supporting `hestia-admin test-push --email <email> [--title <title>] [--body <body>]`.
   - Exported `PushSubscriptionTarget` and `PushOps` interfaces for dependency-injected testability.
   - Extended `runCli` signature with optional `pushOps?: PushOps`, preserving backwards compatibility with existing `reset-password` callers.
   - Validated `--email` presence (missing flags -> exit 2 with `Usage: hestia-admin test-push ...`) and validity (malformed -> exit 2 with `Not an email address: <email>`).
   - Looked up user profile by email in `public.profile` (missing -> exit 1 with `No user has the email <email>.`).
   - Queried active subscriptions in `public.push_subscription` ordered by `created_at, endpoint` (zero subscriptions -> exit 1 with `User <email> has no active push subscriptions.`).
   - Dispatched JSON payload `{ title, body, url: '/' }` to each subscription via `PushTransport`.
   - Automatically cleaned up expired subscriptions: when `PushTransport` returns `{ kind: 'gone' }` (HTTP 404/410), pruned the stale token via `deleteSubscription` (T-11-06).
   - Reported execution summary to stdout: `Dispatched test push to N device(s) for <email>: X accepted, Y gone, Z failed.` and returned exit code 0.
   - Connected `invokedDirectly` execution branch to query database via `withServiceRoleDb`, configured real VAPID transport with `createWebPushTransport`, and ensured database connection pool closure in a `finally` block.

2. **Root Workspace Script Shortcuts (`package.json`)**:
   - Added `"hestia-admin": "pnpm --filter @hestia/service exec hestia-admin"` to workspace root scripts.
   - Added `"hestia:test-push": "pnpm --filter @hestia/service exec hestia-admin test-push"` for streamlined operator invocation.

3. **Comprehensive Unit Test Suite (`apps/service/src/cli.test.ts`)**:
   - Added unit tests distinguishing top-level general usage from `reset-password` command usage.
   - Added `describe('hestia-admin test-push')` suite covering:
     - Missing or malformed arguments exit code 2 and usage outputs.
     - Unconfigured push operations handling.
     - Malformed email address rejection.
     - Non-existent user profile handling (exit code 1).
     - User with zero active subscriptions handling (exit code 1).
     - Multi-device successful dispatch with default copy and custom `--title` / `--body` flags.
     - Pruning of expired subscriptions on `{ kind: 'gone' }`.
     - Graceful handling of transport errors (`{ kind: 'failed' }`) without crashing.

4. **Standalone Mobile PWA Verification Runbook (`docs/deployment.md`)**:
   - Authored "Mobile Web Push Verification" runbook detailing:
     - iOS Safari 16.4+ standalone Home Screen PWA constraints (`display: standalone`, user touch gesture requirement, APNs RFC 8292 VAPID JWT claims).
     - Android Chrome installation requirements.
     - Step-by-step device verification procedure: Home Screen installation, standalone launch, user sign-in, notification permission toggle, and CLI test push dispatch via `hestia-admin test-push --email <email>`.
     - Device receipt verification asserting system notification banner and dashboard launch (`/`).

## Security & Reliability Mitigations

- **T-11-05 (Privilege Escalation / Notification Spam)**: `hestia-admin test-push` requires host-level execution credentials. User email lookup verifies existence in `public.profile` before any outbound calls; non-existent accounts terminate immediately with code 1. Notification payloads are constrained to administrative templates.
- **T-11-06 (Stale Push Subscriptions)**: Push endpoints returning HTTP 404/410 (`{ kind: 'gone' }`) are pruned from `public.push_subscription` via `deleteSubscription`, preventing delivery waste and notification leakage to recycled endpoints.

## Verification Results

- `pnpm --filter @hestia/service exec vitest run src/cli.test.ts`:
  Passed (22 tests passed across 2 test suites, 0 failures).
- `pnpm --filter @hestia/service typecheck`:
  Passed (`tsc --noEmit` clean, 0 errors).
- `pnpm lint`:
  Passed (`eslint --max-warnings=0` clean across all packages).
- Runbook verification script:
  Passed (all required iOS Safari, standalone PWA, and CLI verification checks present in `docs/deployment.md`).
- `node scripts/check-repo-hygiene.mjs`:
  Passed (clean across 1088 files, 14 scripts).

## Self-Check: PASSED
