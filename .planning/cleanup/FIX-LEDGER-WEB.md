# Fix ledger: PR 1 (web fixes FIX-01, FIX-02, FIX-04)

base=9819e7c1436a8ad984f459c9fcb3e62fa68e0806
branch=fix/list-adds-rotation
continuation=fix/list-adds-lock

Raw logs are under `.planning/cleanup/logs/` (gitignored) as `04-01-{fix}-{red,green}.log`.

## Red and green

| FIX | Test | Red (unfixed) | Green (fixed) | Commit |
| --- | --- | --- | --- | --- |
| FIX-01 | `apps/web/src/screens/deals/deal-card.test.tsx`, `describe('adding a deal after a lost response')` (4 cases) | `pnpm --dir ../hearth-list-adds-rotation --filter @hearth/web exec vitest run src/screens/deals/deal-card.test.tsx`: exit=1, 2 failed / 15 passed. FAIL `sends the same item id on the retry, so the deal lands once`: `AssertionError: expected 'af845729-3a21-4090-aec1-b47bf64d1727' to be '19360e28-5786-4e3e-b2cc-17efcc059796'` at `expect(ids[1]).toBe(ids[0])`. FAIL `keeps the id of a failed add for its list while the deal goes to another list`: `AssertionError: expected '3af8f168-0510-42a9-931b-4e266bcae7c2' to be '589a96bf-7e61-4a6a-a2fe-fad143f26a52'` at `expect(toThisWeek[1]).toBe(toThisWeek[0])`. The other two new cases (new id after a success; no id carried to another list) pass on the unfixed hook, as designed: they guard against over-fixing. | same command: exit=0, `Tests  17 passed (17)`; `vitest run src/screens/deals`: 5 files, 57 passed; web typecheck, ESLint `--max-warnings=0` and Prettier clean on both files | d4b01b2a394c036aa1fbc69073de6f07ff772799 (`fix/list-adds-rotation`) |

## Findings

- FIX-01: the D-01 sequence reproduces. A POST that lands and then loses its response makes the card show `OFFLINE_MESSAGE`; the next tap on the unfixed hook posts a new `crypto.randomUUID()`, so the server-side store (one row per id, `on conflict (id) do nothing`) holds the deal twice. Fixed by holding the id per `${listId}:${dealId}` until a success (a single slot is not enough: test 4 fails with one, because a success on list B would forget list A's held id). Held ids live in the hook's memory; a reload between the failure and the retry mints a new id (persisting them would be the offline-queue capability CONTEXT defers).

## Gates and decisions

## CI
