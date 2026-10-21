# Fixture consolidation ledger (PR B: RED-03)

base=4e39165141ea1c6655f1bcc6a357c2bf0511726a
branch=test/shared-fixtures-wip
worktree=../hearth-fixtures-wip

Working branch note: the plan names `claude/vigilant-gates-a4ihid`; the session's working branch is
`claude/eloquent-mayer-szjtjf` (see `CI-SETUP-LEDGER.md`, "Gates and decisions"), and `base=` is its
tip when `test/shared-fixtures-wip` was cut.

## Baseline

Scan: the Phase 2 test-inclusive jscpd command (jscpd 5.4.1, `--min-tokens 60 --min-lines 8`, formats
typescript and tsx), run from the root of `../hearth-fixtures-wip` at `base=`, label `05-02-before`.

before-clones=99
before-duplicated-lines=1472
before-cross-test=50

Phase 2 reference (TRIAGE.md): 96 clones, 1,438 duplicated lines, 1.87%. Today's `main` reports 99
clones, 1,472 lines, 1.90%, so the Phase 5 bar of "at most 90 clones" is 9 below the starting point.
Of the 99 clones, 61 are across two files and 38 repeat inside one file (D-07: those stay); 50 of the
61 cross-file clones have a test, test-helper or e2e side, and 15 of those have a side under
`apps/service/`.

## Clone dispositions

One row per cross-file test clone pair of the `05-02-before` scan that has a side under
`apps/service/`. Clusters: A is the integration stack hooks plus per-file helpers, B is the job logger.

| # | File A (lines) | File B (lines) | Lines | Cluster | Disposition | Commit |
| - | -------------- | -------------- | ----- | ------- | ----------- | ------ |
| 1 | `apps/service/src/api.integration.test.ts` 28-57 | `apps/service/src/chores.integration.test.ts` 11-40 | 30 | A | removed | 948432f |
| 2 | `apps/service/src/api.integration.test.ts` 29-57 | `apps/service/src/meal-plan.integration.test.ts` 17-46 | 29 | A | removed | 948432f |
| 3 | `apps/service/src/api.integration.test.ts` 32-57 | `apps/service/src/bills.integration.test.ts` 22-54 | 26 | A | removed | 948432f |
| 4 | `apps/service/src/api.integration.test.ts` 32-53 | `apps/service/src/lists.integration.test.ts` 21-42 | 22 | A | removed | 948432f |
| 5 | `apps/service/src/api.integration.test.ts` 32-60 | `apps/service/src/notifications.integration.test.ts` 20-41 | 29 | A | removed | 948432f |
| 6 | `apps/service/src/api.integration.test.ts` 39-57 | `apps/service/src/match-overrides.integration.test.ts` 21-38 | 19 | A | removed | 948432f |
| 7 | `apps/service/src/chores.integration.test.ts` 7-40 | `apps/service/src/errands.integration.test.ts` 6-38 | 34 | A | removed | b3bf88f |
| 8 | `apps/service/src/chores.integration.test.ts` 56-67 | `apps/service/src/errands.integration.test.ts` 45-54 | 12 | A | kept: createHome differs; chores adds `extraMembers` and a `members` list, errands returns a smaller `Home`, so only the 12-line prefix (admin sign-up, household POST) is shared | |
| 9 | `apps/service/src/dispatch-notifications.integration.test.ts` 36-55 | `apps/service/src/jobs.integration.test.ts` 49-68 | 20 | B | removed | 053f371 |
| 10 | `apps/service/src/dispatch-notifications.integration.test.ts` 36-47 | `apps/service/src/jobs/scheduler.test.ts` 25-36 | 12 | B | removed | 053f371 |
| 11 | `apps/service/src/dispatch-notifications.integration.test.ts` 37-46 | `apps/service/src/jobs/dispatch-notifications.test.ts` 110-119 | 10 | B | removed | 053f371 |
| 12 | `apps/service/src/lists.integration.test.ts` 19-42 | `apps/service/src/match-overrides.integration.test.ts` 10-34 | 24 | A | removed | b3bf88f |
| 13 | `apps/service/src/lists.integration.test.ts` 89-100 | `apps/service/src/meal-plan.integration.test.ts` 119-132 | 12 | A | kept: `itemNamed` differs; meal-plan's error also lists the items it saw, and `createList` has a different default name | |
| 14 | `apps/service/src/match-overrides.integration.test.ts` 29-42 | `apps/service/src/meal-plan.integration.test.ts` 37-50 | 14 | A | removed | b3bf88f |
| 15 | `apps/service/src/meal-plan.integration.test.ts` 42-60 | `apps/service/src/readiness.integration.test.ts` 54-72 | 19 | A | kept: `addPantryItem` differs (returns void in meal-plan, the item in readiness) and readiness reassigns its own `app`, so a stack-bound `favoriteStore` in the helper would read an `app` readiness never sets | |

## Test counts

tests-before.service-unit=757
tests-after.service-unit=757

`pnpm --filter @hearth/service test` at `base=` (log `05-02-service-unit-before.log`): 56 files, 757
tests. This equals the 757 recorded by 05-01 for the service workspace. After the last commit
(053f371, log `05-02-service-unit-after.log`) the suite again reports 56 files and 757 tests. Integration files do not run
here (no Supabase stack); their counts are compared in PR B's CI (05-05).

## Scans

| Label | Where | Clones | Duplicated lines | Cross-file | Cross-file test | Note |
| ----- | ----- | ------ | ---------------- | ---------- | --------------- | ---- |
| 05-02-before | `base=` | 99 | 1472 | 61 | 50 | before any edit |
| 05-02-t1 | after commit 948432f | 98 | 1459 | 60 | 49 | api on the shared hooks |
| 05-02-t2a | after commit b3bf88f | 90 | 1241 | 52 | 41 | seven files on the hooks, three on `expectStatus` only; step 4 moved nothing |
| 05-02-t2 | same tree as t2a | 90 | 1241 | 52 | 41 | identical totals to t2a |
| 05-02 | after commit 053f371 | 87 | 1199 | 49 | 38 | recording job logger shared; final service scan |

after-05-02-clones=87
after-05-02-duplicated-lines=1199
service-cross-test-left=3

The final scan is 12 below the starting 99 and 9 below the Phase 2 baseline of 96, within the Phase 5
bar of at most 90. No clone pair in it names `stack-hooks.ts` or `job-logger.ts`. Of its 49 cross-file
pairs, 38 have a test, test-helper or e2e side; the 3 with a side under `apps/service/` are rows 8, 13
and 15 above, each `kept:` with its semantic difference. The web side (05-04) is not touched here.

Row 9 needed no `createJobTestDb()` helper: once `makeLogger()` was shared, the remaining
`beforeAll` text of the two job integration files fell below the scan's 8-line and 60-token floor, so
the pair is gone and `enableServiceLogin`, `createDatabase` and the `jobDb` construction stay in
their files in their original order.

Reports: `.planning/cleanup/jscpd/phase5-{label}/jscpd-report.json`; read them with
`node .planning/cleanup/tools/jscpd-compare.mjs {report} --list cross-test --root ../hearth-fixtures-wip`.

## Gates

Hook variants (diffs in `.planning/cleanup/logs/05-02-variant-{name}.diff`, gitignored): api is
identical to the helper; bills, chores, errands, lists, match-overrides, meal-plan and notifications
differ only by the explanatory comment above the `beforeEach` app (it lives in the helper now);
readiness keeps its hooks (its `beforeAll` also deletes the rows for six hardcoded postal codes, and
its tests and one nested `beforeAll` reassign `app`, which an imported binding cannot do); deals
builds its app with an injected deals service and recipes builds one app per test, so both keep their
hooks. All eleven integration files import `expectStatus`; none defines its own.

Task 1 (`../hearth-fixtures-wip` at 948432f): service typecheck passes; `eslint --max-warnings=0` and
`prettier --check` pass on `stack-hooks.ts` and `api.integration.test.ts`; the service unit suite
reports 757 passed (log `05-02-t1-service-unit.log`); the pre-commit hook (lint-staged, root
typecheck) and commitlint pass. A throwaway test confirmed that an exported `let` reassigned in a
`beforeEach` registered by a helper module is read live by the importing test file.

Task 2 (`../hearth-fixtures-wip` at b3bf88f): service typecheck, `eslint --max-warnings=0` and
`prettier --check` over `apps/service/src` pass; the unit suite reports 757 passed
(`05-02-t2-service-unit.log`); per touched file the count of lines matching the citation vocabulary
equals the base, and the count of `it`/`describe`/`test` declarations equals the base.

Task 3 (`../hearth-fixtures-wip` at 053f371): service typecheck, `eslint --max-warnings=0` and
`prettier` over the touched files pass; the unit suite (scheduler and dispatch-notifications unit
tests included) reports 757 passed, equal to `tests-before.service-unit`; per touched file the
citation-line count and the `it`/`describe` declaration count equal the base.
`git diff --name-only 4e39165..053f371` in the worktree lists only files under `apps/service/src/`.

## Web clone dispositions (05-04)

One row per cross-file test clone pair of the `05-02` scan (the final service scan; the web files were
untouched by 05-02, so it equals the web side of `05-02-before`) with both sides under `apps/web/`:
35 pairs. Clusters: C is the browser online and pointer stubs, `openMenu` and per-file mounts, D is the
household-timezone fake clock, E is the offline queue, F is the deals handler table and the `vi.hoisted`
viewer-zone block, G is the session handler. A pair counts as `removed` when no clone of the same two
files remains at an overlapping range; jscpd re-reports a shared block against the next file that
still carries it, so a pair can vanish from one file pairing and appear against another until every
copy is gone. `open` means not decided yet in this plan's current task.

| # | File A (lines) | File B (lines) | Lines | Cluster | Disposition | Commit |
| - | -------------- | -------------- | ----- | ------- | ----------- | ------ |
<!-- web-rows-start -->
| 1 | `apps/web/src/App.test.tsx` 48-57 | `apps/web/src/screens/settings/settings.test.tsx` 37-46 | 10 | G | kept: two-file duplicate shorter than a helper; HOUSEHOLDS and MEMBERS are each file's own tables and the shared lines are two handler entries |  |
| 2 | `apps/web/src/lib/offline/write-queue.test.tsx` 67-76 | `apps/web/src/screens/bills/bill-detail.test.tsx` 35-44 | 10 | C | removed | 96e17d6 |
| 3 | `apps/web/src/lib/offline/write-queue.test.tsx` 67-79 | `apps/web/src/screens/chores/chores-offline-queue.test.tsx` 43-54 | 13 | E | removed | 96e17d6 |
| 4 | `apps/web/src/lib/offline/write-queue.test.tsx` 67-76 | `apps/web/src/screens/lists/lists.test.tsx` 86-96 | 10 | C | removed | 96e17d6 |
| 5 | `apps/web/src/lib/offline/write-queue.test.tsx` 68-79 | `apps/web/src/screens/meals/planner.test.tsx` 99-109 | 12 | C | removed | 96e17d6 |
| 6 | `apps/web/src/screens/bills/bill-detail.test.tsx` 34-71 | `apps/web/src/screens/bills/bills-index.test.tsx` 38-75 | 38 | C | removed | b6569aa |
| 7 | `apps/web/src/screens/bills/bill-detail.test.tsx` 47-57 | `apps/web/src/screens/chores/chores.test.tsx` 160-170 | 11 | C | removed | b6569aa |
| 8 | `apps/web/src/screens/bills/bill-detail.test.tsx` 43-55 | `apps/web/src/screens/deals/deal-search.test.tsx` 71-84 | 13 | C | removed | b6569aa |
| 9 | `apps/web/src/screens/bills/bill-detail.test.tsx` 36-47 | `apps/web/src/screens/lists/lists.test.tsx` 87-99 | 12 | C | removed | b6569aa |
| 10 | `apps/web/src/screens/bills/bill-detail.test.tsx` 34-59 | `apps/web/src/screens/meals/recipe-detail.test.tsx` 53-78 | 26 | C | removed | b6569aa |
| 11 | `apps/web/src/screens/bills/bills-index.test.tsx` 153-161 | `apps/web/src/screens/bills/subscriptions.test.tsx` 99-108 | 9 | C | kept: the retry assertion sits inside each screen's own test and names its own endpoint (`/bills`, `/subscriptions`, `/lists`, `/recipes`); a helper would hide what each test asserts |  |
| 12 | `apps/web/src/screens/bills/bills-index.test.tsx` 38-51 | `apps/web/src/screens/bills/subscriptions.test.tsx` 36-49 | 14 | C | removed | b6569aa |
| 13 | `apps/web/src/screens/bills/bills-index.test.tsx` 153-161 | `apps/web/src/screens/lists/lists.test.tsx` 132-140 | 9 | C | kept: the retry assertion sits inside each screen's own test and names its own endpoint (`/bills`, `/subscriptions`, `/lists`, `/recipes`); a helper would hide what each test asserts |  |
| 14 | `apps/web/src/screens/bills/bills-index.test.tsx` 38-48 | `apps/web/src/screens/meals/planner.test.tsx` 97-107 | 11 | C | removed | b6569aa |
| 15 | `apps/web/src/screens/bills/bills-index.test.tsx` 153-161 | `apps/web/src/screens/meals/recipe-library.test.tsx` 115-123 | 9 | C | kept: the retry assertion sits inside each screen's own test and names its own endpoint (`/bills`, `/subscriptions`, `/lists`, `/recipes`); a helper would hide what each test asserts |  |
| 16 | `apps/web/src/screens/bills/bills-index.test.tsx` 38-63 | `apps/web/src/screens/meals/recipe-library.test.tsx` 40-66 | 26 | C | removed | b6569aa |
| 17 | `apps/web/src/screens/bills/household-timezone.test.tsx` 59-74 | `apps/web/src/screens/chores/household-timezone.test.tsx` 55-70 | 16 | D | removed | 979f696 |
| 18 | `apps/web/src/screens/bills/household-timezone.test.tsx` 59-74 | `apps/web/src/screens/household-timezone.test.tsx` 103-118 | 16 | D | removed | 979f696 |
| 19 | `apps/web/src/screens/bills/subscriptions.test.tsx` 41-58 | `apps/web/src/screens/lists/lists.test.tsx` 91-108 | 18 | C | removed | b6569aa |
| 20 | `apps/web/src/screens/chores/chores-offline-queue.test.tsx` 46-54 | `apps/web/src/screens/chores/chores.test.tsx` 66-74 | 9 | E | removed | b6569aa |
| 21 | `apps/web/src/screens/chores/chores-offline-queue.test.tsx` 39-54 | `apps/web/src/screens/chores/errands-offline-queue.test.tsx` 33-48 | 16 | E | removed | d5e5d36 |
| 22 | `apps/web/src/screens/chores/chores-offline-queue.test.tsx` 54-62 | `apps/web/src/screens/chores/errands-offline-queue.test.tsx` 48-56 | 9 | E | kept: the mount functions differ in the screen, the list endpoint and the POST or PATCH handler, which each test reads |  |
| 23 | `apps/web/src/screens/chores/chores-offline-queue.test.tsx` 87-104 | `apps/web/src/screens/chores/errands-offline-queue.test.tsx` 83-99 | 18 | E | kept: the hooks are a variant of `registerHouseholdClock` (a literal instant, `setOnline(true)` through `act`, `onlineManager` reset before unstub), and the first test then drives a different list |  |
| 24 | `apps/web/src/screens/chores/chores.test.tsx` 153-175 | `apps/web/src/screens/chores/errands.test.tsx` 90-111 | 23 | C | kept: the hook pair is the fake clock plus the pointer stub with a leading `onlineManager` reset in `afterEach`, a variant of both `registerHouseholdClock` and `registerBrowserStubs`; `openMenu(user, element)` takes the trigger element, not its name |  |
| 25 | `apps/web/src/screens/chores/chores.test.tsx` 388-397 | `apps/web/src/screens/chores/errands.test.tsx` 351-360 | 10 | C | kept: the gamification-words assertion block belongs to each screen's own copy test and mounts a different screen |  |
| 26 | `apps/web/src/screens/chores/chores.test.tsx` 64-74 | `apps/web/src/screens/chores/errands.test.tsx` 39-54 | 11 | C | removed | b6569aa |
| 27 | `apps/web/src/screens/deals/deal-card.test.tsx` 16-30 | `apps/web/src/screens/onboarding/onboarding.test.tsx` 31-45 | 15 | F | removed | a876868 |
| 28 | `apps/web/src/screens/deals/deal-search.test.tsx` 21-37 | `apps/web/src/screens/deals/favorites.test.tsx` 19-35 | 17 | F | kept: the viewer-zone `vi.hoisted` block and its `afterAll` must run before any import, so it cannot call a helper |  |
| 29 | `apps/web/src/screens/deals/deal-search.test.tsx` 21-37 | `apps/web/src/screens/deals/flyers.test.tsx` 23-39 | 17 | F | kept: the viewer-zone `vi.hoisted` block and its `afterAll` must run before any import, so it cannot call a helper |  |
| 30 | `apps/web/src/screens/deals/deal-search.test.tsx` 75-89 | `apps/web/src/screens/deals/flyers.test.tsx` 54-67 | 15 | F | removed | b6569aa |
| 31 | `apps/web/src/screens/deals/deal-search.test.tsx` 21-37 | `apps/web/src/screens/meals/suggestions.test.tsx` 15-31 | 17 | F | kept: the viewer-zone `vi.hoisted` block and its `afterAll` must run before any import, so it cannot call a helper |  |
| 32 | `apps/web/src/screens/deals/favorites.test.tsx` 26-41 | `apps/web/src/screens/deals/flyers.test.tsx` 30-45 | 16 | F | kept: the shared lines are the tail of the `vi.hoisted` block and its `afterAll`; the handler tables now come from `dealScreenHandlers` |  |
| 33 | `apps/web/src/screens/deals/favorites.test.tsx` 26-37 | `apps/web/src/screens/meals/suggestions.test.tsx` 22-33 | 12 | F | kept: the viewer-zone `vi.hoisted` block and its `afterAll` must run before any import, so it cannot call a helper |  |
| 34 | `apps/web/src/screens/meals/household-timezone.test.tsx` 103-119 | `apps/web/src/screens/meals/recipe-detail.test.tsx` 26-42 | 17 | D | kept: the inline empty deal search moved to `emptyDealSearch`; the 9 lines left are four handler entries, while the profile and household entries differ (abroad profile, injectable household) |  |
| 35 | `apps/web/src/screens/meals/recipe-detail.test.tsx` 67-80 | `apps/web/src/screens/meals/recipe-library.test.tsx` 55-68 | 14 | C | removed | b6569aa |
<!-- web-rows-end -->

Web tests (`pnpm --filter @hearth/web test` in `../hearth-fixtures-wip` at `base=`, log
`05-04-web-before.log`): 57 files, 728 tests.

tests-before.web=728

## Web scans

| Label | Where | Clones | Duplicated lines | Cross-file | Cross-file test | Note |
| ----- | ----- | ------ | ---------------- | ---------- | --------------- | ---- |
| 05-04-t1 | after commit 96e17d6 | 85 | 1151 | 47 | 36 | `browser.ts` with `setOnline` and the stub pair; bill-detail and write-queue adopt it |
| 05-04-t2 | after commit b6569aa | 70 | 932 | 32 | 21 | `registerBrowserStubs` in bills-index, planner, recipe-detail, recipe-library; `setOnline`, `stubCoarsePointer` and `openMenu` elsewhere |
| 05-04 | after commit 8a7e8e4 | 66 | 858 | 28 | 17 | household clock, `WithQueue`, deals handler table, `stubFetch`, `emptyDealSearch`; final web scan |

after-05-04-clones=66
after-05-04-duplicated-lines=858
web-cross-test-left=14

The final scan is 33 below the starting 99 and 30 below the Phase 2 baseline of 96, within the Phase 5
bar of at most 90 and the plan's at most 80. No clone pair in it names `browser.ts`, `harness.tsx`,
`deal-fixtures.ts`, `stack-hooks.ts` or `job-logger.ts`. Of its 28 cross-file pairs, 17 have a test
side; 14 of those are web pairs (rows below marked `kept`) and 3 are the service rows 8, 13 and 15.
Commits in `../hearth-fixtures-wip`: 96e17d6 (online and pointer stubs), b6569aa (cluster C),
979f696 (household clock), d5e5d36 (`WithQueue`), a876868 (deals handler table and `stubFetch`),
8a7e8e4 (empty deal search).

tests-after.web=728

`pnpm --filter @hearth/web test` at 8a7e8e4 (log `05-04-web-after.log`): 57 files, 728 tests, equal to
`tests-before.web`; also 728 after the second commit (`05-04-web-t2.log`). Web typecheck, ESLint
(`--max-warnings=0`) and Prettier pass over `apps/web/src`. Per touched file the count of lines
matching the citation vocabulary equals the base `4e39165`.

## Web cluster C variants

Diffs in `.planning/cleanup/logs/05-04-variant-*.diff` (gitignored). Every local `setOnline` in
bill-detail, write-queue, bills-index, subscriptions, lists, planner, recipe-detail, recipe-library,
chores and errands equals the helper body (only `export` differs) and was replaced by the import.
Kept in place, with the difference:

- `deal-search.test.tsx` `setOnline`: only spies on `navigator.onLine` (no `onlineManager`, no event);
  its `afterEach` has no `onlineManager` reset. It adopts only `stubCoarsePointer()`.
- `shell.test.tsx` `setOnline`: no `onlineManager.setOnline`, only the window event; its `afterEach`
  restores mocks only. Not part of any scan pair; untouched.
- subscriptions and lists hooks (`setOnline(true)` before; online reset, unstub, restore after): no
  pointer stub, so `registerBrowserStubs()` would add one; they keep their hooks.
- chores and errands hooks: fake `Date` clock, `setOnline(true)`, pointer stub; `afterEach` resets
  `onlineManager`, then real timers, unstub, restore. They adopt `setOnline` and `stubCoarsePointer()`.
- `openMenu`: bill-detail and bills-index bodies are identical (`user`, trigger name) and use the
  helper; chores and errands share a second body (`user`, trigger element) that stays local.
- `mountWithFetchStub` was not added: after the helper edits no `createFetchStub` plus `vi.stubGlobal`
  plus `renderScreen` sequence remains as a scan pair, so it would remove zero pairs.

## Web clusters D to G

- D, household clock: `registerHouseholdClock(instant)` replaces the identical hook pair in the bills,
  chores and dashboard household-timezone tests. The meals household-timezone hooks differ (a pointer
  stub and an `onlineManager` reset between the timer and unstub steps) and stay; its local
  `stubMobileMatchMedia` became `stubCoarsePointer()`.
- E, offline queue: `WithQueue` is exported once from `harness.tsx` and replaces six identical copies
  (write-queue, chores, errands, both offline-queue files, lists), diffs saved. The two offline-queue
  files also take `setOnline` from `browser.ts`; their clock hooks stay, as the table says.
- F, deals: `dealScreenHandlers(extra)` (session, household, merchants) in `deal-fixtures.ts` backs
  deal-search, flyers and favorites; lists and search stay in the files that use them, and favorites
  does not gain a lists handler. `stubFetch` in `harness.tsx` replaces the identical local copies in
  deal-card and onboarding and the bodies of the favorites and flyers `stub` wrappers. The four
  `vi.hoisted` viewer-zone blocks stay (hoisted code runs before imports; see "Dates and time zones" in
  `docs/testing.md`). `emptyDealSearch` replaces the same inline body in recipe-detail (twice) and
  meals household-timezone.
- G, session handler: App.test and settings.test share two handler entries over their own
  `HOUSEHOLDS` and `MEMBERS` tables; a helper would be longer than the copies, so row 1 is `kept`.

## CI

Not run yet: integration files run in PR B's CI (05-05).

## PR B head (05-05)

wb-after-a=1ab61703f46e17e00564cbe639b6ec1ec8977a0c
pr-b-branch=test/shared-fixtures
pr-b-patch-id=4e14160077f92434539b1111d2fab446a0b88000
pr-b-head-initial=13fcc016555f06e603eec0551fb9732d4cc392df

`test/shared-fixtures` was cut from the synced working branch tip (`wb-after-a=`, which contains
PR A's squash commit `ac8ef34`) in `../hearth-fixtures`, and the nine fixture commits of
`test/shared-fixtures-wip` (`base=..8a7e8e4`) were cherry-picked with no conflict. The
`git patch-id --stable` of `git diff {base} origin/test/shared-fixtures-wip -- apps` equals that of
`git diff {wb-after-a} HEAD -- apps` on the new branch (`pr-b-patch-id=`). Merging the working branch
in was a no-op. The branch touches 41 files, all under `apps/service/src/` and `apps/web/src/`,
besides the `.planning/` state that rides along (D-04). It is pushed at `pr-b-head-initial=`.
