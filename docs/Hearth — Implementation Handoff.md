# Hearth — Implementation Handoff

2026-09-17 · @Someone

The entry point for an implementation agent. Read this first, then the document it points you to for the phase you are working on.

## The document set

Seven documents, all in `docs/`: this one and six others. Each owns a domain; where they overlap, the owner wins.

| Document | Path | Authoritative for |
| --- | --- | --- |
| **Product Requirements** | `docs/Hearth — Product Requirements Document.md` | What the app does. Data model, feature behavior, permissions, recurrence and timezone semantics, deal price rules, matching, membership lifecycle, notification defaults, offline scope, build sequencing. |
| **Technical Architecture** | `docs/Hearth — Technical Architecture.md` | Topology, ingress, deployment, auth configuration, the full API surface, scheduled jobs, the Flipp wrapper contract, database policies and functions, backups, observability. |
| **Engineering Practices** | `docs/Hearth — Engineering Practices.md` | Stack versions, libraries, repo layout, code conventions, testing strategy, git and CI, deploy, PWA and offline-queue implementation. |
| **Design System and UI Specification** | `docs/Hearth — Design System and UI Specification.md` | Components, layout shell and sub-tabs, per-screen layouts, the state matrix, accessibility requirements. |
| **Branding** | `docs/Hearth — Branding.md` | Color tokens and contrast, typography, spacing, iconography, voice, copy patterns, notification copy. |
| **Seed Data** | `docs/Hearth — Seed Data.md` | Fixtures: users, households, stores, deals including the messy price strings, recipes with expected buckets and readiness, lists, bills, chores. Use it for development, for mockups, and for tests, rather than inventing placeholder content. |
| **This document** | `docs/Hearth — Implementation Handoff.md` | Build order, acceptance criteria, non-negotiables, and what to do when the specs do not answer a question. |

### Reading order

First pass, in order: Requirements, then Technical Architecture, then Engineering Practices. Branding and Design are reference material consulted per screen rather than read front to back.

Before any phase, re-read the relevant Requirements section. Before any screen, read its entry in Design plus the universal state patterns.

### For mockups specifically

Mockups need Branding in full, the Design document's layout shell, component inventory, and state patterns, plus the per-screen entries for whatever is being mocked. High fidelity is expected: real color tokens, real type scale, real spacing, both themes. Not wireframes.

Mockups must include the empty, loading, error, and offline variants for each screen, not only the populated state. A mockup set showing only populated screens is incomplete and will produce an incomplete implementation.

### Copy in mockups

Use the copy patterns and notification copy from Branding. Do not invent placeholder lorem text — the copy is specified because its tone is a product decision.

## Non-negotiables

These are the constraints most likely to be quietly violated for convenience. Violating any of them is a defect regardless of whether tests pass.

### Security

1. **The service forwards the caller's JWT to Postgres for every user-initiated request.** Every handler reaches the database through `withUserDb`, which runs the request as the `authenticated` role with the caller's claims, so RLS applies. The service role is used only by the four uses Technical Architecture lists: scheduled jobs, migrations, the owner CLI, and the password-verified email change. A user-facing code path holding the service role for anything else is a security failure, not a shortcut.
2. **Every table has RLS enabled with an explicit policy.** A table without one denies everything, and that is correct — never disable RLS to make something work.
3. **Recorded errors are scrubbed.** Nothing written to `app_error` or to the logs contains bill amounts, list or pantry contents, recipe data, email addresses, or tokens.
4. **Secrets never enter the repository.** `.env` stays on the host.

### Correctness

5. **Recurrence is anchored, never shifting.** Computed from the anchor date and interval, never from the completion timestamp. If a test seems to demand otherwise, the test is wrong.
6. **Unparseable deal prices are skipped, never stored as null or zero.** A deal with a fabricated price is worse than a missing deal.
7. **Notifications are deduplicated by the outbox's unique key (user, type, target, occurrence key).** A job rerun must not double-send.
8. **Dates are evaluated in the timezone that owns them.** Chore dates, errand dates, household-bill dates, meal-plan dates, and "today" in household views use the household timezone. Personal-bill dates, quiet hours, and personal send times use the user's stored timezone. The server's timezone and the browser's live timezone are never used for these.
9. **Offline writes are idempotent.** Client-generated UUIDs, inserts that ignore duplicates, absolute-value updates, and natural unique keys, so that a replayed write never changes anything twice.

### Product

10. **Households are isolated.** No endpoint returns another household's data. The only exceptions are the caller's own membership list (for the switcher) and the caller's own personal bills. No aggregate across households exists.
11. **Hearth never moves money.** Bills are tracked. There is no payment integration, no account linking, and no path to either.
12. **On-sale and in-pantry ingredients weigh equally** in readiness scoring. Equal weighting is the v1 decision.
13. **No gamification in chores.** No streaks, points, badges, or motivational copy.
14. **Free to host.** No domain, no paid service, no SMTP relay, no metered API. Anything that would add a recurring cost needs the owner's approval first.

### Quality

15. **Every screen implements all its applicable states.** Populated-only is not done.
16. **WCAG AA is an acceptance criterion.** Keyboard operability and visible focus are not optional polish.
17. **Tests never call Flipp live.** Fixtures and test doubles only.
18. **Stale data beats empty data.** Where a cache exists and a fetch fails, show the cache with an as-of date.

### Rate discipline

19. **The daily refresh fetches once per active postal code**, and fetches flyer items only for favorited merchants. Requests are serialized with a minimum gap and backed off on failure. There is never a fetch per household, and never a fetch triggered directly by a user action a cache could serve. The one on-demand refresh a dormant postal code gets is a cache-miss fetch. It follows the same queue, gap, and circuit breaker.

### Data rules

20. **Mismatched ingredient units are never converted.** They merge by name and show both quantities. Volume-to-weight conversion without density data produces confident wrong answers.
21. **Deleting a household is irreversible and must be confirmed with counts** of what is lost and the typed household name, not a single tap.
22. **Expired deal prices are corrected, never left stale.** A list subtotal built on last week's sale price is quietly wrong, which is worse than showing no price.

## Build phases

Six phases, mapping onto four staged releases. Each phase has acceptance criteria that must pass before the next begins.

| Release | Phases |
| --- | --- |
| **v1.0** | Phase 0 (Foundation), Phase 1 (Identity and households), Phase 2 (Deals and shopping lists, including list offline) |
| **v1.1** | Phase 3 (Meal planning) |
| **v1.2** | Phase 4 (Bills and chores, completing the dashboard) |
| **v1.3** | Phase 5 (Notifications, quiet hours, and offline for chores and errands) |

Staging is a shipping decision, not a scope cut. Two constraints keep the result cohesive rather than four apps in a trench coat:

- **The navigation shell and dashboard layout are completed in v1.0**, with all five tabs present. Tabs for unbuilt pillars show a "coming soon" state; the dashboard shows placeholder cards. Later phases fill a finished frame.
- **The complete schema, including RLS policies for every table, lands in Phase 0 and 1 migrations** — meals, bills, and chores tables exist before anything writes to them. No later migration should touch foundational tables.

### Phase 0 — Foundation

Monorepo scaffold. Docker Compose stack with exactly the services Technical Architecture lists. Tailscale Funnel and Caddy with the pinned machine and tailnet names, security headers, and CSP. Supabase running. The backup container writing to the second disk. Pino logging with Docker log rotation, and the `/api/health` and `/api/health/deep` endpoints. CI pipeline green on an empty test suite on GitHub-hosted runners; ESLint, Prettier, and commitlint wired. The self-hosted deploy runner, deploy only.

**The Flipp spike is a go/no-go gate before Phase 2.** Against the live endpoint, from the box:

- document the endpoint URLs and parameters for all four modes (search, flyers, flyer items, merchants) and the image CDN hosts
- confirm that each mode works for 27514
- capture the raw fixtures for 27514 into `e2e/fixtures/flipp/raw/`

If any mode is unavailable, stop and ask before Phase 2 begins.

**Client-IP passthrough check.** Confirm that the real client IP survives Funnel → Caddy → Kong → GoTrue and Funnel → Caddy → service, per Technical Architecture, and configure the trusted proxies. Record the result.

**Done when:**

- `docker compose up` brings the full stack online on a clean machine
- the PWA shell loads at `https://<machine>.<tailnet>.ts.net`
- CI runs lint, typecheck, and test jobs on a PR
- a merge to `main` deploys through backup, migrate, and restart, with the health-check rollback exercised once
- a nightly backup lands on the second disk and has been restored successfully once into a fresh Supabase Postgres container
- the Flipp spike findings and raw fixtures are committed
- the IP passthrough result is recorded

### Phase 1 — Identity and households

The complete schema and migrations, including every table's RLS policy, the helper function, and the membership lifecycle functions. Password auth: signup through the service with the common-password check, sign-in, password and email change, the forgot-password screen. The owner reset CLI (`hearth-admin reset-password`). Magic link and code entry built but disabled behind the flag. Rate limits. Invites with link and code (admin only). Multi-household membership and switching via `profile.active_household_id`. Departure preview, reassign-and-depart, admin transfer, auto-promotion, and last-member deletion. Settings screen. Onboarding. The navigation shell, sub-tabs, dashboard layout, and coming-soon states.

**Done when:**

- A user signs up with a password, creates a household, invites a second user, and that user joins by link and a third by code
- The owner CLI prints a reset link that lets a user set a new password; the forgot-password screen tells other users to ask the server owner
- With the magic-link flag off, no magic-link UI is reachable
- An E2E smoke test through Caddy shows that external `POST /auth/v1/signup` and `PUT /auth/v1/user` are refused, including encoded and doubled-slash variants, so the common-password check and password re-entry cannot be bypassed
- A user belongs to two households and switches between them with full context swap
- The RLS isolation suite passes: a member of A can read and write nothing belonging to B
- Removing a member prompts reassignment and blocks until resolved; the removed user loses access immediately
- The last member leaving deletes the household only after the typed-name confirmation; their personal bills survive
- E2E journeys 1, 8, and 9 pass

### Phase 2 — Deals and shopping lists

The Flipp wrapper behind its interface, with the parser chain and both fixture types. `deal` and `deal_query_cache` with TTLs, and the daily `refresh-deals` job. Deal search and flyer browse. Favorite stores. Shopping lists with realtime sync, per-store grouping and subtotals, snapshot pricing, repricing, archive and delete, and manual entry. Pantry. **List offline**: the service worker, the persisted cache, and the queue for list item add, check, uncheck, and edit.

**Done when:**

- Searching deals for a real postal code returns normalized results from favorite stores
- Every price parser has unit tests over recorded strings; unparseable items are skipped and counted
- Two browser contexts on one list see each other's changes within a second
- A failed fetch with a warm cache shows stale results with an as-of date
- Rate discipline is observable in logs: one refresh per active postal code, flyer items only for favorited merchants, serialized, backed off on failure
- An item from an expired deal reprices to the current deal, or to its regular price, or to no price, exactly as the Seed Data list expects
- Offline list writes queue, survive a reload, replay in order on reconnect, and a duplicate replay changes nothing
- A flyers request for a dormant postal code shows the cached "as of" state (or the "no cache, refreshing" state) and queues at most one background refresh per UTC day; keyword search still fetches live on a cache miss
- E2E journeys 2 and 3 pass, and the list portion of journey 7 passes

### Phase 3 — Meal planning

Recipes with URL parsing, the ingredient-line parser, and manual fallback. Ingredient normalization. The matching package, including the fuzzy-library benchmark. Readiness precomputation with equal weighting. Match overrides. Week planner. Suggestions. Add-missing-to-list for a recipe, a meal, and a week.

**Done when:**

- A recipe imports from a URL with JSON-LD, and a page without it falls back cleanly to an editable form
- Readiness scoring matches every expected bucket and percentage in Seed Data
- The named false-positive tests pass, including chicken breast against chicken broth
- The fuzzy-library benchmark is recorded and the chosen library is in Engineering Practices
- A wrong match can be corrected inline; the override applies household-wide and persists until removed
- Adding missing ingredients produces a list containing exactly what is neither on hand nor already listed
- E2E journey 4 passes

### Phase 4 — Bills and chores

Buildable in parallel; they share no code beyond the recurrence package. Bills with visibility, the payment log, skip, archive, the `log-autopay` job, and the subscriptions view. The `dispatch-notifications` job waits for Phase 5. Chores with derived occurrences, rotation, and completion. Errands. The recurrence package underpinning both. The dashboard's Bills and Chores cards, which complete the dashboard.

**Done when:**

- The recurrence suite covers late completion, missed occurrences, month-end clamping, and leap years, at 90%+ coverage
- A bill paid late advances to the next anchor date, not completion plus interval; an unpaid bill stays overdue until paid or skipped
- Autopay logs a payment on the due date exactly once, even when the job reruns, and never for an occurrence dated before the bill's `created_at` date; such an occurrence stays overdue until paid or skipped
- A rotating chore advances to the next member on completion, a missed occurrence rolls forward without passing the turn, and an early completion closes the upcoming occurrence
- Undoing a completion (the toast's Undo, or deleting the most recent completion from history) reverts the rotation and next due date
- The dashboard renders each card independently and stays stable when a section is empty
- Personal bills are invisible to other household members, verified at the database level
- E2E journeys 5 and 6 pass

### Phase 5 — Cross-cutting

Only the remaining scope: Web Push with VAPID, the `notification` outbox and dispatch, per-type preferences and defaults, list-activity batching, and **per-user quiet hours**. Offline queueing is extended to chore complete and errand done.

**Done when:**

- Notifications follow the defaults table and per-type preferences; bill reminders reach only the owner unless another member turned on the household-bills setting
- List activity batches into one notification per list rather than one per item, and a later batch on the same day sends again
- A job rerun sends nothing twice
- A notification due inside a user's quiet-hours window is delivered when the window ends, resolved against that user's stored timezone, with batching and the outbox key still applied
- Tapping a notification opens its target in its household and switches to that household
- Offline chore completion and errand done queue, survive a reload, and replay in order on reconnect
- The chores and errands portion of E2E journey 7 passes, and axe-core assertions pass on every screen in both themes

## Definition of done and handling ambiguity

### A unit of work is done when

- It satisfies its phase's acceptance criteria
- All applicable screen states are implemented, not just the populated one
- Tests exist at the right layer: pure logic unit-tested, database behavior integration-tested, journeys E2E-tested
- Lint, typecheck, and the full test suite pass
- Accessibility holds: keyboard operable, visible focus, axe-core clean, meaning never carried by color alone
- Both themes render correctly
- No new secret, fixture of real data, or `.env` value entered the repository

### When the specs do not answer a question

The documents are detailed but cannot be exhaustive. In order:

1. **Check the owning document.** Most gaps are covered somewhere; the table at the top of this document says where to look.
2. **Follow the established pattern.** If one screen's error handling is specified and another's is not, mirror the specified one. Consistency is usually the right answer.
3. **Apply the non-negotiables.** Several ambiguities resolve immediately once the security and correctness constraints are applied.
4. **Prefer the simpler option**, and prefer the one that degrades more gracefully offline or when Flipp is unavailable.
5. **Ask.** For anything that changes product behavior, data shape, or security posture, stop and ask rather than deciding. A wrong guess about recurrence semantics or RLS scope is expensive to unwind.

### Do not do these without asking

- Change the data model
- Add a dependency that duplicates something already chosen
- Introduce a second deal source, or bring back the Kroger API
- Add a feature not in the Requirements document, however small it seems
- Weaken a non-negotiable to make a test pass
- Relax the anchored-recurrence rule, the equal-weighting rule, or household isolation

### Recording decisions

When a gap is resolved, write the resolution directly into the owning document, as if it had always been there. The documents stay the oracle. A decision that lives only in a commit message will be lost.

### Known unknowns

These cannot be settled from a spec and will need real-world work:

- **Fuzzy matching threshold.** 0.85 token similarity is a starting point. Real deal strings will require tuning, and each adjustment needs test cases added rather than the threshold quietly moved.
- **Fuzzy library.** `fastest-levenshtein` versus `fuse.js`, decided by a Phase 3 benchmark on real deal strings.
- **Price parser coverage.** The parser chain handles the known formats. New ones will appear; the skip-rate logging exists precisely to surface them.
- **Flipp upstream stability.** Flipp is unauthenticated and has no SLA, so its endpoints and response shapes (Technical Architecture, Flipp wrapper › Endpoints) can change without notice. The wrapper's single-file isolation and the raw captures in `e2e/fixtures/flipp/raw/` exist so a breaking change is a one-file fix.
- **Client-IP passthrough.** Whether Tailscale Funnel delivers the real client IP to Caddy is unknown until the Phase 0 check. If it does not, per-IP rate limits act as one global limit.
