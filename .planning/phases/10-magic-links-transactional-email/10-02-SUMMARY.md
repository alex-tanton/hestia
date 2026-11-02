---
phase: "10"
plan: "02"
subsystem: "web"
tags: [magic-link, auth, react, pwa, vitest, check-build]
requires: ["10-01"]
provides:
  - web-magic-link-entry-point
  - auth-client-should-create-user-false
  - unknown-email-error-handling
affects:
  - apps/web
tech-stack:
  - react
  - react-router
  - vitest
  - vite
requirements-completed: [AUTH-01, AUTH-02]
key-files:
  created: []
  modified:
    - apps/web/src/lib/auth/auth-client.ts
    - apps/web/src/screens/onboarding/magic-link.ts
    - apps/web/src/screens/onboarding/SignInScreen.tsx
    - apps/web/src/screens/onboarding/magic-link.test.tsx
commits:
  - sha: "7164ade"
    subject: "feat(web): enforce shouldCreateUser false and handle unknown email message"
  - sha: "75e7365"
    subject: "feat(web): upgrade magic link entry point to secondary button with or divider"
  - sha: "05a21eb"
    subject: "test(web): update magic link unit tests and verify bundle budget"
verification: PASSED
---

# Plan 10-02 Summary: Client-Side Magic Link Auth and UI Integration

## What Was Built

Upgrades the Web PWA front-end to support passwordless magic link sign-in for invited household members while preventing public account creation and preserving app shell bundle budgets:

1. **Auth Client Lockdown (`apps/web/src/lib/auth/auth-client.ts`)**:
   - Explicitly configured `auth.signInWithOtp` options with `shouldCreateUser: false` and `emailRedirectTo: `${window.location.origin}/``, ensuring GoTrue only sends magic links to pre-existing provisioned users.

2. **Unknown Email Mapping (`apps/web/src/screens/onboarding/magic-link.ts`)**:
   - Added and exported `UNKNOWN_EMAIL_MESSAGE`: `"No account found with this email. Ask your household admin for an invite."`
   - Updated `magicLinkMessage` to intercept GoTrue errors containing `"signups not allowed for otp"` or `"not found"` and return `UNKNOWN_EMAIL_MESSAGE` to the user.

3. **Sign-In Screen Secondary Button & Divider (`apps/web/src/screens/onboarding/SignInScreen.tsx`)**:
   - Replaced plain link with an `"or"` divider and a full-width secondary `Button` that navigates to `/sign-in/link`.
   - Strictly preserved the exact string `"Email me a sign-in link"` required by the post-build tripwire script `apps/web/scripts/check-build.mjs`.

4. **Component Unit Tests & Bundle Budget Verification (`apps/web/src/screens/onboarding/magic-link.test.tsx`)**:
   - Updated component unit tests to assert the secondary button's role and navigation to `/sign-in/link`.
   - Added test verifying unknown email rejection and live-region error message announcement.
   - Verified that when `VITE_MAGIC_LINK_ENABLED=true`, `pnpm --filter @hestia/web build` passes with app shell size at 197.8 KB gzipped (strictly under the 200 KB budget) and zero copy leakage into the initial shell.

## Verification Results

- Unit tests:
  `pnpm --filter @hestia/web exec vitest run src/screens/onboarding/magic-link.test.tsx`
  Result: 26 passed (0 failures).
- Bundle budget & copy tripwire check:
  `VITE_MAGIC_LINK_ENABLED=true pnpm --filter @hestia/web build`
  Result: App shell 197.8 KB gzipped (budget 200 KB); all tripwire copy checks passed.

## Self-Check: PASSED
