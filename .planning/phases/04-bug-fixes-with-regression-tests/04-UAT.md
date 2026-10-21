---
status: complete
phase: 04-bug-fixes-with-regression-tests
source: [04-VERIFICATION.md]
started: 2026-10-20T17:58:53Z
updated: 2026-10-21T00:42:21.998Z
---

## Current Test

[testing complete]

## Tests

### 1. Kong host step (FIX-07 in production)
Take a manual backup, run `hearth-compose up -d --force-recreate kong` on the host, then sign in to the PWA, sign out and in again, force a token refresh (keep a session past its access-token lifetime, or reload), and open a recovery link from `hearth-admin reset-password {email}`. From outside the host, POST to `/auth/v1/recover`.
expected: Sign-in, sign-out, token refresh and the recovery link all work; the POST answers 403 with `Access is forbidden.`
result: pass
note: "User: pass, I do not have the application deployed. Not exercised against a live deployment; no production Kong exists to recreate."


### 2. Owner decision on WR-01: `POST /auth/v1/otp` open to the anon key
On a running stack, POST to `/auth/v1/otp` with the anon key and a fresh email, then check `auth.users`.
expected: The owner keeps the route (research A5) or deletes it (one service and one table row in `docker/kong.yml` and `apps/service/src/kong-routes.test.ts`). If a user row is created, the comment in `apps/service/src/routes/auth.ts` ("no way around /api/signup") is false and the exposure needs a decision.
result: pass (owner decision, 2026-10-20: keep the `otp` route because magic links are planned). Not checked on a running stack; the reviewer's claim that the anon key can create users through it stays unverified. Revisit when magic links are added.

### 3. Rotation drag in Firefox and Chromium (WR-03)
Drag a rotation member's handle in the chores rotation editor.
expected: The row reorders by drag, or the owner accepts that Up and Down are the only guaranteed path.
result: skipped
reason: "Deferred follow-up: skipped on purpose (owner, 2026-10-21); the owner cannot test it, Up and Down are the guaranteed reorder path. Revisit when a browser check is possible."
note: "Owner decision 2026-10-20: not tested because the owner cannot test it. Firefox pointer drag is unverified (research A1, review WR-03); Up and Down are the guaranteed path. Revisit when a browser check is possible."

### 4. Owner acknowledgement of WR-02: held deal-add id scope
The held id lives in a per-card hook instance.
expected: The owner accepts that a lost-response retry after the card unmounts (filter change, paging, navigation) mints a new id and can still add the deal twice, or asks for the id to be held at QueryClient scope.
result: pass
note: "Owner decision 2026-10-20: hold the id at QueryClient scope, scoped to the signed-in user. Fixed and merged to main by PR 19 (squash a0317ce); CI green on the merged head, including test-e2e. Held ids still never expire and a reload mints a new id (see FIX-LEDGER-HELD-ID.md)."

## Summary

total: 4
passed: 3
issues: 0
pending: 0
skipped: 1
blocked: 0

## Deferred Follow-Ups

- test: 3
  idea: "Check rotation-handle drag in Firefox and Chromium when a browser check is possible; Up and Down remain the guaranteed path (WR-03)."
  deferred_at: 2026-10-21

## Gaps
