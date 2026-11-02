---
status: complete
phase: 09-domain-network-migration-cloudflare-tunnel-ingress
source: [09-VERIFICATION.md]
started: 2026-10-26T19:03:57Z
updated: 2026-11-01T22:53:52.652Z
---

## Current Test

[testing complete]

## Tests

### 1. Tunnel is live
expected: cloudflared healthy, Deploy health gate passes, site answers on https://hestia.aberrance.app
result: pass

### 2. WebSocket and CSP on the real origin
expected: No console CSP violation; CSP names wss://hestia.aberrance.app; no access-control-allow-origin or set-cookie header; POST /auth/v1/signup returns 403 (checklist step 10)
result: pass

### 3. Real client IP through Cloudflare
expected: hestia-service logs show remoteAddress as the owner's public address, not 172.16.238.x (checklist step 10)
result: pass

### 4. First-deploy network recreate and GoTrue origin
expected: |
  1. GoTrue URLs: docker inspect "$(hestia-compose ps -q auth)" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^(API_EXTERNAL_URL|GOTRUE_SITE_URL|GOTRUE_URI_ALLOW_LIST|GOTRUE_JWT_ISSUER)=' shows https://hestia.aberrance.app
  2. Zero published ports: docker ps --filter label=com.docker.compose.project=hestia --format '{{.Names}} {{.Ports}}' | grep -c -- '->' prints 0
  3. Router has no open port forwards
result: pass

### 5. Retire the old ingress and reinstall the PWAs
expected: |
  1. Turn off the retired ingress on the host:
     sudo tailscale funnel reset
  2. Reinstall the PWA on your devices from https://hestia.aberrance.app and re-enable notifications
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
