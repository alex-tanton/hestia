# Roadmap: Hestia

## Milestones

- [x] **[v1.0 Hearth — Cleanup and Hardening](milestones/v1.0/ROADMAP.md)** — 6 phases, 60 plans, 40 requirements; completed 2026-10-25
- [ ] **v2.0 Hestia — Domain Migration and Rebrand** — 5 phases (7–11), 21 requirements; active

---

## Active Milestone: v2.0 Hestia — Domain Migration and Rebrand

**Goal:** Migrate to custom domain `hestia.aberrance.app` via Cloudflare, replace Tailscale Funnel with Cloudflare Tunnel, enable passwordless magic links, configure Web Push VAPID, execute a full rebrand to Hestia, and restructure documentation.

### Phases

- [x] **Phase 7: Planning Cleanup & Documentation Restructure** - Archive v1.0 planning bloat, restructure `README.md`, and create modular runbooks under `docs/`. (completed 2026-10-25)
- [ ] **Phase 8: Full Rebrand to Hestia** - Rebrand web UI, PWA manifest, CLI, workspace packages (`@hestia/*`), and environment variables (`HESTIA_*`).
- [ ] **Phase 9: Domain & Network Migration (Cloudflare Tunnel & Ingress)** - Decommission Tailscale Funnel, add Cloudflare Tunnel, update Caddy real-IP restoration (`CF-Connecting-IP`), and configure domain routing for `hestia.aberrance.app`.
- [ ] **Phase 10: Magic Links & Transactional Email** - Activate magic link routes and screens, configure GoTrue SMTP for Resend/Postmark, and implement E2E verification.
- [ ] **Phase 11: Web Push & Edge Hardening** - Update VAPID claims under RFC 8292, verify iOS/Android standalone PWA push notifications, configure Cloudflare Edge caching/WAF, and run full verification.

---

## Phase Details

### Phase 7: Planning Cleanup & Documentation Restructure

**Goal:** Clean out v1.0 planning bloat and restructure documentation so the repository is tidy, maintainable, and approachable.
**Depends on:** Nothing (first phase of v2.0)
**Requirements:** CLEAN-01, DOC-01, DOC-02
**Success Criteria:**
1. Historical v1.0 phases and cleanup ledgers are archived into `.planning/milestones/v1.0/`, leaving `.planning/` free of obsolete bloat.
2. Root `README.md` is concise (<150 lines), well-structured, and focuses on project overview, architecture, and quickstart commands.
3. In-depth technical runbooks are cleanly organized in `docs/`: `docs/development.md`, `docs/deployment.md`, and `docs/testing.md` with zero loss of operational knowledge.

**Plans:** 4/4 plans complete

Plans:
**Wave 1**
- [x] 07-01-PLAN.md — Archive v1.0 phases, cleanup ledgers and quick tasks into `.planning/milestones/v1.0/` (rename-only), delete `.planning/codebase/`, classify raw outputs and index the archive

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 07-02-PLAN.md — Doc link and fact-map checker; rename the deployment guide to `docs/deployment.md` and merge the README's deployment, backup and restore material

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 07-03-PLAN.md — Create `docs/development.md` (README development sections plus CONTRIBUTING scripts and pre-push checks); merge README E2E notes into `docs/testing.md`

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 07-04-PLAN.md — Rewrite `README.md` as a landing page under 150 lines with a docs index; final gates and the README section map

---

### Phase 8: Full Rebrand to Hestia

**Goal:** Rebrand the application from Hearth to Hestia across the monorepo, UI, manifest, CLI, and configuration.
**Depends on:** Phase 7
**Requirements:** BRAND-01, BRAND-02, BRAND-03, BRAND-04, BRAND-05, BRAND-06
**Success Criteria:**
1. PWA UI titles, shell header, onboarding copy, and home screen install banners display "Hestia".
2. Web App Manifest generates with `name: "Hestia"` and `short_name: "Hestia"`.
3. Administrative CLI command is `hestia-admin` in `apps/service`.
4. Monorepo packages are renamed to `@hestia/shared`, `@hestia/recurrence`, `@hestia/matching`, `@hestia/service`, `@hestia/web`, `@hestia/e2e`, and `@hestia/seed`.
5. Environment variables and Docker Compose services support `HESTIA_*` configuration (hard cutover; the old names are not read).
6. All existing unit, component, integration, and E2E tests pass cleanly under the new brand.

**Plans:** 5/7 plans executed

Plans:
**Wave 1**
- [x] 08-01-PLAN.md — Rename the login role to `hestia_service` by editing the two applied migrations in place, admitted by a content-pinned, self-expiring exemption in the append-only gate

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 08-02-PLAN.md — Rename the workspace packages to `@hestia/*` (seven, with `@hestia/seed`), regenerate the lockfile with pnpm, prove typecheck, builds and every repository gate

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 08-03-PLAN.md — Hard-cut every environment variable to `HESTIA_*`; rename the Compose project, network, service, images, host paths, E2E names, Supabase project id and runner label

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 08-04-PLAN.md — Hestia in the PWA copy, title and manifest (build-checked), `hestia-admin` as a clean break, renamed browser keys

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 08-05-PLAN.md — Catch-all sweep of the remaining references in every live file outside `.planning/`, one commit, full unit suite green
- [ ] 08-06-PLAN.md — Planning text aligned with the decisions (BRAND-02 to BRAND-05), cloud tooling renamed, owner checklist with PR notes and owner-visible choices

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 08-07-PLAN.md — Legacy-name guard in the hygiene gate; every CI check, `pnpm test:integration`, the integration coverage suite and the E2E suite green under the new brand

---

### Phase 9: Domain & Network Migration (Cloudflare Tunnel & Ingress)

**Goal:** Establish secure ingress for `hestia.aberrance.app` via Cloudflare Tunnel, eliminating Tailscale Funnel and port forwarding.
**Depends on:** Phase 8
**Requirements:** NET-01, NET-02, NET-03, NET-04, NET-05
**Success Criteria:**
1. Tailscale Funnel dependencies, host-loopback proxy requirements, and Funnel documentation are removed.
2. Cloudflare Tunnel (`cloudflared`) is integrated in Docker Compose to route `hestia.aberrance.app` to Caddy with zero open router ports.
3. `docker/Caddyfile` trusts Cloudflare proxy IPs and resolves true client IP addresses via `CF-Connecting-IP`.
4. CSP (`connect-src wss://hestia.aberrance.app`), CORS, and cookie policies are configured for `https://hestia.aberrance.app`.
5. Base origin across all services points to `https://hestia.aberrance.app`.

---

### Phase 10: Magic Links & Transactional Email

**Goal:** Enable passwordless magic link authentication end-to-end with verified email delivery.
**Depends on:** Phase 9
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria:**
1. Magic link routes (`/sign-in/link`, `/sign-in/code`) are compiled and reachable in the PWA.
2. GoTrue SMTP configuration is established for Resend / Postmark with sender address `auth@aberrance.app` or `hestia@aberrance.app`.
3. GoTrue site URL and URI allow-list are locked to `https://hestia.aberrance.app`.
4. Automated Playwright E2E tests validate magic link request, OTP code entry, and authentication session creation.

---

### Phase 11: Web Push & Edge Hardening

**Goal:** Ensure reliable Web Push notifications on real HTTPS mobile devices, configure Cloudflare edge performance/security, and lock in quality gates.
**Depends on:** Phase 10
**Requirements:** PUSH-01, PUSH-02, EDGE-01, VERIFY-01
**Success Criteria:**
1. Web Push VAPID claims in `apps/service` use `mailto:admin@aberrance.app` meeting RFC 8292 requirements.
2. Standalone PWA push subscription and notification receipt are verified for iOS Safari and Android Chrome over HTTPS.
3. Cloudflare Edge caching rules for immutable Vite assets (`/assets/*`) and WAF rate limiting for `/auth/v1/*` are documented and tested.
4. Complete test sweep, build verification, Knip, and JSCPD checks pass with 100% green status.
