---
phase: "13"
slug: "deal-pricing-engine-ingestion-performance"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-09"
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.1 |
| **Config file** | `apps/service/vitest.config.ts`, `apps/web/vite.config.ts` |
| **Quick run command** | `pnpm --filter @hestia/service test && pnpm --filter @hestia/web test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @hestia/service test && pnpm --filter @hestia/web test`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | DEAL-02 | — | Half-up cent rounding and 1%-95% discount validation threshold | unit | `pnpm --filter @hestia/service test apps/service/src/deals/price/parse-price.test.ts` | ✅ | ⬜ pending |
| 13-01-02 | 01 | 1 | DEAL-02 | — | Mathematical derivation for bundle savings and Buy-N-Get-M | unit | `pnpm --filter @hestia/service test apps/service/src/deals/price/parse-price.test.ts` | ✅ | ⬜ pending |
| 13-02-01 | 02 | 2 | DEAL-03 | — | Bounded worker pool (4-5 concurrent workers, 100-200ms pacing) | unit | `pnpm --filter @hestia/service test apps/service/src/deals/flipp/request-queue.test.ts` | ✅ | ⬜ pending |
| 13-02-02 | 02 | 2 | DEAL-03 | — | Concurrent item resolution and in-memory LRU item-detail cache | unit | `pnpm --filter @hestia/service test apps/service/src/deals/flipp/flipp-deal-source.test.ts` | ✅ | ⬜ pending |
| 13-03-01 | 03 | 3 | DEAL-01 | — | Primary sale price, inline discount badge, strikethrough original price | component | `pnpm --filter @hestia/web test apps/web/src/screens/deals/deal-card.test.tsx` | ✅ | ⬜ pending |
| 13-03-02 | 03 | 3 | DEAL-03 | — | Adaptive 4-5s client polling with 3-minute ceiling | unit | `pnpm --filter @hestia/web test apps/web/src/screens/deals/use-refresh-poll.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending 2026-11-09

