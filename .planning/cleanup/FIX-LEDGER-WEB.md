# Fix ledger: PR 1 (web fixes FIX-01, FIX-02, FIX-04)

base=9819e7c1436a8ad984f459c9fcb3e62fa68e0806
branch=fix/list-adds-rotation
continuation=fix/list-adds-lock

Raw logs are under `.planning/cleanup/logs/` (gitignored) as `04-01-{fix}-{red,green}.log`.

## Red and green

| FIX | Test | Red (unfixed) | Green (fixed) | Commit |
| --- | --- | --- | --- | --- |
| FIX-01 | `apps/web/src/screens/deals/deal-card.test.tsx`, `describe('adding a deal after a lost response')` (4 cases) | `pnpm --dir ../hearth-list-adds-rotation --filter @hearth/web exec vitest run src/screens/deals/deal-card.test.tsx`: exit=1, 2 failed / 15 passed. FAIL `sends the same item id on the retry, so the deal lands once`: `AssertionError: expected 'af845729-3a21-4090-aec1-b47bf64d1727' to be '19360e28-5786-4e3e-b2cc-17efcc059796'` at `expect(ids[1]).toBe(ids[0])`. FAIL `keeps the id of a failed add for its list while the deal goes to another list`: `AssertionError: expected '3af8f168-0510-42a9-931b-4e266bcae7c2' to be '589a96bf-7e61-4a6a-a2fe-fad143f26a52'` at `expect(toThisWeek[1]).toBe(toThisWeek[0])`. The other two new cases (new id after a success; no id carried to another list) pass on the unfixed hook, as designed: they guard against over-fixing. | same command: exit=0, `Tests  17 passed (17)`; `vitest run src/screens/deals`: 5 files, 57 passed; web typecheck, ESLint `--max-warnings=0` and Prettier clean on both files | d4b01b2a394c036aa1fbc69073de6f07ff772799 (`fix/list-adds-rotation`) |
| FIX-04 | `apps/web/src/components/chores/RotationEditor.test.tsx` (7 cases: 6 keyboard-only, 1 pointer) and the component's own lint | Part 1, the suppression lifted (line 132 deleted, then restored and confirmed clean): `pnpm --dir ../hearth-list-adds-rotation exec eslint --max-warnings=0 apps/web/src/components/chores/RotationEditor.tsx`: exit=1, `132:11  error  Non-interactive elements should not be assigned mouse or keyboard event listeners  jsx-a11y/no-noninteractive-element-interactions` (1 problem). Part 2, the new test on the unfixed component: `pnpm --dir ../hearth-list-adds-rotation --filter @hearth/web exec vitest run src/components/chores/RotationEditor.test.tsx`: exit=1, 1 failed / 6 passed. FAIL `the rotation editor, pointer > reorders by dragging a member’s handle onto another row`: `TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Drag Alex Rivera to reorder"`. The six keyboard cases pass on the unfixed component. | Test: exit=0, `Tests  7 passed (7)`. Lint: ESLint `--max-warnings=0` on the component and its test, exit=0, and `grep -c eslint-disable` on the component prints 0. `vitest run src/components/chores src/screens/chores`: 6 files, 59 passed; web typecheck and Prettier clean | f1e16fde3892b29cce4d448392a03ac511fb2715 (`fix/list-adds-rotation`) |
| FIX-02 | `apps/service/src/meal-plan.integration.test.ts`, `describe('when the same call arrives again')` (3 cases) | pending PR 1 CI (`test-integration` at PR head 1571f0778aab255b9c4b75b7489e2b90725c27d9, tests without the lock; the cloud box has no Docker, so no local run) | pending PR 1 CI (lock fast-forwarded onto the PR branch at 2e357e59b97eefd10eef478f5912710347454a36, `fix/list-adds-lock`) | 1571f0778aab255b9c4b75b7489e2b90725c27d9 (tests), 2e357e59b97eefd10eef478f5912710347454a36 (lock) |

## Findings

- FIX-04: keyboard path already worked; red is the lifted suppression and the drag-handle case; Firefox drag caveat A1
- FIX-02: a sequential replay is a no-op (guard kept: `a replay after a lost response changes nothing, item for item`). A bought item is added again by design (`docs/use-cases.md`: only needed and in-cart items count as on the list; guard kept: `adds an ingredient again once its item is bought, ...`). Overlapping calls duplicate every ingredient (research: 5 of 5 unfixed runs, 6 rows instead of 3), fixed by a per-list `pg_advisory_xact_lock` keyed `add-to-list:{listId}` after `requireList`, with no migration and no contract change (A3; D-13). Local gates on both heads (typecheck, ESLint, Prettier; service unit suite 725 passed on the lock head) are green; the integration tests need the Supabase stack, so red and green come from PR 1's CI (04-02).
- FIX-01: the D-01 sequence reproduces. A POST that lands and then loses its response makes the card show `OFFLINE_MESSAGE`; the next tap on the unfixed hook posts a new `crypto.randomUUID()`, so the server-side store (one row per id, `on conflict (id) do nothing`) holds the deal twice. Fixed by holding the id per `${listId}:${dealId}` until a success (a single slot is not enough: test 4 fails with one, because a success on list B would forget list A's held id). Held ids live in the hook's memory; a reload between the failure and the retry mints a new id (persisting them would be the offline-queue capability CONTEXT defers).

## Gates and decisions

## CI
