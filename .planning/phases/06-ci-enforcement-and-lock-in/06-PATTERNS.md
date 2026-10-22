# Phase 6: CI Enforcement and Lock-in - Pattern Map

**Mapped:** 2026-10-22
**Files analyzed:** 20 new/modified
**Analogs found:** 18 / 20 (all analogs below are git-tracked: scripts/, .github/, root configs)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/check-repo-hygiene.mjs` | CI script | batch (git index scan) | `scripts/knip-summary.mjs` + `scripts/test-sweep.mjs` (spawnSync/usage style) | role-match |
| `scripts/check-repo-hygiene.test.mjs` | test (node:test) | temp git repos, child process | `scripts/deploy.test.mjs` | exact |
| `scripts/check-migrations-append-only.mjs` (+ `.test.mjs`) | CI script + test | batch (git diff) | `scripts/test-sweep.mjs` (arg parse, exit 2) / `deploy.test.mjs` | role-match |
| `scripts/audit-prod.mjs` (+ `.test.mjs`) | CI script + test | transform (JSON in, verdict out) | `scripts/knip-summary.mjs` (JSON normalizer) | role-match |
| `scripts/audit-allowlist.json` | config | static data | `knip.json` | partial |
| `scripts/check-knip-baseline.mjs` (+ `.test.mjs`) | CI script + test | transform | `scripts/knip-summary.mjs` | exact (reuse) |
| `scripts/knip-production-baseline.txt` | baseline data | static | output format of `knip-summary.mjs` | exact |
| `scripts/knip-summary.mjs` (modify: export `summarize()`, main guard) | utility | transform | itself (currently runs on import) | n/a |
| `scripts/test-sweep.mjs` (modify: today cell) | CI script | batch | itself (`UNIT_CELLS`, `parseArguments`, `printMatrix`) | exact |
| `scripts/test-sweep.test.mjs` (modify) | test | child process | itself | exact |
| `knip.json` (modify) | config | - | itself | exact |
| `.jscpd.json` | config | - | `knip.json` | partial |
| `package.json` (`test:harness`, `jscpd` script, devDep) | config | - | existing `test:harness` line 16 | exact |
| `.github/workflows/ci.yml` (hygiene job, timeouts, coverage, db:types) | workflow | event-driven | itself | exact |
| `.github/workflows/sweep.yml` | workflow | event-driven (cron/push/dispatch) | `.github/workflows/ci.yml` | role-match |
| `apps/web/vite.config.ts` (thresholds) | config | - | itself lines 82-86 | exact |
| `docs/testing.md`, `docs/file-map.md`, `CONTRIBUTING.md`, `.claude/CLAUDE.md` | docs | - | existing sections | exact |
| `.planning/cleanup/CI-LEDGER.md` (name free) | ledger | - | `.planning/cleanup/REMOVAL-LEDGER.md` | role-match |
| 3 `.planning/*.sh` mode fixes | git mode | - | n/a (`git update-index --chmod=+x`) | none |

## Pattern Assignments

### Tested CI scripts (`check-repo-hygiene`, `check-migrations-append-only`, `audit-prod`, `check-knip-baseline`)

**Analog:** `scripts/deploy.test.mjs`, `scripts/test-sweep.mjs`, `scripts/test-sweep.test.mjs`

**Test header + imports + scratch dir** (`deploy.test.mjs` 1-36):
```javascript
/*
 * Tests for `scripts/deploy.sh`: ... Run by `pnpm test` through `test:harness`.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const scratch = mkdtempSync(join(tmpdir(), 'hearth-deploy-'));
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});
```

**Child-process runner with scrubbed env** (`test-sweep.test.mjs` 22-31; for git tests also delete `GIT_DIR`/`GIT_INDEX_FILE`, set `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_NOSYSTEM`, per RESEARCH Pitfall 12):
```javascript
function sweep(...args) {
  const run = spawnSync(process.execPath, [SWEEP, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key !== 'TZ' && key !== 'HEARTH_TEST_NOW'),
    ),
  });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}
```

**Script CLI conventions** (`test-sweep.mjs` 17-21, 55-59, 263): leading block comment with usage; `REPO_ROOT = resolve(import.meta.dirname, '..')`; `usageError()` prints `name: message` + USAGE to stderr and `process.exit(2)`; `main()` returns an exit code and `process.exit(main())`. Exit 2 = bad usage / cannot decide (fail closed), exit 1 = findings.
```javascript
function usageError(message) {
  console.error(`test-sweep: ${message}`);
  console.error(USAGE);
  process.exit(2);
}
```

**Rules to carry:** pure core function exported (`evaluateAudit(report, allowlist, today)`, `compareBaseline`, `findHygieneViolations`) plus thin CLI; tests must pass an explicit `today`/instant (clock fence bans `new Date()`/`Date.now()` in `*.test.mjs`); spawn git with argument arrays, never a shell; validate `--base` against a SHA/ref pattern like `ONLY_PATTERN` (`test-sweep.mjs` 45, 188). Register every `*.test.mjs` by appending to `test:harness` (`package.json` line 16):
```
"test:harness": "node --test test/clock-setup.test.mjs ... scripts/deploy.test.mjs scripts/ci-prepull-images.test.mjs",
```
Non-test scripts must also be added to `knip.json` root `entry` as `"scripts/<name>.mjs!"` (RESEARCH Pitfall 4).

### `scripts/knip-summary.mjs` (refactor) and `scripts/check-knip-baseline.mjs`

**Analog:** `scripts/knip-summary.mjs` lines 14-39. Normalization to reuse (export as `summarize(report)` returning the sorted `kind\tpath\tsymbol` lines, run the CLI only behind `if (import.meta.url === pathToFileURL(process.argv[1]).href)` guard, since it currently executes on import):
```javascript
const report = JSON.parse(readFileSync(input, 'utf8'));
const lines = [];
for (const issue of report.issues ?? []) {
  for (const [kind, entries] of Object.entries(issue)) {
    if (kind === 'file' || !Array.isArray(entries)) continue;
    for (const entry of entries) {
      let path = issue.file; let symbol = '-';
      if (kind === 'files') { path = entry.name ?? issue.file; }
      else if (Array.isArray(entry)) { symbol = entry.map((e) => e.name).join('|'); }
      else if (entry && typeof entry === 'object') { symbol = entry.name ?? '-'; }
      else { symbol = String(entry); }
      lines.push([kind, path, symbol]);
    }
  }
}
```
Invoke knip as `pnpm --silent knip:production --reporter json` (pnpm banner corrupts JSON; knip exits 1 on findings, so parse stdout instead of trusting exit code). Normalize `\` to `/`. Baseline fails on both new findings and stale rows. Baseline format: the 28-line `kind<TAB>path<TAB>symbol` file (drop the `total` row or compare it consistently).

### `scripts/test-sweep.mjs` (add today cell)

**Analog:** itself. Insert points: cells array (27-34), `parseArguments` flag whitelist (76), `printMatrix` (91-98), selection (180-185), summary line (251).
```javascript
if (!['--suite', '--workspace', '--cell', '--only', '--log-dir'].includes(flag ?? '')) {
  usageError(`unknown flag ${String(flag)}`);
}
```
`--with-today` is a boolean like `--list` (handled before the value check, lines 72-75). Export a pure `todayCell(instant)` (RESEARCH "rotation helper") and print `now=` and `tz=` on the cell's result line (line 251 format `cell=... workspace=... result=...`). The existing `canonicalZone`/`childZone` check (222-231) already validates the zone. `test-sweep.mjs` is not clock-fenced and ends with `process.exit(main())`, so exporting needs a main guard like knip-summary; tests (fenced) call `todayCell(new Date('2026-10-22T14:00:00.000Z'))`.

### `.github/workflows/ci.yml` (modify)

**Analog:** itself. Job shape to copy for `hygiene` (lines 25-30, 116-121) and where timeouts go (only line 60 has one today):
```yaml
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: ./.github/actions/setup
      - run: pnpm typecheck
```
- Add `timeout-minutes` directly under `runs-on` (match line 59-60 order): lint 10, typecheck 10, build 10, test-unit 15, test-integration 25, hygiene 10, e2e stays 40.
- Do not rename `name: CI` (line 1) or any job id (D-01).
- `test-unit` line 37 `- run: pnpm test` becomes the three-step split from RESEARCH (harness, `pnpm -r --filter '!@hearth/web' test`, `pnpm --filter @hearth/web test:coverage`).
- `test-integration`: insert drift step between "Start Supabase" (48-49) and line 53, with a `#` comment in the existing why-style (lines 47, 50-52).
- `hygiene` checkout needs `with: fetch-depth: 0`; pass `BASE_SHA` through `env:` (never inline `${{ }}` in `run:`).
- Comments in this file explain why and wrap near 100 columns; Prettier-clean YAML required.

### `.github/workflows/sweep.yml` (new)

**Analog:** `ci.yml` header (lines 1-13) and the artifact step (109-114):
```yaml
permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```
```yaml
      - uses: actions/upload-artifact@v7
        if: failure()
        with:
          name: playwright-report
          path: e2e/playwright-report/
          retention-days: 7
```
Use `name: Sweep` (never `CI`), triggers push main / schedule / workflow_dispatch, the same checkout + `./.github/actions/setup` pair, `timeout-minutes: 60`, `pnpm test:sweep --log-dir sweep-logs`, upload `sweep-logs/` on failure. Full sketch in RESEARCH "sweep.yml". Pushing any `.github/workflows/*` file needs the owner `apply.sh` hand-off (`.planning/cleanup/patches/ci-setup-action/apply.sh`; the token lacks `workflow` scope).

### `knip.json` (modify)

**Analog:** itself (lines 4-8). Add top-level `"ignore": [".planning/**"]`, `"ignoreDependencies": ["tailwindcss"]`, `"node": false`; change root entry (line 7) from `"test/*.mjs!"` to `"test/**/*.mjs!"` and append `"scripts/<new>.mjs!"` per new script. Keep `ignoreExportsUsedInFile` and `ignoreBinaries`. Match its one-item-per-line wrapping only when Prettier requires it.

### `.jscpd.json` (new)

**Analog:** `knip.json` (root JSON config style, `$schema` optional). Content verbatim from RESEARCH "`.jscpd.json`" (threshold 2, minTokens 60, minLines 8). Add `"jscpd": "jscpd"` next to `"knip"` (package.json line 25) and exact-pin `jscpd@5.4.1` via `pnpm add -Dw --save-exact` after a `checkpoint:human-verify`.

### `apps/web/vite.config.ts` (modify thresholds)

**Analog:** itself lines 82-86. Replace values with measured-minus-margin (RESEARCH suggests `84/80/77/85`) and refresh the comment, changing the last line to "Enforced by CI's `test-unit` job":
```typescript
      // ... Enforced by `pnpm --filter @hearth/web test:coverage`.
      thresholds: { statements: 82, branches: 78, functions: 74, lines: 84 },
```
Do not add `--coverage` to the web `test` script (sweep runs it per cell).

## Shared Patterns

### Fail closed
**Source:** `scripts/test-sweep.mjs` lines 142-151 and 203-207 (exit 2 when the check itself cannot run, never treat "nothing checked" as pass). **Apply to:** audit script (missing `advisories`/`error` key), migration check (unresolved base, all-zero SHA), knip baseline (unparseable JSON), hygiene (not a git checkout).

### No shell, validated inputs
**Source:** `test-sweep.mjs` 45 and 188-191 (`ONLY_PATTERN`) plus `spawnSync(cmd, [args])` at 137-141. **Apply to:** every script that takes `--base` or paths.

### Clock fence
**Source:** `.claude/CLAUDE.md` Conventions, `eslint.config.js`. **Apply to:** all new `*.test.mjs`: explicit `today`/instant arguments; non-test scripts may read the clock.

### Comments and style
Leading `/* ... */` block explaining purpose and run path, why-comments, named exports, single quotes, printWidth 100, ESM `import.meta.dirname`.

## No Analog Found

| File | Role | Reason |
|---|---|---|
| `scripts/audit-allowlist.json` | data/config | No expiring-allowlist file exists; use the RESEARCH shape `{"allow":[{"id":"GHSA-...","expires":"YYYY-MM-DD","reason":"..."}]}` |
| `.planning/**/*.sh` mode fixes | git mode | Use `git update-index --chmod=+x`; verify with `git ls-tree` after the commit |
| CI-05/CI-07 ledger | doc | Follow `.planning/cleanup/REMOVAL-LEDGER.md` layout (not re-read here) |

## Metadata

**Analog search scope:** `scripts/`, `.github/`, root `package.json`, `knip.json`, `apps/web/vite.config.ts`
**Files read:** ci.yml, knip.json, knip-summary.mjs, test-sweep.mjs, test-sweep.test.mjs (head), deploy.test.mjs (head), vite.config.ts coverage block
**Tracked-source check:** all named analogs live in `scripts/`, `.github/`, or repo root, which are tracked (listed by `git ls-files`)
**Pattern extraction date:** 2026-10-22
