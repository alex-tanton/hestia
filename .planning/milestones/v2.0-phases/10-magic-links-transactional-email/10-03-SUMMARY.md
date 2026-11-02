---
phase: "10"
plan: "03"
subsystem: "e2e"
tags: [inbucket, playwright, e2e, docs, resend, dns, smtp]
requires: ["10-01", "10-02"]
provides:
  - inbucket-rest-client-helper
  - magic-link-e2e-journey-suite
  - transactional-email-deployment-runbook
affects:
  - e2e
  - docs
tech-stack:
  - playwright
  - inbucket
  - markdown
requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05]
key-files:
  created:
    - e2e/support/inbucket.ts
    - e2e/tests/07-magic-link.spec.ts
  deleted:
    - e2e/tests/07-magic-link-disabled.spec.ts
  modified:
    - docs/deployment.md
    - apps/web/src/lib/auth/auth-client.test.ts
commits:
  - sha: "a2f22dd"
    subject: "feat(e2e): add Inbucket REST client helper for email interception"
  - sha: "a2b7da6"
    subject: "test(e2e): replace disabled spec with magic link test suite"
  - sha: "2a2127f"
    subject: "test(web): assert shouldCreateUser false in auth client test"
  - sha: "3da3c86"
    subject: "docs(docker): add transactional email SMTP and DNS runbook"
verification: PASSED
---

# Plan 10-03 Summary: Inbucket E2E Test Suite and Deployment Documentation

## What Was Built

Delivers the end-to-end integration, automated Playwright verification, and production operational runbook for passwordless magic links and transactional email:

1. **Inbucket REST Client Helper (`e2e/support/inbucket.ts`)**:
   - Implemented typed REST API client for interacting with the Inbucket test-double container.
   - Provides `purgeMailbox(email)` to isolate tests between assertions.
   - Provides `waitForLatestEmail(email, timeoutMs)` using non-monotonic polling compatible with ESLint clocks.
   - Provides `extractOtpCode(email)` and `extractConfirmationUrl(email)` with RegExp matching.
   - Keys mailboxes strictly by local username (`email.split('@')[0]`) as required by Inbucket's REST API.

2. **Playwright E2E Magic Link Suite (`e2e/tests/07-magic-link.spec.ts`)**:
   - Replaced and deleted `07-magic-link-disabled.spec.ts`.
   - Verified that `HESTIA_MAGIC_LINK_ENABLED === 'true'`.
   - Verified sign-in screen renders secondary `"Email me a sign-in link"` button and `"or"` divider.
   - Verified uninvited email rejection displays `UNKNOWN_EMAIL_MESSAGE` and dispatches zero Inbucket emails.
   - Verified happy path: `alex@example.com` receives OTP email with subject `"Your Magic Link"` from `auth@aberrance.app`, enters 6-digit code on `/sign-in/code`, and authenticates to Rivera Family dashboard.
   - Verified invalid code `000000` is rejected with `"That code is incorrect or has expired. Ask for a new one."`
   - Verified direct link sign-in: `sam@example.com` opens email confirmation URL in browser and is signed into Oak Street.
   - Verified 30-second cooldown timer on code resend button.
   - Verified GoTrue rejects open redirects outside application origin with HTTP 400.

3. **Operational Runbook (`docs/deployment.md`)**:
   - Added dedicated section `"Transactional Email (SMTP & DNS)"` documenting Resend SMTP parameters, implicit TLS on port 465, and sender address `auth@aberrance.app`.
   - Documented exact Cloudflare DNS records: SPF (`v=spf1 include:resend.com ~all`), DKIM (`CNAME resend._domainkey`), DMARC (`TXT _dmarc`), and custom return-path MX/TXT for bounce handling.
   - Documented the operator requirement to run `hestia-compose up -d --wait` once after populating `GOTRUE_SMTP_PASS` in `/srv/hestia/.env` to recreate GoTrue.
   - Documented end-to-end production smoke test checklist.

## Verification Results

- Static document check:
  `docs/deployment.md` contains all required sections, DNS records, and verification instructions.
- Unit & static test suites:
  `pnpm --filter @hestia/service test` — 58 test files passed (771 tests).
  `pnpm --filter @hestia/web test` — 57 test files passed (732 tests).
  `pnpm --filter @hestia/e2e typecheck` — passed with 0 errors.
  `pnpm --filter @hestia/web build` — passed with 198.2 KB gzipped shell (budget 200 KB).

## Self-Check: PASSED
