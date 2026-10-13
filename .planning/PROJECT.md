# Hearth — Cleanup and Hardening

## What This Is

Hearth is a household-management PWA (shopping lists, chores, bills, meals/recipes, deals, notifications) for a single household, built as a React + Vite PWA and a Fastify service over Postgres/Supabase with RLS as the isolation boundary. The application was built largely with an LLM. This milestone is a cleanup pass: remove dead code, generated and leftover files, and redundancy, and make the repo, CI, and code healthier and more robust before the owner does a manual review.

## Core Value

The owner can start a manual review from a lean, trustworthy base: no dead code or stray generated files, a CI suite that passes repeatably regardless of day or timezone, and the known bugs fixed with regression tests.

## Requirements

### Validated

<!-- Inferred from the existing codebase (.planning/codebase/). -->

- ✓ Authenticated household app with RLS-enforced tenant isolation (service runs each request in a Postgres transaction as `authenticated`) — existing
- ✓ Feature pillars: shopping lists with realtime and offline write queue, chores with rotation, bills with recurrence and autopay, meals/recipes import and matching, Flipp-backed deals, push notifications — existing
- ✓ Installable offline-capable PWA with service worker and persisted query cache — existing
- ✓ Privileged `service_role` access fenced in `apps/service/src/privileged/` with an ESLint restriction — existing
- ✓ In-process cron jobs guarded by Postgres advisory locks — existing
- ✓ Docker Compose single-host deployment with Caddy gateway, GoTrue, Realtime, Kong, backups, and a CI-gated deploy workflow — existing
- ✓ Unit, component, service integration, and Playwright E2E test suites with a coverage threshold — existing

### Active

- [ ] Dead code, unused exports, unused dependencies, and stale references are identified by tooling or tests and removed; uncertain candidates are listed for the owner rather than deleted
- [ ] Committed generated files and LLM-leftover artifacts are removed or git-ignored, and docs match the code
- [ ] Redundancy and duplication in code, fixtures, scripts, and CI config are reduced
- [ ] Date- and timezone-dependent unit, component, and E2E tests are made deterministic so the suite passes on any weekday and household timezone
- [ ] CI is robust: dead-code and dependency checks are enforced, flakiness sources are removed, and the pipeline is reviewed for correctness
- [ ] Known bug fixed: offline list write replay can create duplicate items after a lost response, with a regression test
- [ ] Other known bugs and robustness gaps in the codebase concerns map are fixed, each with a regression test (accessibility suppression in `RotationEditor`, PATCH schema rule for shared contracts, service-role key scope enforcement, Kong/Caddy GoTrue path coverage, deploy-script password exposure)
- [ ] Behavior of the application is otherwise unchanged and the full test suite stays green
- [ ] Clean git history is published: the ~55 existing local commits are curated (rebased/squashed/reworded as needed) onto the remote's initial commit and pushed to `origin` (GitHub) before cleanup work lands
- [ ] Cleanup work is developed on local branches or worktrees, with PRs opened for major functionality and only minor/mechanical changes pushed directly to `main`

### Out of Scope

- New product features — this milestone is cleanup and hardening only
- Off-host backup infrastructure and scheduled restore tests — requires infrastructure decisions outside the repo
- Replacing the unofficial Flipp deal source — tracked as a dependency risk, not cleanup
- Scaling beyond a single host (shared rate limiter, shared job lock) — not needed at household scale
- Aggressive deletion of code that tooling cannot prove unused — listed for owner review instead

## Context

- Brownfield: codebase mapped on 2026-10-11 in `.planning/codebase/` (STACK, ARCHITECTURE, CONCERNS, CONVENTIONS, TESTING, STRUCTURE, INTEGRATIONS).
- pnpm workspace (TypeScript 6, Node 24): `apps/service`, `apps/web`, `packages/{shared,matching,recurrence}`, `e2e`, `supabase/seed`.
- Recent commits fixed a PATCH default-reset bug, an E2E weekday flake, and dependency vulnerabilities; the remaining `braces` transitive advisory has no upstream patch.
- The owner has not yet manually reviewed the LLM-generated code; this cleanup precedes that review.
- Concerns already catalogued in `.planning/codebase/CONCERNS.md` (date-dependent tests, offline replay duplicates, large test files, security considerations) seed the Active list.

## Constraints

- **Behavior**: Existing application behavior must not change except where fixing a documented bug — cleanup must be safe
- **Evidence**: Dead-code removal requires tooling or test proof; ambiguous cases are reported, not deleted
- **Verification**: Every bug fix ships with a regression test; full suite and CI must remain green
- **Tech stack**: Existing stack (pnpm, TypeScript, Fastify, React/Vite, Postgres/Supabase, Playwright) — no framework migrations
- **Git**: `main` is curated and published (Phase 1, `origin/main` from d3da748), and every push to it runs CI and a deploy (only `docs/` is exempt). Work on branches or worktrees and land changes through pull requests per `CONTRIBUTING.md`; never force-push or rewrite published history without the owner's approval
- **Docs**: Specs in `docs/` are the only source of truth; no review, decision-log, or ADR files are added there

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scope includes known bug fixes, not only behavior-preserving cleanup | Owner wants bugs resolved before manual review | — Pending |
| Remove only proven-dead code; list uncertain candidates | Dynamic imports and Docker/Supabase config defeat static analysis | — Pending |
| Curate history first, then push; PRs for major functionality, direct-to-main for minor changes | Owner wants a clean public history and reviewable PRs | — Pending |
| Defer off-host backups and scaling work | Infrastructure outside repo, not cleanup | — Pending |

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
*Last updated: 2026-10-11 after initialization*
