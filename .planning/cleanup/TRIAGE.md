# Triage - knip and jscpd findings

## Approvals

- Package legitimacy: knip@6.41.0 approved - 2026-10-13
- Package legitimacy: jscpd@5.4.1 approved - 2026-10-13

## Calibration

### Setup

- knip 6.41.0, exact-pinned root devDependency on `chore/knip-config` (from `origin/main` 89eb558), Node v24.21.0. `pnpm add -Dw knip@6.41.0` printed no `Ignored build scripts` line.
- Config: root `knip.json` (entries per workspace as the plan specifies; no `ignore`, `ignoreFiles` or `ignoreDependencies`). Report-only: only `--reporter json` was ever run; no `--fix` or file-removal flag.
- Default mode: `pnpm --silent knip --reporter json` (exit 1: findings reported).
- Production mode: `pnpm --silent knip:production --reporter json`, which expands to `knip --production --workspace "!e2e" --workspace "!supabase/seed"` (exit 1: findings reported).
- Records: `.planning/cleanup/knip/calibration-default.json`, `calibration-production.json` and the normalized `calibration-default-summary.txt`, `calibration-production-summary.txt` (`kind<TAB>path<TAB>symbol`, sorted, final `total` line).

### Finding counts per kind (baseline config, no canaries)

| Kind | Default | Production |
| --- | --- | --- |
| files | 0 | 1 |
| dependencies | 0 | 0 |
| devDependencies | 2 | 0 |
| unlisted | 1 | 0 |
| binaries / unresolved | 0 | 0 |
| exports | 17 | 40 |
| types | 37 | 37 |
| duplicates | 1 | 1 |
| total | 58 | 79 |

Production mode sees no devDependency findings (devDependencies are out of scope there) and sees more exports because exports used only by tests are no longer counted as used.

### Known-live entries

None of the nine entry files below is reported on a `files` line in either mode's summary.

| Entry file | Reported as unused file (default) | Reported as unused file (production) |
| --- | --- | --- |
| `apps/web/src/sw.ts` | no | no |
| `supabase/seed/seed-users.ts` | no (workspace excluded from production) | no (workspace excluded from production) |
| `e2e/global-setup.ts` | no | no (workspace excluded from production) |
| `e2e/global-teardown.ts` | no | no (workspace excluded from production) |
| `apps/service/src/cli.ts` | no | no |
| `packages/shared/src/index.ts` | no | no |
| `packages/shared/src/common-passwords.ts` | no | no |
| `packages/recurrence/src/index.ts` | no | no |
| `packages/matching/src/index.ts` | no | no |

For `e2e` and `supabase/seed`, the production-mode "no" means the workspace is not analyzed at all by the `knip:production` script; the default-mode "no" is the real check for the three `e2e` and `supabase/seed` entries.

### Observations on the baseline report

- `tailwindcss` IS reported (default mode, unused devDependency in `apps/web/package.json`). This is a false positive: `apps/web/src/index.css` line 1 is `@import 'tailwindcss';` and knip does not follow CSS imports. Research predicted exactly this when `apps/web` gets an `entry` override, which the plan requires (for `sw.ts`). It is not hidden with an `ignoreDependencies` entry (D-10): it is a known limitation, routed to the uncertain bucket for plan 02-07.
- Research cross-check: `tsx` is reported as an unused devDependency of `supabase/seed/package.json`, and `fuse.js` as an unlisted dependency of `packages/matching/scripts/fuzzy-benchmark.ts`. Both match the research baseline. (`tsx` is launched by the service's `db:seed` script through a cross-workspace path, so it is a candidate for the owner list, not a deletion.)
- Other research findings reproduced: `pruneCutoffs` (jobs barrel), `useFavoriteStores`, `listIdOfWrite`, and the three meal fixtures (`currentWeekFixture`, `previousWeekFixture`, `emptyWeekFixture`).
- New in this config versus research: `includeEntryExports: true` on the three packages surfaces unused re-exports of the package barrels (for example `packages/matching/src/index.ts` `BRANDS`, `DESCRIPTORS`, `UNITS`, `tokenize`; `packages/recurrence/src/index.ts` `currentTurnIndex`). These are API-surface candidates, not proof of dead code, and are triaged in 02-07.
- Production mode reports one unused file, `apps/service/src/deals/flipp/normalized-fixtures.ts`. It is imported by a test (`normalized-fixtures.test.ts`) and a script (`apps/service/scripts/normalize-fixtures.ts`), so it is test/script-only rather than proven dead; triaged in 02-07.
- Configuration hints: default mode prints 13 "Remove redundant entry pattern" hints (every `!` production entry, plus `playwright.config.ts` and others), because plugins and `package.json` already supply those entries in default mode, and one hint that `.css` imports are not followed. The plan requires explicit entries and the redundancy is mode-dependent, so the hints are left unaddressed.

### Canary table

Four canaries were planted on the throwaway branch `scratch/knip-canaries` (commit `test: plant knip calibration canaries`, deleted afterwards; never pushed) and measured in both modes. Records: `calibration-canary-default.json`, `calibration-canary-production.json` and their `-summary.txt` files. The canary runs differ from the baseline runs only by the canary lines (diff of the two summaries per mode), and the totals moved from 58 to 61 (default) and from 79 to 83 (production).

| Canary | Planted at | Expected default | Expected production | Observed default | Observed production | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| dead file canary | `apps/web/src/lib/knip-canary-orphan.ts` | not reported (research: tests make everything reachable) or noted if reported | `files` line | `files` line (reported) | `files` line | PASS |
| dead export canary | `KNIP_CANARY_UNUSED_EXPORT` in `apps/web/src/lib/format.ts` | `exports` line | `exports` line | `exports` line | `exports` line | PASS |
| unused dependency canary | `fastest-levenshtein` in `apps/web/package.json` `dependencies` | `dependencies` line for `apps/web/package.json` | not required | `dependencies` line | `dependencies` line | PASS |
| test-only export canary | `knipCanaryTestOnly` in `apps/service/src/problem.ts`, called from `problem.test.ts` | absent | `exports` line | absent | `exports` line | PASS |
| known-live entries canary check | the nine entry files listed above | no `files` line | no `files` line | none of the nine reported | none of the nine reported | PASS |

All expectations held on the first measurement, so no `knip.json` change was needed (no config-gap row, no `ignoreDependencies` value).

Notes:

- Default mode DID report the orphan file as a `files` line. Research expected default mode to report no unused files; with explicit entries and `!`-suffixed project patterns this config does report a file nothing imports, even in default mode. Both modes therefore see dead files; production mode additionally sees files reachable only from tests, such as `apps/service/src/deals/flipp/normalized-fixtures.ts`.
- The unused-dependency canary was also reported in production mode, which the plan did not require.
- Only the test-only export separates the two modes as the plan intended: it is invisible in default mode (the test counts as a use) and visible in production mode.

### Known limitations (routed to 02-07's uncertain bucket)

- `tailwindcss` (unused devDependency, `apps/web`): CSS `@import` is not followed by knip. Not hidden by a config exception; owner or 02-07 decides.
- Anything reachable only through Docker, Compose, Kong, Caddy, SQL, shell scripts or string-built paths (for example `HEARTH_FLIPP_FIXTURE_DIR`, `HEARTH_RECIPE_FIXTURE_DIR`, `e2e/fixtures/`) cannot be modelled and goes to the owner list rather than the removal list (D-10).
- `knip:production` skips the `e2e` and `supabase/seed` workspaces by construction, so dead code inside them is seen by default mode only.
