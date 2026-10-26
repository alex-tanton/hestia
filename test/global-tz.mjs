/*
 * Vitest `globalSetup`: validates the time zone a run was asked for.
 *
 * Node silently falls back to UTC for an unknown zone, so a mistyped `TZ` would run the whole
 * suite in UTC and still report green. This hook fails the run before any test instead. When
 * `TZ` is unset it changes nothing, so a plain run behaves as it always did. The sweep
 * (`scripts/test-sweep.mjs`) is what sets `TZ` and `HESTIA_TEST_NOW`; `docs/testing.md`
 * describes the contract.
 *
 * A `TZ` value is accepted when it names a zone and the process really runs on that zone's
 * offsets. Names are not compared, because Node reports the same zone differently depending on
 * how it was asked: `TZ=GMT` is `UTC` to `Intl.DateTimeFormat` but `+00:00` to the process, and
 * the POSIX form `TZ=:America/New_York` is a valid process setting that `Intl` refuses. So the
 * hook checks that `Intl` knows the zone (after dropping a leading colon), then compares the
 * offsets of that zone with the offsets the process uses over a few years of sample instants.
 * An unknown zone, or one whose letter case is wrong, makes Node fall back to UTC and fails the
 * comparison. `HESTIA_TEST_NOW` must be an ISO-8601 instant with an offset (`test-now.mjs`).
 */

import { parseTestNow } from './test-now.mjs';

const MINUTE = 60_000;

/** The offset of `zone` at `instant`, in milliseconds ahead of UTC, as `Intl` reports it. */
function zoneOffset(formatter, instant) {
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, Number(part.value)]),
  );
  const local = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return local - Math.floor(instant / 1000) * 1000;
}

/** The first and the middle of every month of 2024 to 2030 at midday UTC, plus the pinned instant. */
function sampleInstants(pinned) {
  const instants = [];
  for (let year = 2024; year <= 2030; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      instants.push(Date.UTC(year, month, 1, 12), Date.UTC(year, month, 15, 12));
    }
  }
  if (pinned !== undefined) instants.push(pinned);
  return instants;
}

export default function setup() {
  const requested = process.env['TZ'];
  const now = process.env['HESTIA_TEST_NOW'];
  const configured = now !== undefined && now !== '';
  const pinned = configured ? parseTestNow(now) : undefined;

  if (requested === undefined || requested === '') return;

  const name = requested.startsWith(':') ? requested.slice(1) : requested;
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: name,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
  } catch (error) {
    if (error instanceof RangeError) {
      throw new Error(`TZ="${requested}" is not an IANA time zone`, { cause: error });
    }
    throw error;
  }

  // Assigning TZ makes Node reset its zone cache before the workers fork.
  process.env['TZ'] = requested;
  const mismatch = sampleInstants(pinned).find(
    (instant) => zoneOffset(formatter, instant) !== -new Date(instant).getTimezoneOffset() * MINUTE,
  );
  if (mismatch !== undefined) {
    const expected = zoneOffset(formatter, mismatch) / MINUTE;
    const actual = -new Date(mismatch).getTimezoneOffset();
    throw new Error(
      `TZ="${requested}" is not honored: at ${new Date(mismatch).toISOString()} the zone is ` +
        `${String(expected)} min from UTC but the process uses ${String(actual)} min ` +
        '(check the spelling and the letter case)',
    );
  }

  const zone = formatter.resolvedOptions().timeZone;
  console.log(`[test-clock] TZ=${zone} HESTIA_TEST_NOW=${configured ? now : '(default)'}`);
}
