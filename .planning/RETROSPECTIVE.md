# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

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

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 104 E2E | High | Knip baseline, JSCPD, Hygiene |
| v2.0 | 107 E2E | High | Cloudflare Tunnel, Magic link E2E, Test-push CLI |

### Top Lessons (Verified Across Milestones)

1. Enforce quality gates at the commit and CI boundaries early; fixing regressions late costs exponentially more context and time.
2. Maintain strict documentation traceability between requirements, plans, and verification reports.
