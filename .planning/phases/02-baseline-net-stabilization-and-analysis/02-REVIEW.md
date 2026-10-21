---
phase: 02-baseline-net-stabilization-and-analysis
reviewed: 2026-10-13T02:50:00Z
depth: deep
files_reviewed: 33
files_reviewed_list:
  - test/clock-setup.mjs
  - test/global-tz.mjs
  - scripts/test-sweep.mjs
  - eslint.config.js
  - knip.json
  - package.json
  - e2e/package.json
  - e2e/playwright.config.ts
  - e2e/support/clock.ts
  - e2e/support/clock.test.ts
  - e2e/tests/15-chores-and-errands.spec.ts
  - e2e/tests/16-bill-paid-late-keeps-anchor.spec.ts
  - e2e/tests/19-notifications.spec.ts
  - apps/service/vitest.config.ts
  - apps/service/vitest.coverage.config.ts
  - apps/service/vitest.integration.config.ts
  - apps/service/src/test/zone-dates.ts
  - apps/service/src/test/zone-dates.test.ts
  - apps/service/src/test/fake-app.ts
  - apps/service/src/cli.test.ts
  - apps/service/src/deals/flipp/request-queue.test.ts
  - apps/service/src/recipes/host-rate-limiter.test.ts
  - apps/service/src/routes/routes.test.ts
  - apps/service/src/bills.integration.test.ts
  - apps/service/src/chores.integration.test.ts
  - apps/service/src/errands.integration.test.ts
  - apps/service/src/log-autopay.integration.test.ts
  - apps/service/src/jobs.integration.test.ts
  - apps/web/vite.config.ts
  - apps/web/src/screens/deals/favorites.test.tsx
  - packages/shared/src/api/schemas.test.ts
  - docs/testing.md
  - docs/file-map.md
findings:
  critical: 0
  warning: 5
  info: 8
  total: 13
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-10-13
**Depth:** deep
**Files Reviewed:** 33
**Status:** issues_found

Scope: `git -C /home/user/hearth-knip diff 89eb558 3c0fe6b -- . ':(exclude).planning'` on branch `chore/knip-config` (3c0fe6b).
Other changed files in the same diff (the remaining `*.integration.test.ts` edits, the other three `apps/web/src/screens/**` `vi.hoisted` TZ tests, the three package vitest configs, `pnpm-lock.yaml`) follow the patterns of the files listed above and were read, not separately listed.

## Summary

Production code is untouched: every non-test path in the diff under `apps/*/src`, `packages/*/src` and `supabase/` is either a `src/test/` helper or a config file (`fake-app.ts`, `zone-dates.ts`, the vitest/vite configs). No production module changed.

Evidence gathered:

- `pnpm lint` (eslint, `--max-warnings=0`) is clean on the tree.
- The full unit sweep (`node scripts/test-sweep.mjs --log-dir <scratch>`, 6 cells x 6 workspaces) finished `sweep: 36/36 passed`. The service integration suite and the E2E suite were NOT run: there is no Docker daemon in this sandbox, so every integration and E2E finding below is from reading, not execution.
- The sweep's shell-injection claim holds. `--only 'x;echo pwned'`, `--only $(id)`, an embedded newline, `a b`, a leading `-`, and an unknown workspace or cell are all rejected before any process is spawned (exit 2). JS `$` has no PCRE trailing-newline allowance, so `x\n` is also rejected. No injection path found.
- The clock pin was exercised in a scratch vitest project outside the repo with `test/clock-setup.mjs` as a setup file (the scratch copy and its output are in the scratchpad, not the repo). The pin behaves correctly for: default instant, `HEARTH_TEST_NOW` (ISO), `new Date()`, `Date.now()`, `Date.UTC/parse`, subclassing, `vi.setSystemTime` inside a test, `vi.useFakeTimers()` inside a test, restoration between tests, and the integration-file skip. The defects are in the edges listed below.
- `git -C /home/user/hearth-knip status --short` is empty on completion.

No blockers. Five warnings concern the robustness of the clock pin and the sweep, which are the guardrails the rest of the phase depends on.

## Warnings

### WR-01: The per-test re-pin silently discards `beforeAll`/module-scope `vi.setSystemTime` and `vi.useFakeTimers`, and tears down fake timers installed there

**File:** `test/clock-setup.mjs:70-78`
**Issue:** The setup registers `beforeEach(() => { globalThis.Date = PinnedDate })` and an unconditional `afterEach(() => { vi.useRealTimers(); globalThis.Date = PinnedDate })`. Both run for every test. A test file that installs a clock once, in `beforeAll` or at module scope (a normal Vitest idiom, and the idiom that worked before this phase), has it clobbered with no error. Reproduced in a scratch project:

```
describe('beforeAll fake timers', () => {
  beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2031-01-01T00:00:00Z')); });
  it('first',  ...) // new Date() -> 2026-10-14T12:00:00.000Z (not 2031), vi.isFakeTimers() true
  it('second', ...) // new Date() -> 2026-10-14T12:00:00.000Z, vi.isFakeTimers() false
})
describe('beforeAll setSystemTime only', () => {
  beforeAll(() => { vi.setSystemTime(new Date('2032-01-01T00:00:00Z')); });
  // both tests see 2026-10-14T12:00:00.000Z
})
```

The first test of a `beforeAll`-faked file gets fake timers with the wrong `Date`, and every later test loses the fake timers entirely (the unconditional `vi.useRealTimers()`). The result is a wrong instant, not a failure, so a future test can pass or fail for the wrong reason. No current test hits this (every existing use is inside `beforeEach` or a test body; I grepped), which is why the 36-cell sweep is green. `docs/testing.md` ("A test overrides the instant with `vi.setSystemTime`") and the file header ("takes over until the test ends") present it as a general mechanism and never mention the scope restriction.
**Fix:** Either make the re-pin conditional so it does not fight a deliberately installed clock, or document the restriction. A minimal conditional version:

```js
beforeEach(() => {
  if (!vi.isFakeTimers() && globalThis.Date === NativeDate) globalThis.Date = PinnedDate;
});
afterEach(() => {
  if (vi.isFakeTimers()) vi.useRealTimers();
  globalThis.Date = PinnedDate;
});
```

(`beforeAll` clocks would still be reset by `afterEach` after the first test; if that is intended, state in `docs/testing.md` that clock overrides must be installed in `beforeEach` or the test body.)

### WR-02: `--only` with a path that matches no test reports PASS

**File:** `scripts/test-sweep.mjs:121-125, 198-206`
**Issue:** Every workspace `test` script is `vitest run --passWithNoTests`, so an `--only` filter that matches nothing exits 0 and the sweep prints `result=PASS exit=0`. Reproduced: `node scripts/test-sweep.mjs --workspace shared --cell default --only nonexistent/foo.test.ts` prints "No test files found, exiting with code 0" and then `sweep: 1/1 passed`. A mistyped path in the documented debugging workflow (`--only` is the way to re-run a failing file in a failing cell) therefore looks like a fix. The sweep exits 0, which the header advertises as "only when every run passed".
**Fix:** Reject an `--only` that matches no file before spawning (for example, `existsSync(join(REPO_ROOT, 'apps'|'packages', workspace, only))`), or append `--passWithNoTests=false` to the command when `only` is set, so vitest exits 1:

```js
const filter = only === undefined ? '' : ` --passWithNoTests=false ${only}`;
```

### WR-03: The `no-restricted-syntax` clock ban has easy false negatives, and the rule scope has gaps

**File:** `eslint.config.js:112-128` (selectors at lines 118 and 123)
**Issue:** Only two shapes are caught: `NewExpression[callee.name='Date'][arguments.length=0]` and `CallExpression[callee.object.name='Date'][callee.property.name='now']`. I linted a probe through `eslint --stdin` under four in-scope paths (e2e, `src/test/`, web `src/test/`, `test-setup.ts`). Reported: `new Date()`, `Date.now()`, `new Date(Date.now())`, `new Date().getFullYear()`. NOT reported:

- `new Date(undefined)` and `new Date(...[])` (arguments.length is not 0, but both read the real/pinned "now" for the second and an invalid date for the first)
- `globalThis.Date.now()`, `new globalThis.Date()`, `Date['now']()` (computed member has no `property.name`), `new (Date as any)()`
- `const f = Date.now; f()`, `const { now } = Date; now()`, `{ now: Date.now }` (reference, not a call)
- `Date()` called as a function (returns the current time string)
- `Reflect.construct(Date, [])`
- `new Intl.DateTimeFormat(...).format()` with no argument, which reads the real wall clock and is NOT covered by the pin (confirmed: it returned the real date while `new Date()` returned the pinned one)
- `performance.now()`, `process.hrtime()`, and `setTimeout`-based clocks

The `files` list also uses `**/*.test.{ts,tsx}` and `**/*.spec.ts`, so `*.test.mjs`, `*.test.js`, `*.test.cts` and `*.spec.tsx` are outside it. No such files exist today (checked with `git ls-files`), so this is latent. In fairness, the rule is a guard rail against the common mistakes, not a proof; the point is that the docs promise "bans bare `new Date()` and `Date.now()`", which is accurate, while the rule's comment ("A real-clock read goes through a currentInstant helper") reads as stronger than it is.
**Fix:** Broaden the selectors to the cheap, high-value shapes and widen `files`:

```js
{ selector: "NewExpression[callee.name='Date'][arguments.length=0]" },
{ selector: "NewExpression[callee.name='Date'][arguments.length=1][arguments.0.name='undefined']" },
{ selector: "CallExpression[callee.name='Date']" },
{ selector: "MemberExpression[object.name='Date'][property.name='now']" },          // also catches aliasing and references
{ selector: "MemberExpression[object.property.name='Date'][property.name='now']" }, // globalThis.Date.now
{ selector: "MemberExpression[object.name='Date'][computed=true][property.value='now']" },
{ selector: "MemberExpression[object.name='performance'][property.name='now']" },   // with a documented opt-out
```

and use `**/*.{test,spec}.{ts,tsx,mjs,js,cts}` in `files`. State in the docs which real-clock paths remain unguarded (`Intl` formatter with no argument, `hrtime`).

### WR-04: The clock pin, `global-tz.mjs` and the sweep's argument validation have no tests, and the pin diverges from native `Date` in ways nothing asserts

**File:** `test/clock-setup.mjs:44-65`, `test/global-tz.mjs`, `scripts/test-sweep.mjs:59-87,159-167`
**Issue:** The most delicate piece of this phase (a hand-built `Date` replacement using `new.target`, `Reflect.construct`, a copied prototype and `Object.setPrototypeOf`) is covered only indirectly by the suite staying green. There is no test that `test/` code behaves as the header comment claims, and `test/` is not part of any Vitest project. Measured divergences from native `Date` that nothing pins down:

- Dates created natively are not `instanceof Date`: `structuredClone(new Date()) instanceof Date === false`, and `fs.statSync(...).mtime instanceof Date === false`, because their prototype is `NativeDate.prototype`, not `PinnedDate.prototype`. A future `z.date()` or `instanceof Date` check on such a value passes in production and fails under the pin.
- `Date.length` is 0 (native: 7) and `Function.prototype.toString.call(Date)` shows JS source, not `[native code]`.
- `currentTime()` recurses if a library installs a subclass of `PinnedDate` that does not override static `now` while `globalThis.Date !== PinnedDate` (`globalThis.Date.now()` resolves back to the inherited `PinnedDate.now`). I could not make a vitest/sinon/mockdate path hit this, so it is theoretical.

The sweep's injection rejection, unknown-cell handling and `--only` shape checks are likewise untested; the claim that `--only 'x;echo pwned'` is rejected is true (verified by hand above) but would regress silently. The phase constraint is "every bug fix ships with a regression test", and the TIME-05 fix has one (see IN-08) while the guard rails do not.
**Fix:** Add a small `node --test` file for the harness (the repo already runs `node --test` in `e2e/support`), for example `test/clock-setup.test.mjs` that runs a tiny vitest project, and `scripts/test-sweep.test.mjs` that spawns `node scripts/test-sweep.mjs --only 'x;echo pwned' ...` and asserts exit 2 and no side effect. For the divergences, document them in the header of `clock-setup.mjs` (the header currently only explains why the pin exists).

### WR-05: `global-tz.mjs` rejects some valid `TZ` values and does not validate `HEARTH_TEST_NOW`

**File:** `test/global-tz.mjs:97-112`; `test/clock-setup.mjs:24-32`
**Issue:** `docs/testing.md` says the hook "does nothing when `TZ` is unset" and otherwise only rejects non-IANA values. Checked against Node 24.21:

- `TZ=GMT`: `Intl.DateTimeFormat('en-US', {timeZone: 'GMT'})` resolves to `UTC`, but the process default resolves to `+00:00`, so the hook throws "resolved to +00:00, expected UTC" for a valid, common value.
- `TZ=:America/New_York` (POSIX colon form) throws a RangeError and is reported as "not an IANA time zone".
- `TZ=america/new_york` is correctly rejected (Node falls back; good).

Separately, `HEARTH_TEST_NOW` is only echoed by the hook, never validated. A bad value surfaces from `clock-setup.mjs` as a thrown error inside the setup file of every test file (many obscure failures instead of one upfront message), and an accepted-but-non-ISO value such as `Oct 5 2030` is parsed in the local zone (verified: pinned to `2030-10-05T00:00:00.000Z` here, but it would differ per `TZ`), which defeats the point of a zone-independent pin. Only `Z`-suffixed ISO strings are safe, and nothing says so.
**Fix:** In `global-tz.mjs`, compare normalized zones via a second formatter that goes through the same path as the process default (or accept the `GMT`/`UTC` equivalence explicitly), and validate `HEARTH_TEST_NOW` there once:

```js
if (now !== undefined && now !== '' && !/Z$|[+-]\d\d:\d\d$/.test(now)) {
  throw new Error(`HEARTH_TEST_NOW="${now}" must be an ISO instant with Z or an offset`);
}
```

## Info

### IN-01: The lint message and docs send contributors to a helper that does not exist in 4 of 6 workspaces

**File:** `eslint.config.js:120,125`; `docs/testing.md:109-112`
**Issue:** The error text says "pass an explicit instant to the Date constructor or call currentInstant()". `currentInstant` exists only in `apps/service/src/test/zone-dates.ts` and `e2e/support/clock.ts`. In `apps/web`, `packages/*` and `test/` there is nothing to call, and `docs/testing.md` ("Read the clock through the helper instead") has the same gap. Note the two files also each define their own `dateInZone`/`addDays`, so the "helper" is not one helper.
**Fix:** Reword to "pass an explicit instant; in service tests call `currentInstant()` from `test/zone-dates`, in E2E from `support/clock`" and name which helper applies where.

### IN-02: `spawnSync(..., { shell: true })` with a command string is safe today only because of the regex

**File:** `scripts/test-sweep.mjs:121-125, 198-203`
**Issue:** The claim holds (see Summary): `workspace`, `suite` and cell ids are checked against fixed lists and `only` against `^[A-Za-z0-9._/-]+$` plus a leading-`-` guard before the string is built. The safety, though, depends on one regex staying correct; a later edit that relaxes `ONLY_PATTERN` (to allow spaces or `:` for a test-name filter, say) turns this into command injection from CLI input. `shell: true` is not needed on Linux. `--only` also lets `..` segments through (harmless for a vitest name filter).
**Fix:** Spawn with an argv array and no shell, which removes the dependency on the regex:

```js
spawnSync('pnpm', ['--filter', `@hearth/${workspace}`, script, ...(only === undefined ? [] : [only])], { cwd: REPO_ROOT, env, stdio });
```

### IN-03: A frozen `Date.now()` and a real `performance.now()` is a mixed clock the docs do not mention

**File:** `test/clock-setup.mjs:1-15`; `apps/service/src/recipes/host-rate-limiter.test.ts:85-97`; `docs/testing.md:68-72`
**Issue:** Under the pin `Date.now()` never advances (measured: 30 ms of real timer wait gives an elapsed `Date.now()` delta of 0) while `performance.now()` is real. Any elapsed-time, deadline or `while (Date.now() < t)` logic hangs or reads zero. The host-rate-limiter test had to be rewritten to `performance.now()` for this reason, and its comment says the limiter's default `now` "stays the pinned `Date.now`". That test therefore no longer exercises the limiter against a clock that moves, which was its stated purpose ("the constructor's own defaults"). `docs/testing.md` says only that `Date` is pinned.
**Fix:** Add a sentence to `docs/testing.md` that the pin is frozen (time does not pass) and that elapsed-time tests must install fake timers or measure with `performance.now()`. Consider letting the pin tick forward from its start, using `performance.now()`, if a moving-but-deterministic start is acceptable.

### IN-04: The sweep matrix leaves the common calendar traps uncovered

**File:** `scripts/test-sweep.mjs:25-41`; `docs/testing.md` cell tables
**Issue:** Covered: weekday and weekend in UTC, UTC-11/-8/+9/+14, a year boundary at UTC-11, US spring-forward. Missing: US fall-back (the repeated 01:00 hour), a leap day or month end (Jan 31, Feb 28/29 2028), a year rollover seen from a UTC-positive zone (23:30Z on Dec 31 is already Jan 1 in Tokyo/Kiritimati, the harder direction for `dateInZone`-style code), and half or quarter-hour zones (`Asia/Kolkata`, `Asia/Kathmandu`). The four `vi.hoisted` TZ tests also pin `America/New_York` for themselves, so those files do not vary with `TZ` at all.
**Fix:** Add `dst-end-new-york` (2026-11-01T05:30Z), `leap-day-kolkata` (2028-02-29T18:45Z, `Asia/Kolkata`) and `newyear-tokyo` (2026-12-31T15:30Z, `Asia/Tokyo`).

### IN-05: knip.json produces 14 configuration hints and an unlisted dependency

**File:** `knip.json`; `test/clock-setup.mjs:17`
**Issue:** `pnpm knip` (exit 1, which the docs call "report-only") prints "Configuration hints (14)": ten of the visible ones are "Remove redundant entry pattern" for the `!`-suffixed entries (`src/main.ts!`, `src/cli.ts!`, `src/write-openapi.ts!`, `src/main.tsx!`, `src/sw.ts!`, `src/index.ts!` x3, `src/common-passwords.ts!`, `scripts/test-sweep.mjs!`), plus "`.css` compiled extension excluded by project" for `apps/web`. It also reports `vitest` as an unlisted dependency of `test/clock-setup.mjs` (the root `package.json` has no `vitest`; it resolves only because Vitest aliases its own import in setup files). The `test/*.mjs!` entries mark test setup files as production entries.
**Fix:** Drop the redundant `!` patterns (knip already treats those as entries), drop `!` from `test/*.mjs`, and either add `vitest` to the root `devDependencies` or add `ignoreDependencies: ["vitest"]` for the root workspace with a reason.

### IN-06: Duplicated helpers and a duplicated hoisted TZ block

**File:** `apps/service/src/test/zone-dates.ts:20-39` and `e2e/support/clock.ts:68-93`; `apps/web/src/screens/deals/{favorites,flyers,deal-search}.test.tsx`, `meals/suggestions.test.tsx`
**Issue:** `dateInZone`/`addDays` exist twice with different implementations (ms arithmetic vs `setUTCDate`) and parameter names (`instant` vs `at`). The 15-line `vi.hoisted` + `afterAll` TZ block is copied into four web test files; on restore it assigns the resolved zone name rather than removing `TZ`, so a process that began with `TZ` unset ends with it set (harmless under forks, which isolate per file). `HOME_ZONE = 'America/New_York'` in `bills.integration.test.ts:58` re-states the default in `test/service-stack.ts` (lines 184, 254, 278) instead of importing it, so changing the stack default would silently misalign the bill dates.
**Fix:** Export a `DEFAULT_ZONE` from `service-stack.ts`; note in each of the two clock modules that they are intentionally separate (E2E cannot import service code); consider a `viewerZone()` helper under `apps/web/src/test/` used as `vi.hoisted(async ...)` where the hoisting rules allow, otherwise keep the copies and reference one canonical block in `docs/testing.md`.

### IN-07: A test title that says more than it asserts

**File:** `e2e/support/clock.test.ts:34`
**Issue:** The test is titled "jumps from 1 to 3 across the spring-forward gap" but asserts only that 07:30Z maps to hour 3; nothing asserts the preceding hour is 1, so the "jump" is not tested.
**Fix:** Add `assert.equal(hourInZone('America/New_York', new Date('2026-03-08T06:30:00.000Z')), 1)` or rename the test to match.

### IN-08: Integration and E2E changes were reviewed by reading only

**File:** `apps/service/src/bills.integration.test.ts:551-606`; `e2e/tests/15-chores-and-errands.spec.ts:154-157`; `e2e/tests/19-notifications.spec.ts:89-100`
**Issue:** No Docker or Supabase in this sandbox, so none of these ran. By inspection: the TIME-05 regression tests are sound in design. Kiritimati (UTC+14) differs from the UTC date from 10:00Z and Pago Pago (UTC-11) before 11:00Z, so at every instant at least one household straddles the UTC date and a UTC-calendar helper fails at least one of the four tests, and `homeDate`/`householdDate` are now zone-correct. Remaining risk is a household-midnight race: `householdDate(zone, 0)` is computed from the real clock, then a request is made, so a run that straddles the household's midnight in either zone could see a one-day mismatch (a window of about the request latency twice a day; low). The E2E spec 15 change replaces a fixed `2026-12-01` with `dateInZone(...) + 30`, which is correct and removes a date that would become overdue.
**Fix:** Run `pnpm test:sweep:integration` and the E2E suite on a machine with the stack before relying on the sweep as the net for TIME-05. Optionally recompute the date inside the request-and-assert step, or retry once when `householdDate` differs before and after.

---

_Reviewed: 2026-10-13T02:50:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
