/*
 * Tests for `test/clock-setup.mjs`. The pin is a hand-built `Date` replacement, so it is checked
 * from inside real Vitest workers: each fixture below is a test file run by a throwaway project
 * that has the clock setup file as its `setupFiles`, and every fixture test becomes one test here.
 * Run by `pnpm test` through the root `test:harness` script.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runVitestProject } from './support/vitest-project.mjs';

/** Registers one node:test case per fixture test name, passing when Vitest passed it. */
function expectPassed(result, names) {
  assert.ok(result.tests.length > 0, `Vitest reported no tests:\n${result.output}`);
  for (const name of names) {
    it(name, () => {
      const found = result.tests.find((test) => test.fullName === name);
      assert.ok(
        found,
        `no such test in the fixture run. Ran: ${result.tests.map((t) => t.fullName).join(' | ')}`,
      );
      assert.equal(found.status, 'passed', found.message);
    });
  }
  it('every fixture test is covered by a case here', () => {
    const covered = new Set(names);
    const extra = result.tests.filter((test) => !covered.has(test.fullName));
    assert.deepEqual(
      extra.map((test) => test.fullName),
      [],
    );
  });
}

const SCENARIOS = `
import { statSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const PIN = '2026-10-14T12:00:00.000Z';
const stamp = () => new Date().toISOString();

describe('default pin', () => {
  it('new Date() is the default instant', () => {
    expect(stamp()).toBe(PIN);
  });

  it('Date.now() is the default instant and time does not pass', async () => {
    const first = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(first).toBe(Date.parse(PIN));
    expect(Date.now()).toBe(first);
  });

  it('constructor arguments, Date.UTC and Date.parse behave as native', () => {
    expect(new Date(0).getTime()).toBe(0);
    expect(new Date('2030-01-01T00:00:00Z').toISOString()).toBe('2030-01-01T00:00:00.000Z');
    expect(new Date(2030, 0, 2, 3, 4, 5).getFullYear()).toBe(2030);
    expect(Date.UTC(2030, 0, 1)).toBe(1893456000000);
    expect(Date.parse('2030-01-01T00:00:00Z')).toBe(1893456000000);
    expect(Number.isNaN(new Date(undefined).getTime())).toBe(true);
  });

  it('Date() called as a function returns the pinned time as a string', () => {
    expect(Date()).toBe(new Date(PIN).toString());
  });

  it('a subclass is constructed at the pin and keeps its own class', () => {
    class Stamp extends Date {
      tag = 'stamp';
    }
    const value = new Stamp();
    expect(value).toBeInstanceOf(Stamp);
    expect(value.tag).toBe('stamp');
    expect(value.toISOString()).toBe(PIN);
    expect(new Stamp(2030, 0, 2).getFullYear()).toBe(2030);
    expect(Stamp.now()).toBe(Date.parse(PIN));
  });

  it('keeps the name and the prototype shape of Date', () => {
    expect(Date.name).toBe('Date');
    expect(Date.prototype.constructor).toBe(Date);
    expect(Object.getOwnPropertyNames(Date.prototype)).toContain('getTime');
    expect(new Date()).toBeInstanceOf(Date);
  });
});

describe('the pin looks like the native Date', () => {
  it('has the native length', () => {
    expect(Date.length).toBe(7);
  });

  it('accepts dates created natively as instances', () => {
    expect(structuredClone(new Date())).toBeInstanceOf(Date);
    expect(statSync(process.cwd()).mtime).toBeInstanceOf(Date);
    expect(Object.create(null) instanceof Date).toBe(false);
    expect({} instanceof Date).toBe(false);
  });

  it('does not make a subclass accept plain dates', () => {
    class Stamp extends Date {}
    expect(new Date() instanceof Stamp).toBe(false);
    expect(new Stamp() instanceof Date).toBe(true);
  });

  it('a subclass installed as the global Date follows the pin without recursing', () => {
    class Installed extends Date {}
    const pinned = globalThis.Date;
    globalThis.Date = Installed;
    try {
      expect(Date.now()).toBe(Date.parse(PIN));
      expect(new Installed().toISOString()).toBe(PIN);
    } finally {
      globalThis.Date = pinned;
    }
  });
});

describe('a Date subclass installed as the global Date', () => {
  const PIN_MS = Date.parse(PIN);
  const pinnedDate = globalThis.Date;
  const install = (subclass) => {
    globalThis.Date = subclass;
  };
  afterEach(() => {
    globalThis.Date = pinnedDate;
  });

  it('whose now() adds to super.now() sees the pin plus its own adjustment, once', () => {
    class Skewed extends Date {
      static now() {
        return super.now() + 1;
      }
    }
    install(Skewed);
    expect(Date.now()).toBe(PIN_MS + 1);
  });

  it('two levels of super.now() add each adjustment once', () => {
    class Skewed extends Date {
      static now() {
        return super.now() + 1;
      }
    }
    class MoreSkewed extends Skewed {
      static now() {
        return super.now() + 20;
      }
    }
    install(MoreSkewed);
    expect(Date.now()).toBe(PIN_MS + 21);
  });

  it('whose now() ignores super still answers for itself', () => {
    class Fixed extends Date {
      static now() {
        return 42;
      }
    }
    install(Fixed);
    expect(Date.now()).toBe(42);
    expect(Fixed.now()).toBe(42);
  });

  it('whose now() names a captured pin instead of super ends rather than recursing', () => {
    const Captured = pinnedDate;
    class ByName extends Captured {
      static now() {
        return Captured.now() + 1;
      }
    }
    install(ByName);
    expect(Date.now()).toBeGreaterThanOrEqual(PIN_MS + 1);
  });

  it('is not asked by a class that extended the pin earlier, unless it is the global', () => {
    class Stamp extends pinnedDate {}
    class Skewed extends Date {
      static now() {
        return super.now() + 1;
      }
    }
    expect(Stamp.now()).toBe(PIN_MS);
    install(Skewed);
    expect(Stamp.now()).toBe(PIN_MS + 1);
  });
});

describe('an override lasts until its test ends', () => {
  it('a class that extended the pin follows a clock the test sets', () => {
    class Stamp extends Date {}
    vi.setSystemTime(new Date('2044-01-01T00:00:00.000Z'));
    expect(Stamp.now()).toBe(Date.parse('2044-01-01T00:00:00.000Z'));
    expect(new Stamp().toISOString()).toBe('2044-01-01T00:00:00.000Z');
  });

  it('a test sets the system time', () => {
    vi.setSystemTime(new Date('2040-01-01T00:00:00.000Z'));
    expect(stamp()).toBe('2040-01-01T00:00:00.000Z');
  });

  it('the next test is pinned again', () => {
    expect(stamp()).toBe(PIN);
  });

  it('a test installs fake timers', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2041-01-01T00:00:00.000Z'));
    expect(vi.isFakeTimers()).toBe(true);
    expect(stamp()).toBe('2041-01-01T00:00:00.000Z');
  });

  it('the next test has real timers and the pin', () => {
    expect(vi.isFakeTimers()).toBe(false);
    expect(stamp()).toBe(PIN);
  });

  describe('set in beforeEach', () => {
    beforeEach(() => {
      vi.setSystemTime(new Date('2042-01-01T00:00:00.000Z'));
    });

    it('the first test sees the override', () => {
      expect(stamp()).toBe('2042-01-01T00:00:00.000Z');
    });

    it('the second test sees it too', () => {
      expect(stamp()).toBe('2042-01-01T00:00:00.000Z');
    });
  });

  it('the pin is back after a beforeEach suite', () => {
    expect(stamp()).toBe(PIN);
  });

  describe('a file whose own afterEach restores real timers', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('sets the time', () => {
      vi.setSystemTime(new Date('2043-01-01T00:00:00.000Z'));
      expect(stamp()).toBe('2043-01-01T00:00:00.000Z');
    });

    it('is pinned again, not on the wall clock', () => {
      expect(stamp()).toBe(PIN);
    });
  });
});

describe('a suite-level setSystemTime', () => {
  beforeAll(() => {
    vi.setSystemTime(new Date('2032-01-01T00:00:00.000Z'));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('is seen by the first test', () => {
    expect(stamp()).toBe('2032-01-01T00:00:00.000Z');
  });

  it('is seen by the second test', () => {
    expect(stamp()).toBe('2032-01-01T00:00:00.000Z');
    expect(Date.now()).toBe(Date.parse('2032-01-01T00:00:00.000Z'));
  });

  it('is moved by a test, because the suite owns the clock', () => {
    vi.setSystemTime(new Date('2034-01-01T00:00:00.000Z'));
    expect(stamp()).toBe('2034-01-01T00:00:00.000Z');
  });

  it('stays where the previous test left it', () => {
    expect(stamp()).toBe('2034-01-01T00:00:00.000Z');
  });
});

describe('suite-level fake timers', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2031-01-01T00:00:00.000Z'));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('are installed for the first test', () => {
    expect(vi.isFakeTimers()).toBe(true);
    expect(stamp()).toBe('2031-01-01T00:00:00.000Z');
  });

  it('are still installed for the second test, which advances them', () => {
    expect(vi.isFakeTimers()).toBe(true);
    expect(stamp()).toBe('2031-01-01T00:00:00.000Z');
    vi.advanceTimersByTime(1000);
    expect(stamp()).toBe('2031-01-01T00:00:01.000Z');
  });

  it('keep the time the suite advanced to', () => {
    expect(vi.isFakeTimers()).toBe(true);
    expect(stamp()).toBe('2031-01-01T00:00:01.000Z');
  });
});

describe('after the suites that owned the clock', () => {
  it('real timers and the pin are back', () => {
    expect(vi.isFakeTimers()).toBe(false);
    expect(stamp()).toBe(PIN);
  });
});
`;

const MODULE_SCOPE_FAKE_TIMERS = `
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.useFakeTimers();
vi.setSystemTime(new Date('2035-01-01T00:00:00.000Z'));
afterAll(() => {
  vi.useRealTimers();
});

describe('fake timers installed at module scope', () => {
  it('reach the first test', () => {
    expect(vi.isFakeTimers()).toBe(true);
    expect(new Date().toISOString()).toBe('2035-01-01T00:00:00.000Z');
  });

  it('reach the second test', () => {
    expect(vi.isFakeTimers()).toBe(true);
    expect(new Date().toISOString()).toBe('2035-01-01T00:00:00.000Z');
  });
});
`;

const MODULE_SCOPE_SYSTEM_TIME = `
import { describe, expect, it, vi } from 'vitest';

vi.setSystemTime(new Date('2036-01-01T00:00:00.000Z'));

describe('a system time set at module scope', () => {
  it('reaches the first test', () => {
    expect(new Date().toISOString()).toBe('2036-01-01T00:00:00.000Z');
  });

  it('reaches the second test', () => {
    expect(new Date().toISOString()).toBe('2036-01-01T00:00:00.000Z');
  });
});
`;

describe('clock-setup: the default pin, overrides and restoration', () => {
  const result = runVitestProject({
    files: {
      'scenarios.test.mjs': SCENARIOS,
      'module-fake-timers.test.mjs': MODULE_SCOPE_FAKE_TIMERS,
      'module-system-time.test.mjs': MODULE_SCOPE_SYSTEM_TIME,
    },
  });
  expectPassed(result, [
    'default pin new Date() is the default instant',
    'default pin Date.now() is the default instant and time does not pass',
    'default pin constructor arguments, Date.UTC and Date.parse behave as native',
    'default pin Date() called as a function returns the pinned time as a string',
    'default pin a subclass is constructed at the pin and keeps its own class',
    'default pin keeps the name and the prototype shape of Date',
    'the pin looks like the native Date has the native length',
    'the pin looks like the native Date accepts dates created natively as instances',
    'the pin looks like the native Date does not make a subclass accept plain dates',
    'the pin looks like the native Date a subclass installed as the global Date follows the pin without recursing',
    'a Date subclass installed as the global Date whose now() adds to super.now() sees the pin plus its own adjustment, once',
    'a Date subclass installed as the global Date two levels of super.now() add each adjustment once',
    'a Date subclass installed as the global Date whose now() ignores super still answers for itself',
    'a Date subclass installed as the global Date whose now() names a captured pin instead of super ends rather than recursing',
    'a Date subclass installed as the global Date is not asked by a class that extended the pin earlier, unless it is the global',
    'an override lasts until its test ends a class that extended the pin follows a clock the test sets',
    'an override lasts until its test ends a test sets the system time',
    'an override lasts until its test ends the next test is pinned again',
    'an override lasts until its test ends a test installs fake timers',
    'an override lasts until its test ends the next test has real timers and the pin',
    'an override lasts until its test ends set in beforeEach the first test sees the override',
    'an override lasts until its test ends set in beforeEach the second test sees it too',
    'an override lasts until its test ends the pin is back after a beforeEach suite',
    'an override lasts until its test ends a file whose own afterEach restores real timers sets the time',
    'an override lasts until its test ends a file whose own afterEach restores real timers is pinned again, not on the wall clock',
    'a suite-level setSystemTime is seen by the first test',
    'a suite-level setSystemTime is seen by the second test',
    'a suite-level setSystemTime is moved by a test, because the suite owns the clock',
    'a suite-level setSystemTime stays where the previous test left it',
    'suite-level fake timers are installed for the first test',
    'suite-level fake timers are still installed for the second test, which advances them',
    'suite-level fake timers keep the time the suite advanced to',
    'after the suites that owned the clock real timers and the pin are back',
    'fake timers installed at module scope reach the first test',
    'fake timers installed at module scope reach the second test',
    'a system time set at module scope reaches the first test',
    'a system time set at module scope reaches the second test',
  ]);
});

// With `isolate: false` Vitest runs every file's setup files again in the same global, one file
// after another. Each fixture file counts its position in that sequence on `globalThis`, so the
// test names prove the files shared a global; with isolation they would all say "position 1".
const SHARED_GLOBAL_FILE = `
import { describe, expect, it } from 'vitest';

const position = (globalThis.__hestiaFilePosition = (globalThis.__hestiaFilePosition ?? 0) + 1);
// Padding keeps the unit files larger than the integration file, which Vitest then runs last.
// ${'x'.repeat(4000)}

describe(\`file at position \${position}\`, () => {
  it('sits on a single pin over the native Date', () => {
    const base = Object.getPrototypeOf(Date);
    expect(Function.prototype.toString.call(base)).toContain('[native code]');
  });

  it('accepts natively created dates as instances', () => {
    expect(structuredClone(new Date()) instanceof Date).toBe(true);
    expect(new Date() instanceof Date).toBe(true);
  });

  it('is pinned, and a test override ends with its test', () => {
    expect(new Date().toISOString()).toBe('2026-10-14T12:00:00.000Z');
    expect(Date.now()).toBe(Date.parse('2026-10-14T12:00:00.000Z'));
  });
});
`;

const SHARED_GLOBAL_INTEGRATION_FILE = `
import { describe, expect, it } from 'vitest';

const position = (globalThis.__hestiaFilePosition = (globalThis.__hestiaFilePosition ?? 0) + 1);

describe(\`integration file at position \${position}\`, () => {
  it('is left on the native Date, not on a pin an earlier file installed', () => {
    expect(Function.prototype.toString.call(Date)).toContain('[native code]');
    expect(Date.now()).not.toBe(Date.parse('2026-10-14T12:00:00.000Z'));
  });
});
`;

describe('clock-setup: loaded again in the same global (isolate: false)', () => {
  const result = runVitestProject({
    files: {
      'one.test.mjs': SHARED_GLOBAL_FILE,
      'two.test.mjs': SHARED_GLOBAL_FILE,
      'three.test.mjs': SHARED_GLOBAL_FILE,
      'db.integration.test.mjs': SHARED_GLOBAL_INTEGRATION_FILE,
    },
    testConfig: { isolate: false, fileParallelism: false },
  });
  expectPassed(result, [
    ...[1, 2, 3].flatMap((position) => [
      `file at position ${position} sits on a single pin over the native Date`,
      `file at position ${position} accepts natively created dates as instances`,
      `file at position ${position} is pinned, and a test override ends with its test`,
    ]),
    'integration file at position 4 is left on the native Date, not on a pin an earlier file installed',
  ]);
});

describe('clock-setup: HESTIA_TEST_NOW', () => {
  const FIXTURE = `
import { describe, expect, it } from 'vitest';

describe('configured pin', () => {
  it('is the instant of the offset time, whatever the zone', () => {
    expect(new Date().toISOString()).toBe('2030-10-05T21:30:00.000Z');
    expect(Date.now()).toBe(Date.parse('2030-10-05T21:30:00.000Z'));
  });
});
`;
  for (const zone of ['America/New_York', 'Pacific/Kiritimati']) {
    describe(`in ${zone}`, () => {
      const result = runVitestProject({
        files: { 'configured.test.mjs': FIXTURE },
        env: { HESTIA_TEST_NOW: '2030-10-05T23:30:00+02:00', TZ: zone },
      });
      expectPassed(result, ['configured pin is the instant of the offset time, whatever the zone']);
    });
  }
});

describe('clock-setup: integration test files', () => {
  const FIXTURE = `
import { describe, expect, it } from 'vitest';

describe('integration file', () => {
  it('is left on the native Date', () => {
    expect(Function.prototype.toString.call(Date)).toContain('[native code]');
    expect(Date.now()).not.toBe(Date.parse('2026-10-14T12:00:00.000Z'));
  });
});
`;
  const result = runVitestProject({ files: { 'db.integration.test.mjs': FIXTURE } });
  expectPassed(result, ['integration file is left on the native Date']);
});

describe('clock-setup: an invalid HESTIA_TEST_NOW', () => {
  const FIXTURE = `
import { describe, expect, it } from 'vitest';

describe('never runs', () => {
  it('is not reached', () => {
    expect(true).toBe(true);
  });
});
`;
  for (const value of ['Oct 5 2030', '2030-10-05', 'garbage']) {
    it(`fails the run with a message naming it: ${value}`, () => {
      const result = runVitestProject({
        files: { 'never.test.mjs': FIXTURE },
        env: { HESTIA_TEST_NOW: value },
      });
      assert.notEqual(result.status, 0);
      assert.match(result.output, /HESTIA_TEST_NOW=/);
      assert.match(result.output, /ISO-8601/);
    });
  }
});
