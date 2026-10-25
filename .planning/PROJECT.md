# Hearth — Household Management PWA

## What This Is

Hearth is a household-management PWA (shopping lists, chores, bills, meals/recipes, deals, notifications) for a single household, built as a React + Vite PWA and a Fastify service over Postgres/Supabase with RLS as the isolation boundary.

## Current State

**Shipped Milestone:** v1.0 — Cleanup and Hardening (2026-10-25)
- Lean, trustworthy base for manual review: clean published git history, deterministic test suite (36-cell date and timezone sweep), bare-clock lint ban, proven-dead code removed with Knip baseline.
- Known bugs fixed with regression tests: offline list-add replay duplicates, `RotationEditor` keyboard accessibility, PATCH schema default injection, scoped `service_role` and GoTrue route fencing.
- Redundancy reduced: composite CI setup action, consolidated web/service test fixtures, retired spec citations removed.
- Blocking CI enforcement ratchet: Knip baseline (0 default findings), JSCPD duplication (<2%), repo hygiene (modes, line endings, tracked-ignored), migration append-only, and zero intermittent CI failures (`CI-08`).
- 40 requirements verified complete; 100% UAT pass across 32 tests.

## Core Value

The owner can start a manual review from a lean, trustworthy base: no dead code or stray generated files, a CI suite that passes repeatably regardless of day or timezone, and the known bugs fixed with regression tests.

## Requirements

### Validated

- ✓ Authenticated household app with RLS-enforced tenant isolation (service runs each request in a Postgres transaction as `authenticated`) — existing
- ✓ Feature pillars: shopping lists with realtime and offline write queue, chores with rotation, bills with recurrence and autopay, meals/recipes import and matching, Flipp-backed deals, push notifications — existing
- ✓ Installable offline-capable PWA with service worker and persisted query cache — existing
- ✓ Privileged `service_role` access fenced in `apps/service/src/privileged/` with an ESLint restriction — existing & Phase 4
- ✓ In-process cron jobs guarded by Postgres advisory locks — existing
- ✓ Docker Compose single-host deployment with Caddy gateway, GoTrue, Realtime, Kong, backups, and a CI-gated deploy workflow — existing & Phase 4/6
- ✓ Unit, component, service integration, and Playwright E2E test suites with coverage thresholds — existing & Phase 2/6
- ✓ Date- and timezone-dependent unit, component, and E2E tests are deterministic: one clock pin and zone hook, a 36-cell weekday-and-zone sweep, a lint ban on bare clock reads, and a household-zone bills regression guard — v1.0 (Phase 2 & 6)
- ✓ Dead-code and duplication tooling is calibrated and enforced (knip 6.41.0, jscpd 5.4.1) — v1.0 (Phase 2, 3, 6)
- ✓ Clean git history and branch policy published to origin — v1.0 (Phase 1)
- ✓ Offline replay duplication bug, RotationEditor keyboard accessibility, and PATCH default-injection fixed behind regression tests — v1.0 (Phase 4)
- ✓ Composite setup action, consolidated fixtures, and docs synchronized with code — v1.0 (Phase 5)
- ✓ Blocking CI ratchet (hygiene, Knip, JSCPD, audit, migration append-only, deploy gate) with zero flaky tests — v1.0 (Phase 6)

### Active

*No active requirements.* All v1.0 requirements completed. New requirements will be defined for the next milestone.

### Next Milestone Goals

- Manual review of the codebase by the owner.
- Prioritize backlog/v2 candidates:
  - Splitting large integration test files by domain (`TEST-01`)
  - DST-boundary test cases in `packages/recurrence` (`TEST-02`)
  - Production-level per-IP rate limiting end-to-end (`TEST-03`)
  - CSP `style-src 'unsafe-inline'` review/replacement (`SEC-01`)
  - Action SHA pinning and workflow linting (`CIX-01`)
  - Weekend E2E execution confirmation (`TIME-03`)

### Out of Scope

- New product features — v1.0 was cleanup and hardening only
- Off-host backup infrastructure and scheduled restore tests — requires infrastructure decisions outside the repo
- Replacing the unofficial Flipp deal source — tracked as a dependency risk, not cleanup
- Scaling beyond a single host (shared rate limiter, shared job lock) — not needed at household scale
- Aggressive deletion of code that tooling cannot prove unused — listed for owner review instead

## Context

- Brownfield: codebase mapped on 2026-10-11 in `.planning/codebase/`.
- pnpm workspace (TypeScript 6, Node 24): `apps/service`, `apps/web`, `packages/{shared,matching,recurrence}`, `e2e`, `supabase/seed`.
- The v1.0 cleanup precedes the owner's manual review.

## Constraints

- **Behavior**: Existing application behavior must not change except where fixing a documented bug.
- **Evidence**: Dead-code removal requires tooling or test proof; ambiguous cases are reported, not deleted.
- **Verification**: Every bug fix ships with a regression test; full suite and CI must remain green.
- **Tech stack**: Existing stack (pnpm, TypeScript, Fastify, React/Vite, Postgres/Supabase, Playwright).
- **Git**: `main` is curated and published. Work on branches or worktrees and land changes through pull requests per `CONTRIBUTING.md`; never force-push published history.
- **Docs**: Specs in `docs/` are the only source of truth; no review, decision-log, or ADR files are added there.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scope includes known bug fixes, not only behavior-preserving cleanup | Owner wants bugs resolved before manual review | ✓ Good — v1.0 |
| Remove only proven-dead code; list uncertain candidates | Dynamic imports and Docker/Supabase config defeat static analysis | ✓ Good — v1.0 |
| Curate history first, then push; PRs for major functionality, direct-to-main for minor changes | Owner wants a clean public history and reviewable PRs | ✓ Good — v1.0 |
| Defer off-host backups and scaling work | Infrastructure outside repo, not cleanup | ✓ Good — v1.0 |
| Pin `Date` with a subclass-safe replacement, not `vi.setSystemTime` | `vi.setSystemTime` breaks `@date-fns/tz` in negative-offset zones | ✓ Good — v1.0 |
| Phase 5 compares duplication against the test-inclusive jscpd baseline (96 clones, 1.87%) | The source-only scan leaves out test fixtures | ✓ Good — v1.0 |
| Defer the weekend E2E run that would confirm TIME-03 | No scheduled run exercises it; waiting for a weekend would take days | ✓ Good — v1.0 |
| Unused exports in internal packages are removable when nothing imports them | Packages are internal to the workspace | ✓ Good — v1.0 |
| Deploy gate skips redeploying the commit already running on CI push | Prevents redundant redeployments while keeping deliberate re-run on Deploy | ✓ Good — v1.0 |
| Fix flaky CI tests at root cause without retries or weakened assertions | Ensures true CI reliability without masking defects | ✓ Good — v1.0 |

---
*Last updated: 2026-10-25 after v1.0 milestone archive*
