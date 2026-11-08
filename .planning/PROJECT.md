# Hestia — Household Management PWA

## What This Is

Hestia is a self-hosted household-management PWA (grocery deals, shopping lists, meals/recipes, bills, chores, and notifications) for a single household, built as a React + Vite PWA and a Fastify service over Postgres/Supabase with RLS as the tenant isolation boundary.

## Current State

**Shipped Milestones:**
- **v1.0 — Cleanup and Hardening (2026-10-25):** 6 phases, 60 plans, 40 requirements. Test determinism, bare-clock ban, Knip baseline, bug fixes, CI ratchets.
- **v2.0 — Hestia Domain Migration and Rebrand (2026-11-02):** 5 phases, 23 plans, 21 requirements. Custom domain `hestia.aberrance.app` via Cloudflare Tunnel, full Hestia rebrand, GoTrue magic link authentication, RFC 8292 Web Push VAPID, edge caching & WAF rate limits, documentation modularization in `docs/`.

## Current Milestone: v2.1 Grocery & Deals Intelligence

**Goal:** Overhaul the grocery and deals experience with reliable image delivery, intelligent pricing & discount computation, high-performance deal syncing, barcode scanning for grocery list management, flexible meal planning with standalone items, and robust real-world test coverage.

**Target features:**
- Fix missing store and item images by updating CSP and image origin allowlists across Caddy, PWA service worker, and web components.
- Derive and display original price (secondary) and percent-off discount badge alongside primary sale price, computing discounts from sale stories when needed.
- Accelerate deal ingestion and refresh performance to eliminate 15+ minute stalls for new accounts and active postal codes.
- Implement camera-based barcode scanning (with manual entry fallback) and Open Food Facts lookup to add items to grocery lists.
- Enable barcode scanning to automatically match and mark list items as purchased (`bought`).
- Support first-class standalone items (e.g. banana, yogurt) on the meal planner without requiring a recipe.
- Improve unit, integration, and Playwright E2E test coverage with real-world grocery and deal scenarios.

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

### Validated (v2.0)

- ✓ **CLEAN-01**: Archive v1.0 phases and cleanup ledgers to `.planning/milestones/v1.0/` — Phase 7
- ✓ **DOC-01**: Restructure `README.md` into clean overview — Phase 7
- ✓ **DOC-02**: Create `docs/development.md`, `docs/deployment.md`, and `docs/testing.md` — Phase 7
- ✓ **BRAND-01**: Rebrand user-facing PWA app name to "Hestia" — Phase 8
- ✓ **BRAND-02**: Update PWA manifest with `name: "Hestia"` and `short_name: "Hestia"` — Phase 8
- ✓ **BRAND-03**: Rename service CLI from `hearth-admin` to `hestia-admin` — Phase 8
- ✓ **BRAND-04**: Migrate workspace packages to `@hestia/*` namespace — Phase 8
- ✓ **BRAND-05**: Transition environment and Docker variables from `HEARTH_*` to `HESTIA_*` — Phase 8
- ✓ **BRAND-06**: Update test suites to pass under Hestia brand — Phase 8
- ✓ **NET-01**: Decommission Tailscale Funnel dependencies, CLI instructions, and host proxy — Phase 9
- ✓ **NET-02**: Cloudflare Tunnel (`cloudflared`) in Docker Compose with zero host ports — Phase 9
- ✓ **NET-03**: Caddy trusts Compose subnet and extracts IP from `CF-Connecting-IP` — Phase 9
- ✓ **NET-04**: CSP, CORS, and cookie security policies updated for `hestia.aberrance.app` — Phase 9
- ✓ **NET-05**: Set base origin and site URL configurations to `https://hestia.aberrance.app` — Phase 9
- ✓ **AUTH-01**: Enable `VITE_MAGIC_LINK_ENABLED=true` and `HESTIA_MAGIC_LINK_ENABLED=true` in build arguments and runtime environment — Phase 10
- ✓ **AUTH-02**: Activate and verify magic link routes (`/sign-in/link`, `/sign-in/code`) and screens in the web PWA — Phase 10
- ✓ **AUTH-03**: Configure GoTrue SMTP settings (`GOTRUE_SMTP_*`) supporting Resend/Postmark with custom sender name ("Hestia") and address (`auth@aberrance.app` or `hestia@aberrance.app`) — Phase 10
- ✓ **AUTH-04**: Update GoTrue site URL and URI allow-list to `https://hestia.aberrance.app` and `https://hestia.aberrance.app/**` — Phase 10
- ✓ **AUTH-05**: Replace `07-magic-link-disabled.spec.ts` with Playwright E2E tests validating active magic link request and code entry flows — Phase 10
- ✓ **PUSH-01**: Update Web Push VAPID configuration in `apps/service` to use `mailto:admin@aberrance.app` as RFC 8292 subject — Phase 11
- ✓ **PUSH-02**: Verify standalone PWA push subscription and notification dispatch over HTTPS for iOS and Android devices — Phase 11
- ✓ **EDGE-01**: Document Cloudflare Edge caching rules for immutable Vite assets (`/assets/*`) and WAF rate limiting for `/auth/v1/*` — Phase 11
- ✓ **VERIFY-01**: Full test suite sweep, build validation, Knip, and CI verification green across all packages — Phase 11

### Active

- [ ] **IMG-01**: Fix missing store and item images across Caddy CSP, PWA service worker, and web components for modern Flipp CDNs.
- [ ] **PRICE-01**: Derive and display original price (secondary) and percent-off discount badge alongside primary sale price, computing discounts from sale stories when needed.
- [ ] **PERF-01**: Accelerate deal ingestion and refresh performance to eliminate 15+ minute stalls for new accounts and active postal codes.
- [ ] **SCAN-01**: Camera-based barcode scanner in PWA (with manual entry fallback) and Open Food Facts lookup to add items to grocery list.
- [ ] **SCAN-02**: Barcode scanning to automatically match and mark list items as purchased (`bought`).
- [ ] **MEAL-01**: First-class custom standalone items on meal planner without requiring a recipe.
- [ ] **TEST-01**: Comprehensive unit, integration, and E2E test coverage for grocery, deal, and meal features.

### Out of Scope

- Multi-tenant household segregation outside existing RLS schema (remains single household or small family circle).
- Rewriting database migration history (migrations remain append-only).
- Replacing Fastify/Vite/Postgres core tech stack.
- Complex federated OAuth providers (retaining email/password + magic link auth).

## Context

- Brownfield codebase with 11 completed and archived phases across v1.0 and v2.0.
- Shipped v2.0 with ~81,600 LOC TypeScript across monorepo.
- Custom domain `hestia.aberrance.app` active under Cloudflare Tunnel.
- pnpm workspace (TypeScript 6, Node 24).

## Constraints

- **No open router ports**: Host server must not require opening ports 80/443 directly to the public internet; Cloudflare Tunnel handles ingress.
- **Zero test regressions**: All existing unit, integration, and E2E tests must remain green after package and brand renaming.
- **Documentation integrity**: Do not discard operational knowledge when simplifying `README.md`; preserve it in dedicated `docs/` files.
- **Append-only migrations**: Any schema or seed updates must be forward-only.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rename app to Hestia without verbose philosophical justification | Goddess of the Hearth fits household management; keep documentation clean and direct | Validated — Phase 8 |
| Use Cloudflare Tunnel (`cloudflared`) instead of port forwarding or Tailscale Funnel | Zero exposed host ports, automatic edge SSL, and native Cloudflare DNS integration | Validated — Phase 9 |
| Enable GoTrue Magic Links via Resend / Postmark SMTP | Seamless passwordless sign-in with verified deliverability on custom domain | Validated — Phase 10 |
| Update VAPID subject to `mailto:admin@aberrance.app` | RFC 8292 compliance required by Apple and Mozilla push endpoints | Validated — Phase 11 |
| Full rebrand (PWA, CLI, package scopes `@hestia/*`, env vars `HESTIA_*`) | Complete architectural consistency across monorepo and operations | Validated — Phase 8 |
| Abstract `README.md` into dedicated `docs/` runbooks | Keeps main landing clean for new developers while preserving in-depth runbooks | Validated — Phase 7 |
| Archive v1.0 phases into `.planning/milestones/v1.0/` | Clears clutter from active planning directory while preserving audit trail | Validated — Phase 7 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-08 for milestone v2.1*
