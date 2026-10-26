---
status: testing
phase: 09-domain-network-migration-cloudflare-tunnel-ingress
source: [09-VERIFICATION.md]
started: 2026-10-26T19:03:57Z
updated: 2026-10-26T19:03:57Z
---

## Current Test

number: 1
name: Tunnel is live
expected: |
  cloudflared reports healthy, the Deploy run's health gate passes, and the site answers on https://hestia.aberrance.app (owner checklist steps 1-7)
awaiting: user response

## Tests

### 1. Tunnel is live
expected: cloudflared healthy, Deploy health gate passes, site answers on https://hestia.aberrance.app
result: [pending]

### 2. WebSocket and CSP on the real origin
expected: No console CSP violation; CSP names wss://hestia.aberrance.app; no access-control-allow-origin or set-cookie header; POST /auth/v1/signup returns 403 (checklist step 10)
result: [pending]

### 3. Real client IP through Cloudflare
expected: hestia-service logs show remoteAddress as the owner's public address, not 172.16.238.x (checklist step 10)
result: [pending]

### 4. First-deploy network recreate and GoTrue origin
expected: Deploy log shows Network hestia Removing/Removed/Creating/Created; GoTrue URL variables show https://hestia.aberrance.app after hestia-compose up -d --wait; no published port; no router forwards (checklist steps 7-9)
result: [pending]

### 5. Retire the old ingress and reinstall the PWAs
expected: Old host-level forwarding is off; PWAs reinstalled from the new origin and notifications re-enabled (checklist steps 11-12)
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
