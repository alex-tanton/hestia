# Milestones

## v2.0 Hestia — Domain Migration and Rebrand (Shipped: 2026-11-02)

**Phases completed:** 5 phases, 23 plans, 39 tasks
**Closeout type:** Override closeout (Phase 8 manual browser check accepted as owner override)
**Known verification overrides:** 1 newly acknowledged, 0 carried forward from a prior close (see STATE.md Deferred Items)

**Key accomplishments:**
- All v1.0 phases, ledgers and quick tasks now live under `.planning/milestones/v1.0/` via one rename-only commit (280 files, all R100), the stale `.planning/codebase/` maps are deleted, and an archive index classifies every raw output and lists the owner review items.
- `docs/deploy.md` is now `docs/deployment.md` with its history, holding every README deployment, backup and restore fact (148 facts, 111 README clauses, 0 missing) plus a Compose services table, and `07-doc-checks.mjs` can prove that again at the end of the phase.
- `docs/development.md` now holds the README's development material and CONTRIBUTING's script and pre-push steps, the README's one README-only E2E fact (`ready at …`) is in `docs/testing.md`, and CONTRIBUTING.md is policy plus links, proven by 247 facts and 196 covered clauses with none missing.
- README.md is now a 70-line landing page (overview, prerequisites, quickstart, architecture with the Layout table, nine-row documentation index), and the three fact maps plus a clause-level coverage pass over all 313 original lines show nothing the old README held was lost.
- The service login role is now `hestia_service` end to end, proven on a fresh Supabase database, and the append-only migration gate admits exactly the two in-place migration edits through blob-pinned entries that expire on their own.
- The PWA, its built manifest and title say Hestia (with a build check that fails on anything else, proven by mutation), the owner CLI is `hestia-admin` with no alias, and the persisted cache key and notification-click message type are `hestia-query-cache` and `hestia:notification-click` with no migration code.
- One catch-all substitution moved the last 93 old-name lines in 52 live files to Hestia (User-Agent, OpenAPI title, dev passwords with their readers, test origins and scaffolding, clock symbols, every doc sentence), leaving zero residual outside `.planning/` with typecheck, lint, format and every unit and harness test green.
- The requirement, project and roadmap text now says what the rebrand delivers (brand-free manifest description left alone, a clean CLI break, seven packages, a hard environment cutover), the cloud-session tooling follows the new name, and a 17-step owner checklist carries the PR body notes and the two owner-visible choices.
- The hygiene gate now fails on any reintroduced former product name in a tracked file, a tracked path, or a planning state line outside twelve pinned quotes, and every CI check, the integration suites and all 104 Playwright tests pass on the renamed stack.
- Caddy now identifies the client from Cloudflare's `CF-Connecting-IP` only, trusted only from the Compose subnet, behind a pinned `cloudflared` service with a required token and no published host port, proven on the real E2E stack (3 passed).
- deploy.sh now prepares the whole Compose project before its subset start so the first deploy's network recreate completes, gates health from inside the caddy container with no host port, and starts cloudflared with the supporting services; Caddy's entrypoint refuses an empty trust list and names the real origin.
- All ten test and source files that built or asserted links on made-up hosts under the retired private network now use `https://hestia.aberrance.app`, by a literal-only sweep (25 lines changed, `env.ts` comment included) with identical test counts.
- `docs/deployment.md` now takes an owner from nothing to `https://hestia.aberrance.app` through a Cloudflare Tunnel (including what the first deploy's network recreate prints and how to recover), a phase owner checklist orders every outside step the merge depends on, the other guides and CLAUDE.md match the new stack with derived counts, and NET-03/NET-04 state what D-05, D-06 and D-09 deliver.
- The hygiene gate now fails CI if the retired ingress returns to any tracked file, path or use of the word beyond one pinned recurrence comment, and the whole tree passes every CI check, the integration suite and all 107 Playwright tests on the tunnel-ready stack.

---
