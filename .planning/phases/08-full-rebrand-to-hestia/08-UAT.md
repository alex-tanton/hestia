---
status: testing
phase: 08-full-rebrand-to-hestia
source: [08-VERIFICATION.md]
started: 2026-10-26T05:10:00Z
updated: 2026-10-26T06:00:00Z
---

## Current Test

number: 1
name: Real-browser check of the Hestia brand
expected: |
  Tab title reads Hestia (page titles like "This Week · Hestia"); onboarding says "Install Hestia" and "Go to Hestia"; the installed PWA is named Hestia (iOS may keep the old label until the app is re-added)
awaiting: user response

## Tests

### 1. Real-browser check of the Hestia brand
expected: Tab title, shell header, onboarding install step and installed app name all read Hestia
result: [pending]

### 2. CI green on the pull request
expected: All seven CI jobs pass, including test-integration and test-e2e (104 passed)
result: [pending]

### 3. Owner checklist (08-OWNER-CHECKLIST.md steps 1-4 before merge, 5-17 after)
expected: /srv/hestia/.env exists with HESTIA_* names, runner has the hestia label, old stack stopped, Deploy run succeeds, /api/health answers, repository renamed
result: pass
note: "Owner reports the checklist steps are completed. The application has never been deployed, so there is no old hearth stack or existing deployment to stop or migrate; steps that assume one (6-8, 16) do not apply."
source: owner-reported

### 4. Allowlist choice for .planning/phases/ and .planning/research/
expected: Owner accepts it or asks for those prefixes to be dropped in a follow-up
result: [pending]

## Summary

total: 4
passed: 1
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
