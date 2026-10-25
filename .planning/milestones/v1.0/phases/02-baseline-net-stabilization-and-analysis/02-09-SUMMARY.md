---
phase: 02-baseline-net-stabilization-and-analysis
plan: 09
subsystem: testing
tags: [playwright, e2e, timezone, clock, sweep, docs]

requires:
  - phase: 02-baseline-net-stabilization-and-analysis
    provides: "02-05: e2e/support/clock.ts and the bare-clock lint ban; 02-02: test/clock-setup.mjs, test/global-tz.mjs and scripts/test-sweep.mjs; 02-04: apps/service/src/test/zone-dates.ts"
provides:
  - "Playwright browser pinned to America/New_York with locale en-US for every journey"
  - "Weekday audit ledger covering all 19 E2E specs: 20 ok rows, 1 fixed row, 0 owner rows"
  - "Root commands pnpm test:sweep and pnpm test:sweep:integration"
  - "docs/testing.md and docs/file-map.md describe the clock pin, viewer-zone pin, zone helpers, sweep cells, lint rule, E2E clock helper and browser zone, and the test/ folder"
affects: [02-08, phase-06]

actuals:
  tokens: 1500
  tasks: 2
  commits: 2
plan_head_before: eebbbbff5346327fca1635c6e68e441a1810bcfc
plan_head_after: e1fad8b3735b424bfec4cd08cb9cac772e39c1b3

tech-stack:
  added: []
  patterns:
    - "E2E date inputs and expectations come from seed-relative data or e2e/support/clock.ts, never a calendar literal"

key-files:
  created: []
  modified:
    - e2e/playwright.config.ts
    - e2e/tests/15-chores-and-errands.spec.ts
    - package.json
    - docs/testing.md
    - docs/file-map.md

key-decisions:
  - "e2e/fixtures/e2e-seed.sql left untouched: its only server-zone date (Casey's Car Insurance anchor, now() minus 3 months) is never asserted by a spec"
  - "The errand due-date literal in spec 15 was replaced by a household-zone date 30 days out; only the input changed"
  - "HEARTH_FLIPP_FIXTURE_NOW in the E2E overlay is a pre-existing E2E-only override, recorded as the source for spec 12 and not counted as a seam added here"

requirements-completed: [TIME-03]

duration: ~30min (start time not captured; approximate)
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 09: Browser zone pin, E2E weekday audit, sweep scripts and clock docs Summary

**The Playwright browser now runs in America/New_York (en-US), every one of the 19 E2E specs is in a weekday ledger with no `owner` row, `pnpm test:sweep` and `pnpm test:sweep:integration` run the date and zone matrices from the root, and `docs/testing.md` and `docs/file-map.md` describe the clock contract as built.**

TIME-03 closed: no `owner` rows. This is shown by the ledger and by static checks. The journeys themselves were not run here; their gate is CI's `test-e2e` job on the pull request in plan 02-08.

## Performance

- **Tasks:** 2 of 2
- **Commits on `test/deterministic-clock`:** 2 code commits (measured from the ledger: `eebbbbf..e1fad8b`), plus the docs commit that carries this SUMMARY
- **Changed files:** 5 (one E2E config, one spec, root `package.json`, two reference docs); no production module

## Accomplishments

- `e2e/playwright.config.ts`: `timezoneId: 'America/New_York'` and `locale: 'en-US'` in the top-level `use`, with a comment saying why (the app renders instants such as "As of" stamps in the viewer's zone, CI runs in UTC, calendar dates already follow the household).
- Weekday audit of every spec under `e2e/tests/` (the ledger is copied below). One expectation-side change was needed: spec 15 filled the errand "Due date" with the literal `2026-12-01`, which falls behind the suite's "today" after that day. It now uses `addDays(dateInZone('America/New_York', currentInstant()), 30)` from `e2e/support/clock.ts`. No assertion read the date and the errand schema accepts any calendar date, so only the input changed.
- `e2e/fixtures/e2e-seed.sql` was not edited (T-02-14): no spec depends on its server-zone date.
- Root `package.json`: `test:sweep` (`node scripts/test-sweep.mjs`) and `test:sweep:integration` (`node scripts/test-sweep.mjs --suite integration`) directly after `test:integration`. `git diff origin/main...HEAD -- package.json` adds exactly those two lines.
- `docs/testing.md`: the layer table and exceptions paragraph now say two `node --test` files (adding `e2e/support/clock.test.ts`); the old closing sentence on fixing the instant became a pointer to a new `### Dates and time zones` subsection (clock pin and `HEARTH_TEST_NOW` default `2026-10-14T12:00:00.000Z`, `vi.setSystemTime` override, viewer-zone pin with `vi.hoisted` and `afterAll`, zone helpers `currentInstant`/`dateInZone`/`householdDate`/`addDays`/`daysBetween`, `test/global-tz.mjs`, the six unit cells and five integration cells by id with what each covers, the rule to set `TZ` only through the sweep or a spawned `env`, and the lint ban with its `// eslint-disable-next-line no-restricted-syntax -- {reason}` opt-out). "End-to-end tests" gained a paragraph on the real clock, `e2e/support/clock.ts` and the browser zone.
- `docs/file-map.md`: new `test/` row and the updated `scripts/` row, directly after one another. Only these two files changed under `docs/`.

## Task Commits

1. Task 1 (tracer): `9a3a5f3` test(e2e): pin the browser zone and audit e2e date expectations
2. Task 2: `e1fad8b` test: document the clock pin and add the sweep scripts
3. This SUMMARY: `docs: complete plan 02-09` (made after this file was written, so not in `commits:` above)

## E2E weekday audit ledger

Source: `.planning/cleanup/logs/02-09-e2e-audit.md` (raw log, not committed). Verdict counts: ok 20, fixed 1, owner 0 (21 rows over 19 specs; there is no spec 04).

| Spec | Date-dependent element | Expected value comes from | Verdict |
| --- | --- | --- | --- |
| 01-signup-and-first-household.spec.ts | none | n/a (sign-up and onboarding carry no date text) | ok |
| 02-switch-household.spec.ts | invite rows shown or hidden by expiry | seed invites dated `now() - interval` (seed-relative); expired and revoked invites never show on any day | ok |
| 03-invites-link-and-code.spec.ts | none | n/a (invites are created in the run; no date is asserted) | ok |
| 05-last-member-leaves.spec.ts | none | n/a (counts Casey's surviving bill only, so the server-zone `now()::date` anchor in `e2e-seed.sql` is never asserted) | ok |
| 06-owner-reset-password.spec.ts | none | n/a | ok |
| 07-magic-link-disabled.spec.ts | none | n/a (build-time flag) | ok |
| 08-caddy-refuses-gotrue-endpoints.spec.ts | none | n/a | ok |
| 09-search-deals-and-add-to-list.spec.ts | deals found and added are current | seed deals valid `local_today - 2` to `local_today + 4` in `seed.sql`; search served from a warm `deal_query_cache` row; only name, store and price are asserted | ok |
| 10-realtime-list-sync.spec.ts | none | n/a ("This Week" is a list name, not a date) | ok |
| 11-offline-list-sync.spec.ts | none | n/a ("This Week" is a list name, not a date) | ok |
| 12-deal-rate-discipline.spec.ts | flyer window and 12-hour flyer cache TTL | flyer activity comes from the E2E overlay's existing `HEARTH_FLIPP_FIXTURE_NOW`, a pre-existing E2E-only override not added here, so it holds on any day; the TTL step is a reload seconds later | ok |
| 13-recipe-import-and-readiness.spec.ts | "on sale" and "in pantry" counts | seed deals valid `local_today - 2` to `local_today + 4`; pantry rows dated `now() - interval` (oldest 45 days, no staleness rule in the counts) | ok |
| 14-bills-and-subscriptions.spec.ts | Overdue group, Later group, Skip dialog date, 60-day clock | seed bills relative to `local_today`: Duke C = today - 5 (overdue), Spotify C = today + 12 (always Later), Water C = today + 9, Adobe confirmed 70 days ago; the spec checks row labels and a `\d{2}/\d{2}/\d{4}` shape, never which week a bill lands in | ok |
| 15-chores-and-errands.spec.ts | Overdue and Today chore groups, trash due today | seed chores relative to `local_today` (trash due today, Vacuum 38 days back, HVAC +11, fridge +6) | ok |
| 15-chores-and-errands.spec.ts | `Completed by Alex Rivera · today` | completion stamped at run time; the app and the NY-pinned browser agree on "today" | ok |
| 15-chores-and-errands.spec.ts | errand "Due date" input was the literal `2026-12-01` | now `addDays(dateInZone('America/New_York', currentInstant()), 30)` from `e2e/support/clock.ts`; only the input changed, no assertion read it and the errand schema accepts any calendar date | fixed |
| 16-bill-paid-late-keeps-anchor.spec.ts | anchor, three occurrences, paid date, Overdue and This week groups | `dateInZone(HOUSEHOLD_TZ, currentInstant())` from `e2e/support/clock.ts` (moved there by plan 02-05) | ok |
| 17-accessibility-states.spec.ts | planner filled, "this week" copy | seed meal plan relative to `this_sunday`; the copy strings are static text and only axe runs on the planner | ok |
| 18-chores-and-errands-offline.spec.ts | "Due today", "in 2 days", "Overdue 2 days", "Due in 2 days", `Completed ... · today` | seed chores and errands relative to `local_today` (trash today, bathroom +2, Amazon +2, dry cleaning -2), counted in the household zone as the spec comment states | ok |
| 19-notifications.spec.ts | reminder day, dispatch clock, dinner on that day | `reminderDay(currentInstant())` with `dateInZone`, `hourInZone` and `addDays` from `e2e/support/clock.ts` (plan 02-05); dinner read from the seed (Sunday to Friday) or planned through the API for a Saturday | ok |
| 20-remove-member.spec.ts | none | n/a (owned names only) | ok |

## For the owner

None. The ledger has no `owner` row, so TIME-03 is closed by this plan and nothing waits on an owner decision. One observation, not a decision request: the audit depends on the seed being applied in the same household-zone day the suite runs; a suite that straddles New York midnight after seeding would shift "today" for the seed-relative labels in specs 14, 15 and 18. That is a property of the seed, was present before this plan, and needs no seam.

## Opt-outs and seams

No server, database or service clock seam was added and no application file changed (D-05). `git show HEAD~1 -- e2e/tests` adds no `.skip`, `.fixme` or `.only` (count 0).

## Verification run

- Ledger check from Task 1's verify: header present, every spec file name appears in a row, every row ends in `ok`, `fixed` or `owner`, no `owner` row. Passed.
- `pnpm --filter @hearth/e2e test`: `tests 15, pass 15, fail 0` (twice, after each commit's content). `pnpm --filter @hearth/e2e typecheck`, `pnpm typecheck`, `pnpm lint` (`--max-warnings=0`) and `pnpm format:check` all exit 0. Both commits passed the Husky and commitlint hooks.
- Task 1 acceptance: commit `9a3a5f3` touches only `e2e/playwright.config.ts` and `e2e/tests/15-chores-and-errands.spec.ts`.
- Task 2: both root scripts match exactly; all eleven required terms are in `docs/testing.md`; `docs/file-map.md` has the `test/` row; `node scripts/test-sweep.mjs --list` prints the six unit and five integration cells; `git diff --name-only origin/main...HEAD -- docs` lists only `docs/file-map.md` and `docs/testing.md`.
- Backup push (phase rule 4): `git diff --name-only origin/main...HEAD` (47 paths) holds nothing under `.claude/`, `.github/`, `supabase/migrations/`, `docker/` or `.planning/cleanup/logs/`, no env file, and the plan 02-08 secret-shaped pattern counts 0 on the added lines. Plain `git push -u origin test/deterministic-clock` fast-forwarded `eebbbbf..e1fad8b`; `git ls-remote --heads origin test/deterministic-clock` equals the local tip `e1fad8b`. No pull request was opened. The SUMMARY commit is pushed the same way afterwards.

## Not run

- E2E journeys (the Playwright specs against the Compose stack): they need the full stack, which is not run here. The audit is by reading the specs, the seeds and the app's date handling; the browser-zone pin is checked by config inspection only. Their gate is CI's `test-e2e` job on the pull request in plan 02-08.
- The sweep itself (`pnpm test:sweep`): only `--list` was run, as the plan directs. The sweep was exercised in plans 02-02 to 02-05 and is run in full by plan 02-08.

## Deviations from Plan

**1. [Plan detail] Task 2 lists two `<automated>` blocks inside one `<verify>`**
- Task 2 has two `<automated>` commands (gates, then branch backup). I ran the first clause by clause and the second as separate checks (local ref equals `git ls-remote` head; forbidden-path and env-file scans on `git diff origin/main...HEAD`). Both hold. No output was contrived.

**2. [Judgement] Spec 15 date literal marked `fixed`, not `ok`**
- The plan frames `fixed` as changing how an expected value is obtained. The `2026-12-01` literal is an input, not an expected value, and no assertion depends on it today. I changed it anyway because after that day the new errand would render as overdue, which changes what the page shows on later runs. The change keeps every assertion as it was. If the owner prefers inputs left alone, reverting the three added lines in spec 15 changes only that row to `ok`.

**3. [Process] STATE.md, ROADMAP.md and REQUIREMENTS.md not touched**
- The orchestrator owns those writes, so this plan's docs commit carries only this SUMMARY, not the four files the plan's `<output>` names.

**4. [Process] The worktree branch-namespace check was not applied**
- Same as 02-02 to 02-05: the plan names `../hearth-clock` on `test/deterministic-clock`, so the protected/detached-branch check was applied and the `agent-*` allow-list was not.

**Total deviations:** 1 verify-shape note, 1 judgement call, 2 process notes. No Rule 1 to 4 deviation.

## Known Stubs

None.

## Threat Flags

None. Only an E2E config, one spec, root scripts and two reference docs changed; no endpoint, auth path or schema.

## Self-Check

- FOUND: `e2e/playwright.config.ts` with `timezoneId: 'America/New_York'` and `locale: 'en-US'` in `../hearth-clock`
- FOUND: `test:sweep` and `test:sweep:integration` in `../hearth-clock/package.json`
- FOUND commits 9a3a5f3 and e1fad8b on `test/deterministic-clock` and on `origin/test/deterministic-clock`
- `git status --porcelain` in `../hearth-clock` was empty after the code commits
