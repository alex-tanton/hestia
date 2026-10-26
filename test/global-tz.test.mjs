/*
 * Tests for `test/global-tz.mjs`, the Vitest `globalSetup` that validates `TZ` and
 * `HESTIA_TEST_NOW` before any test runs. `TZ` is process-wide state, so each case runs the hook
 * in a child process with its own environment. Run by `pnpm test` through `test:harness`.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { REPO_ROOT } from './support/vitest-project.mjs';

const HOOK = pathToFileURL(join(REPO_ROOT, 'test', 'global-tz.mjs')).href;

// Prints the offsets (minutes behind UTC) the process uses after the hook ran.
const SCRIPT = `
import setup from ${JSON.stringify(HOOK)};
setup();
const at = (iso) => new Date(iso).getTimezoneOffset();
console.log(JSON.stringify({ january: at('2026-01-15T12:00:00Z'), july: at('2026-07-15T12:00:00Z') }));
`;

function runHook(env) {
  const childEnvironment = { ...process.env };
  delete childEnvironment['TZ'];
  delete childEnvironment['HESTIA_TEST_NOW'];
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', SCRIPT], {
    env: { ...childEnvironment, ...env },
    encoding: 'utf8',
  });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

/** The offsets the hook left the process on, from the last line of its output. */
function offsets(run) {
  const lines = run.stdout.trim().split('\n');
  return JSON.parse(lines[lines.length - 1] ?? '{}');
}

describe('global-tz: TZ values the process honors are accepted', () => {
  // [value, January offset, July offset] in minutes behind UTC, as `getTimezoneOffset` reports.
  const accepted = [
    ['America/New_York', 300, 240],
    ['Asia/Tokyo', -540, -540],
    ['Pacific/Kiritimati', -840, -840],
    ['Pacific/Pago_Pago', 660, 660],
    ['Asia/Kolkata', -330, -330],
    ['Europe/London', 0, -60],
    ['EST5EDT', 300, 240],
    ['UTC', 0, 0],
    ['Etc/UTC', 0, 0],
    ['GMT', 0, 0],
    ['Etc/GMT', 0, 0],
    [':America/New_York', 300, 240],
    [':UTC', 0, 0],
  ];
  for (const [value, january, july] of accepted) {
    it(`TZ=${value}`, () => {
      const run = runHook({ TZ: value });
      assert.equal(run.status, 0, run.stderr);
      assert.match(run.stdout, /\[test-clock\] TZ=\S+ HESTIA_TEST_NOW=\(default\)/);
      assert.deepEqual(offsets(run), { january, july });
    });
  }

  it('does nothing when TZ is unset or empty', () => {
    for (const env of [{}, { TZ: '' }]) {
      const run = runHook(env);
      assert.equal(run.status, 0, run.stderr);
      assert.doesNotMatch(run.stdout, /\[test-clock\]/);
    }
  });
});

describe('global-tz: TZ values that are not a zone are rejected', () => {
  for (const value of ['Foo/Bar', 'america/new_york', 'UTC+3', 'Z', 'not a zone', ':Foo/Bar']) {
    it(`TZ=${value}`, () => {
      const run = runHook({ TZ: value });
      assert.notEqual(run.status, 0, `accepted: ${run.stdout}`);
      assert.match(run.stderr, /TZ=/);
      assert.match(run.stderr, /not (an IANA time zone|honored)/);
    });
  }
});

describe('global-tz: HESTIA_TEST_NOW is validated upfront', () => {
  for (const value of [
    '2026-10-14T12:00:00.000Z',
    '2030-10-05T23:30:00+02:00',
    '2030-10-05T23:30Z',
    '2030-10-05T23:30:15-07:00',
    '2030-10-05T23:30:15.5Z',
  ]) {
    it(`accepts ${value}`, () => {
      for (const zone of [undefined, 'Asia/Tokyo']) {
        const run = runHook(
          zone === undefined ? { HESTIA_TEST_NOW: value } : { HESTIA_TEST_NOW: value, TZ: zone },
        );
        assert.equal(run.status, 0, run.stderr);
      }
    });
  }

  for (const value of [
    'Oct 5 2030',
    '2030-10-05',
    '2030-10-05T12:00:00',
    '2030-10-05T12:00:00+0200',
    '2030-10-05 12:00:00Z',
    '2026-02-30T00:00:00Z',
    '2026-10-05T24:00:00Z',
    '2026-10-05T12:00:00+25:00',
    '1760000000000',
    'garbage',
  ]) {
    it(`rejects ${value}`, () => {
      for (const zone of [undefined, 'Asia/Tokyo']) {
        const run = runHook(
          zone === undefined ? { HESTIA_TEST_NOW: value } : { HESTIA_TEST_NOW: value, TZ: zone },
        );
        assert.notEqual(run.status, 0, `accepted: ${run.stdout}`);
        assert.match(run.stderr, /HESTIA_TEST_NOW=/);
        assert.match(run.stderr, /ISO-8601/);
      }
    });
  }

  it('echoes the instant it was given', () => {
    const run = runHook({ TZ: 'Asia/Tokyo', HESTIA_TEST_NOW: '2030-10-05T23:30:00+02:00' });
    assert.match(run.stdout, /HESTIA_TEST_NOW=2030-10-05T23:30:00\+02:00/);
  });
});
