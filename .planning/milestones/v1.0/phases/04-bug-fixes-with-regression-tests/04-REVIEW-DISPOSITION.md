# Phase 4 code review: finding dispositions

Source: `04-REVIEW.md` (standard depth, 15 files, 0 critical, 5 warning, 4 info). Advisory: the review does not block the phase. Every finding starts as `open`; none has been triaged or fixed.

| Finding | Severity | Disposition | Note |
| --- | --- | --- | --- |
| WR-01 | warning | open | `POST /auth/v1/otp` stays routable to the anon key; with signup enabled and autoconfirm on it may still create users (reviewer's reading of GoTrue, not yet checked on a running stack). Owner approved keeping `otp` (A5); needs an owner decision |
| WR-02 | warning | fixed and merged (PR 19, squash a0317ce) | Held deal-add id lived in a per-card hook instance, lost on unmount. Now held per QueryClient and signed-in user; pushed at c69569a70c8d31c601961f6713abeaf949d03b50, awaiting the owner's PR (see `.planning/cleanup/FIX-LEDGER-HELD-ID.md`) |
| WR-03 | warning | open | `<button draggable>` drag may not start in Firefox (research A1, caveat already noted in PR 1) |
| WR-04 | warning | open | Add-member focus path untested; focus request can be stolen or left pending |
| WR-05 | warning | open | PATCH-default guard does not descend into nested objects or arrays |
| IN-01 | info | open | `admin/users` exposed on the production gateway for the E2E seed (owner exception D-14) |
| IN-02 | info | open | Add-to-list lock scope notes; concurrency test proves the lock only by timing |
| IN-03 | info | open | No guard for an empty password in `deploy.sh`; stub test cannot prove the real CLI honors `PGPASSWORD` |
| IN-04 | info | open | Inert drag-handle button; unneeded cast |
