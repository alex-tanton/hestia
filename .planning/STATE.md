---
gsd_state_version: "1.0"
milestone: v2.0
milestone_name: Hestia — Domain Migration and Rebrand
current_phase: 9
current_phase_name: Domain & Network Migration (Cloudflare Tunnel & Ingress)
current_plan: 7
status: ready_to_plan
stopped_at: Phase 9 context gathered
last_updated: "2026-10-26T13:40:35.474Z"
last_activity: 2026-10-26
last_activity_desc: Phase 08 execution started
state_head: 85afdbe6c4f5ce527ebbf90a08ffd12c3cd09ec3
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 11
  completed_plans: 11
  percent: 40
current_milestone: v2.0
---

# Project State

## Project Reference

See: [.planning/PROJECT.md](file:///c:/Users/actanton/Development/Aberrance/hearth/.planning/PROJECT.md) (updated 2026-10-25)

**Core value:** The application is securely reachable at `https://hestia.aberrance.app` with zero open router ports via Cloudflare Tunnel, features friction-free passwordless magic link authentication, delivers reliable mobile Web Push notifications, operates under the unified Hestia brand, and provides clean, structured documentation for developers and operators.
**Current focus:** Phase 08 — Full Rebrand to Hestia

## Current Position

Milestone: v2.0 (Hestia Domain Migration and Rebrand) — ACTIVE
Phase: 9 (Domain & Network Migration)
Current Plan: 7
Total Plans in Phase: 7
Phases: 2 of 5 complete (Phases 7–11)
Status: Phase 8 complete (owner override); Phase 9 ready to plan
Last activity: 2026-10-26 — Phase 08 execution started

Progress: [████░░░░░░] 40% of milestone plans

## Milestone Roadmap

- [ ] **Phase 7: Planning Cleanup & Documentation Restructure** - Archive v1.0 bloat, rewrite `README.md`, extract guides to `docs/`
- [x] **Phase 8: Full Rebrand to Hestia** - Web UI, manifest, CLI, packages (`@hestia/*`), env (`HESTIA_*`)
- [ ] **Phase 9: Domain & Network Migration (Cloudflare Tunnel & Ingress)** - Decommission Tailscale, add Cloudflare Tunnel, Caddy `CF-Connecting-IP`, origin `hestia.aberrance.app`
- [ ] **Phase 10: Magic Links & Transactional Email** - Build flag, screens, GoTrue SMTP for Resend/Postmark, E2E tests
- [ ] **Phase 11: Web Push & Edge Hardening** - VAPID `mailto:admin@aberrance.app`, iOS/Android PWA push verification, Cloudflare Edge caching, quality ratchet

## Next Action

Plan Phase 9 with /gsd-plan-phase 9.

## Session

**Last session:** 2026-10-26T13:40:35.380Z
**Stopped at:** Phase 9 context gathered
**Resume file:** .planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-CONTEXT.md

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 07 P01 | 7min | 3 tasks | 289 files |
| Phase 07 P02 | 9min | 3 tasks | 7 files |
| Phase 07 P03 | 8min | 3 tasks | 4 files |
| Phase 07 P04 | 8 min | 2 tasks | 3 files |
| Phase 08 P01 | 15 min | 2 tasks | 32 files |
| Phase 08 P02 | 7 min | 2 tasks | 216 files |
| Phase 08 P03 | 7 min | 2 tasks | 73 files |
| Phase 08 P04 | 7 min | 3 tasks | 41 files |
| Phase 08 P05 | 8 min | 1 tasks | 52 files |
| Phase 08 P06 | 10 min | 2 tasks | 7 files |
| Phase 08 P07 | 24 min | 3 tasks | 5 files |

## Decisions

- [Phase 07]: 07-01: all 47 v1.0 raw outputs kept under the D-04 evidence rule (cited by tracked planning files; patches not regenerable in this clone), zero deletions
- [Phase 07]: 07-02: DOC-02 left open in REQUIREMENTS.md; this plan delivers only the docs/deployment.md part, development.md and testing.md merge and README links follow in 07-03 and 07-04
- [Phase 07]: 07-03: DOC-02 left open; development.md, the testing.md E2E merge and CONTRIBUTING links are done, the README cut and its links follow in 07-04
- [Phase 07]: README keeps intro, Prerequisites and Layout verbatim and links every docs file; Prerequisites heading kept for docs/development.md anchor
- [Phase 08]: 08-01: the login role is renamed by editing the two applied migrations in place; scripts/migration-exemptions.json pins each edit to the exact base and head blobs so the append-only gate admits only those edits and expires on its own once they are on main
- [Phase 08]: 08-01: exemption entry paths must be flat .sql names under supabase/migrations/ and reasons single-line, stricter than the plan contract, to keep entry data from reaching git or the CI log unvalidated
- [Phase 08]: 08-02: the phase docs-claims checker copy finds the root workspace by directory and its allowlist keeps both old and new product names allowed; the 08-07 legacy-name guard rejects old names in docs
- [Phase 08]: 08-03: hard cutover to HESTIA_*; no fallback read of any pre-rebrand name anywhere (D-01)
- [Phase 08]: 08-03: Compose project/network hestia, service hestia-service, runner label hestia; /srv/hestia host path
- [Phase 08]: 08-04: no alias for the old CLI name and no migration of the old IndexedDB key or notification message type (D-07, D-08); manifest description, start_url, icons unchanged (D-10)
- [Phase 08]: The outbound User-Agent and the OpenAPI title follow the product name; the dev seed, reset and test database passwords moved with their readers in one commit (08-05)
- [Phase 08]: The live-file sweep leaves .planning/, the lockfile, the exemptions file and supabase/migrations untouched, so the former name remains there until 08-06 and 08-07 (08-05)
- [Phase 08]: BRAND-02 text aligned with D-10: manifest and meta descriptions name no brand and stay as they are (orchestrator choice, owner-visible in 08-OWNER-CHECKLIST.md, overrule by changing both descriptions and restoring the requirement clause) — D-10 locks only name and short_name; the owner was unavailable
- [Phase 08]: Guard allowlist prefixes .planning/phases/ and .planning/research/ are the planner's reading of D-13, recorded as an owner-visible choice in 08-OWNER-CHECKLIST.md — D-13 lists only the v1.0 archive; overrule by dropping a prefix from LEGACY_NAME_ALLOWLIST
- [Phase 08]: CLI requirement is a clean break (no alias or shim, D-07) and the environment requirement is a hard cutover with no fallback reads (D-01, D-02); cloud-session probe targets alex-tanton/hestia and fails until the repository is renamed after merge — Requirement text must describe what 08-03 and 08-04 delivered
- [Phase 08]: 08-07: the former product name is blocked in CI by check 4 of the existing hygiene script; six allowlisted paths, and the four planning state files allow only twelve exact quotes, so anything else there must say the former name
- [Phase 08]: 08-07: every CI check, test:integration, the service coverage run and all 104 Playwright tests pass on the renamed stack; the browser look at the tab title, manifest and install step is left to the owner
