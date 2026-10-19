/*
 * Tests for `scripts/test-sweep.mjs`: how it rejects bad arguments before it spawns anything, and
 * that an `--only` filter selecting no test file fails the sweep instead of passing it. Each case
 * runs the script as a child process. Run by `pnpm test` through the root `test:harness` script.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const SWEEP = join(REPO_ROOT, 'scripts', 'test-sweep.mjs');

const scratch = mkdtempSync(join(tmpdir(), 'hearth-sweep-'));
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function sweep(...args) {
  const run = spawnSync(process.execPath, [SWEEP, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key !== 'TZ' && key !== 'HEARTH_TEST_NOW'),
    ),
  });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

describe('test-sweep: --only rejects anything but a plain test path', () => {
  const marker = join(scratch, 'pwned');
  const hostile = [
    `x;touch ${marker}`,
    `$(touch ${marker})`,
    `\`touch ${marker}\``,
    `x\ntouch ${marker}`,
    `x && touch ${marker}`,
    `x|touch ${marker}`,
    `x&touch ${marker}`,
    `x>${marker}`,
    `x'y`,
    'x"y',
    'a b',
    '$HOME',
    'x\n',
    '-x',
    '',
  ];
  for (const value of hostile) {
    it(`exit 2 before any run: ${JSON.stringify(value)}`, () => {
      const run = sweep('--workspace', 'shared', '--cell', 'default', '--only', value);
      assert.equal(run.status, 2, `${run.stdout}\n${run.stderr}`);
      assert.match(run.stderr, /test-sweep: (--only must be a test path|--only needs a value)/);
      assert.doesNotMatch(run.stdout, /result=|sweep:/);
      assert.equal(existsSync(marker), false, 'the value reached a shell');
    });
  }
});

describe('test-sweep: other arguments are rejected with exit 2', () => {
  const rejected = [
    [['--workspace', 'nope'], /unknown workspace nope/],
    [['--workspace', 'shared', '--cell', 'nope'], /unknown unit cell nope/],
    [['--suite', 'nope'], /unknown suite nope/],
    [['--suite', 'integration', '--workspace', 'web'], /integration suite runs in the service/],
    [['--bogus'], /unknown flag --bogus/],
    [['--workspace'], /--workspace needs a value/],
    [['--workspace', '--cell'], /--workspace needs a value/],
    [['--only', 'src/a.test.ts'], /--only needs a single Vitest workspace/],
    [['--workspace', 'all', '--only', 'src/a.test.ts'], /--only needs a single Vitest workspace/],
    [['--workspace', 'e2e', '--only', 'support/a.test.ts'], /--only needs a single Vitest/],
  ];
  for (const [args, message] of rejected) {
    it(args.join(' '), () => {
      const run = sweep(...args);
      assert.equal(run.status, 2, `${run.stdout}\n${run.stderr}`);
      assert.match(run.stderr, message);
      assert.doesNotMatch(run.stdout, /result=|sweep:/);
    });
  }

  it('--list prints the matrix and runs nothing', () => {
    const run = sweep('--list');
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /unit cells:/);
    assert.match(run.stdout, /integration cells:/);
    assert.doesNotMatch(run.stdout, /result=/);
  });
});

describe('test-sweep: an --only that selects no test fails the sweep', () => {
  it('a path that matches no unit test file', () => {
    const run = sweep(
      '--workspace',
      'shared',
      '--cell',
      'default',
      '--only',
      'nonexistent/foo.test.ts',
    );
    assert.notEqual(run.status, 0, `passed: ${run.stdout}`);
    assert.match(run.stderr, /--only nonexistent\/foo\.test\.ts matches no test file/);
    assert.match(run.stderr, /@hearth\/shared/);
    assert.doesNotMatch(run.stdout, /result=PASS|sweep: 1\/1 passed/);
  });

  it('a path that matches no integration test file, before any database is needed', () => {
    const run = sweep('--suite', 'integration', '--only', 'nonexistent/foo.integration.test.ts');
    assert.notEqual(run.status, 0, `passed: ${run.stdout}`);
    assert.match(run.stderr, /matches no test file/);
    assert.match(run.stderr, /integration/);
    assert.doesNotMatch(run.stdout, /result=PASS/);
  });

  it('writes no log files when nothing is selected', () => {
    const logs = join(scratch, 'logs');
    const run = sweep(
      '--workspace',
      'shared',
      '--cell',
      'default',
      '--only',
      'nonexistent/foo.test.ts',
      '--log-dir',
      logs,
    );
    assert.notEqual(run.status, 0);
    assert.equal(existsSync(logs), false);
  });
});

describe('test-sweep: a listing that cannot run exits 2 with a message, not a crash', () => {
  /** Runs the sweep for one `--only` with `pathDirectory` as the whole of `PATH`. */
  function sweepWithPath(pathDirectory) {
    const run = spawnSync(
      process.execPath,
      [SWEEP, '--workspace', 'shared', '--cell', 'default', '--only', 'src/a.test.ts'],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, PATH: pathDirectory },
      },
    );
    return { status: run.status, stdout: run.stdout, stderr: run.stderr };
  }

  function assertCleanFailure(run, expectedMessage) {
    assert.equal(run.status, 2, `${run.stdout}\n${run.stderr}`);
    assert.match(
      run.stderr,
      /^test-sweep: could not list the test files for --only src\/a\.test\.ts/m,
    );
    assert.match(run.stderr, expectedMessage);
    assert.doesNotMatch(run.stderr, /undefined|null/);
    assert.doesNotMatch(run.stderr, /^\s+at /m);
    assert.doesNotMatch(run.stdout, /result=|sweep: /);
  }

  it('pnpm cannot be spawned', () => {
    const run = sweepWithPath(join(scratch, 'no-such-bin-directory'));
    assertCleanFailure(run, /ENOENT/);
  });

  it('vitest list fails, and the message carries what it printed', () => {
    const bin = join(scratch, 'failing-pnpm');
    mkdirSync(bin, { recursive: true });
    const stub = join(bin, 'pnpm');
    writeFileSync(stub, '#!/bin/sh\necho "broken vitest config: boom" >&2\nexit 3\n');
    chmodSync(stub, 0o755);
    const run = sweepWithPath(bin);
    assertCleanFailure(run, /broken vitest config: boom/);
  });

  it('vitest list fails without printing anything, and the exit status is named', () => {
    const bin = join(scratch, 'silent-pnpm');
    mkdirSync(bin, { recursive: true });
    const stub = join(bin, 'pnpm');
    writeFileSync(stub, '#!/bin/sh\nexit 4\n');
    chmodSync(stub, 0o755);
    const run = sweepWithPath(bin);
    assertCleanFailure(run, /status 4/);
  });
});

describe('test-sweep: an --only that selects a test still runs it', () => {
  it('one file, one cell, passes', () => {
    const run = sweep(
      '--workspace',
      'shared',
      '--cell',
      'default',
      '--only',
      'src/api/schemas.test.ts',
    );
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /cell=default workspace=shared result=PASS exit=0/);
    assert.match(run.stdout, /sweep: 1\/1 passed/);
  });
});
