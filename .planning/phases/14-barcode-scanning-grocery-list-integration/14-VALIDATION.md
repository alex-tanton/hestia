---
phase: "14"
slug: "barcode-scanning-grocery-list-integration"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-09"
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.1 |
| **Config file** | `apps/web/vite.config.ts`, `apps/service/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @hestia/web test && pnpm --filter @hestia/service test` |
| **Full suite command** | `pnpm test && pnpm test:integration` |
| **Estimated runtime** | ~25 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @hestia/web test && pnpm --filter @hestia/service test`
- **After every plan wave:** Run `pnpm test && pnpm test:integration`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | SCAN-02 | T-14-02 | Authenticated route rejects 401 | unit | `pnpm --filter @hestia/service test src/routes/barcodes.test.ts` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | SCAN-02 | T-14-03 | Open Food Facts caching & timeout | unit | `pnpm --filter @hestia/service test src/services/barcodes.test.ts` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 2 | SCAN-01 | T-14-01 | Viewfinder, debounce & polyfill fallback | component | `pnpm --filter @hestia/web test src/components/lists/BarcodeScannerDialog.test.tsx` | ❌ W0 | ⬜ pending |
| 14-03-01 | 03 | 3 | SCAN-03 | — | N/A | component | `pnpm --filter @hestia/web test src/screens/lists/ListDetailScreen.test.tsx` | ❌ W0 | ⬜ pending |
| 14-03-02 | 03 | 3 | SCAN-04 | — | N/A | component | `pnpm --filter @hestia/web test src/screens/lists/ListDetailScreen.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/service/src/services/barcodes.test.ts` — stubs for SCAN-02
- [ ] `apps/service/src/routes/barcodes.test.ts` — stubs for SCAN-02
- [ ] `apps/web/src/components/lists/BarcodeScannerDialog.test.tsx` — stubs for SCAN-01
- [ ] `apps/web/src/screens/lists/ListDetailScreen.test.tsx` — stubs for SCAN-03, SCAN-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Hardware camera video stream & torch toggle | SCAN-01 | Requires physical camera sensor and torch LED | Open scanner dialog on mobile device or emulator, verify camera feed appears and torch toggles on supported devices |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

