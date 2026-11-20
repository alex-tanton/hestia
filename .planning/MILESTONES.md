# Milestones

## v3.0 Material Design 3 Overhaul (Shipped: 2026-11-20)

**Phases completed:** 5 phases, 31 plans, 41 tasks
**Closeout type:** Override closeout (Phase 17 unverified report / UAT gap accepted as owner override)
**Known verification overrides:** 1 newly acknowledged, 0 carried forward from a prior close (see STATE.md Deferred Items)

### Known Gaps
- Phase 17: Formal verification report was not generated (`17-VERIFICATION.md` missing). Requirements FND-01, FND-02, and FND-03 carried forward as unverified in formal traceability chain; automated verification in `17-UAT.md` (25/25 tests) passed.

**Key accomplishments:**
- ESLint `@material/web`/`lit`/`@lit` boundary and `jsx-a11y` rules preserving test clock checks, forced `element-internals-polyfill` + jsdom shims, DRY `md-queries.ts`, zero-cast `omitUndefined`, and `@lit/react` adapters for text fields, buttons, selects, and checkboxes.
- Completed the remaining six `@material/web@2.5.0` `@lit/react@1.0.8` adapters (`MdSwitch`, `MdRadio`, `MdDialog`, `MdMenu`, `MdTabs`, `MdProgress`) and verified all five `D-13` smoke checks in `jsdom@30.1.0` without escalating to `@vitest/browser-playwright`.
- Established Hestia's Material Symbols Rounded inline SVG registry (`Icon.tsx` + `icon-paths.ts`) from Google's official `google/material-design-icons` repository (`10ecc14790612ca8fd164e3f4ffe9c16fc50d5b7`) with zero third-party icon packages, zero WOFF2 font weight, and zero raw HTML injection.
- Upgraded `Button`, `TextField`, `TextAreaField`, and `Select` onto `components/md/` adapters with 56px native `DateField`/`TimeField` framing, widened `HTMLElement` refs in form callers, and zero `as` casts.
- Added `Switch`, upgraded `Checkbox`, `ConfirmDialog`, `OverflowMenu`, and `Tabs` onto `@material/web` adapters via `components/md/`, migrated `NotificationTypeRows`, and updated shadow-DOM initial focus selectors in 3 screens with zero `as` casts.
- Replaced Radix Dialog and Radix Toast with native top-layer `<dialog>.showModal()` (`ModalBottomSheet` + `gap-primitives.css`) and a single-slot FIFO `Snackbar` queue with persistent `Undo`/error semantics, updating `primitives.test.tsx`, `Toast.test.tsx`, and `chores.test.tsx` for MD3 Shadow DOM and `D-11`.
- Upgraded all 7 remaining light-DOM `components/ui/` primitives (`Card`, `ListRow`, `Badge`, `SegmentedControl`, `Skeleton`, `FormMessage`, `CopyButton`) onto Warm Terracotta MD3 tonal tokens and `Icon.tsx`, eliminating all `lucide-react` and `radix-ui` imports from `apps/web/src/components/ui/` and verifying all 7 in `primitives.test.tsx`.
- Updated `browser.ts` `openMenu` onto `md-queries.ts` `findMdButton` with inner shadow button focus, and synchronized all 5 core infrastructure test suites (62/62 tests passing) onto MD3 Shadow DOM host queries with zero fake ARIA roles.
- Synchronized all 7 Settings, Onboarding, and Dashboard-route test suites (128/128 tests passing) onto `apps/web/src/test/md-queries.ts` Shadow DOM queries with zero production screen modifications.
- Synchronized all 8 Lists and Bills test suites (81/81 tests passing across 4 Lists suites and 4 Bills suites) onto `apps/web/src/test/md-queries.ts` Shadow DOM queries with zero production screen modifications.
- Synchronized all 9 Chores, Errands, and Deals test suites (91/91 tests passing across 5 Chores/Errands suites and 4 Deals suites) onto `apps/web/src/test/md-queries.ts` Shadow DOM queries with zero production screen modifications.
- Synchronized all 8 Meal component and screen test suites (78/78 tests passing across 3 Meal component suites and 5 Meal screen suites) onto `apps/web/src/test/md-queries.ts` Shadow DOM queries with zero production screen modifications.
- Centered 440px MD3 surfaceContainer cards with floating-label TextFields, exact magic-link copy preservation, and Material Symbols navigation across all authentication and onboarding screens.

---

## v2.1 Grocery & Deals Intelligence (Shipped: 2026-11-10)

**Phases completed:** 5 phases, 13 plans, 12 tasks

**Key accomplishments:**
- Centralized image CDN domain definitions and strict URL validation in `@hestia/shared`, and updated Caddy CSP `img-src` headers to permit modern Flipp and Open Food Facts CDNs.
- Expanded PWA Service Worker image caching route to intercept all allowed Flipp and Open Food Facts CDNs with a 200-entry quota, and refactored DealImage to consume centralized domain validation with fallback placeholders.
- Delivered database schema, Open Food Facts v3 caching proxy service, authenticated Fastify barcode routes, shopping list item barcode persistence, and Caddy ingress camera permissions.
- Delivered client-side barcode scanning engine, Web Audio sensory feedback, offline-first item matcher, and full-screen mobile camera viewfinder dialog with dual-mode toggle and manual keypad fallback.
- Integrated barcode scanning into the live grocery list UI with dedicated toolbar access, scan-to-add metadata pre-population in `ItemSheet`, and shop-and-check-off with interactive Undo toasts.
- Delivered schema migration, Kysely types, shared Zod schemas, service persistence, and Fastify routes for standalone custom meal plan items and shopping list export.
- Delivered frontend components and end-to-end user workflows for placing custom food items, disambiguating entries in the week planner, and exporting standalone items to shopping lists.
- Hardened mathematical pricing derivation unit tests in the Fastify service and deal card presentation tests in the PWA frontend.
- Harden PostgreSQL integration tests for Open Food Facts barcode proxy caching, upstream failure resilience, and flexible meal plan concurrency with advisory locks.
- Implemented Playwright E2E test journeys for deal pricing presentation, barcode scanner sheet add and shop check-off, and flexible meal planning across light and dark themes with WCAG 2.1 AA accessibility audits.

---

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
