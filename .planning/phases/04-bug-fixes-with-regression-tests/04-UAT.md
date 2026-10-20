---
status: testing
phase: 04-bug-fixes-with-regression-tests
source: [04-VERIFICATION.md]
started: 2026-10-20T17:58:53Z
updated: 2026-10-20T17:58:53Z
---

## Current Test

number: 1
name: Kong host step (FIX-07 in production)
expected: |
  Sign-in, sign-out, token refresh and the recovery link all work after the Kong recreate; an outside `POST /auth/v1/recover` answers 403 with body `Access is forbidden.`
awaiting: user response

## Tests

### 1. Kong host step (FIX-07 in production)
Take a manual backup, run `hearth-compose up -d --force-recreate kong` on the host, then sign in to the PWA, sign out and in again, force a token refresh (keep a session past its access-token lifetime, or reload), and open a recovery link from `hearth-admin reset-password {email}`. From outside the host, POST to `/auth/v1/recover`.
expected: Sign-in, sign-out, token refresh and the recovery link all work; the POST answers 403 with `Access is forbidden.`
result: [pending]

### 2. Owner decision on WR-01: `POST /auth/v1/otp` open to the anon key
On a running stack, POST to `/auth/v1/otp` with the anon key and a fresh email, then check `auth.users`.
expected: The owner keeps the route (research A5) or deletes it (one service and one table row in `docker/kong.yml` and `apps/service/src/kong-routes.test.ts`). If a user row is created, the comment in `apps/service/src/routes/auth.ts` ("no way around /api/signup") is false and the exposure needs a decision.
result: [pending]

### 3. Rotation drag in Firefox and Chromium (WR-03)
Drag a rotation member's handle in the chores rotation editor.
expected: The row reorders by drag, or the owner accepts that Up and Down are the only guaranteed path.
result: [pending]

### 4. Owner acknowledgement of WR-02: held deal-add id scope
The held id lives in a per-card hook instance.
expected: The owner accepts that a lost-response retry after the card unmounts (filter change, paging, navigation) mints a new id and can still add the deal twice, or asks for the id to be held at QueryClient scope.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
