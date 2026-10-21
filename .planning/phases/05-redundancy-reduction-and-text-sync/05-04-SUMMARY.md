---
phase: 05-redundancy-reduction-and-text-sync
plan: 04
subsystem: testing
tags: [vitest, react-testing-library, test-helpers, jscpd, fixtures, web]

requires:
  - phase: 05-redundancy-reduction-and-text-sync
    provides: "05-02: test/shared-fixtures-wip with the service half, jscpd-compare.mjs and FIXTURE-LEDGER.md"
provides:
  - apps/web/src/test/browser.ts with setOnline, stubCoarsePointer, registerBrowserStubs, registerHouseholdClock and openMenu
  - WithQueue and stubFetch exported from apps/web/src/test/harness.tsx
  - dealScreenHandlers and emptyDealSearch in apps/web/src/test/deal-fixtures.ts
  - branch test/shared-fixtures-wip with the web half of PR B content (backup, never a PR head), pushed
  - FIXTURE-LEDGER.md with 35 web clone dispositions and the final scan
affects: [05-05 PR B landing, 05-13 redundancy index]

actuals:
  tokens: 5706
  tasks: 3
  commits: 6

plan_head_before: 053f3714623545921c33a498cb303906c1f7c42e
plan_head_after: 8a7e8e4fb40324104ff1ee5b4c0507b7d6b3f41d

tech-stack:
  added: []
  patterns:
    - "Registering test helpers (register...) are called at the top level of a test file exactly where the file's own beforeEach/afterEach pair stood, so hook order is unchanged; no web helper has a use prefix"
    - "A file whose hooks differ keeps them and adopts only the identical part (setOnline, stubCoarsePointer)"

key-files:
  created:
    - apps/web/src/test/browser.ts (branch test/shared-fixtures-wip)
    - .planning/cleanup/jscpd/phase5-05-04-t1/, phase5-05-04-t2/, phase5-05-04/ (jscpd-report.json each)
  modified:
    - "apps/web/src/test/harness.tsx, deal-fixtures.ts on test/shared-fixtures-wip"
    - "22 web test files on test/shared-fixtures-wip (bills, chores, lists, meals, deals, onboarding, offline write-queue)"
    - .planning/cleanup/FIXTURE-LEDGER.md

key-decisions:
  - "Only the identical part of a variant is shared: deal-search, shell and the subscriptions/lists hooks keep their own setOnline or hooks; chores and errands keep their clock-plus-pointer hooks and take setOnline and stubCoarsePointer()"
  - "openMenu(user, triggerName) is shared by bill-detail and bills-index; the chores/errands body takes the trigger element and stays local"
  - "No mountWithFetchStub: after the helper edits no mount sequence remains as a scan pair, so it would remove zero pairs"
  - "Added stubFetch (harness), dealScreenHandlers and emptyDealSearch (deal-fixtures) beyond the plan's named helpers, each replacing identical copies; favorites does not gain a lists handler"
  - "The four vi.hoisted viewer-zone blocks stay (hoisted code runs before imports)"

patterns-established:
  - "Comments attached to a moved block move into the helper doc comment; citation-vocabulary line counts equal the base in every touched file"

requirements-completed: []

duration: 35min
completed: 2026-10-21
status: complete
---

# Phase 5 Plan 04: Web fixture consolidation Summary

**Web component tests take their online, pointer, menu, household-clock and write-queue setup from `test/browser.ts` and `test/harness.tsx`, and their deals handler table from `deal-fixtures.ts`; the Phase 2 jscpd scan drops from 87 to 66 clones with 728 web tests before and after.**

## Performance

- **Duration:** 35 min
- **Completed:** 2026-10-21
- **Tasks:** 3 (one tracer, two auto)
- **Files modified:** 24 files (203 insertions, 418 deletions) on `test/shared-fixtures-wip`; the ledger and three scans on the working branch

## Accomplishments

- Task 1 (tracer): `apps/web/src/test/browser.ts` exports `setOnline`, `stubCoarsePointer` and `registerBrowserStubs`; bill-detail and write-queue adopt it. Scan 87 to 85 clones, web suite 26 tests green, before expanding.
- Task 2: `registerBrowserStubs()` replaces the identical hook pair in bills-index, planner, recipe-detail and recipe-library; every identical `setOnline` (subscriptions, lists, chores, errands too) and the pointer stub (deal-search, chores, errands) come from the helper; `openMenu(user, triggerName)` serves bill-detail and bills-index. Scan 70 clones.
- Task 3: `registerHouseholdClock(instant)` replaces the identical fake-clock hooks in the bills, chores and dashboard household-timezone tests; `WithQueue` is exported once from `harness.tsx` and replaces six identical copies; `dealScreenHandlers` backs deal-search, flyers and favorites; `stubFetch` replaces the copies in deal-card and onboarding; `emptyDealSearch` replaces three inline bodies. Final scan 66 clones, 858 duplicated lines (baseline 99 and 1,472; Phase 2 reference 96 and 1,438), at most 80 as planned.
- Web suite: 57 files, 728 tests before, after Task 2 and at the end. Typecheck, ESLint (`--max-warnings=0`) and Prettier pass over `apps/web/src`; per touched file the citation-vocabulary line count equals the base.

## Branches and commits

| Where | SHA | Subject |
| ----- | --- | ------- |
| test/shared-fixtures-wip | 96e17d6 | test(web): share the online and pointer stubs |
| test/shared-fixtures-wip | b6569aa | test(web): use the shared online, pointer and menu helpers |
| test/shared-fixtures-wip | 979f696 | test(web): share the household clock setup |
| test/shared-fixtures-wip | d5e5d36 | test(web): share WithQueue for the offline queue tests |
| test/shared-fixtures-wip | a876868 | test(web): share the deals handler table |
| test/shared-fixtures-wip | 8a7e8e4 | test(web): share the empty deal search response |
| working branch | 8d44e91 | docs: record the first web fixture scan |
| working branch | 36d64aa | docs: record the web cluster C fixture scan |
| working branch | 7a6da0b | docs: record the web fixture consolidation |

`test/shared-fixtures-wip` tip is 8a7e8e4fb40324104ff1ee5b4c0507b7d6b3f41d, six commits on 053f371 (05-02's tip), pushed; its diff against `4e39165` lists only files under `apps/service/src/` and `apps/web/src/`. No pull request was opened. `commits: 6` is measured on the code branch (`git rev-list --count 053f371..8a7e8e4`); the three working-branch commits are ledger and scan records.

## Clone totals and test counts

| Scan | Clones | Duplicated lines | Cross-file | Cross-file test |
| ---- | ------ | ---------------- | ---------- | --------------- |
| 05-02 (service final, start of this plan) | 87 | 1199 | 49 | 38 |
| 05-04-t1 | 85 | 1151 | 47 | 36 |
| 05-04-t2 | 70 | 932 | 32 | 21 |
| 05-04 (final) | 66 | 858 | 28 | 17 |

Web unit suite: `tests-before.web=728`, `tests-after.web=728` (57 files). No clone pair names `browser.ts`, `harness.tsx`, `deal-fixtures.ts`, `stack-hooks.ts` or `job-logger.ts`.

## Dispositions (35 web pairs: 21 removed, 14 kept)

| Pair | Why it stays |
| ---- | ------------ |
| App / settings (session handler, 10 lines) | two-file duplicate shorter than a helper; `HOUSEHOLDS` and `MEMBERS` are each file's own tables |
| bills-index with subscriptions, lists, recipe-library (retry assertion, 9 lines, three rows) | the assertion sits inside each screen's own test and names its own endpoint |
| chores / errands (hooks plus `openMenu(user, element)`, 19 lines) | hooks are the fake clock plus the pointer stub with a leading `onlineManager` reset, a variant of both helpers; `openMenu` takes the element |
| chores / errands (gamification-words assertion, 10 lines) | belongs to each screen's own copy test |
| chores-offline-queue / errands-offline-queue (mount, 9 lines; hooks and first test, 18 lines) | mounts differ in endpoint and write handler; hooks are a variant of `registerHouseholdClock` |
| deal-search with favorites, flyers, suggestions; favorites with flyers and suggestions (five rows) | the `vi.hoisted` viewer-zone block and its `afterAll` run before imports |
| meals household-timezone / recipe-detail (9 lines) | four handler entries; the profile and household entries differ |

## Deviations from Plan

### Auto-fixed Issues

None for code. Notes on how the plan's conditional steps resolved:

- Task 2 step 3: `mountWithFetchStub` not added (it would remove zero pairs).
- Task 3 step 3: beyond `dealScreenHandlers`, the plan's "likewise" for deal-card versus onboarding became `stubFetch` in `harness.tsx` (identical local copies), and the same inline empty deal search body in three places became `emptyDealSearch`. Both are test-helper additions that replace copies without changing any test.
- Task 3 step 4: G kept (no fold).
- The plan names the working branch `claude/vigilant-gates-a4ihid`; the session's working branch is `claude/eloquent-mayer-szjtjf`, as recorded by 05-01 and directed by the orchestrator. Working-branch commits were path-limited.
- The orchestrator committed `5a4a88c` on the working branch during this plan; pushes of the working branch stayed fast-forward.

**Total deviations:** 0 auto-fixed. **Impact:** none on scope or behavior; no test renamed, added or removed.

## Issues Encountered

None. Both pushes used the default credentials, so no token helper was needed; the tracked token scan printed nothing and the token value scan passed.

## Known Stubs

None.

## Threat Flags

None. The helpers add no network, auth or file-access surface; no package was added. `registerHouseholdClock` takes an explicit instant, so no helper reads the real clock (T-05-10).

## Next Phase Readiness

PR B's content (service and web) is complete on `test/shared-fixtures-wip`; 05-05 lands it after PR A merges. The scan is 66 clones against the Phase 5 bar of 90. RED-03 stays pending until PR B merges.

## Self-Check: PASSED

- Files found: `browser.ts`, `harness.tsx`, `deal-fixtures.ts` (in `../hearth-fixtures-wip`), `.planning/cleanup/FIXTURE-LEDGER.md`, the three scan reports.
- Commits found as ancestors of their branch tips: 96e17d6, b6569aa, 979f696, d5e5d36, a876868, 8a7e8e4 (test/shared-fixtures-wip); 8d44e91, 36d64aa, 7a6da0b (working branch).
- Plan verification (Task 3 command) printed VERIFY-PASS: helpers exported, equal web counts, scan 66 (at most 80), all 35 rows dispositioned, citation lines equal, no token pattern, both branches pushed at their tips.
