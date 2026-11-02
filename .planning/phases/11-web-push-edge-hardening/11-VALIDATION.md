---
phase: "11"
slug: "web-push-edge-hardening"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-01"
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit/service/config) & Playwright (E2E) |
| **Config file** | `apps/service/vite.config.ts`, `apps/web/vite.config.ts`, `e2e/playwright.config.ts` |
| **Quick run command** | `pnpm --filter @hestia/service test src/env.test.ts src/cli.test.ts src/ingress-config.test.ts` |
| **Full suite command** | `pnpm lint && pnpm typecheck && pnpm test && pnpm jscpd && pnpm knip && node scripts/check-repo-hygiene.mjs && pnpm --filter @hestia/web build` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run fast relevant unit/config command (e.g. `pnpm --filter @hestia/service test src/env.test.ts`)
- **After every plan wave:** Run `pnpm test && pnpm --filter @hestia/web build`
- **Before `/gsd-verify-work`:** Full suite green including hygiene, knip, jscpd, and E2E ingress tests
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | PUSH-01 | T-11-01 | Strict `VAPID_SUBJECT` contact URI validation & fails fast on invalid/empty | unit | `pnpm --filter @hestia/service test src/env.test.ts` | ✅ | ⬜ pending |
| 11-01-02 | 01 | 1 | PUSH-01 | T-11-02 | Config templates (`.env.example`, `docker-compose.yml`, `generate-secrets.sh`, `e2e/setup/stack.ts`) pre-populate RFC 8292 claims | static | `node -e "const fs=require('fs'); if(!fs.readFileSync('.env.example','utf8').includes('VAPID_SUBJECT=mailto:admin@aberrance.app')) process.exit(1);"` | ✅ | ⬜ pending |
| 11-02-01 | 02 | 2 | EDGE-01 | T-11-03 | Caddyfile emits immutable headers for `/assets/*` and no-cache for `/index.html` and `/sw.js` | static/unit | `pnpm --filter @hestia/service test src/ingress-config.test.ts` | ✅ | ⬜ pending |
| 11-02-02 | 02 | 2 | EDGE-01 | T-11-04 | E2E ingress test verifies exact `Cache-Control` response headers across origin routes | e2e | `pnpm --filter @hestia/e2e test:e2e tests/20-ingress-client-ip-and-csp.spec.ts` | ✅ | ⬜ pending |
| 11-02-03 | 02 | 2 | EDGE-01 | T-11-05 | Cloudflare Edge Cache Rules and WAF Rate Limiting runbooks documented | doc | `node -e "const doc=require('fs').readFileSync('docs/deployment.md','utf8'); if(!doc.includes('Edge Caching') || !doc.includes('Rate Limiting')) process.exit(1);"` | ✅ | ⬜ pending |
| 11-03-01 | 03 | 3 | PUSH-02 | T-11-06 | `hestia-admin test-push` CLI argument parsing, user subscription lookup, and push dispatch | unit | `pnpm --filter @hestia/service test src/cli.test.ts` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 3 | PUSH-02 | T-11-07 | PWA standalone mobile push verification runbook and checklist documented | doc | `node -e "const doc=require('fs').readFileSync('docs/deployment.md','utf8'); if(!doc.includes('Mobile Push Verification') || !doc.includes('Safari')) process.exit(1);"` | ✅ | ⬜ pending |
| 11-04-01 | 04 | 4 | VERIFY-01 | T-11-08 | Full CI test sweep, build, knip, jscpd, and repo hygiene pass with 100% green | quality | `pnpm lint && pnpm typecheck && pnpm test && pnpm jscpd && pnpm knip && node scripts/check-repo-hygiene.mjs && pnpm --filter @hestia/web build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/service/src/cli.test.ts` — unit test suite for `hestia-admin test-push` subcommand arguments, validation, and error states

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real iOS Safari 16.4+ Standalone PWA Push Receipt | PUSH-02 | Requires physical Apple device running iOS 16.4+ added to Home Screen and valid APNs push endpoint | Install PWA on iPhone via Safari "Add to Home Screen", enable notifications in settings, trigger test push via `pnpm hestia-admin test-push --email <user>`, verify system banner appears. |
| Real Android Chrome Standalone PWA Push Receipt | PUSH-02 | Requires physical Android device with Google Play Services and FCM endpoint | Install PWA on Android via Chrome "Install app", enable notifications, trigger test push via CLI, verify system notification tray receipt. |
| Production Cloudflare Edge Caching & WAF Challenge | EDGE-01 | Requires live DNS routing through Cloudflare Edge proxy and Cloudflare dashboard rules | Deploy to production origin, perform curl tests against `https://hestia.aberrance.app/assets/...` checking `cf-cache-status: HIT`, and execute curl loop against `POST /auth/v1/otp` to verify Managed Challenge response after 15 requests. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
