/*
 * Date and time-zone sweep: runs a test suite once per cell of a fixed matrix, each cell in its
 * own child process with its own `HEARTH_TEST_NOW` (the pinned instant, read by
 * `test/clock-setup.mjs`) and `TZ` (validated by `test/global-tz.mjs`). `docs/testing.md`
 * describes the contract.
 *
 *   node scripts/test-sweep.mjs [--suite unit|integration] [--workspace web|service|shared|
 *     recurrence|matching|e2e|all] [--cell ID]... [--only TEST_PATH] [--log-dir DIR] [--list]
 *
 * Cells run one after another and the child inherits the zone, so every Vitest worker, under the
 * forks or the threads pool, runs in it. The sweep exits 0 only when every run passed; a child
 * killed by a signal counts as a failure. An `--only` that selects no test file exits 2 before
 * any run, because Vitest would otherwise pass an empty run.
 */

import { spawnSync } from 'node:child_process';
import { appendFileSync, closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');

const WORKSPACES = ['web', 'service', 'shared', 'recurrence', 'matching', 'e2e'];
const VITEST_WORKSPACES = WORKSPACES.filter((workspace) => workspace !== 'e2e');

/** Unit cells: a weekday and a weekend day, UTC-negative and UTC-positive zones, a year boundary. */
const UNIT_CELLS = [
  { id: 'default', now: undefined, tz: undefined },
  { id: 'wed-tokyo', now: '2026-10-14T12:00:00.000Z', tz: 'Asia/Tokyo' },
  { id: 'sat-utc-fri-la', now: '2026-10-17T02:30:00.000Z', tz: 'America/Los_Angeles' },
  { id: 'sun-utc-mon-kiritimati', now: '2026-10-18T22:30:00.000Z', tz: 'Pacific/Kiritimati' },
  { id: 'newyear-pago-pago', now: '2027-01-01T00:30:00.000Z', tz: 'Pacific/Pago_Pago' },
  { id: 'dst-start-new-york', now: '2026-03-08T07:30:00.000Z', tz: 'America/New_York' },
];

/** Integration cells set only the zone: the database clock cannot be pinned. */
const INTEGRATION_CELLS = [
  { id: 'default', now: undefined, tz: undefined },
  { id: 'la', now: undefined, tz: 'America/Los_Angeles' },
  { id: 'kiritimati', now: undefined, tz: 'Pacific/Kiritimati' },
  { id: 'pago-pago', now: undefined, tz: 'Pacific/Pago_Pago' },
  { id: 'tokyo', now: undefined, tz: 'Asia/Tokyo' },
];

const ONLY_PATTERN = /^[A-Za-z0-9._/-]+$/;

const USAGE = `usage: node scripts/test-sweep.mjs [options]
  --suite unit|integration   default unit
  --workspace NAME           ${WORKSPACES.join('|')}|all (default all; integration uses service)
  --cell ID                  repeatable; default every cell of the suite
  --only TEST_PATH           one test path, with a single Vitest workspace
  --log-dir DIR              write one log per run and summary.txt there
  --list                     print the matrix and exit`;

function usageError(message) {
  console.error(`test-sweep: ${message}`);
  console.error(USAGE);
  process.exit(2);
}

function parseArguments(argv) {
  const options = {
    suite: 'unit',
    workspace: 'all',
    cells: [],
    only: undefined,
    logDir: undefined,
  };
  let list = false;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--list') {
      list = true;
      continue;
    }
    if (!['--suite', '--workspace', '--cell', '--only', '--log-dir'].includes(flag ?? '')) {
      usageError(`unknown flag ${String(flag)}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) usageError(`${String(flag)} needs a value`);
    index += 1;
    if (flag === '--suite') options.suite = value;
    else if (flag === '--workspace') options.workspace = value;
    else if (flag === '--cell') options.cells.push(value);
    else if (flag === '--only') options.only = value;
    else options.logDir = resolve(process.cwd(), value);
  }
  return { options, list };
}

function printMatrix() {
  const describe = (cell) =>
    `  ${cell.id}: HEARTH_TEST_NOW=${cell.now ?? '(unset)'} TZ=${cell.tz ?? '(unset)'}`;
  console.log('unit cells:');
  for (const cell of UNIT_CELLS) console.log(describe(cell));
  console.log('integration cells:');
  for (const cell of INTEGRATION_CELLS) console.log(describe(cell));
}

function canonicalZone(zone) {
  return new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone;
}

/** The zone a child process resolves under the cell's environment, read in a separate process. */
function childZone(env) {
  const probe = spawnSync(
    process.execPath,
    ['-e', 'process.stdout.write(Intl.DateTimeFormat().resolvedOptions().timeZone)'],
    { env, encoding: 'utf8' },
  );
  return probe.status === 0 ? probe.stdout : `(probe failed: exit ${String(probe.status)})`;
}

function cellEnvironment(cell) {
  const env = { ...process.env };
  delete env['HEARTH_TEST_NOW'];
  delete env['TZ'];
  if (cell.now !== undefined) env['HEARTH_TEST_NOW'] = cell.now;
  if (cell.tz !== undefined) env['TZ'] = cell.tz;
  return env;
}

function commandFor(suite, workspace, only) {
  const script = suite === 'integration' ? 'test:integration' : 'test';
  const filter = only === undefined ? '' : ` ${only}`;
  return `pnpm --filter @hearth/${workspace} ${script}${filter}`;
}

/**
 * The test files `only` selects in `workspace`, asked of Vitest itself, so it uses the same
 * config and filter rules as the run. Every workspace's `test` script passes `--passWithNoTests`,
 * so a filter that selects nothing would otherwise exit 0 and be counted as a pass.
 */
function selectedTestFiles(suite, workspace, only) {
  const config = suite === 'integration' ? ['--config', 'vitest.integration.config.ts'] : [];
  const env = cellEnvironment({ now: undefined, tz: undefined });
  const list = spawnSync(
    'pnpm',
    ['--filter', `@hearth/${workspace}`, 'exec', 'vitest', 'list', '--filesOnly', ...config, only],
    { cwd: REPO_ROOT, env, encoding: 'utf8' },
  );
  if (list.status !== 0) {
    throw new Error(`could not list the test files for --only ${only}:\n${list.stderr}`);
  }
  return list.stdout.split('\n').filter((line) => line.trim() !== '');
}

function main() {
  const { options, list } = parseArguments(process.argv.slice(2));
  if (list) {
    printMatrix();
    return 0;
  }

  if (!['unit', 'integration'].includes(options.suite)) {
    usageError(`unknown suite ${options.suite}`);
  }
  const cells = options.suite === 'integration' ? INTEGRATION_CELLS : UNIT_CELLS;

  if (options.workspace !== 'all' && !WORKSPACES.includes(options.workspace)) {
    usageError(`unknown workspace ${options.workspace}`);
  }
  let workspaces;
  if (options.suite === 'integration') {
    if (options.workspace !== 'all' && options.workspace !== 'service') {
      usageError('the integration suite runs in the service workspace only');
    }
    workspaces = ['service'];
  } else {
    workspaces = options.workspace === 'all' ? WORKSPACES : [options.workspace];
  }

  const selected = options.cells.length === 0 ? cells : [];
  for (const id of options.cells) {
    const cell = cells.find((candidate) => candidate.id === id);
    if (cell === undefined) usageError(`unknown ${options.suite} cell ${id}`);
    if (!selected.includes(cell)) selected.push(cell);
  }

  if (options.only !== undefined) {
    if (!ONLY_PATTERN.test(options.only) || options.only.startsWith('-')) {
      usageError('--only must be a test path made of letters, digits, . _ / -');
    }
    const [single] = workspaces;
    if (workspaces.length !== 1 || single === undefined || !VITEST_WORKSPACES.includes(single)) {
      usageError('--only needs a single Vitest workspace');
    }
  }

  if (options.only !== undefined) {
    const [single] = workspaces;
    if (
      single !== undefined &&
      selectedTestFiles(options.suite, single, options.only).length === 0
    ) {
      console.error(
        `test-sweep: --only ${options.only} matches no test file in @hearth/${single} ` +
          `(${options.suite} suite); a sweep that runs nothing is not a pass`,
      );
      return 2;
    }
  }

  const summaryPath =
    options.logDir === undefined ? undefined : join(options.logDir, 'summary.txt');
  if (options.logDir !== undefined && summaryPath !== undefined) {
    mkdirSync(options.logDir, { recursive: true });
    writeFileSync(summaryPath, '');
  }

  let passed = 0;
  let total = 0;
  for (const cell of selected) {
    const env = cellEnvironment(cell);
    if (cell.tz !== undefined) {
      const expected = canonicalZone(cell.tz);
      const actual = childZone(env);
      if (actual !== expected) {
        console.error(
          `test-sweep: cell ${cell.id} asked for ${expected} but a child resolved ${actual}`,
        );
        return 2;
      }
    }

    for (const workspace of workspaces) {
      total += 1;
      const command = commandFor(options.suite, workspace, options.only);
      let descriptor;
      if (options.logDir !== undefined) {
        descriptor = openSync(join(options.logDir, `${cell.id}-${workspace}.log`), 'w');
      }
      const run = spawnSync(command, {
        shell: true,
        cwd: REPO_ROOT,
        env,
        stdio: descriptor === undefined ? 'inherit' : ['ignore', descriptor, descriptor],
      });
      if (descriptor !== undefined) closeSync(descriptor);

      const ok = run.status === 0 && run.signal === null && run.error === undefined;
      if (ok) passed += 1;
      const exit = run.status ?? (run.signal === null ? 'error' : run.signal);
      const line = `cell=${cell.id} workspace=${workspace} result=${ok ? 'PASS' : 'FAIL'} exit=${String(exit)}`;
      console.log(line);
      if (summaryPath !== undefined) appendFileSync(summaryPath, `${line}\n`);
    }
  }

  const last = `sweep: ${String(passed)}/${String(total)} passed`;
  console.log(last);
  if (summaryPath !== undefined) appendFileSync(summaryPath, `${last}\n`);
  return passed === total ? 0 : 1;
}

process.exit(main());
