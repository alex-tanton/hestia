/*
 * Vitest setup file shared by every workspace: pins `Date` so a unit test does not depend on
 * the wall clock. `docs/testing.md` describes the clock pin and the sweep that varies it.
 *
 * The instant comes from `HEARTH_TEST_NOW`, otherwise `DEFAULT_TEST_NOW`. Only `Date` is frozen
 * and no fake timers are installed, so real timers keep running for `waitFor`.
 *
 * Overriding the clock (`docs/testing.md` states the same contract):
 * - In a test body or a `beforeEach` (`vi.setSystemTime`, `vi.useFakeTimers`): the override takes
 *   over until that test ends, then real timers and the pin are restored for the next test.
 * - At module scope or in a `beforeAll`: the suite owns the clock. It stays installed for every
 *   test in that scope, exactly as the tests leave it (a test that advances fake timers advances
 *   them for the next test), and the suite removes it in an `afterAll` with
 *   `vi.useRealTimers()`. The pin is not re-applied over it.
 * - After `vi.useRealTimers()` the pin comes back at the start of the next test. Code that runs
 *   between that call and the next test (a sibling suite's `beforeAll`) sees the native clock.
 *
 * The pin is a `Date` of its own rather than `vi.setSystemTime`. Vitest's mock leaves
 * `Date.prototype` without its own methods, and `@date-fns/tz` (used by `@hearth/recurrence`)
 * lists those methods when it loads in order to override them: loaded under that mock, its
 * `TZDate` answers in the machine's zone, which is wrong in every negative-offset zone. This pin
 * is in place before any test module is imported, so it has to look like `Date` to such code and
 * construct instances of whatever class extends it.
 *
 * Where the pin still differs from the native `Date`: `Function.prototype.toString.call(Date)`
 * prints this file's function, not `[native code]`, and a test that checks that is checking the
 * pin. `Date.length` is 7 and `instanceof Date` is true for natively created dates, as native.
 */

import { afterEach, beforeEach, expect, vi } from 'vitest';
import { parseTestNow } from './test-now.mjs';

// A Wednesday, midday UTC, mid-month, away from the US daylight-saving changes.
const DEFAULT_TEST_NOW = '2026-10-14T12:00:00.000Z';

const NativeDate = globalThis.Date;

function pinnedInstant() {
  const configured = process.env['HEARTH_TEST_NOW'];
  if (configured === undefined || configured === '') return NativeDate.parse(DEFAULT_TEST_NOW);
  return parseTestNow(configured);
}

const testPath = expect.getState().testPath ?? '';

// Integration tests compare against the Postgres clock, which cannot be pinned.
if (!testPath.includes('.integration.test.')) {
  const pinned = pinnedInstant();

  // The current time: the pin, or whatever a test installed over it with `vi.setSystemTime` or
  // fake timers, so a class extending the pin still follows the clock the test chose. A subclass
  // installed as the global `Date` without its own `now` inherits this function, which must not
  // ask it again.
  const currentTime = () => {
    const installed = globalThis.Date;
    return installed === PinnedDate || installed.now === currentTime ? pinned : installed.now();
  };

  function PinnedDate(...args) {
    if (new.target === undefined) return new NativeDate(currentTime()).toString();
    return Reflect.construct(NativeDate, args.length === 0 ? [currentTime()] : args, new.target);
  }
  // The methods are copied onto the pin's own prototype, because `@date-fns/tz` finds the ones to
  // override by listing the own properties of `Date.prototype` when it loads.
  PinnedDate.prototype = Object.create(
    NativeDate.prototype,
    Object.getOwnPropertyDescriptors(NativeDate.prototype),
  );
  Object.defineProperty(PinnedDate.prototype, 'constructor', {
    value: PinnedDate,
    writable: true,
    configurable: true,
  });
  Object.setPrototypeOf(PinnedDate, NativeDate);
  Object.defineProperty(PinnedDate, 'name', { value: 'Date', configurable: true });
  Object.defineProperty(PinnedDate, 'length', { value: 7, configurable: true });
  // A date made natively (`structuredClone(new Date())`, a file's `mtime`) has the native
  // prototype, not the pin's copy; it is still a `Date`. A subclass keeps the ordinary check.
  Object.defineProperty(PinnedDate, Symbol.hasInstance, {
    value(candidate) {
      return this === PinnedDate
        ? Object.prototype.isPrototypeOf.call(NativeDate.prototype, candidate)
        : Function.prototype[Symbol.hasInstance].call(this, candidate);
    },
    configurable: true,
  });
  Object.defineProperty(PinnedDate, 'now', {
    value: currentTime,
    writable: true,
    configurable: true,
  });

  // Covers module scope and `beforeAll` until a test file installs a clock of its own.
  globalThis.Date = PinnedDate;

  // A clock the file installed in `beforeAll` or at module scope: fake timers, or a `Date` that is
  // neither the pin nor the native one. (After `vi.useRealTimers()` the native `Date` is back, and
  // that is not a clock to keep: the pin returns.)
  const suiteClockInstalled = () =>
    vi.isFakeTimers() || (globalThis.Date !== PinnedDate && globalThis.Date !== NativeDate);

  // Whether the current test started with a clock installed by its file or suite.
  let suiteClock = false;

  beforeEach(() => {
    // Hooks run outside in, so a `beforeAll` has already run and a test's own `beforeEach` has
    // not: what is installed now was installed for the whole scope, not for this test.
    suiteClock = suiteClockInstalled();
    if (!suiteClock) globalThis.Date = PinnedDate;
  });

  afterEach(() => {
    if (suiteClock) {
      // The suite owns its clock and cleans it up itself; the pin leaves it as the tests left it.
      // Only a clock a test tore down (`vi.useRealTimers()`) is put back to the pin.
      if (globalThis.Date === NativeDate) globalThis.Date = PinnedDate;
      return;
    }
    vi.useRealTimers();
    globalThis.Date = PinnedDate;
  });
}
