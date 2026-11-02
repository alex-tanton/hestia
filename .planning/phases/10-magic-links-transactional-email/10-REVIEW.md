---
phase: 10-magic-links-transactional-email
reviewed: 2026-11-01T21:55:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - docker/docker-compose.yml
  - e2e/docker-compose.e2e.yml
  - apps/web/public/templates/magic_link.html
  - .env.example
  - scripts/generate-secrets.sh
  - supabase/config.toml
  - apps/service/src/docker-compose-smtp.test.ts
  - e2e/setup/stack.ts
  - e2e/support/env.ts
  - apps/web/src/lib/auth/auth-client.ts
  - apps/web/src/screens/onboarding/magic-link.ts
  - apps/web/src/screens/onboarding/SignInScreen.tsx
  - apps/web/src/screens/onboarding/MagicLinkRequestScreen.tsx
  - apps/web/src/screens/onboarding/MagicLinkCodeScreen.tsx
  - apps/web/src/screens/onboarding/magic-link.test.tsx
  - apps/web/src/lib/auth/auth-client.test.ts
  - e2e/support/inbucket.ts
  - e2e/tests/07-magic-link.spec.ts
  - docs/deployment.md
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-11-01
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 10 changes implement GoTrue SMTP configuration with Resend targeting, Inbucket test-double integration in E2E Compose, client-side magic link authentication enforcement (`shouldCreateUser: false`), and active Playwright test coverage. Public signups are locked down (`GOTRUE_DISABLE_SIGNUP: 'true'`), and OTP expiry is tightened to 15 minutes.

All tripwires and bundle budgets are respected: shell size is 197.8 KB (within 200 KB budget).

---

## Critical Issues

None.

---

## Warnings

### WR-01: Inbucket Polling Timeout in CI
- **File:** `e2e/support/inbucket.ts`
- **Issue:** `waitForLatestEmail` defaults to a 10,000ms timeout. In heavily loaded CI environments or slow virtual machines, SMTP delivery through the container network might occasionally approach or exceed 10 seconds.
- **Recommendation:** Consider increasing default timeout to 15,000ms or allowing an env-configured timeout override if CI runs show flake.

### WR-02: HTML Email Template Inline Styling and Theme Support
- **File:** `apps/web/public/templates/magic_link.html`
- **Issue:** Email template relies purely on static light-mode inline styles. While highly compatible with older email clients, some dark mode email clients may invert text colors without adjusting container backgrounds.
- **Recommendation:** Maintain as-is for MVP; consider adding `@media (prefers-color-scheme: dark)` overrides in future polishing phases if dark mode client styling issues arise.

---

## Info

### IN-01: Runtime Secrets Provisioning
- **File:** `.env.example`, `docs/deployment.md`
- **Issue:** `GOTRUE_SMTP_PASS` requires a Resend API key (`re_...`) in production environments.
- **Note:** Documented in `docs/deployment.md` runbook with full Cloudflare DNS record instructions.

### IN-02: Client-Side Resend Timer State
- **File:** `apps/web/src/screens/onboarding/MagicLinkCodeScreen.tsx`
- **Issue:** The 30-second cooldown timer is stored in local component state and resets if the route is unmounted and remounted.
- **Note:** Backend rate limiting provides the authoritative throttle against spamming.
