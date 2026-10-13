# Baseline - untouched main

Measured from a detached, unmodified checkout of d3da748 (the curated `main` tip published in Phase 1). Plan 02-01, BASE-01, D-11.

## Environment

- Commit: `d3da748223fb85432fc06defaa25ac00ac4ed258` (`git worktree add --detach`, no branch; `git status --porcelain` was empty before the install and again after both runs and the TZ variants)
- `node --version`: v24.21.0
- `pnpm --version`: 10.34.5
- `supabase --version`: 2.117.0

Toolchain: .planning/environment/cloud-check.sh exited 0

Docker: absent (path b) - the `docker` binary exists but its daemon is not reachable, so `supabase start` was not attempted; integration rows come from CI

Other facts:

- OS: `Linux vm 6.18.44-fc-v114 #1 SMP PREEMPT_DYNAMIC @0 x86_64 GNU/Linux`
- Machine time zone: `UTC` (session `TZ` unset throughout)
- Measured: Monday 2026-10-12, 22:12 to 22:24 UTC (22:12 to 22:24 local, same zone)
- Run 1 web suite started 2026-10-12T22:14:55Z; run 2 web suite started 2026-10-12T22:17:42Z
- Worktree was clean before measuring; `pnpm install --frozen-lockfile` only (no dependency change, no config edit, no fix)

## Results

Run 1 and run 2 are two full passes over untouched d3da748. `test:integration` and `test:coverage` were first recorded from CI (path b) because Docker was not usable in the session. They were re-measured later in the same session on a fresh detached d3da748 worktree against the local `supabase start` stack (path a), so those rows now carry real counts. The CI step conclusions are kept in the Integration section as a cross-check.

| Command | Run | Exit | Passed | Failed | Duration | Log |
|---------|-----|------|--------|--------|----------|-----|
| typecheck | 1 | 0 | n/a | n/a | not timed | logs/baseline/run1-typecheck.log |
| typecheck | 2 | 0 | n/a | n/a | 15s | logs/baseline/run2-typecheck.log |
| lint | 1 | 0 | n/a | n/a | 44s | logs/baseline/run1-lint.log |
| lint | 2 | 0 | n/a | n/a | 44s | logs/baseline/run2-lint.log |
| format:check | 1 | 0 | n/a | n/a | 8s | logs/baseline/run1-format-check.log |
| format:check | 2 | 0 | n/a | n/a | 8s | logs/baseline/run2-format-check.log |
| test:web | 1 | 1 | 714 | 1 | 72s | logs/baseline/run1-web.log, run1-web.json |
| test:web | 2 | 1 | 714 | 1 | 73s | logs/baseline/run2-web.log, run2-web.json |
| test:service | 1 | 0 | 716 | 0 | 16s | logs/baseline/run1-service.log, run1-service.json |
| test:service | 2 | 0 | 716 | 0 | 15s | logs/baseline/run2-service.log, run2-service.json |
| test:shared | 1 | 0 | 148 | 0 | 2s | logs/baseline/run1-shared.log, run1-shared.json |
| test:shared | 2 | 0 | 148 | 0 | 3s | logs/baseline/run2-shared.log, run2-shared.json |
| test:recurrence | 1 | 0 | 77 | 0 | 4s | logs/baseline/run1-recurrence.log, run1-recurrence.json |
| test:recurrence | 2 | 0 | 77 | 0 | 4s | logs/baseline/run2-recurrence.log, run2-recurrence.json |
| test:matching | 1 | 0 | 156 | 0 | 1s | logs/baseline/run1-matching.log, run1-matching.json |
| test:matching | 2 | 0 | 156 | 0 | 1s | logs/baseline/run2-matching.log, run2-matching.json |
| test:e2e-unit | 1 | 0 | 6 | 0 | 1s | logs/baseline/run1-e2e-unit.log |
| test:e2e-unit | 2 | 0 | 6 | 0 | 1s | logs/baseline/run2-e2e-unit.log |
| test:integration | 1 | 0 | 426 | 0 | 4m24s | logs/baseline/docker-run1-integration.log |
| test:integration | 2 | 0 | 426 | 0 | 4m28s | logs/baseline/docker-run2-integration.log |
| test:coverage | 1 | 0 | 1142 | 0 | 5m9s | logs/baseline/docker-run1-coverage.log |
| test:coverage | 2 | 0 | 1142 | 0 | 5m31s | logs/baseline/docker-run2-coverage.log |
| build | 1 | 0 | n/a | n/a | 3s | logs/baseline/run1-build.log |
| build | 2 | 0 | n/a | n/a | 3s | logs/baseline/run2-build.log |

Log paths are relative to `.planning/cleanup/` and are never committed (the directory is gitignored). Web suite size: 715 tests in 56 files; service: 716 tests in 54 files.

## Failures

One failing test exists on untouched main, and it fails in both runs, so it is `pre-existing`. No failure occurred in only one run, so nothing is `flaky`.

| Test (file > full name) | Runs failed | Label |
|-------------------------|-------------|-------|
| `apps/web/src/screens/deals/favorites.test.tsx` > favorite stores keeps the stale list with its as-of date rather than emptying | run 1, run 2 (also all four TZ variants below) | pre-existing |

Failure message (run 1 and run 2): `Unable to find an element with the text: As of 09/24/2026, 4:00 AM.` This is the same test CI's `test-unit` job fails on at d3da748 (`pnpm test` step failed in both CI runs; the CI job logs could not be read, so the CI failing-test name is not independently confirmed, only the failed step).

typecheck, lint, format:check, build, and the service, shared, recurrence, matching and e2e-unit suites: no failures in either run.

Failures seen only in a time-zone variant (not in run 1 or run 2, so the pre-existing/flaky labels, which are defined over runs 1 and 2, do not apply). All four fail only under `TZ=Pacific/Pago_Pago`, at 2026-10-12T22:23:04Z:

- `apps/web/src/screens/deals/deal-search.test.tsx` > deal search keeps stale results with their as-of date instead of showing nothing (expected `/Showing deals as of 09\/25\/2026/`)
- `apps/web/src/screens/deals/flyers.test.tsx` > browsing flyers shows cached flyers with their as-of date rather than nothing (expected `/Showing deals as of 09\/24\/2026/`)
- `apps/web/src/screens/meals/suggestions.test.tsx` > Deal-matched suggestions (Design › Screens › 13) ranks by readiness descending, ties broken by title, and states the deal week and as-of date (expected `/09\/25\/2026/`)
- `apps/web/src/screens/deals/favorites.test.tsx` (the pre-existing one above, again)

## Time-dependent web test files

Cells are `pass` or `fail (n test)` for the file in that run. Columns `TZ=...` are one web-suite run each, after run 2, with the zone set only in the spawned process environment; the zone Node resolved equalled the requested zone in every case. d3da748 has no clock hook, so all of these used the real current instant.

| File | tests | run 1 | run 2 | TZ=UTC | TZ=America/Los_Angeles | TZ=Pacific/Kiritimati | TZ=Pacific/Pago_Pago |
|------|-------|-------|-------|--------|------------------------|-----------------------|----------------------|
| `apps/web/src/lib/bills/recurrence-preview.test.ts` | 8 | pass | pass | pass | pass | pass | pass |
| `apps/web/src/screens/chores/chores.test.tsx` | 25 | pass | pass | pass | pass | pass | pass |
| `apps/web/src/screens/chores/chores-offline-queue.test.tsx` | 4 | pass | pass | pass | pass | pass | pass |
| `apps/web/src/screens/deals/favorites.test.tsx` | 9 | fail (1 test) | fail (1 test) | fail (1 test) | fail (1 test) | fail (1 test) | fail (1 test) |
| `apps/web/src/screens/deals/deal-search.test.tsx` | 13 | pass | pass | pass | pass | pass | fail (1 test) |
| `apps/web/src/screens/deals/flyers.test.tsx` | 13 | pass | pass | pass | pass | pass | fail (1 test) |
| `apps/web/src/screens/meals/suggestions.test.tsx` | 6 | pass | pass | pass | pass | pass | fail (1 test) |

Run instants (UTC, Monday 2026-10-12): run 1 web 22:14:55Z, run 2 web 22:17:42Z, TZ=UTC 22:19:22Z, TZ=America/Los_Angeles 22:20:35Z, TZ=Pacific/Kiritimati 22:21:50Z, TZ=Pacific/Pago_Pago 22:23:04Z. A time-of-day failure may pass at another hour, and all seven runs fall inside a 9 minute window, so they cannot show hour-dependence.

- `recurrence-preview.test.ts`: does not fail in this session at any run or zone; the research sweep failed it only at pinned instants (Saturday-UTC/Friday-LA and the Pago_Pago year boundary), which a real-clock run at this instant does not reproduce. Not pre-existing here; still a candidate for 02-02.
- `chores.test.tsx`: does not fail in this session; same reasoning, failed only under the research sweep's pinned instants.
- `chores-offline-queue.test.tsx`: does not fail in this session; same reasoning.
- `favorites.test.tsx`: its failure pre-exists in this session (both runs and every zone), and it is the test CI's `test-unit` job fails on at d3da748.
- `deal-search.test.tsx`: passes in both runs and in three of four zones; fails only under Pago_Pago (UTC-11) at this instant, so its failure does not pre-exist in runs 1 and 2.
- `flyers.test.tsx`: same as deal-search; fails only under Pago_Pago.
- `suggestions.test.tsx`: same as deal-search; fails only under Pago_Pago.

## Integration

path (a): measured locally against `supabase start` (migrations applied from `supabase/migrations/`), on a fresh detached d3da748 worktree that stayed clean (`git status --porcelain` empty). Cross-checked against CI runs 38206071791 and 38254024046.

- Stack: `supabase start -x studio,postgres-meta,mailpit,postgrest,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor` (db, auth, realtime, kong), Postgres on 127.0.0.1:54322. The excluded services are not used by the integration tests. The `postgres`, `gotrue` and `realtime` images came from Docker Hub tagged under their `public.ecr.aws` names, because ECR Public returned `Data limit exceeded` for anonymous pulls.
- `test:integration` (`pnpm --filter @hearth/service test:integration`): 20 files, 426 tests, all passed in run 1 and run 2.
- `test:coverage` (`pnpm --filter @hearth/service test:coverage`): 74 files, 1142 tests (716 unit + 426 integration), all passed in both runs; thresholds met. Statements 96.77% (3094/3197), branches 86.55% (1474/1703), functions 98.07% (867/884), lines 98.66% (2744/2781), identical in both runs.
- No failures and no flakiness in either run. Run 1 and run 2 differ only in duration. The measurements ran at 2026-10-12 (about 23:05 to 23:30 UTC), on Monday, in the machine zone UTC.
- CI cross-check: run 1 = `pull_request` run 38206071791, run 2 = `push` run 38254024046, both head d3da748. The `test-integration` job succeeded in both, with "Start Supabase" and the `test:coverage` step concluding `success`, consistent with the local result. The same CI runs concluded `test-unit` failure (step "Run pnpm test", the `favorites` web test above), `test-e2e` success, `lint` success, `typecheck` success and `build` success. CI job logs remain unreadable (HTTP 403 from the Actions log host).

## Notes

- E2E was not run locally in either path (it needs the full Docker Compose stack). CI's `test-e2e` job is the E2E gate: it concluded `success` in both CI runs on d3da748 (102/102 passing on PR #1 per Phase 1).
- Overall the two runs agree exactly: the only difference between run 1 and run 2 is timing, so there are no flaky failures in this baseline. Two runs three minutes apart on the same hour cannot expose flakiness that depends on the time of day or the weekday; that is what the 02-02 sweep covers.
- The web `build` prints a Rolldown notice: `inlineDynamicImports option is deprecated, please use codeSplitting: false instead.` It is not an error and does not affect the exit code.
- `test:recurrence`'s script includes `--coverage`; no threshold failed.
- Typecheck run 1 was run during Task 1 and was not timed.
- `main` at the time of measuring is `89eb558`, which is d3da748 plus one docs commit; its only changes outside `.planning/` and `.claude/` are to `.gitignore`, `.dockerignore` and `.prettierignore`. None of them is application code, and the measured tree is d3da748 itself, so they do not affect these results. The primary checkout was on branch `claude/trusting-lovelace-y4r87h` (two docs-only commits ahead of `main`), not on `main`.
- The integration counts were a gap in the first version of this baseline (CI logs unreadable, Docker daemon not started). They were filled in the same session once Docker was running and the local Supabase stack was up; see Integration.
