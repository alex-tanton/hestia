# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v3.0 — Material Design 3 Overhaul

**Shipped:** 2026-11-20  
**Phases:** 5 | **Plans:** 31 | **Tasks:** 41

### What Was Built
- **MD3 Foundation & Primitives (Phase 17):** Generated build-time Warm Terracotta `--md-sys-*` tokens via `@material/material-color-utilities` verifying WCAG AA contrast across 5 tiers; created `@material/web@2.5.0` `@lit/react` adapters behind `components/md/`; implemented commit-pinned Material Symbols Rounded inline SVG registry (`Icon.tsx`); delivered light-DOM and native-`<dialog>` gap primitives (`ModalBottomSheet`, single-slot persistent Undo `Snackbar`, `Card`, `ListRow`, `Badge`, `SegmentedControl`).
- **Adaptive Shell & Navigation (Phase 18):** Replaced legacy layout cliff with MD3 Window Size Classes (`NavigationBar` `<600px`, `NavigationRail` `>=600px`), single-`<h1>` Small Top App Bar, MD3 Primary Tabs in `SubTabs`, and consolidated Meals sub-tabs with `"On sale / Ready now"` filter chips.
- **Entry, Dashboard & Grocery Ecosystem (Phase 19):** Overhauled Auth into centered 440px tonal cards; restructured Dashboard with borderless tonal cards; modernized Grocery Lists, Pantry, and dark-scheme Barcode Scanner Full-Screen Dialog with persistent Undo feedback; simplified DealCards with lifted `AddToListSheet` and elevated flyers.
- **Meals, Bills, Chores & Settings (Phase 20):** Overhauled PlannerScreen with compact agenda `<840px` and 7-column board `>=840px`; converted dense forms (`RecipeForm`, `BillForm`, `ChoreForm`) to responsive Centered/Full-Screen dialogs; modernized Bills, Chores, Errands with direct actions and Undo snackbars; delivered categorized Settings hub with sub-routes.
- **Legacy Stack Cleanup & Verification (Phase 21):** Completely removed Tailwind CSS v4, Radix UI, and Lucide icons in favor of pure semantic CSS modules; reconciled Knip baseline; passed all 881 Vitest unit/DOM tests, 24 Playwright E2E journeys (56 test cases), light/dark WCAG 2.1 AA audits (66 test cases), shell budget (<= 200 KB gz), and CI ratchets.

### What Worked
- **Parallel Foundation-to-Pillar Staging:** Locking the token pipeline and adapter contract in Phase 17 allowed subsequent screens (Phases 18-20) to migrate rapidly without re-architecting primitives.
- **Pure Inline SVG Registry:** Building `Icon.tsx` directly from official `google/material-design-icons` geometry avoided font network overhead, bypassed CSP font hazards, and guaranteed 100% offline reliability.
- **Single-Slot Persistent Snackbar Queue:** Replacing toast popups with a centralized FIFO snackbar system eliminated clutter and provided consistent, reliable optimistic undo mechanics.

### What Was Inefficient
- **Verification Report Invalidation:** Changing common styling or test utilities in later phases invalidated digests of earlier phases, flagging them as stale in audit checks.
- **Phase Verification vs UAT Desynchronization:** Phase 17 completed 25 automated UAT scenarios but missed generating the formal `17-VERIFICATION.md` report, requiring an override closeout.

### Patterns Established
- **Zero-Cast `@lit/react` Adapters:** Typed wrapper pattern with `omitUndefined` helper and `exactOptionalPropertyTypes` normalization for seamless Material Web React 19 integration.
- **Responsive Window Size Class Split:** Clean `<600px`, `>=600px`, and `>=840px` breakpoints separating compact bottom bars from desktop rails and multi-column boards without layout flash.
- **Semantic CSS Domain Sheets:** Modular domain stylesheets replacing repetitive Tailwind utility strings while preserving clean build budgets and strict CSP.

### Key Lessons
1. **Material Web custom elements in jsdom:** Configuring forced `element-internals-polyfill` and Shadow DOM helper queries early avoided costly test runner migrations to browser-playwright.
2. **Always complete formal verification before phase transitions:** Completing UAT is not sufficient under GSD audit rules; ensure `*-VERIFICATION.md` is emitted prior to moving to subsequent phases.

### Cost Observations
- **Model mix:** Gemini 3.8 Flash / Claude 3.5 Sonnet
- **Sessions:** 5 phases across 9 days
- **Notable:** Over 38,000 insertions and 8,000 deletions with zero test regressions across 24 E2E journeys.

---

## Milestone: v2.0 — Hestia Domain Migration and Rebrand

**Shipped:** 2026-11-02  
**Phases:** 5 | **Plans:** 23 | **Tasks:** 39

### What Was Built
- **Planning & Docs (Phase 7):** Archived v1.0 bloat, rewrote `README.md` to a concise landing page (<70 lines), and established modular runbooks in `docs/` (`development.md`, `deployment.md`, `testing.md`).
- **Full Rebrand (Phase 8):** Complete rebrand to Hestia across PWA UI, manifest, CLI (`hestia-admin`), workspace package scopes (`@hestia/*`), Compose services, and environment variables (`HESTIA_*`).
- **Domain & Ingress (Phase 9):** Decommissioned Tailscale Funnel in favor of Cloudflare Tunnel (`cloudflared`) pointing to `hestia.aberrance.app` with zero open host ports; updated Caddy client IP resolution (`CF-Connecting-IP`).
- **Transactional Auth (Phase 10):** Enabled passwordless magic link authentication end-to-end with GoTrue SMTP configuration (Resend/Postmark) and dynamic Inbucket E2E test-doubles.
- **Web Push & Edge Hardening (Phase 11):** Strictly enforced RFC 8292 `VAPID_SUBJECT` (`mailto:admin@aberrance.app`), verified iOS/Android standalone PWA push notifications, configured Cloudflare edge caching / WAF rate limits, and locked in full quality gates.

### What Worked
- **Incremental Wave Parallelization:** Breaking phases into dependency-aware waves allowed parallel development of independent components (e.g. CLI vs web routes, docs vs fixtures).
- **Automated Gate Ratchets:** Pre-commit and CI hygiene gates caught legacy references, append-only migration violations, and typing regressions immediately at source.
- **Contract-First Testing:** Pinning invariants via static Vitest assertions (e.g. Caddy trust, env cutover, GoTrue configs) prevented drift before container integration.

### What Was Inefficient
- **Verification Hash Invalidation:** Modifications to documentation and summaries caused earlier phase verification digests to flag as stale even when source code was untouched.
- **Manual Visual Verification Overhead:** Brand visual inspections and mobile home-screen checks required human verification gates that could not run headlessly in CI.

### Patterns Established
- **Migration Exemptions with Self-Expiring Signatures:** In-place role renames and schema adjustments permitted strictly via blob-pinned cryptographic hashes that automatically expire once on `main`.
- **Zero-Port Tunnel Topology:** Routing all external ingress through `cloudflared` without exposing any host ports or relying on host gateways.
- **Mocked Inbound Email Interception:** Dynamic Inbucket harness port allocation for deterministic Playwright magic link tests.

### Key Lessons
1. **Hard cutovers with hygiene checks:** Renaming env vars and packages with zero backward-compatibility fallbacks combined with hygiene lint guards prevented subtle split-brain configuration issues.
2. **Derive ingress origins from single source of truth:** Standardizing on `HESTIA_ORIGIN` for CSP, redirect allowlists, and link generation eliminated CORS and WebSocket disconnect bugs.

### Cost Observations
- **Model mix:** Gemini 3.8 Flash (High) / Claude 3.5 Sonnet
- **Sessions:** 5 phases across 7 days
- **Notable:** High execution efficiency with 23 plans delivered cleanly without broken builds or failed rollbacks.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 60 plans | 6 | Cleanup, determinism, and test suite hardening |
| v2.0 | 23 plans | 5 | Custom domain ingress, rebrand, magic links, Web Push RFC 8292 |
| v2.1 | 13 plans | 5 | Grocery & deals intelligence, barcode scanning, flexible meals |
| v3.0 | 31 plans | 5 | Complete Material Design 3 overhaul, pure semantic CSS |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 104 E2E | High | Knip baseline, JSCPD, Hygiene |
| v2.0 | 107 E2E | High | Cloudflare Tunnel, Magic link E2E, Test-push CLI |
| v2.1 | 107+ E2E | High | OFF proxy caching, Barcode detector |
| v3.0 | 881 Unit/DOM, 24 E2E (56 runs), 66 a11y runs | High (84/80/77/85) | Material Symbols SVG registry, MD3 tokens, Shell <= 200KB |

### Top Lessons (Verified Across Milestones)

1. Enforce quality gates at the commit and CI boundaries early; fixing regressions late costs exponentially more context and time.
2. Maintain strict documentation traceability between requirements, plans, and verification reports.

