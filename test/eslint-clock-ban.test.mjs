/*
 * Probes for the clock ban in `eslint.config.js` (`no-restricted-syntax` on bare real-clock reads
 * in test code). Each probe is a snippet linted under a path the rule covers, with the repo's real
 * config. A bad probe must raise the rule; a good probe (an explicit instant, `Date.UTC`,
 * `performance.now()`) must not. Run by `pnpm test` through the root `test:harness` script.
 *
 * Out of reach of a selector, so not probed and not banned: a formatter held in a variable and
 * called later (`const f = new Intl.DateTimeFormat(); f.format()`), `process.hrtime()`, timers.
 * `performance.now()` is allowed on purpose: it measures elapsed time and cannot make a result
 * depend on the day or the zone.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { REPO_ROOT } from './support/vitest-project.mjs';

// The probes are virtual files, which the type-aware project service cannot find; the rule under
// test reads syntax only, so type information is switched off for them.
const eslint = new ESLint({
  cwd: REPO_ROOT,
  overrideConfig: tseslint.config(tseslint.configs.disableTypeChecked),
});

/** The messages of the `no-restricted-syntax` rule raised for `code` as if it lived at `filePath`. */
async function clockMessages(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  assert.ok(result, 'no lint result');
  const fatal = result.messages.filter((message) => message.fatal);
  assert.deepEqual(fatal, [], `the probe did not parse: ${JSON.stringify(fatal)}`);
  return result.messages.filter((message) => message.ruleId === 'no-restricted-syntax');
}

const TEST_PATH = 'apps/service/src/test/probe.ts';

const BAD = [
  // The two shapes the rule always had.
  'new Date();',
  'Date.now();',
  'new Date(Date.now());',
  'new Date().getFullYear();',
  // An argument that is the real clock in disguise.
  'new Date(undefined);',
  'new Date(void 0);',
  'new Date(...[]);',
  'Reflect.construct(Date, []);',
  // Another way to name Date or now.
  'globalThis.Date.now();',
  'global.Date.now();',
  "Date['now']();",
  'new globalThis.Date();',
  'new (Date as any)();',
  'new (Date as unknown as DateConstructor)();',
  // A reference, an alias or a destructuring of now.
  'const read = Date.now; read();',
  'const { now } = Date; now();',
  'const clock = { now: Date.now };',
  'const read = globalThis.Date.now;',
  // Date called as a function returns the current time as a string.
  'Date();',
  'String(Date());',
  // A formatter with no instant formats the real now (the pin does not cover Intl).
  "new Intl.DateTimeFormat('en-US').format();",
  'Intl.DateTimeFormat().format();',
  "new Intl.DateTimeFormat('en-US').formatToParts();",
  "new Intl.DateTimeFormat('en-US').format(undefined);",
];

const GOOD = [
  'new Date(someValue);',
  'new Date(0);',
  "new Date('2026-10-14T12:00:00Z');",
  'new Date(2026, 9, 14);',
  'new Date(...parts);',
  'new Date(instant.getTime());',
  'Date.UTC(2026, 9, 14);',
  "Date.parse('2026-10-14T12:00:00Z');",
  'performance.now();',
  "vi.spyOn(Date, 'now');",
  'expect(value).toBeInstanceOf(Date);',
  'const kind = typeof Date;',
  'clock.now();',
  'other.Date.now;',
  "new Intl.DateTimeFormat('en-US').format(someDate);",
  "new Intl.DateTimeFormat('en-US').resolvedOptions().timeZone;",
  "new Intl.DateTimeFormat('en-US').formatToParts(someDate);",
  'Date.prototype.getTime.call(someDate);',
];

describe('eslint clock ban: calls the rule must report', () => {
  for (const code of BAD) {
    it(code, async () => {
      assert.ok((await clockMessages(code, TEST_PATH)).length >= 1, 'not reported');
    });
  }
});

describe('eslint clock ban: code the rule must leave alone', () => {
  for (const code of GOOD) {
    it(code, async () => {
      assert.deepEqual(await clockMessages(code, TEST_PATH), []);
    });
  }

  it('a next-line opt-out with a reason silences it', async () => {
    const code =
      '// eslint-disable-next-line no-restricted-syntax -- measures the real clock\nDate.now();';
    assert.deepEqual(await clockMessages(code, TEST_PATH), []);
  });

  it('production code is not covered', async () => {
    assert.deepEqual(
      await clockMessages('new Date(); Date.now();', 'apps/service/src/probe.ts'),
      [],
    );
  });
});

describe('eslint clock ban: the files it covers', () => {
  const covered = [
    'apps/service/src/probe.test.ts',
    'apps/web/src/probe.test.tsx',
    'apps/web/src/probe.spec.tsx',
    'e2e/tests/probe.spec.ts',
    'e2e/support/probe.ts',
    'apps/service/src/test/probe.ts',
    'apps/web/src/test/probe.tsx',
    'apps/web/src/test-setup.ts',
    'test/probe.mjs',
    'test/probe.test.mjs',
    'scripts/probe.test.mjs',
    'scripts/probe.test.js',
    'scripts/probe.spec.mjs',
  ];
  for (const filePath of covered) {
    it(filePath, async () => {
      assert.ok((await clockMessages('new Date();', filePath)).length >= 1, 'not covered');
    });
  }

  const notCovered = ['apps/service/src/probe.ts', 'apps/web/src/probe.tsx', 'scripts/probe.mjs'];
  for (const filePath of notCovered) {
    it(`${filePath} is production or tooling code`, async () => {
      assert.deepEqual(await clockMessages('new Date();', filePath), []);
    });
  }
});
