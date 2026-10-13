/*
 * Vitest setup file shared by every workspace: pins `Date` so a unit test does not depend on
 * the wall clock. `docs/testing.md` describes the clock pin and the sweep that varies it.
 *
 * The instant comes from `HEARTH_TEST_NOW`, otherwise `DEFAULT_TEST_NOW`. Only `Date` is frozen
 * and no fake timers are installed, so real timers keep running for `waitFor`. A test that needs
 * a different instant sets its own with `vi.setSystemTime`, which takes over until the test ends.
 *
 * The pin is a `Date` of its own rather than `vi.setSystemTime`. Vitest's mock leaves
 * `Date.prototype` without its own methods, and `@date-fns/tz` (used by `@hearth/recurrence`)
 * lists those methods when it loads in order to override them: loaded under that mock, its
 * `TZDate` answers in the machine's zone, which is wrong in every negative-offset zone. This pin
 * is in place before any test module is imported, so it has to look like `Date` to such code and
 * construct instances of whatever class extends it.
 */

import { afterEach, beforeEach, expect, vi } from 'vitest';

// A Wednesday, midday UTC, mid-month, away from the US daylight-saving changes.
const DEFAULT_TEST_NOW = '2026-10-14T12:00:00.000Z';

const NativeDate = globalThis.Date;

function pinnedInstant() {
  const configured = process.env['HEARTH_TEST_NOW'];
  if (configured === undefined || configured === '') return NativeDate.parse(DEFAULT_TEST_NOW);
  const instant = NativeDate.parse(configured);
  if (Number.isNaN(instant)) {
    throw new Error(`HEARTH_TEST_NOW="${configured}" is not a valid instant`);
  }
  return instant;
}

const testPath = expect.getState().testPath ?? '';

// Integration tests compare against the Postgres clock, which cannot be pinned.
if (!testPath.includes('.integration.test.')) {
  const pinned = pinnedInstant();

  // The current time: the pin, or whatever a test installed over it with `vi.setSystemTime` or
  // fake timers, so a class extending the pin still follows the clock the test chose.
  const currentTime = () => (globalThis.Date === PinnedDate ? pinned : globalThis.Date.now());

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
  Object.defineProperty(PinnedDate, 'now', {
    value: currentTime,
    writable: true,
    configurable: true,
  });

  // Covers module scope and `beforeAll`.
  globalThis.Date = PinnedDate;

  // Re-pins after a test that called `vi.useRealTimers()` in its own `afterEach`.
  beforeEach(() => {
    globalThis.Date = PinnedDate;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.Date = PinnedDate;
  });
}
