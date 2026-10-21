---
phase: 04-bug-fixes-with-regression-tests
plan: 01
subsystem: web-fixes
tags: [react, tanstack-query, jsx-a11y, advisory-lock, regression-tests, fix-ledger]

requires:
  - phase: 03-evidence-gated-removal
    provides: "main at 9819e7c, the base of every Phase 4 branch"
provides:
  - "fix/list-adds-rotation (PR 1 head): FIX-01 held-id hook, FIX-04 rotation editor without a suppression, FIX-02 replay and overlap tests without the fix"
  - "fix/list-adds-lock: the PR 1 head plus one commit, the per-list add-to-list advisory lock, ready to fast-forward in 04-02"
  - ".planning/cleanup/FIX-LEDGER-WEB.md with the FIX-01 and FIX-04 red and green rows and the FIX-02 finding"
affects: [04-02 (opens PR 1, records the red and green test-integration runs, fast-forwards the lock), 04-08 (ledger index)]

actuals:
  tokens: 6500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A useRef Map holds a client-generated id per (list, deal) until a success, so a retry after a lost response is a server-side replay"
    - "Draggable grip as a native button (tabIndex -1) with the drop target on a role=presentation row inside the li, so jsx-a11y needs no suppression"
    - "Transaction-scoped pg_advisory_xact_lock keyed add-to-list:{listId}, spelled as recordListActivity spells its lock"

key-files:
  created:
    - apps/web/src/components/chores/RotationEditor.test.tsx
    - .planning/cleanup/FIX-LEDGER-WEB.md
  modified:
    - apps/web/src/lib/api/deals.ts
    - apps/web/src/screens/deals/deal-card.test.tsx
    - apps/web/src/components/chores/RotationEditor.tsx
    - apps/service/src/meal-plan.integration.test.ts
    - apps/service/src/services/add-to-list.ts

key-decisions:
  - "FIX-01 uses a Map keyed by list and deal, not a single slot: a success on list B would otherwise forget list A's held id, and test 4 fails with a single slot"
  - "FIX-04 keeps drag (D-05): the grip is a draggable button out of the Tab order and the drop target is a role=presentation row; Up, Down and Remove are untouched, so the focusRequest effect is unchanged"
  - "FIX-02 is a real leak only for overlapping calls: sequential replay is a no-op and a bought item is added again by design, so the fix is the per-list lock alone (no migration, no contract change, D-13)"
  - "The lock lives one commit ahead of the PR branch so PR 1's CI can run the overlap test red first (rule 4)"

requirements-completed: []

plan_head_before: 68a82b9ca856612e4c86d8c9789a9f103991abf8
plan_head_after: b0d26059411d05e12d044f3a8d606b9390537d6d
commits: 3

coverage:
  - id: D1
    description: "Adding a deal after a lost response sends the same item id, so the list holds one item; a success mints a fresh id; ids never cross lists"
    requirement: FIX-01
    verification:
      - kind: unit
        ref: "apps/web/src/screens/deals/deal-card.test.tsx#adding a deal after a lost response (4 cases; 2 red on the unfixed hook, all green after)"
        status: pass
    human_judgment: false
  - id: D2
    description: "RotationEditor has no lint suppression, is operable by keyboard alone, and drag still works through a real button"
    requirement: FIX-04
    verification:
      - kind: unit
        ref: "apps/web/src/components/chores/RotationEditor.test.tsx (7 cases)"
        status: pass
      - kind: other
        ref: "pnpm exec eslint --max-warnings=0 apps/web/src/components/chores/RotationEditor.tsx apps/web/src/components/chores/RotationEditor.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Overlapping add-recipe-to-list calls add each ingredient once (lock) and the replay and bought-item cases are pinned"
    requirement: FIX-02
    verification:
      - kind: integration
        ref: "apps/service/src/meal-plan.integration.test.ts#when the same call arrives again"
        status: unknown
    human_judgment: true
    rationale: "The integration tests need the Supabase stack, which the cloud box lacks; their red (PR head 1571f07) and green (lock 2e357e5) come from PR 1's test-integration runs in plan 04-02"

duration: 12min
completed: 2026-10-20
status: complete
---

# Phase 4 Plan 01: Web fixes, rotation editor and add-to-list lock Summary

**A deal added after a lost response now lands once (id held per list and deal until a success), the rotation editor passes jsx-a11y strict with no `eslint-disable` and a keyboard-only test file, and the overlapping recipe add-to-list leak has red-ready tests on the PR branch with its advisory-lock fix one commit ahead.**

## Performance

- **Duration:** about 12 min
- **Started:** 2026-10-20T13:38Z (approximate; the start time was not captured before the first command)
- **Completed:** 2026-10-20T13:51Z
- **Tasks:** 3 (one tracer, two auto with `tdd="true"`)
- **Files modified:** 6 code files across two branches, plus the ledger

## Accomplishments

- **FIX-01.** `useAddDealToList` keeps a `Map` of ids keyed `${listId}:${dealId}` in a `useRef`; `mutationFn` reuses or mints, `onSuccess` deletes the key, an error clears nothing. The D-01 sequence (POST lands, response lost, offline toast, second tap) reproduced on the unfixed hook: two of the four new tests failed (`expected 'af845729-...' to be '19360e28-...'` and the held-per-list case), all four pass after.
- **FIX-04.** The `<li>` lost all five drag props and the `eslint-disable`; the row is a `role="presentation"` div that takes `onDragOver`/`onDrop`, and the grip is a draggable `<button tabIndex={-1}>` named `Drag {name} to reorder`. Red was the lifted suppression (`jsx-a11y/no-noninteractive-element-interactions` at the `<li>`, exit 1) plus the one failing pointer test; the six keyboard cases already passed on the unfixed component, as research predicted.
- **FIX-02.** Three integration cases sit on the PR head with `add-to-list.ts` equal to `origin/main`. `fix/list-adds-lock` adds the per-list lock in one commit that touches only `add-to-list.ts`. Sequential replay is a no-op (guard kept), a bought item is added again by design (rule pinned), and the overlap case is the one expected red in PR CI.

## Task Commits

All code commits are on sibling branches; both are pushed.

1. **Task 1 (tracer): FIX-01** - `d4b01b2a394c036aa1fbc69073de6f07ff772799` (`fix/list-adds-rotation`, fix)
2. **Task 2: FIX-04** - `f1e16fde3892b29cce4d448392a03ac511fb2715` (`fix/list-adds-rotation`, fix)
3. **Task 3a: FIX-02 tests (PR 1 head)** - `1571f0778aab255b9c4b75b7489e2b90725c27d9` (`fix/list-adds-rotation`, test)
4. **Task 3b: FIX-02 lock** - `2e357e59b97eefd10eef478f5912710347454a36` (`fix/list-adds-lock`, fix; exactly one commit ahead of 3a)

**Working-branch commits (`claude/trusting-lovelace-y4r87h`, the measured `commits: 3` above):** `docs: record the FIX-01 red and green runs`, `docs: record the FIX-04 red and green runs`, `docs: record the FIX-02 finding and its pending CI runs`. The plan metadata commit (`docs: complete plan 04-01`) follows them.

## Red and green evidence

The full rows are in `.planning/cleanup/FIX-LEDGER-WEB.md`; raw logs are in the gitignored `.planning/cleanup/logs/04-01-*`.

| FIX | Red (unfixed) | Green (fixed) |
| --- | --- | --- |
| FIX-01 | `vitest run src/screens/deals/deal-card.test.tsx`: exit=1, 2 failed / 15 passed (`sends the same item id on the retry, so the deal lands once`; `keeps the id of a failed add for its list while the deal goes to another list`) | exit=0, 17 passed; `src/screens/deals` 57 passed |
| FIX-04 | ESLint on the component with line 132 removed: exit=1, `jsx-a11y/no-noninteractive-element-interactions` at 132:11; new test file: exit=1, 1 failed / 6 passed (`reorders by dragging a member's handle onto another row`) | test exit=0, 7 passed; ESLint exit=0, `grep -c eslint-disable` prints 0; `src/components/chores src/screens/chores` 59 passed |
| FIX-02 | pending PR 1 CI (`test-integration` at 1571f07) | pending PR 1 CI (lock 2e357e5); local gates on both heads green, service unit suite 725 passed |

RED semantic assessment: each red failed on the planned assertion for the intended reason (a retry carrying a different id; a missing drag-handle button; the named lint rule at the `<li>`), not on a syntax, fixture or import fault. The FIX-02 red could not be run here (no Docker) and is deferred to CI by plan rule 4.

## Decisions Made

See `key-decisions` above. One finding to carry forward: FIX-01 held ids live in the hook's memory, so a reload or remount between the failure and the retry mints a new id; persisting them would be the offline-queue capability CONTEXT defers. For FIX-04 the Firefox caveat (A1: a `<button>` may not start a drag there) goes in the PR 1 description; Up and Down remain the guaranteed alternative.

## Deviations from Plan

None - plan executed exactly as written.

Small notes that are not deviations: the test's two `target as Element` casts were rewritten to `target!` because `@typescript-eslint/non-nullable-type-assertion-style` rejected the casts; and the FIX-04 commit message was amended once, before its first push, to correct a count ("five" drag props, not "six"). Plan rule 1 creates `fix/*` branches, so the executor's generic `agent-*` branch-name allow-list was not applied to them (the protected-branch check was).

## Issues Encountered

None. No fix attempt was repeated, and no auth gate or checkpoint was hit.

## Known Stubs

None.

## Threat Flags

None. T-04-01 (id reuse across lists) is mitigated by the per-pair key and tests 3 and 4; T-04-02 (overlapping add-to-list) by the lock on `fix/list-adds-lock`, with its CI proof pending in 04-02. No new endpoint, auth path or schema change was added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 04-02: open PR 1 at `1571f0778aab255b9c4b75b7489e2b90725c27d9` (no fix for FIX-02), wait for `test-integration` to fail on `two calls in flight at once add each ingredient once`, then fast-forward `fix/list-adds-lock` onto `fix/list-adds-rotation` (`git merge-base --is-ancestor` first) and record the green run. The PR 1 description should state the D-13 assumption (the lock) and the Firefox drag caveat. No pull request exists yet, and nothing was pushed to `main`.

## Self-Check: PASSED

- All six code files exist on `fix/list-adds-lock`; the ledger exists and is committed.
- Commits d4b01b2, f1e16fd, 1571f07 and 2e357e5 are ancestors of `fix/list-adds-lock`; `fix/list-adds-rotation` and `fix/list-adds-lock` are pushed at their tips.
- Task 1, 2 and 3 `<verify>` commands each printed OK; `git diff --name-only origin/main...fix/list-adds-lock` lists exactly the six PR 1 files, and nothing under `.planning`, `.claude`, `supabase`, `docker`, `.github`, `eslint.config.js`, `knip.json` or `apps/service/src/privileged` changed.

---
*Phase: 04-bug-fixes-with-regression-tests*
*Completed: 2026-10-20*
