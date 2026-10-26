---
phase: 08-full-rebrand-to-hestia
plan: 04
subsystem: web
tags: [pwa, manifest, cli, indexeddb, rebrand, build-check]

requires:
  - phase: 08-full-rebrand-to-hestia
    provides: 08-02 @hestia/* workspace scope; 08-03 HESTIA_* environment and hestia-service container name
provides:
  - every user-facing string in the PWA says Hestia (tab title, shell states, onboarding, install, bills empty state, notification copy, push fallback title)
  - built manifest name and short_name are Hestia, enforced by check 3 in apps/web/scripts/check-build.mjs (mutation-proven)
  - owner CLI is hestia-admin with no alias (wrapper, bin entry, Dockerfile COPY and PATH link, usage string, E2E helper hestiaAdmin())
  - PERSIST_KEY hestia-query-cache and NOTIFICATION_CLICK_MESSAGE hestia:notification-click, with a test pinning PERSIST_KEY and no migration code
affects: [08-05, 08-06, 08-07]

plan_head_before: 99f365787e4b11e16284e243e1ff56291e890a56
plan_head_after: fdceb3046b2a519f64c0cd134d494e22bb1d4516

actuals:
  tokens: 9000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Scripted class substitutions (UI, CLI, KEYS) over the tracked-file selector, each diff read before commit"
    - "Post-build assertion on the generated manifest and title with the file's fail() accumulator"

key-files:
  created:
    - apps/service/bin/hestia-admin
  modified:
    - apps/web/scripts/check-build.mjs
    - apps/web/vite.config.ts
    - apps/web/index.html
    - apps/web/src/lib/offline/persist.ts
    - apps/web/src/lib/push/push-message.ts
    - apps/web/src/lib/offline/write-queue.test.tsx
    - apps/service/package.json
    - apps/service/src/cli.ts
    - docker/service.Dockerfile
    - e2e/support/db.ts
    - README.md
    - docs/architecture.md
    - docs/development.md
    - docs/file-map.md
    - docs/use-cases.md
    - .claude/CLAUDE.md
  deleted:
    - apps/service/bin/hearth-admin (git rename to hestia-admin, mode 100755 kept)

key-decisions:
  - "No alias, wrapper or deprecation shim for the old CLI name (D-07); the old command simply stops existing"
  - "No code reads, migrates or deletes the old IndexedDB key or message type (D-08); queued offline writes on a device are dropped once at upgrade"
  - "Manifest description, start_url, scope, icons and theme tokens untouched and no manifest id added (D-10)"

requirements-completed: [BRAND-01, BRAND-02, BRAND-03, BRAND-06]

coverage:
  - id: D1
    description: "User-facing PWA copy says Hestia: tab title, AppShell title, onboarding, install step, loading and offline states, bills empty state, notification settings, push fallback title"
    requirement: "BRAND-01"
    verification:
      - kind: unit
        ref: "web vitest run src/components/shell src/screens/onboarding src/screens/bills src/screens/settings src/lib/push src/sw.test.ts (17 files, 228 passed); full web suite 729 passed"
        status: pass
      - kind: other
        ref: "git grep -F Hearth -- apps/web e2e/tests exits 1; e2e typecheck clean with the renamed install heading and button expectations"
        status: pass
    human_judgment: false
  - id: D2
    description: "Built manifest has name and short_name Hestia, start_url '/', no id, unchanged description; the build fails if name, short_name or the built title is anything else"
    requirement: "BRAND-02"
    verification:
      - kind: other
        ref: "pnpm --filter @hestia/web build (check-build passes); node check of dist/manifest.webmanifest; mutated manifest exits 1 with both messages, mutated title exits 1, restored build exits 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Owner CLI is hestia-admin, executable, runs under the new name against the built bundle, no old name or alias in the live tree"
    requirement: "BRAND-03"
    verification:
      - kind: unit
        ref: "apps/service/src/cli.test.ts (9 passed)"
        status: pass
      - kind: other
        ref: "ls-files mode 100755, sh -n, bin entry exact, Dockerfile COPY and ln -s lines, wrapper run with no args exits 2 printing the new usage line, check-repo-hygiene clean"
        status: pass
    human_judgment: false
  - id: D4
    description: "Browser keys renamed; the page and the built service worker agree on the message type; PERSIST_KEY pinned by a test written RED first"
    requirement: "BRAND-06"
    verification:
      - kind: unit
        ref: "write-queue.test.tsx pin failed first (expected 'hearth-query-cache' to be 'hestia-query-cache'), then passed; offline, push and sw tests 84 passed"
        status: pass
      - kind: other
        ref: "dist/sw.js and dist/assets carry hestia:notification-click; dist/assets carries hestia-query-cache; grep -ri hearth apps/web/dist exits 1"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-26
status: complete
---

# Phase 8 Plan 04: PWA Name, Owner CLI and Browser Keys Summary

**The PWA, its built manifest and title say Hestia (with a build check that fails on anything else, proven by mutation), the owner CLI is `hestia-admin` with no alias, and the persisted cache key and notification-click message type are `hestia-query-cache` and `hestia:notification-click` with no migration code.**

## Performance

- **Duration:** about 7 min (start about 03:42Z, SUMMARY written 03:49Z)
- **Tasks:** 3
- **Files:** 41 file changes across the three commits (21, 16 including the wrapper rename, 5; the pin in `write-queue.test.tsx` is in the third)

## Accomplishments

- UI class: `Hearth` to `Hestia` over `apps/web` and `e2e/tests` (20 files). The 37-line diff was read in full: every line is the product name in copy, a title, a test expectation or a comment. `vite.config.ts` changed exactly the `name` and `short_name` lines.
- `check-build.mjs` check 3 (header comment updated to three checks): reads `dist/manifest.webmanifest` and pushes `manifest name is <value>, expected "Hestia"`, `manifest short_name is <value>, expected "Hestia"`, or `index.html <title> is not Hestia` through the existing `fail()` accumulator.
- CLI class: `git mv apps/service/bin/hearth-admin apps/service/bin/hestia-admin` (git reports a rename, mode 100755 unchanged), then the name and `hearthAdmin()` to `hestiaAdmin()` over the selector (16 files: `bin` entry, Dockerfile COPY and `ln -s`, `USAGE`, `cli.test.ts`, `api.integration.test.ts` title, `e2e/support/db.ts` and specs 06 and 17, the ForgotPasswordScreen comment, README, four docs, CLAUDE.md).
- KEYS class: the two constants and the three test literals (5 files). The PERSIST_KEY pin was added first and failed against the old key, then passed after the rename.

## Verification Output

- Built manifest: `{"name":"Hestia","short_name":"Hestia","start_url":"/","id":undefined,"description":"Deals, shopping lists, meals, bills, and chores for your household."}`; `dist/index.html` has `<title>Hestia</title>`.
- check-build mutation results: manifest with both names set to `"Other"` exits 1 and prints `manifest name is "Other", expected "Hestia"` and `manifest short_name is "Other", expected "Hestia"`; title set to `<title>Other</title>` exits 1 and prints `index.html <title> is not Hestia`; restored build exits 0 (`App shell 198.2 KB gzipped (budget 200 KB); magic link off, as built.`).
- Wrapper, run with `env -i`, the three CLI env names and no arguments: exit 2, output exactly `Usage: hestia-admin reset-password <email>`.
- Residual count (`git grep -I -n -i hearth`, excluding `.planning`, the lockfile and the exemptions file): 168 at the start, 131 after Task 1 (limit 138), 98 after Task 2 (limit 105), 93 after Task 3 (limit 100).
- Gates after Task 3: `pnpm lint`, `pnpm format:check`, `pnpm knip` (exit 0), `knip-baseline: 28 rows match`, `repo-hygiene: clean (1029 files, 14 scripts)`, migration gate against the `origin/main` merge base `0 added, nothing else changed, 2 exempt`, docs-claims (phase copy) `checked=1351 misses=0`, `pnpm typecheck` (also run by the pre-commit hook on all three commits).
- Tests (`pnpm -r test`): matching 156, shared 172, recurrence 77, service 760 (56 files), web 729 (57 files), all passed.

## Task Commits

1. **Task 1 (tracer): Hestia name in the app, title and manifest** - `6465edf` `feat(web): show the Hestia name in the app, title and manifest`
2. **Task 2: rename the owner CLI** - `013fea3` `refactor(service): rename the owner CLI to hestia-admin`
3. **Task 3: browser keys** - `fdceb30` `refactor(web): rename the persisted cache key and click message`

**Plan metadata:** committed after this file (docs: complete plan).

## Deviations from Plan

None - plan executed exactly as written.

Notes, none of which changed behavior or code:

- Each first commit attempt was rejected by commitlint because a body line was over 100 characters (the caveat from 08-02). The bodies were shortened and the commits retried with identical content.
- The Task 3 acceptance criterion `grep -rn 'query-cache' apps/web/src` is said to show only `persist.ts` and the pin. It also matches `apps/web/src/lib/api/meal-hooks.ts:212`, a prose comment ("the regular query-cache persister"). It is not the key and was left alone.
- The Task 1 and Task 2 verify chains were run in segments (same commands, same order) so builds and test runs reported their own exit codes.
- Task 1's tracer gate: the verify was run once end to end before expansion (build, mutation checks, tests, typecheck); there is no `gate="blocking-human"`, so no checkpoint was needed.

## Issues Encountered

- Not run in this plan: the E2E image build and Playwright suite (owned by 08-07), so the Dockerfile `COPY`/`ln -s` lines and `compose exec hestia-service hestia-admin` in `e2e/support/db.ts` are proven by greps, `sh -n`, the wrapper run against the built bundle and the E2E typecheck, not by running the container. The integration suite was also not run.
- `pnpm exec prettier --check` cannot infer a parser for the extensionless wrapper and the Dockerfile; `pnpm format:check` (the CI command) is clean because it does not select them.
- `.planning/milestone.lock` stays untracked as instructed.

## Known Stubs

None.

## Threat Flags

None. T-08-16 (wrapper losing its executable bit or bundle path) is mitigated: mode 100755 in the index, `sh -n`, hygiene gate clean, wrapper executed against the built bundle. T-08-14, T-08-15 and T-08-17 are accepted per D-08 and D-10; the built service worker and page bundle were checked to carry the same new message type.

## User Setup Required

None here. For the PR description (08-06): queued offline writes under the old IndexedDB key are dropped once on upgrade, and iOS may keep the old home-screen label until the app is reinstalled.

## Next Phase Readiness

Ready for 08-05. 93 old-name lines remain outside `.planning/`; the User-Agent, OpenAPI title and the rest belong to 08-05 through 08-07.

## Self-Check: PASSED

- Created file exists: `apps/service/bin/hestia-admin`; the old wrapper is not tracked
- Commits `6465edf`, `013fea3` and `fdceb30` are ancestors of HEAD
- Acceptance criteria re-run: the three commit subjects match; `check-build.mjs` header lists three checks and the three messages appear verbatim; `vite.config.ts` diff in the Task 1 commit is the `name` and `short_name` lines only; `git show --stat` of the Task 2 commit reports `bin/{hearth-admin => hestia-admin}`; the Task 3 commit lists only its five files; the `bin` object has one entry

---
*Phase: 08-full-rebrand-to-hestia*
*Completed: 2026-10-26*
