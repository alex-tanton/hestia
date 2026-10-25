# Hestia — Household Management PWA

## What This Is

Hestia is a self-hosted household-management PWA (grocery deals, shopping lists, meals/recipes, bills, chores, and notifications) for a single household, built as a React + Vite PWA and a Fastify service over Postgres/Supabase with RLS as the tenant isolation boundary.

## Current State

**Shipped Milestone:** v1.0 — Cleanup and Hardening (2026-10-25)
- Lean, trustworthy base for manual review: clean published git history, deterministic test suite (36-cell date and timezone sweep), bare-clock lint ban, proven-dead code removed with Knip baseline.
- Known bugs fixed with regression tests: offline list-add replay duplicates, `RotationEditor` keyboard accessibility, PATCH schema default injection, scoped `service_role` and GoTrue route fencing.
- Redundancy reduced: composite CI setup action, consolidated web/service test fixtures, retired spec citations removed.
- Blocking CI enforcement ratchet: Knip baseline (0 default findings), JSCPD duplication (<2%), repo hygiene (modes, line endings, tracked-ignored), migration append-only, and zero intermittent CI failures (`CI-08`).
- 40 requirements verified complete; 100% UAT pass across 32 tests.

**Active Milestone:** v2.0 — Hestia Domain Migration and Rebrand
- Rebrand the entire application, PWA manifest, CLI, packages, and environment from Hearth to Hestia.
- Migrate ingress from Tailscale Funnel to custom domain `hestia.aberrance.app` using Cloudflare Tunnel (`cloudflared`) and Cloudflare Edge.
- Enable GoTrue magic links with transactional SMTP email delivery (Resend / Postmark).
- Configure Web Push VAPID claims under RFC 8292 (`mailto:admin@aberrance.app`) and verify iOS/Android standalone PWA push notifications.
- Restructure repository documentation: simplify `README.md` and abstract detailed runbooks into `docs/` (`development.md`, `deployment.md`, `testing.md`).
- Archive v1.0 planning bloat and reset project memory for v2.0.

## Core Value

The application is securely reachable at `https://hestia.aberrance.app` with zero open router ports via Cloudflare Tunnel, features friction-free passwordless magic link authentication, delivers reliable mobile Web Push notifications, operates under the unified Hestia brand, and provides clean, structured documentation for developers and operators.

## Requirements

### Validated (v1.0)

- ✓ Authenticated household app with RLS-enforced tenant isolation (service runs each request in a Postgres transaction as `authenticated`) — existing
- ✓ Feature pillars: shopping lists with realtime and offline write queue, chores with rotation, bills with recurrence and autopay, meals/recipes import and matching, Flipp-backed deals, push notifications — existing
- ✓ Installable offline-capable PWA with service worker and persisted query cache — existing
- ✓ Privileged `service_role` access fenced in `apps/service/src/privileged/` with an ESLint restriction — v1.0 (Phase 4)
- ✓ In-process cron jobs guarded by Postgres advisory locks — existing
- ✓ Docker Compose deployment with Caddy gateway, GoTrue, Realtime, Kong, backups, and a CI-gated deploy workflow — v1.0 (Phase 4/6)
- ✓ Unit, component, service integration, and Playwright E2E test suites with coverage thresholds — v1.0 (Phase 2/6)
- ✓ Date- and timezone-dependent unit, component, and E2E tests are deterministic with 36-cell weekday-and-zone sweep and bare-clock lint ban — v1.0 (Phase 2 & 6)
- ✓ Dead-code and duplication tooling calibrated and enforced (knip 6.41.0, jscpd 5.4.1) — v1.0 (Phase 2, 3, 6)
- ✓ Clean git history and branch policy published to origin — v1.0 (Phase 1)
- ✓ Offline replay duplication bug, RotationEditor keyboard accessibility, and PATCH default-injection fixed behind regression tests — v1.0 (Phase 4)
- ✓ Composite setup action, consolidated fixtures, and docs synchronized with code — v1.0 (Phase 5)
- ✓ Blocking CI ratchet (hygiene, Knip, JSCPD, audit, migration append-only, deploy gate) with zero flaky tests — v1.0 (Phase 6)

### Active (v2.0)

- **CLEAN-01**: Archive v1.0 phases and cleanup ledgers to `.planning/milestones/v1.0/`, removing obsolete planning bloat.
- **DOC-01**: Restructure `README.md` into a clean, concise overview, abstracting deep development, deployment, and testing details into dedicated guides in `docs/`.
- **DOC-02**: Create `docs/development.md`, `docs/deployment.md`, and `docs/testing.md` preserving all technical runbook knowledge.
- **BRAND-01**: Rebrand user-facing PWA app name to "Hestia" (page titles, HTML metadata, app shell header, onboarding copy, and install banner).
- **BRAND-02**: Update PWA manifest with `name: "Hestia"`, `short_name: "Hestia"`, updated description, and matching theme/background tokens.
- **BRAND-03**: Rename service administrative CLI from `hearth-admin` to `hestia-admin` and update binary references.
- **BRAND-04**: Migrate workspace package namespaces from `@hearth/*` to `@hestia/*` across `package.json` files and internal imports.
- **BRAND-05**: Transition environment variables, Docker service names, and container configurations from `HEARTH_*` to `HESTIA_*` with backwards-compatibility fallbacks where appropriate.
- **BRAND-06**: Update all unit, component, integration, and E2E test suites to pass under the Hestia brand name.
- **NET-01**: Decommission Tailscale Funnel dependencies, CLI instructions, and host-network proxy configurations.
- **NET-02**: Provide Cloudflare Tunnel (`cloudflared`) Docker Compose service configuration connecting `hestia.aberrance.app` to Caddy with zero exposed host ports.
- **NET-03**: Update `docker/Caddyfile` to trust Cloudflare proxy IP ranges and extract client IP from `CF-Connecting-IP`.
- **NET-04**: Update CSP (`connect-src wss://hestia.aberrance.app`), CORS, and cookie security policies for `hestia.aberrance.app`.
- **NET-05**: Set base origin and site URL configurations to `https://hestia.aberrance.app`.
- **AUTH-01**: Enable `VITE_MAGIC_LINK_ENABLED=true` and `HESTIA_MAGIC_LINK_ENABLED=true` in build arguments and runtime environment.
- **AUTH-02**: Activate and verify magic link routes (`/sign-in/link`, `/sign-in/code`) and screens in the web PWA.
- **AUTH-03**: Configure GoTrue SMTP settings (`GOTRUE_SMTP_*`) supporting Resend/Postmark with custom sender name ("Hestia") and address (`auth@aberrance.app` or `hestia@aberrance.app`).
- **AUTH-04**: Update GoTrue site URL and URI allow-list to `https://hestia.aberrance.app` and `https://hestia.aberrance.app/**`.
- **AUTH-05**: Replace `07-magic-link-disabled.spec.ts` with Playwright E2E tests validating active magic link request and code entry flows.
- **PUSH-01**: Update Web Push VAPID configuration in `apps/service` to use `mailto:admin@aberrance.app` as RFC 8292 subject.
- **PUSH-02**: Verify standalone PWA push subscription and notification dispatch over HTTPS for iOS and Android devices.
- **EDGE-01**: Document Cloudflare Edge caching rules for immutable Vite assets (`/assets/*`) and WAF rate limiting for `/auth/v1/*`.
- **VERIFY-01**: Full test suite sweep, build validation, Knip, and CI verification green across all packages.

### Out of Scope

- Multi-tenant household segregation outside existing RLS schema (remains single household or small family circle).
- Rewriting database migration history (migrations remain append-only).
- Replacing Fastify/Vite/Postgres core tech stack.
- Complex federated OAuth providers (retaining email/password + magic link auth).

## Context

- Brownfield codebase with 6 completed and archived v1.0 phases.
- Domain `aberrance.app` purchased via Cloudflare; targeting subdomain `hestia.aberrance.app`.
- pnpm workspace (TypeScript 6, Node 24).
- Ingress shifting from Tailscale Funnel to Cloudflare Tunnel.

## Constraints

- **No open router ports**: Host server must not require opening ports 80/443 directly to the public internet; Cloudflare Tunnel handles ingress.
- **Zero test regressions**: All existing unit, integration, and E2E tests must remain green after package and brand renaming.
- **Documentation integrity**: Do not discard operational knowledge when simplifying `README.md`; preserve it in dedicated `docs/` files.
- **Append-only migrations**: Any schema or seed updates must be forward-only.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rename app to Hestia without verbose philosophical justification | Goddess of the Hearth fits household management; keep documentation clean and direct | Pending — v2.0 |
| Use Cloudflare Tunnel (`cloudflared`) instead of port forwarding or Tailscale Funnel | Zero exposed host ports, automatic edge SSL, and native Cloudflare DNS integration | Pending — v2.0 |
| Enable GoTrue Magic Links via Resend / Postmark SMTP | Seamless passwordless sign-in with verified deliverability on custom domain | Pending — v2.0 |
| Update VAPID subject to `mailto:admin@aberrance.app` | RFC 8292 compliance required by Apple and Mozilla push endpoints | Pending — v2.0 |
| Full rebrand (PWA, CLI, package scopes `@hestia/*`, env vars `HESTIA_*`) | Complete architectural consistency across monorepo and operations | Pending — v2.0 |
| Abstract `README.md` into dedicated `docs/` runbooks | Keeps main landing clean for new developers while preserving in-depth runbooks | Pending — v2.0 |
| Archive v1.0 phases into `.planning/milestones/v1.0/` | Clears clutter from active planning directory while preserving audit trail | Pending — v2.0 |

---
*Last updated: 2026-10-25 starting v2.0 milestone cycle*
