---
status: complete
phase: 08-full-rebrand-to-hestia
source: [08-VERIFICATION.md]
started: 2026-10-26T05:10:00Z
updated: 2026-10-26T13:22:50.101Z
---

## Current Test

[testing complete]

## Tests

### 1. Real-browser check of the Hestia brand
expected: Tab title, shell header, onboarding install step and installed app name all read Hestia
result: skipped
accepted: "Owner accepted this skip as final on 2026-10-26."
reason: "Owner has no deployed or installed app; only source exists. Checked in source instead: index.html title, PWA manifest name and short_name, AppShell page title suffix, and InstallStep strings all read Hestia, with no remaining Hearth in apps/web. A live-browser check is deferred until the app is first run." 

### 2. CI green on the pull request
expected: All seven CI jobs pass, including test-integration and test-e2e (104 passed)
result: skipped
accepted: "Owner accepted this skip as final on 2026-10-26."
reason: "No pull request or CI run exists yet; confirm when one does." 

### 3. Owner checklist (08-OWNER-CHECKLIST.md steps 1-4 before merge, 5-17 after)
expected: /srv/hestia/.env exists with HESTIA_* names, runner has the hestia label, old stack stopped, Deploy run succeeds, /api/health answers, repository renamed
result: pass
note: "Owner reports the checklist steps are completed. The application has never been deployed, so there is no old hearth stack or existing deployment to stop or migrate; steps that assume one (6-8, 16) do not apply."
source: owner-reported

### 4. Allowlist choice for .planning/phases/ and .planning/research/
expected: Owner accepts it or asks for those prefixes to be dropped in a follow-up
result: pass
note: "Owner accepted the allowlist as is." 

## Summary

total: 4
passed: 2
issues: 0
pending: 0
skipped: 2
blocked: 0

## Gaps
