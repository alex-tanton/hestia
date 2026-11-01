---
phase: "10"
slug: "magic-links-transactional-email"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-01"
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit/component/config) & Playwright (E2E) |
| **Config file** | `apps/web/vite.config.ts`, `e2e/playwright.config.ts` |
| **Quick run command** | `pnpm --filter @hestia/web test:unit && pnpm --filter @hestia/service test:unit` |
| **Full suite command** | `pnpm test && pnpm --filter @hestia/web build && pnpm test:e2e` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @hestia/web test:unit` or relevant unit/config test
- **After every plan wave:** Run `pnpm test && pnpm --filter @hestia/web build`
- **Before `/gsd-verify-work`:** Full suite must be green including `07-magic-link.spec.ts`
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | AUTH-02 | T-10-01 | SMTP settings and secrets configured | static/config | `pnpm --filter @hestia/service test` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | AUTH-03 | T-10-02 | Inbucket mail catcher container in E2E compose | integration | `docker compose -f e2e/docker-compose.e2e.yml config` | ✅ | ⬜ pending |
| 10-02-01 | 02 | 2 | AUTH-01 | T-10-03 | Magic link UI secondary button & routes | component | `pnpm --filter @hestia/web test:unit` | ✅ | ⬜ pending |
| 10-02-02 | 02 | 2 | AUTH-04 | T-10-04 | Code normalization & unknown email handling | component | `pnpm --filter @hestia/web test:unit` | ✅ | ⬜ pending |
| 10-02-03 | 02 | 2 | AUTH-01 | T-10-05 | App bundle shell stays < 200 KB gzipped | build/asset | `pnpm --filter @hestia/web build` | ✅ | ⬜ pending |
| 10-03-01 | 03 | 3 | AUTH-01..05 | T-10-06 | End-to-end magic link request & OTP entry | e2e | `pnpm test:e2e -- e2e/tests/07-magic-link.spec.ts` | ❌ W0 | ⬜ pending |
| 10-03-02 | 03 | 3 | AUTH-05 | T-10-07 | Open redirect prevention strictly locked to origin | e2e | `pnpm test:e2e -- e2e/tests/07-magic-link.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/service/src/docker-compose-smtp.test.ts` — static validation of Compose SMTP and signup settings
- [ ] `e2e/support/inbucket.ts` — Inbucket REST API polling helper for E2E email interception
- [ ] `e2e/tests/07-magic-link.spec.ts` — comprehensive E2E test replacing `07-magic-link-disabled.spec.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Resend SMTP Delivery | AUTH-02 | Requires live internet access and production Resend API credentials | Follow runbook in `docs/deployment.md`: send test magic link from production origin and verify inbox delivery & DKIM/SPF headers. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

