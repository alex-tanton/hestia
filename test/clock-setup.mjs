/*
 * Vitest setup file shared by every workspace: pins `Date` so a unit test does not depend on
 * the wall clock. `docs/testing.md` describes the clock pin and the sweep that varies it.
 *
 * Only `Date` is frozen, through `vi.setSystemTime`, and no fake timers are installed, so real
 * timers keep running for `waitFor`. The instant comes from `HEARTH_TEST_NOW`, otherwise
 * `DEFAULT_TEST_NOW`. A test that needs a different instant sets its own with
 * `vi.setSystemTime`; the pin is re-applied before every test and undone after it.
 */

import { afterEach, beforeEach, expect, vi } from 'vitest';

// A Wednesday, midday UTC, mid-month, away from the US daylight-saving changes.
const DEFAULT_TEST_NOW = '2026-10-14T12:00:00.000Z';

function pinnedInstant() {
  const configured = process.env['HEARTH_TEST_NOW'];
  if (configured === undefined || configured === '') return new Date(DEFAULT_TEST_NOW);
  const instant = new Date(configured);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`HEARTH_TEST_NOW="${configured}" is not a valid instant`);
  }
  return instant;
}

const testPath = expect.getState().testPath ?? '';

// Integration tests compare against the Postgres clock, which cannot be pinned.
if (!testPath.includes('.integration.test.')) {
  const instant = pinnedInstant();

  // Covers module scope and `beforeAll`.
  vi.setSystemTime(instant);

  // Re-pins after a test that called `vi.useRealTimers()` in its own `afterEach`.
  beforeEach(() => {
    vi.setSystemTime(instant);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
}
