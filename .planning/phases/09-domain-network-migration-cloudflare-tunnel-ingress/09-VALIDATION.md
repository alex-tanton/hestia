---
phase: "09"
slug: domain-network-migration-cloudflare-tunnel-ingress
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-26"
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node --test` (root harness), Vitest 5.0.1 (workspaces), Playwright 1.63.0 (E2E) |
| **Config file** | root `package.json` `test:harness` (explicit file list); `apps/service/vitest.config.ts`; `e2e/playwright.config.ts` |
| **Quick run command** | `node --test scripts/check-repo-hygiene.test.mjs scripts/caddy-entrypoint.test.mjs scripts/deploy.test.mjs` and `pnpm --filter @hestia/service exec vitest run src/ingress-config.test.ts` |
| **Full suite command** | `pnpm test`; `pnpm test:e2e` for the stack |
| **Estimated runtime** | ~30 seconds quick; ~9 minutes E2E |

## Sampling Rate

- **After every task commit:** quick run command
- **After every plan wave:** `pnpm test`, `node scripts/check-repo-hygiene.mjs`, `pnpm knip`, `node scripts/check-knip-baseline.mjs`, `pnpm jscpd`, `pnpm typecheck`
- **Before `/gsd-verify-work`:** full suite and `pnpm test:e2e` green
- **Max feedback latency:** 60 seconds

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| NET-01 | tailscale/funnel cannot reappear in tracked live files | harness | `node --test scripts/check-repo-hygiene.test.mjs` | extend existing |
| NET-01 | `deploy.sh` health check via `compose exec`, no host port | harness | `node --test scripts/deploy.test.mjs` | extend existing |
| NET-02 | cloudflared pinned, token required, healthcheck, no published ports, E2E overlay excludes it | vitest static | `pnpm --filter @hestia/service exec vitest run src/ingress-config.test.ts` | ❌ W0 |
| NET-03 | Caddyfile trusted_proxies and CF-Connecting-IP; entrypoint refuses empty trust list | vitest + harness | `vitest run src/ingress-config.test.ts`; `node --test scripts/caddy-entrypoint.test.mjs` | ❌ W0 |
| NET-03 | real header honoured, X-Forwarded-For ignored | e2e | `pnpm test:e2e` | ❌ W0 |
| NET-04 | origin yields HESTIA_HOST; CSP uses it | harness + vitest | `node --test scripts/caddy-entrypoint.test.mjs` | ❌ W0 |
| NET-05 | `.env.example` and docs carry the origin; env.ts still requires it | vitest | `vitest run src/ingress-config.test.ts src/env.test.ts` | ❌ W0 / ✅ |

## Wave 0 Requirements

- [ ] `apps/service/src/ingress-config.test.ts`
- [ ] `scripts/caddy-entrypoint.test.mjs` (add to root `test:harness` list)
- [ ] New cases in `scripts/check-repo-hygiene.test.mjs`
- [ ] Extended case in `scripts/deploy.test.mjs`
- [ ] E2E spec for client IP and CSP
- [ ] `pnpm install --frozen-lockfile`

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live tunnel, DNS, WebSocket upgrade, browser CSP clean, `hestia-compose up -d --wait` after first deploy | NET-02, NET-04 | No Cloudflare edge from CI or sandbox | Owner checklist under `.planning/` |

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
