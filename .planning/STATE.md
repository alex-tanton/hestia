---
gsd_state_version: "1.0"
milestone: v2.1
milestone_name: Grocery & Deals Intelligence
current_phase: 12
current_phase_name: Store & Deal Image Delivery
status: planning
stopped_at: Phase 12 UI-SPEC approved
last_updated: "2026-11-09T14:25:07.210Z"
last_activity: 2026-11-08
last_activity_desc: Milestone v2.1 roadmap created (5 phases)
state_head: e7ec2cd07f407e74fa5e6d844fef36b643a19aae
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
current_milestone: v2.1
---

# Project State

## Project Reference

See: [.planning/PROJECT.md](file:///c:/Users/actanton/Development/Aberrance/hestia/.planning/PROJECT.md) (updated 2026-11-08)

**Core value:** Overhaul the grocery and deals experience with reliable image delivery, intelligent pricing & discount computation, high-performance deal syncing, barcode scanning for grocery list management, flexible meal planning with standalone items, and robust real-world test coverage.
**Current focus:** Milestone v2.1 — Phase 12: Store & Deal Image Delivery

## Current Position

Phase: Phase 12 — Store & Deal Image Delivery
Plan: —
Status: Ready to plan Phase 12
Last activity: 2026-11-08 — Milestone v2.1 roadmap created (5 phases)

## Milestone Roadmap

- [ ] **Phase 12: Store & Deal Image Delivery** - Unblock modern Flipp CDNs and Open Food Facts images across Caddy CSP, Service Worker, and PWA components
- [ ] **Phase 13: Deal Pricing Engine & Ingestion Performance** - Display prominent sale prices, % off badges, and original prices while eliminating 15+ minute deal sync delays
- [ ] **Phase 14: Barcode Scanning & Grocery List Integration** - Camera-based scanner with Open Food Facts lookup to add and mark items bought in grocery lists
- [ ] **Phase 15: Flexible Meal Planning (Custom Items & Recipes)** - Support standalone food items (banana, yogurt) directly on the meal planner alongside recipes
- [ ] **Phase 16: Verification & Real-World Test Hardening** - Comprehensive unit, integration, and Playwright E2E verification of real-world grocery workflows

## Next Action

Run `/gsd-discuss-phase 12` or `/gsd-plan-phase 12` to start execution.

## Session

**Last session:** 2026-11-09T14:25:07.172Z
**Stopped at:** Phase 12 UI-SPEC approved
**Resume file:** .planning/phases/12-store-deal-image-delivery/12-UI-SPEC.md

## Quick Tasks Completed

| Slug | Date | Description | Status |
|------|------|-------------|--------|
| 20261102-prune-project | 2026-11-02 | Prune temporary files, non-core docs, obsolete planning files, redundant tests, and simplify configurations | complete ✓ |
| 261105-ghg-research-the-current-state-of-configurat | 2026-11-05 | Research configuration sprawl and duplicate definitions; propose single-source-of-truth configuration architecture | complete ✓ |

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
| Phase 09 P01 | 12 min | 3 tasks | 9 files |
| Phase 09 P02 | 5 min | 2 tasks | 7 files |
| Phase 09 P03 | 5 min | 2 tasks | 10 files |
| Phase 09 P04 | 14 min | 3 tasks | 10 files |
| Phase 09 P05 | 38 min | 3 tasks | 5 files |

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
- [Phase 09]: 09-01: the hestia network pins only its subnet (no gateway); the first deploy recreates the network, handled by 09-02 and the 09-04 runbook
- [Phase 09]: 09-01: member-removal E2E journey renumbered to 21 so it stays last; spec 20 is the ingress client-IP and CSP spec
- [Phase 09]: 09-01: commits use scope docker or service because commitlint's scope list is closed; Supabase images pulled by identical digest from Docker Hub when ECR hit its data limit in the sandbox
- [Phase 09]: 09-02: deploy.sh prepares the whole project (up --no-start --no-recreate --no-build with HESTIA_TAG) before the subset start so the hestia network recreate completes; health gate runs wget inside the caddy container; cloudflared is in the fail-early start
- [Phase 09]: 09-02: caddy-entrypoint.sh exits 1 on an unset or empty HESTIA_TRUSTED_PROXIES and names https://hestia.aberrance.app; commit scope docker for Compose, deploy and entrypoint work
- [Phase 09]: 09-03: test fixtures swept to https://hestia.aberrance.app by literal-only replacement; env.ts changed by one comment line, HESTIA_ORIGIN still required with no default
- [Phase 09]: 09-04: first-deploy network recreate documented in docs/deployment.md and checklist step 7; only four requirement/roadmap lines reworded (D-05, D-06, D-09)
- [Phase 09]: Hygiene check 5: legacy-name machinery generalised into a TERM_RULES table; retired-ingress allowlist is three entries and one pinned quote (funnel through here in the recurrence comment)

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| verification_gaps | 08/08-VERIFICATION.md | human_needed | 2026-11-02 | v2.0 |

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
