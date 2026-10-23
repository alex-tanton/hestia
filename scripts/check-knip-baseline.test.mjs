/*
 * Tests for `scripts/check-knip-baseline.mjs`: the production-mode knip gate. Each case writes a
 * fixture `knip --reporter json` report and a baseline to a scratch directory and runs the script
 * as a child process with `--report` and `--baseline`, so knip itself never runs. The last case
 * pins the committed baseline to the owner-reviewed 28 rows. Run by `pnpm test` through the root
 * `test:harness` script.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const CHECKER = join(REPO_ROOT, 'scripts', 'check-knip-baseline.mjs');
const COMMITTED_BASELINE = join(REPO_ROOT, 'scripts', 'knip-production-baseline.txt');

const scratch = mkdtempSync(join(tmpdir(), 'hearth-knip-baseline-'));
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

let fixtures = 0;

/** A report in the shape knip 6 prints: one issue object per file, one array per finding kind. */
function report(issues) {
  return JSON.stringify({ files: [], issues });
}

const ONE_EXPORT = { file: 'src/a.ts', exports: [{ name: 'alpha' }] };
const ONE_FILE = { file: 'src/b.ts', files: [{ name: 'src/b.ts' }] };
const BASELINE_ROWS = ['exports\tsrc/a.ts\talpha', 'files\tsrc/b.ts\t-'];

function baselineText(rows, eol = '\n', total = rows.length) {
  return [...rows, `total\t${String(total)}\t-`].join(eol) + eol;
}

/** Writes both fixtures, runs the checker on them and returns status, stdout and stderr. */
function check({ reportText, baseline, extraArguments = [] }) {
  fixtures += 1;
  const reportPath = join(scratch, `report-${String(fixtures)}.json`);
  const baselinePath = join(scratch, `baseline-${String(fixtures)}.txt`);
  if (reportText !== undefined) writeFileSync(reportPath, reportText);
  if (baseline !== undefined) writeFileSync(baselinePath, baseline);
  const run = spawnSync(
    process.execPath,
    [CHECKER, '--report', reportPath, '--baseline', baselinePath, ...extraArguments],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: Object.fromEntries(
        Object.entries(process.env).filter(([key]) => key !== 'TZ' && key !== 'HEARTH_TEST_NOW'),
      ),
    },
  );
  return { status: run.status, stdout: run.stdout, stderr: run.stderr, baselinePath };
}

describe('check-knip-baseline: comparing findings with the baseline', () => {
  it('passes when the findings equal the baseline', () => {
    const run = check({
      reportText: report([ONE_EXPORT, ONE_FILE]),
      baseline: baselineText(BASELINE_ROWS),
    });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^knip-baseline: 2 rows match$/m);
  });

  it('fails on a finding that is not in the baseline and names it', () => {
    const extra = { file: 'src/c.ts', exports: [{ name: 'gamma' }] };
    const run = check({
      reportText: report([ONE_EXPORT, ONE_FILE, extra]),
      baseline: baselineText(BASELINE_ROWS),
    });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /new finding \(not in the baseline\): exports\tsrc\/c\.ts\tgamma/);
    assert.match(run.stdout, /^knip-baseline: 1 new, 0 stale$/m);
  });

  it('fails on a baseline row that the report no longer has and names it', () => {
    const run = check({ reportText: report([ONE_EXPORT]), baseline: baselineText(BASELINE_ROWS) });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /stale baseline row \(remove it from .+\): files\tsrc\/b\.ts\t-/);
    assert.match(run.stdout, /^knip-baseline: 0 new, 1 stale$/m);
  });

  it('compares backslash paths and a CRLF baseline as equal', () => {
    const windowsIssue = { file: 'src\\a.ts', exports: [{ name: 'alpha' }] };
    const windowsFile = { file: 'src\\b.ts', files: [{ name: 'src\\b.ts' }] };
    const run = check({
      reportText: report([windowsIssue, windowsFile]),
      baseline: baselineText(BASELINE_ROWS, '\r\n'),
    });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^knip-baseline: 2 rows match$/m);
  });

  it('normalizes a duplicates group the way knip-summary.mjs does', () => {
    const duplicate = { file: 'src/d.ts', duplicates: [[{ name: 'one' }, { name: 'two' }]] };
    const run = check({
      reportText: report([duplicate]),
      baseline: baselineText(['duplicates\tsrc/d.ts\tone|two']),
    });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^knip-baseline: 1 rows match$/m);
  });

  it('passes an empty report against an empty baseline', () => {
    const run = check({ reportText: report([]), baseline: baselineText([]) });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^knip-baseline: 0 rows match$/m);
  });
});

describe('check-knip-baseline: cases it cannot decide exit 2', () => {
  it('rejects a report that is not JSON', () => {
    const run = check({
      reportText: '> hearth@ knip\nnot json',
      baseline: baselineText(BASELINE_ROWS),
    });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /not JSON/);
  });

  it('rejects a report that is JSON but not an object', () => {
    const run = check({ reportText: '[]', baseline: baselineText(BASELINE_ROWS) });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /not a JSON object/);
  });

  it('rejects a missing report file', () => {
    const run = check({ baseline: baselineText(BASELINE_ROWS) });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /cannot read the report/);
  });

  it('rejects a missing baseline file', () => {
    const run = check({ reportText: report([ONE_EXPORT, ONE_FILE]) });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /cannot read the baseline/);
  });

  it('rejects a baseline whose total row disagrees with its row count and names both numbers', () => {
    const run = check({
      reportText: report([ONE_EXPORT, ONE_FILE]),
      baseline: baselineText(BASELINE_ROWS, '\n', 5),
    });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /total row says 5 but the file has 2 rows/);
  });

  it('rejects a baseline without a total row', () => {
    const run = check({ reportText: report([ONE_EXPORT]), baseline: 'exports\tsrc/a.ts\talpha\n' });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /exactly one total row/);
  });
});

describe('check-knip-baseline: arguments', () => {
  it('rejects an unknown flag with the usage text', () => {
    const run = check({
      reportText: report([]),
      baseline: baselineText([]),
      extraArguments: ['--fix'],
    });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /unknown flag --fix/);
    assert.match(run.stderr, /usage: node scripts\/check-knip-baseline\.mjs/);
  });

  it('rejects a flag without a value with the usage text', () => {
    for (const flag of ['--report', '--baseline']) {
      const run = spawnSync(process.execPath, [CHECKER, flag], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });
      assert.equal(run.status, 2, flag);
      assert.match(run.stderr, new RegExp(`${flag} needs a value`));
      assert.match(run.stderr, /usage: node scripts\/check-knip-baseline\.mjs/);
    }
  });
});

describe('check-knip-baseline: the committed baseline', () => {
  it('holds the owner-reviewed 28 rows and a matching total row', () => {
    const lines = readFileSync(COMMITTED_BASELINE, 'utf8').split('\n');
    assert.equal(lines.at(-1), '', 'the file ends with a newline');
    const rows = lines.slice(0, -1);
    assert.equal(rows.length, 29);
    assert.equal(rows.at(-1), 'total\t28\t-');
    assert.ok(rows.slice(0, -1).every((row) => !row.startsWith('total\t')));
    assert.ok(rows.includes('files\tscripts/knip-summary.mjs\t-'), 'knip-summary stays reported');
  });
});
