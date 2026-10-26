---
phase: 02-baseline-net-stabilization-and-analysis
reviewed: 2026-10-19T14:00:00Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - test/clock-setup.mjs
  - test/global-tz.mjs
  - test/test-now.mjs
  - test/support/vitest-project.mjs
  - test/clock-setup.test.mjs
  - test/global-tz.test.mjs
  - test/eslint-clock-ban.test.mjs
  - scripts/test-sweep.mjs
  - scripts/test-sweep.test.mjs
  - eslint.config.js
  - package.json
  - docs/testing.md
findings:
  critical: 0
  warning: 6
  info: 6
  total: 12
status: issues_found
---

# Phase 02: Code Review Report (review of PR #8, the fixes for 02-REVIEW.md)

**Reviewed:** 2026-10-19
**Depth:** deep
**Files Reviewed:** 12
**Status:** issues_found

Scope: `git diff d8f3daf 4ebc90b -- . ':!.planning'` (PR #8, squash 4ebc90b). Advisory only.

## Summary

The five original warnings are fixed and the fixes mostly hold. No blocker found. The remaining defects are narrow: one reproducible infinite recursion in the pin, divergences of the pin from native `Date` that the header does not list, a setup file that cannot be loaded twice in one global, and documentation that overclaims or has gone stale.

Evidence gathered (all read-only, scratch projects live under the scratchpad and `os.tmpdir()`, the repo tree was not touched):

- `pnpm test:harness`: 167 tests, 167 pass, 14.0 s wall (about 14.8 s with pnpm start-up). `pnpm lint` (`--max-warnings=0`), `pnpm format:check` and `pnpm -r test` (service 725, web 715, plus the packages) are green. `TIMING=1 pnpm lint` shows `no-restricted-syntax` is not in the ten most expensive rules, so the 18 selectors cost nothing measurable.
- `node scripts/test-sweep.mjs --workspace matching --only src/matcher.test.ts` ran all 6 cells, `sweep: 6/6 passed`. The empty-match check does not skip any cell of a normal sweep.
- The new `vitest list --filesOnly` call uses `spawnSync('pnpm', [...])` with an argv array and no shell, so it is injection-safe by construction. The later run still uses `shell: true` with the regex-validated `only` (first-review IN-02, unchanged). `--only nonexistent/foo.test.ts` exits 2 with the documented message for the unit suite, and `--suite integration --only nonexistent.integration.test.ts` exits 2 without a database (`vitest list` with the integration config needs none).
- Clock pin probes ran in 14 throwaway Vitest projects using the repo's own `test/support/vitest-project.mjs`; the TZ hook and `parseTestNow` were driven directly with about 100 inputs; ESLint was driven through the API with the harness's own `disableTypeChecked` override on about 45 snippets, plus a mutation pass that removed each selector in turn.
- Vitest 5.0.1 detail that matters for the logic: `vi.setSystemTime` without fake timers also installs a sinon clock (`toFake: ['Date','Temporal']`), and `uninstall` restores the `Date` that was global at install time, which is the pin. Nothing in Vitest restores the native `Date`.

Confirmed correct: the suite-ownership logic (`suiteClockInstalled`, `beforeEach`, `afterEach`) behaves as the header and docs describe for module-scope clocks, `beforeAll` clocks with and without `Date` faked, `beforeEach` clocks, test-body clocks, a file `afterEach` that calls `vi.useRealTimers()`, and `HEARTH_TEST_NOW` with fake timers (`vi.useFakeTimers()` starts at the pin and advances from it). The claim that a suite's `afterAll` cleanup never exposes the machine clock holds, including for a following suite's `beforeAll`. `instanceof Date` holds for natively created dates, also under `vi.useFakeTimers()`. `Date.length` is 7. `parseTestNow` handles `+05:30`, leap days, Feb 30, `24:00`, leap seconds, 5-digit years, lowercase `t`/`z` as its tests and docs say (all rejected except valid ones). `Etc/GMT+5`, `UTC`, `GMT`, `:UTC`, half-hour and quarter-hour zones (`Asia/Kolkata`, `Asia/Kathmandu`, `Australia/Lord_Howe`, `Pacific/Chatham`) and zones with recent rule changes are accepted; `Z`, an empty-but-set-wrong value, `UTC+3` and `EST5` are rejected.

## Warnings

### WR-01: A global `Date` subclass whose `now` calls `super.now()` recurses without end

**File:** `test/clock-setup.mjs:54-57`
**Issue:** `currentTime` guards only the case where the installed class inherits `now` unchanged (`installed.now === currentTime`). A subclass that overrides `now` and delegates to `super.now()` is the usual shape of a hand-rolled clock mock. Reproduced in a scratch project:

```js
class M extends Date { static now() { return super.now() + 1; } }
globalThis.Date = M;
Date.now();   // RangeError: Maximum call stack size exceeded  (M.now -> currentTime -> M.now ...)
```

`super.now()` resolves to `currentTime`, which sees `installed = M`, whose `now` is not `currentTime`, and calls `M.now()` again. The test "a subclass installed as the global Date follows the pin without recursing" (`test/clock-setup.test.mjs:105`) covers only the inherited-`now` case, so the header's claim ("must not ask it again") is narrower than the code reads. First-review WR-04 called this theoretical; it is not, it needs five lines of ordinary code.
**Fix:** Guard re-entry instead of comparing function identity:

```js
let reading = false;
const currentTime = () => {
  const installed = globalThis.Date;
  if (reading || installed === PinnedDate) return pinned;
  reading = true;
  try {
    return installed.now();
  } finally {
    reading = false;
  }
};
```

and add a case with an overriding subclass.

### WR-02: Natively created dates differ from the pin in prototype and constructor identity, and the header's contract does not say so

**File:** `test/clock-setup.mjs:25-27, 63-86`
**Issue:** The header lists `toString` as the only difference besides `length` and `instanceof`. `Symbol.hasInstance` repairs `instanceof` only. Verified in a pinned Vitest worker (and the same under `vi.useFakeTimers({ toFake: ['Date'] })`):

- `expect(structuredClone(d)).toStrictEqual(d)` fails with "expected 1970-01-01T00:00:00.000Z to strictly equal 1970-01-01T00:00:00.000Z" (`toStrictEqual` compares constructors), while `toEqual` passes. The same holds for `fs.statSync(...).mtime` against `new Date(...)`.
- `structuredClone(new Date(0)).constructor === Date` is false and `Object.getPrototypeOf(nativeDate) === Date.prototype` is false.
- `Object.getOwnPropertyDescriptor(Date, 'prototype').writable` is true (native: false), and `Date.prototype instanceof Date` is true (native: false).

Stock Vitest without the pin passes the `toStrictEqual` case, so this is an unannounced behaviour change that only shows up when a future test round-trips a date through `structuredClone`, IndexedDB (`fake-indexeddb` clones), `fs` or a worker message. First-review WR-04 asked for these divergences to be documented; the fix documented two of them.
**Fix:** List the three behaviours in the header and in `docs/testing.md`, and pin them with a test so a change is deliberate:

```js
it('a natively created date equals a pinned one with toEqual, not toStrictEqual', () => {
  expect(structuredClone(new Date(0))).toEqual(new Date(0));
  expect(() => expect(structuredClone(new Date(0))).toStrictEqual(new Date(0))).toThrow();
});
```

### WR-03: The setup file is not idempotent; a second load in the same global stacks pins and breaks native-date `instanceof`

**File:** `test/clock-setup.mjs:36, 94`
**Issue:** `const NativeDate = globalThis.Date;` assumes it runs once per global. With `isolate: false`, Vitest re-runs setup files per test file in the same global (Vitest's own run summary suggests exactly this: "~19.33s faster with isolate: false", for the service; "~38.81s" for the web). The second file then takes the first file's `PinnedDate` as `NativeDate`, builds a second pin on top of it and registers a second `beforeEach`/`afterEach` pair. Reproduced with `isolate: false`, `fileParallelism: false`, three files:

```
b.test.mjs  FAIL  expect(structuredClone(new Date()) instanceof Date).toBe(true)  -> false
c.test.mjs  FAIL  (same)
```

The first file passes, files two and three fail, because `Symbol.hasInstance` tests against `NativeDate.prototype`, which is now the previous pin's prototype. No config sets `isolate: false` today (`grep` over every vitest/vite config), so this is latent, but the suggestion is on screen every `pnpm test`.
**Fix:** Make the install idempotent by remembering the native class on the pin:

```js
const NATIVE = Symbol.for('hearth.nativeDate');
const NativeDate = globalThis.Date[NATIVE] ?? globalThis.Date;
// after building PinnedDate:
Object.defineProperty(PinnedDate, NATIVE, { value: NativeDate });
```

and add a two-file `isolate: false` scenario to `test/clock-setup.test.mjs` (the runner needs a `config` option for that).

### WR-04: `docs/testing.md` and `docs/file-map.md` do not describe the harness tests that now gate `pnpm test`

**File:** `docs/testing.md:9, 26-28, 43`; `docs/file-map.md:19, 73, 153`; `package.json` (`test`, `test:harness`)
**Issue:** `pnpm test` now runs `pnpm test:harness && pnpm -r test`: four `node --test` files (`test/clock-setup.test.mjs`, `test/global-tz.test.mjs`, `test/eslint-clock-ban.test.mjs`, `scripts/test-sweep.test.mjs`), 167 tests, about 14 s. The docs still say "Vitest (two files, `node --test`, in `e2e/support`)" (line 9), "The two exceptions are ..." (26) and "**Runner:** Vitest everywhere except the two `node --test` files above" (43). `test:harness`, `test/test-now.mjs`, `test/support/vitest-project.mjs` and the new test files are mentioned nowhere in `docs/`; `file-map.md:19` still describes `test/` as setup only. Because `docs/` is the only source of truth (CLAUDE.md), the statement about the runner is now false. Separately the `&&` means a harness failure stops `pnpm -r test` from running at all, so one red harness test hides every workspace result in CI; that trade-off is not stated.
**Fix:** Update the table row and the "exceptions" paragraph to six `node --test` files, add a short "Harness tests" bullet under "Dates and time zones" naming `pnpm test:harness` and what it covers, add the new files to `file-map.md`, and either keep `&&` deliberately (say so) or run the two parts as separate CI steps.

### WR-05: The clock-ban selectors miss common spellings, flag a non-read, and the docs claim "any spelling"

**File:** `eslint.config.js:12-45`; `docs/testing.md:126-134`
**Issue:** Probed with the repo's config through the ESLint API (virtual path `apps/service/src/test/probe.ts`; `disableTypeChecked` as the harness does). The rule did not report any of these real-clock reads:

- `const D = Date; D.now();` and `new D()`; `const { Date: D } = globalThis; D.now();`
- `globalThis['Date'].now()` (computed member on the global), `({ now } = Date)` (assignment pattern, only `VariableDeclarator` is matched)
- `Date.call(null)`, `Date.apply()`, `Reflect.construct(globalThis.Date, [])`
- `globalThis.Intl.DateTimeFormat().format()`, `new Intl.DateTimeFormat('en').formatRange?.()`
- `new (Date satisfies DateConstructor)()`, and `new (Date!)()` in a test file (non-null assertions are allowed in tests, `eslint.config.js:132`)

It reports a non-read: `typeof Date.now === 'function'` is flagged (any `Date.now` member expression is), and so is the stubbing assignment `Date.now = vi.fn()`. The docs say the rule bans "`Date.now` in any spelling ... an alias or a reference" and list only "a formatter held in a variable and `process.hrtime()`" as undetected. Both statements are broader than the selectors. That is the same overclaim the first review's WR-03 flagged, narrowed but not removed.
**Fix:** Do not chase every spelling. Reword the docs to "the common spellings" and list what is not detected (aliasing `Date` itself, computed access on the global, `call`/`apply`, assignment destructuring, `Temporal.Now`, `process.hrtime()`, a formatter in a variable). Optionally add one cheap selector for the alias case: `VariableDeclarator[init.name='Date']` (any `const X = Date` in test code is suspect), and narrow the member selector with `:not(UnaryExpression[operator='typeof'] > MemberExpression)` if the `typeof` false positive matters.

### WR-06: A failing `vitest list` crashes the sweep with a stack trace, exit 1 and the message "undefined"

**File:** `scripts/test-sweep.mjs:133-145, 191-194`
**Issue:** `selectedTestFiles` throws when `list.status !== 0` and puts `list.stderr` in the message, ignoring `list.error`. When `pnpm` cannot be spawned, `status` and `stderr` are null and the user gets (reproduced with `PATH=/nonexistent`):

```
Error: could not list the test files for --only src/a.test.ts:
undefined
    at selectedTestFiles (.../test-sweep.mjs:142:11)
...
exit=1
```

`main()` has no catch, so any listing failure (broken Vitest config, missing pnpm) is an uncaught exception and exit 1. The header promises exit 2 for the empty match and "exits 0 only when every run passed"; a crash is neither a usage error nor a failed run, and exit 1 is indistinguishable from "a cell failed".
**Fix:**

```js
if (list.error !== undefined || list.status !== 0) {
  const why = list.error?.message ?? list.stderr;
  console.error(`test-sweep: could not list the test files for --only ${only}: ${why}`);
  process.exit(2);
}
```

and add a case to `scripts/test-sweep.test.mjs` (run the sweep with an empty `PATH` and assert exit 2).

## Info

### IN-01: The `NativeDate` branches in `suiteClockInstalled` and `afterEach` are unreachable and untested

**File:** `test/clock-setup.mjs:98-99, 115`
**Issue:** `globalThis.Date !== NativeDate` and `if (globalThis.Date === NativeDate) globalThis.Date = PinnedDate` assume something can put the native class back. Under Vitest 5.0.1 nothing does: `setSystemTime` and `useFakeTimers` both go through sinon, whose `uninstall` restores the `Date` global at install time (the pin). A scratch test where a suite's `afterAll` calls `vi.useRealTimers()` and the next suite's `beforeAll` reads `new Date()` returned the pin, so the branch never runs. No test covers it. If a Vitest upgrade does change this, the branch is a useful guard, but then it should carry a test.
**Fix:** Either delete the two `NativeDate` comparisons, or keep them and add a scenario that assigns `globalThis.Date` to the native class (obtained before the setup file) and checks the pin returns.

### IN-02: A `beforeAll` clock without an `afterAll` leaks to every later suite in the file, and the pin cannot be restored

**File:** `test/clock-setup.mjs:96-120`; `docs/testing.md:76-79`
**Issue:** By design a suite-owned clock is left "exactly as the tests leave it". If the suite forgets its `afterAll(() => vi.useRealTimers())`, the next suite's `beforeEach` sees fake timers (or a foreign `Date`), classes it as suite-owned too and never re-pins. Reproduced: a `describe` with `beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(2050) })` and no `afterAll` made the following `describe`'s first test see 2050 and `vi.isFakeTimers() === true`. Before the change the per-test restore contained the leak to one test. This is the same behaviour as plain Vitest, but the previous setup file hid it and the docs only say "the suite removes it in an `afterAll`", not what happens when it does not.
**Fix:** Say in `docs/testing.md` that a suite that installs a clock in `beforeAll` must remove it in `afterAll`, and that a missing cleanup leaks into the rest of the file. Add the "leak" scenario to `test/clock-setup.test.mjs` as documented behaviour.

### IN-03: `global-tz.mjs` accepts wrong-case UTC-equivalent names, and rejects pins before 1883 with a misleading message

**File:** `test/global-tz.mjs:10-17, 82-93`; `docs/testing.md:96-98`
**Issue:** Two edges, both benign in practice.
(a) The header and the docs say a wrong letter case "makes Node fall back to UTC and fails the comparison". That holds for every zone with a non-zero offset, but `TZ=africa/abidjan`, `Africa/abidjan`, `atlantic/reykjavik`, `ETC/UTC`, `etc/gmt`, `gmt` and `utc` all exit 0 (offsets are zero in every sample, so the comparison cannot fail) while the process resolves `Intl.DateTimeFormat().resolvedOptions().timeZone === undefined`. The `[test-clock]` line then prints the normalised `formatter` name, not what the process runs on. Results are identical to UTC, so no test can be wrong, but the statement is not true as written.
(b) A pinned `HEARTH_TEST_NOW` before local mean time ended is compared in minutes against `Intl`'s second-resolution offset: `TZ=America/New_York HEARTH_TEST_NOW=1850-01-01T00:00:00Z` and `Asia/Tokyo` with year `0100` throw "is not honored ... (check the spelling and the letter case)" for a correctly spelled zone. Contrived, but the advice in the message is wrong for it.
**Fix:** Soften the header and docs ("a non-UTC zone with the wrong case fails"), and round both sides to whole minutes in `zoneOffset`/the comparison (`Math.round(offset / MINUTE)`), or limit the pinned-instant sample to years 1970 and later.

### IN-04: Dead branch and leftovers in `parseTestNow`

**File:** `test/test-now.mjs:22-24, 42-44`
**Issue:** After the anchored regex and the calendar/range checks pass, `Date.parse(value)` cannot return `NaN` (probed across offsets up to `+23:59` and years up to 9999), so the `is not a valid instant` branch is unreachable. `match.map((part) => part)` copies the array for no reason, and years `0000`-`0099` are rejected with "is not a real date and time" because `Date.UTC` maps them to 19xx; valid ISO, wrong message. Fractional seconds longer than three digits are silently truncated.
**Fix:** Drop the `Date.parse` guard (or keep it as an `assert`), destructure `match` directly, and say in the message that years before 0100 are unsupported if that is intended.

### IN-05: Harness robustness: no spawn timeouts, collection-time spawns, hard-coded Vitest path, coupling to a real test file

**File:** `test/support/vitest-project.mjs:16, 40-53`; `test/clock-setup.test.mjs:275-352`; `test/global-tz.test.mjs:28`; `scripts/test-sweep.test.mjs:137-148`
**Issue:** None of the `spawnSync` calls sets `timeout`, so a hung child blocks until the CI job limit. `runVitestProject` is called while `describe` bodies run, which means all ten Vitest spawns execute serially during collection (about 10 s) and a spawn failure surfaces as a failed `describe`, not as per-test results. `VITEST_BIN` is `packages/shared/node_modules/vitest/vitest.mjs`, valid only with pnpm's per-workspace links and while `shared` keeps Vitest. The sweep test "one file, one cell, passes" depends on `packages/shared/src/api/schemas.test.ts` existing. `REPO_ROOT` is exported from `vitest-project.mjs` and imported by `global-tz.test.mjs` and `eslint-clock-ban.test.mjs` only for that constant. `suiteClock` in `clock-setup.mjs` is one shared variable, so `describe.concurrent` would interleave it (no test uses `.concurrent` today).
**Fix:** Add `timeout: 120_000` to the spawns; resolve Vitest with `createRequire(import.meta.url).resolve('vitest/vitest.mjs')`; move `REPO_ROOT` to a tiny `test/support/paths.mjs`; run the Vitest projects inside `before()` hooks so a failure is reported per file.

### IN-06: Test gaps in the harness

**File:** `test/eslint-clock-ban.test.mjs:37-89, 142-147`; `test/clock-setup.test.mjs`
**Issue:** A mutation pass (remove each of the 18 selectors, rerun the BAD list) shows three selectors no probe needs: `CallExpression[callee.object.name=GLOBAL][callee.property.name='Date']` (`window.Date()`), `MemberExpression[object.object.name=GLOBAL]...[computed=true]` (`globalThis.Date['now']`) and `VariableDeclarator[init.object.name=GLOBAL]...Property[key.name='now']` (`const { now } = globalThis.Date`). They can be broken or deleted with the suite staying green. The "not covered" cases (`apps/service/src/probe.ts`, `scripts/probe.mjs`) assert an empty rule result, which is also what an ignored or unconfigured path produces (ESLint reports a message with a null `ruleId`, which the helper filters out); they pass vacuously if a future ignore pattern swallows those paths. In `clock-setup.test.mjs`, no case checks that `vi.useFakeTimers()` with no explicit time starts at the pin (it does) or that a following suite's `beforeAll` sees the pin after an owner's `afterAll` (it does); the contract sentence in the header is therefore tested only at test boundaries.
**Fix:** Add `Date.now` probes for the three selectors; in `clockMessages` also return whether any message has `ruleId === null` and assert it is false for the "not covered" cases; add the two clock scenarios above.

---

_Reviewed: 2026-10-19T14:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
