# Milestone Requirements: v2.0 — Hestia Domain Migration and Rebrand

**Created:** 2026-10-25
**Status:** Active
**Target Version:** v2.0

---

## 1. Executive Summary

Milestone v2.0 migrates the application to the custom domain `hestia.aberrance.app` under Cloudflare, replaces Tailscale Funnel with Cloudflare Tunnel (`cloudflared`), enables passwordless magic link authentication via transactional SMTP, validates reliable Web Push notifications under a compliant VAPID subject, rebrands the application and monorepo packages to Hestia, and refactors documentation into a clean `README.md` supported by dedicated runbooks in `docs/`.

---

## 2. Requirements

### Phase 7: Planning Cleanup & Documentation Restructure

- [x] **CLEAN-01**: Archive v1.0 phase plans (`.planning/phases/`) and cleanup ledgers (`.planning/cleanup/`) to `.planning/milestones/v1.0/`, removing obsolete planning scratch files and bloat.
  - *Acceptance Criteria*: `.planning/phases/` is emptied or contains only active v2.0 phases; historical v1.0 plans are preserved under `.planning/milestones/v1.0/phases/`; git working tree remains clean.
- [x] **DOC-01**: Rewrite root `README.md` into an executive, well-structured guide covering project overview, quickstart commands, architecture summary, and clean links to detailed guides.
  - *Acceptance Criteria*: `README.md` is concise (<150 lines), contains no dense deployment or low-level test configuration scripts, and cleanly directs developers to dedicated documentation.
- [x] **DOC-02**: Abstract in-depth operational and developer runbooks into dedicated documents in `docs/`:
  - `docs/development.md`: Local environment setup, dev scripts, seed data, database management.
  - `docs/deployment.md`: Docker Compose topology, secrets generation, backups, updates, troubleshooting.
  - `docs/testing.md`: Vitest unit/component suite, integration test setup, time-sweep harness, Playwright E2E suite.
  - *Acceptance Criteria*: No operational details from the original README are lost; all links in `README.md` resolve to valid files in `docs/`.

### Phase 8: Full Rebrand to Hestia

- [x] **BRAND-01**: Update all user-facing PWA UI text, page titles (`<title>Hestia</title>` and `${page} · Hestia`), shell headers, onboarding copy, and install prompts to "Hestia".
  - *Acceptance Criteria*: No visible user-facing copy refers to Hearth; browser tab title, home screen install prompt, and shell navigation display Hestia.
- [x] **BRAND-02**: Update PWA web app manifest (`apps/web/vite.config.ts`, `apps/web/index.html`) with `name: "Hestia"` and `short_name: "Hestia"`; the manifest description names no brand and stays as it is.
  - *Acceptance Criteria*: Manifest generated during build reflects `Hestia`; browser installation inspects as "Hestia".
- [x] **BRAND-03**: Rename the administrative CLI executable and its `bin` entry from `hearth-admin` to `hestia-admin` in `apps/service`.
  - *Acceptance Criteria*: `hestia-admin` runs administrative tasks; the old command is removed with no alias or shim (D-07).
- [x] **BRAND-04**: Migrate workspace package scopes and names from `@hearth/*` to `@hestia/*` (`@hestia/shared`, `@hestia/recurrence`, `@hestia/matching`, `@hestia/service`, `@hestia/web`, `@hestia/e2e`, `@hestia/seed`).
  - *Acceptance Criteria*: Monorepo dependencies resolve cleanly via pnpm; typecheck, lint, and build pass across all workspaces.
- [x] **BRAND-05**: Update environment variable prefixes, Docker Compose service names, and container configurations from `HEARTH_*` to `HESTIA_*` (`HESTIA_HOST`, `HESTIA_ORIGIN`, `HESTIA_MAGIC_LINK_ENABLED`, etc.), as a hard cutover: there are no fallback reads of the old names.
  - *Acceptance Criteria*: `.env.example`, `docker/docker-compose.yml`, and `apps/service/src/env.ts` accept and document `HESTIA_*` variables; a service started with only the old names fails validation at startup (D-01, D-02).
- [x] **BRAND-06**: Update unit, component, integration, and E2E test suites to validate against the Hestia brand and new package names without test regressions.
  - *Acceptance Criteria*: `pnpm test` and `pnpm test:integration` pass with 100% green status.

### Phase 9: Domain & Network Migration (Cloudflare Tunnel & Ingress)

- [x] **NET-01**: Decommission Tailscale Funnel dependencies, removing Tailscale commands, host network binding references, and Funnel documentation.
  - *Acceptance Criteria*: Codebase contains no active dependencies or setup instructions requiring Tailscale Funnel.
- [x] **NET-02**: Configure Cloudflare Tunnel (`cloudflared`) in Docker Compose to securely forward `hestia.aberrance.app` traffic to Caddy without exposing router ports 80/443.
  - *Acceptance Criteria*: `docker-compose.yml` includes an optional/standard `cloudflared` service using a tunnel token; traffic routes cleanly to `caddy:8080`.
- [x] **NET-03**: Update `docker/Caddyfile` to trust only the Compose subnet that `cloudflared` connects from and to take the client IP from `CF-Connecting-IP` alone, with no `X-Forwarded-For` fallback (D-05, D-06).
  - *Acceptance Criteria*: Downstream service logs and rate limiting resolve true client IPs provided by Cloudflare.
- [x] **NET-04**: Keep the Content Security Policy's `connect-src 'self' wss://hestia.aberrance.app` derived from `HESTIA_ORIGIN` (`'self'` covers `https://hestia.aberrance.app`), and pin with tests that no CORS or cookie surface exists to configure: the service sends no CORS headers and the app keeps its tokens in browser storage, not cookies (D-09).
  - *Acceptance Criteria*: Browser console emits no CSP violation errors during realtime WebSocket connections or API calls on `hestia.aberrance.app`.
- [x] **NET-05**: Update default host origin configurations across web and service to `https://hestia.aberrance.app`.
  - *Acceptance Criteria*: Generated links (invites, password resets, magic links) use `https://hestia.aberrance.app`.

### Phase 10: Magic Links & Transactional Email

- [x] **AUTH-01**: Enable magic link build arguments and runtime environment flags (`VITE_MAGIC_LINK_ENABLED=true`, `HESTIA_MAGIC_LINK_ENABLED=true`).
  - *Acceptance Criteria*: Web bundle includes magic link routes and screens without dead-code elimination folding them away.
- [x] **AUTH-02**: Activate and verify magic link routes (`/sign-in/link`, `/sign-in/code`) and user navigation links in the PWA sign-in screen.
  - *Acceptance Criteria*: Sign-in screen offers "Email me a sign-in link"; submitting valid email navigates to the 6-digit code entry screen.
- [x] **AUTH-03**: Configure GoTrue SMTP settings (`GOTRUE_SMTP_*`) supporting Resend/Postmark with custom sender name ("Hestia") and address (`auth@aberrance.app` or `hestia@aberrance.app`).
  - *Acceptance Criteria*: GoTrue sends OTP email upon magic link request; instructions for Cloudflare DNS records (SPF, DKIM, DMARC) are documented.
- [x] **AUTH-04**: Update GoTrue site URL and redirect allow lists to `https://hestia.aberrance.app` and `https://hestia.aberrance.app/**`.
  - *Acceptance Criteria*: GoTrue redirects users back to the app securely after email link clicks.
- [x] **AUTH-05**: Replace `07-magic-link-disabled.spec.ts` with Playwright E2E tests validating the active magic link request, OTP code validation, and session creation.
  - *Acceptance Criteria*: Automated E2E test runs successfully against the stack with magic links enabled.

### Phase 11: Web Push & Edge Hardening

- [ ] **PUSH-01**: Update Web Push VAPID configuration in `apps/service` to set `VAPID_SUBJECT` to `mailto:admin@aberrance.app` (satisfying RFC 8292).
  - *Acceptance Criteria*: Web push tokens are signed with valid contact claim; Apple Push Notification Service and Mozilla Autopush accept subscriptions without warnings.
- [ ] **PUSH-02**: Verify standalone PWA push subscription and notification dispatch over HTTPS for iOS and Android devices.
  - *Acceptance Criteria*: Test device running installed PWA on `https://hestia.aberrance.app` receives push notifications for assigned chores and reminders.
- [ ] **EDGE-01**: Document and configure Cloudflare Edge caching rules for immutable Vite build assets (`/assets/*`) and WAF rate limiting for `/auth/v1/*`.
  - *Acceptance Criteria*: Static assets return edge cache hits; edge rate limiting protects auth endpoints against brute force attempts.
- [ ] **VERIFY-01**: Execute full test suite sweep, build validation, Knip dead-code scan, JSCPD duplication scan, and CI ratchet checks to guarantee zero regressions.
  - *Acceptance Criteria*: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm knip`, `pnpm jscpd`, and `pnpm build` pass with zero warnings or errors.

---

## 3. User Stories

1. **As a household member**, I want to navigate to `https://hestia.aberrance.app` so that I can access my home management dashboard reliably from any device without VPNs or Tailscale clients.
2. **As a user signing in on mobile**, I want to request a magic link so that I can log into Hestia without typing a long password on a touch keyboard.
3. **As a household admin**, I want the app branded consistently as Hestia so that our home dashboard feels cohesive, warm, and intentional.
4. **As an operator**, I want Hestia to connect via Cloudflare Tunnel so that I do not need to punch holes in my home router or manage dynamic DNS.
5. **As a developer**, I want a clean, concise `README.md` and dedicated documentation guides so that onboarding, deploying, and testing are straightforward.

---

## 4. Definition of Done

- All 21 requirements verified complete with automated tests or concrete artifacts.
- No remaining references to Tailscale Funnel in operational configs.
- Web app, API, and package scopes successfully rebranded to Hestia.
- Magic link flow tested end-to-end with email delivery / OTP code entry.
- `README.md` simplified with operational runbooks living in `docs/`.
- All CI checks, tests, and lint rules passing on `main`.
