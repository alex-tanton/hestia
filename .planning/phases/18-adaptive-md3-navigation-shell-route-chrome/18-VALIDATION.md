---
phase: "18"
slug: "adaptive-md3-navigation-shell-route-chrome"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-15"
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.1 (`jsdom` for DOM project, `node` for unit) |
| **Config file** | `apps/web/vite.config.ts` |
| **Quick run command** | `pnpm --filter @hestia/web test run src/components/shell/shell.test.tsx` |
| **Full suite command** | `pnpm --filter @hestia/web test run && pnpm --filter @hestia/e2e test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @hestia/web test run src/components/shell/shell.test.tsx`
- **After every plan wave:** Run `pnpm --filter @hestia/web test run && pnpm --filter @hestia/e2e test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | NAV-01 | T-18-01 | Responsive layout adapts at 600px without DOM leaks | component | `pnpm --filter @hestia/web test run src/components/shell/shell.test.tsx` | ✅ | ⬜ pending |
| 18-01-02 | 01 | 1 | NAV-02 | T-18-02 | Single h1 in TopBar, detail screens demoted to h2 | component | `pnpm --filter @hestia/web test run src/components/shell/shell.test.tsx` | ✅ | ⬜ pending |
| 18-02-01 | 02 | 2 | NAV-03 | T-18-01 | Primary Tabs in SubTabs with scroll reset, single-membership guidance | component | `pnpm --filter @hestia/web test run src/components/shell/shell.test.tsx` | ✅ | ⬜ pending |
| 18-02-02 | 02 | 2 | NAV-04 | — | Suggestions redirect to recipes?filter=ready and filter chip toggles | component | `pnpm --filter @hestia/web test run src/screens/meals/` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/src/components/shell/shell.test.tsx` — update assertions for MD3 tabs and navigation classes
- [ ] `apps/web/src/components/md/MdFilterChip.tsx` — Lit React wrapper for `@material/web/chips/filter-chip.js`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Touch scroll on narrow (<375px) mobile | NAV-03 | Horizontal touch momentum requires device/emulated touch | Emulate 360px viewport in mobile browser, swipe SubTabs horizontally |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending 2026-11-15
