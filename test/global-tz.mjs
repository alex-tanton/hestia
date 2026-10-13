/*
 * Vitest `globalSetup`: validates the time zone a run was asked for.
 *
 * Node silently falls back to UTC for an unknown zone, so a mistyped `TZ` would run the whole
 * suite in UTC and still report green. This hook fails the run before any test instead. When
 * `TZ` is unset it changes nothing, so a plain run behaves as it always did. The sweep
 * (`scripts/test-sweep.mjs`) is what sets `TZ` and `HEARTH_TEST_NOW`; `docs/testing.md`
 * describes the contract.
 */

export default function setup() {
  const requested = process.env['TZ'];
  const now = process.env['HEARTH_TEST_NOW'];
  const pinned = now === undefined || now === '' ? '(default)' : now;

  if (requested === undefined || requested === '') return;

  let zone;
  try {
    zone = new Intl.DateTimeFormat('en-US', { timeZone: requested }).resolvedOptions().timeZone;
  } catch (error) {
    if (error instanceof RangeError) {
      throw new Error(`TZ="${requested}" is not an IANA time zone`, { cause: error });
    }
    throw error;
  }

  // Assigning TZ makes Node reset its zone cache before the workers fork.
  process.env['TZ'] = requested;
  const effective = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (effective !== zone) {
    throw new Error(`TZ="${requested}" resolved to ${effective}, expected ${zone}`);
  }

  console.log(`[test-clock] TZ=${zone} HEARTH_TEST_NOW=${pinned}`);
}
