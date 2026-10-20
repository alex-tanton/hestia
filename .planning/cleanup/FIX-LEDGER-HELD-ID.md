# Fix ledger: WR-02, held deal-add id at QueryClient scope (quick 261020-v7v)

base=48c111f79ecde910636805976752c94b5f615802
branch=fix/held-deal-id
worktree=../hearth-held-id
commits=c57ba1ad712760f7314ae3dc1cca1517cadf2f7f c69569a70c8d31c601961f6713abeaf949d03b50
pushed=c69569a70c8d31c601961f6713abeaf949d03b50
pr=19 (opened 2026-10-20 at c69569a70c8d31c601961f6713abeaf949d03b50; the owner squash-merges)

Raw logs are `.planning/cleanup/logs/261020-v7v-*.log` (gitignored).

## Red and green

| FIX | Test | Red (unfixed) | Green (fixed) | Commit |
| --- | --- | --- | --- | --- |
| WR-02 (unmount) | `apps/web/src/screens/deals/deal-card.test.tsx`: `sends the same item id after the card unmounts, so the deal lands once` | `pnpm --dir ../hearth-held-id --filter @hearth/web exec vitest run src/screens/deals/deal-card.test.tsx`, taken while `deals.ts` equalled origin/main's: exit=1, `Tests  1 failed \| 17 passed (18)`. FAIL `adding a deal after a lost response > sends the same item id after the card unmounts, so the deal lands once`: `AssertionError: expected '9e200a13-62af-4206-94a2-f75f3c37045f' to be 'cec7af9f-7531-4893-8d1b-64fb9a1191b1'` at `expect(ids[1]).toBe(ids[0])` | same command after the QueryClient-scoped holder: exit=0, `Tests  18 passed (18)`; final run after the user scope: exit=0, `Tests  19 passed (19)` | c57ba1ad712760f7314ae3dc1cca1517cadf2f7f (`fix/held-deal-id`) |
| WR-02 (user scope) | same file: `mints a fresh id when another user signs in on the same page` | same command against the QueryClient-only holder: exit=1, `Tests  1 failed \| 18 passed (19)`. FAIL `adding a deal after a lost response > mints a fresh id when another user signs in on the same page`: `AssertionError: expected 'dad2c98f-6ceb-4381-89e3-b1d94ec94c36' not to be 'dad2c98f-6ceb-4381-89e3-b1d94ec94c36'` at `expect(ids[1]).not.toBe(ids[0])` | same command after the holder is also scoped by user: exit=0, `Tests  19 passed (19)` | c69569a70c8d31c601961f6713abeaf949d03b50 (`fix/held-deal-id`) |

Gates in `../hearth-held-id` on the final head: `pnpm lint`, `pnpm format:check`, `pnpm typecheck` and `pnpm --filter @hearth/web test` all exit=0. The web suite: `Test Files  57 passed (57)`, `Tests  728 passed (728)`. `vitest run src/screens/deals`: 5 files, 59 passed. The branch diff against origin/main names exactly `apps/web/src/lib/api/deals.ts` and `apps/web/src/screens/deals/deal-card.test.tsx`.

## Findings

- (a) WR-02's scope is closed. A lost-response retry now carries the same id after the card unmounts (filter change, paging, navigating away and back) until the page reloads. The key (`${listId}:${dealId}`), the success-only clear, the hook signature and the API contract are unchanged.
- (b) The planner checked whether the QueryClient is cleared on sign-out or household switch. It is not: `main.tsx` builds one client for the page; sign-out only calls supabase-js; a household switch removes household-scoped queries only. Held ids are therefore also scoped to the signed-in user, and the guard case proves it. An id is only meaningful with its list, so a stale one was harmless, but the plan did not assume that.
- (c) Held ids still never expire. If an add lands and its response is lost, its id stays held until an add of that deal to that list succeeds. Any later tap on that deal for that list, whether a retry or a deliberate second add, reuses the id. The server keeps the one row that already landed, the tap is a no-op, and the toast still says Added. Before this fix that window lasted as long as the card. Now it lasts for the user's page session, ended by a reload or another user's sign-in. This is by design under the owner's rule that only a success clears an id. The reviewer's optional TTL and 4xx pruning were not adopted.
- (d) A reload between the failure and the retry still mints a new id. Ids are kept in memory only; persisting them is the offline-queue capability CONTEXT defers.
- (e) WR-03 (Firefox drag) was left out by the owner's choice.
