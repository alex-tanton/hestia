---
phase: "17"
slug: "md3-foundation-token-pipeline-ui-primitives"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-11"
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `5.0.1` (`unit` node project + `dom` jsdom project) |
| **Config file** | `apps/web/vite.config.ts` |
| **Quick run command** | `pnpm --filter @hestia/web exec vitest run src/tokens.test.ts src/components/ui/primitives.test.tsx src/components/ui/Toast.test.tsx` |
| **Full suite command** | `pnpm --filter @hestia/web test:coverage && pnpm typecheck && pnpm lint && pnpm format:check` |
| **Estimated runtime** | ~30 seconds (quick) / ~90 seconds (full wave check) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @hestia/web exec vitest run src/tokens.test.ts src/components/ui/primitives.test.tsx src/components/ui/Toast.test.tsx`
- **After every plan wave:** Run `pnpm --filter @hestia/web test:coverage && pnpm typecheck && pnpm lint && pnpm format:check`
- **Before `/gsd-verify-work`:** Full suite must be green (`pnpm build && pnpm knip && node scripts/check-knip-baseline.mjs && pnpm jscpd && node scripts/audit-prod.mjs && node scripts/check-repo-hygiene.mjs`)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | FND-01 | T-17-01 | Static tokens + zero inline script under Caddy `'self'` CSP | unit (`node`) | `pnpm --filter @hestia/web exec vitest run src/tokens.test.ts` | ✅ (rewrite needed) | ⬜ pending |
| 17-01-02 | 01 | 1 | FND-01 / FND-03 | T-17-01 | Zero external CDN hosts, `<= 200 KB` gzipped shell, dual theme-color metas | build | `pnpm --filter @hestia/web build` | ✅ | ⬜ pending |
| 17-02-01 | 02 | 1 | FND-02 | T-17-02 | `softDisabled` click guard, host `aria-invalid` forwarding, D-13 5 smoke checks | component (`dom`) | `pnpm --filter @hestia/web exec vitest run src/components/ui/primitives.test.tsx` | ✅ (expand needed) | ⬜ pending |
| 17-02-02 | 02 | 1 | FND-02 | T-17-03 | ESLint `no-restricted-imports` + `jsx-a11y/control-has-associated-label` | static lint | `pnpm lint` | ✅ | ⬜ pending |
| 17-03-01 | 03 | 2 | FND-03 | T-17-01 | Curated static SVG `<path d>` registry (no `dangerouslySetInnerHTML`, no WOFF2 precache) | component + build | `pnpm --filter @hestia/web exec vitest run src/components/ui/primitives.test.tsx && pnpm --filter @hestia/web build` | ❌ W0 | ⬜ pending |
| 17-04-01 | 04 | 2 | FND-04 | — | `ModalBottomSheet`, persistent Undo/Error `Snackbar`, `DateField`, `TimeField`, light-DOM primitives | component (`dom`) | `pnpm --filter @hestia/web exec vitest run src/components/ui/primitives.test.tsx src/components/ui/Toast.test.tsx` | ✅ (expand/update needed) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/src/test-setup.ts` — Forced `element-internals-polyfill@3.0.2` bootstrap before `@material/web` imports
- [ ] `apps/web/src/test/md-queries.ts` — Shared Shadow DOM RTL query helpers compliant with `.jscpd.json`
- [ ] `apps/web/src/tokens.test.ts` — Rewrite against generated `src/styles/tokens.css` (light, dark `@media`, `[data-theme="light"]`, `[data-theme="dark"]`, all 5 `surfaceContainer*` tiers, harmonized status roles)
- [ ] `apps/web/src/components/ui/Toast.test.tsx` & `apps/web/src/screens/chores/chores.test.tsx` — Update action-toast persistence assertions per D-11

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supply-chain review of `@material-symbols/svg-400@0.48.3` (`SUS: too-new`, published 2026-11-04) | FND-03 | `gsd-tools package-legitimacy check` flagged package age before `pnpm add` | Verify provenance attestation / package contents during Wave 0 human checkpoint before installing |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
