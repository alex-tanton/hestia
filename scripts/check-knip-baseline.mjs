/*
 * Production-mode knip gate: compares the findings of `knip --production` with the owner-reviewed
 * baseline in `scripts/knip-production-baseline.txt`. A new finding fails, and so does a baseline
 * row that knip no longer reports, so the list can neither grow nor go stale without a visible
 * edit to the baseline file.
 *
 *   node scripts/check-knip-baseline.mjs [--report FILE] [--baseline FILE]
 *
 * Without `--report` the script runs `pnpm --silent knip:production --reporter json` (`--silent`
 * keeps pnpm's banner out of the JSON). `--report` reads a saved `knip --reporter json` report
 * instead; the tests use it. The report is normalized by `scripts/knip-summary.mjs`, run as a child
 * process and never imported: an import would make that file reachable, and knip would drop it from
 * the production findings the owner chose to keep reported.
 *
 * Exit codes: 0 the findings equal the baseline; 1 a new or stale row; 2 the check could not
 * decide (bad usage, unreadable input, knip did not run, a baseline whose total row is wrong).
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const KNIP_SUMMARY = join(REPO_ROOT, 'scripts', 'knip-summary.mjs');
const DEFAULT_BASELINE = join(REPO_ROOT, 'scripts', 'knip-production-baseline.txt');
const MAX_REPORT_BYTES = 256 * 1024 * 1024;
// `--silent` keeps pnpm's banner out of the JSON. Held in a constant so knip does not resolve the
// script to its `knip` binary and report that devDependency as unlisted in production mode.
const KNIP_PRODUCTION_ARGS = ['--silent', 'knip:production', '--reporter', 'json'];

const USAGE = `usage: node scripts/check-knip-baseline.mjs [options]
  --report FILE     use a saved \`knip --reporter json\` report instead of running knip
  --baseline FILE   default scripts/knip-production-baseline.txt`;

function usageError(message) {
  console.error(`check-knip-baseline: ${message}`);
  console.error(USAGE);
  process.exit(2);
}

function cannotDecide(message) {
  console.error(`check-knip-baseline: ${message}`);
  return 2;
}

function parseArguments(argv) {
  const options = { report: undefined, baseline: DEFAULT_BASELINE };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag !== '--report' && flag !== '--baseline') {
      usageError(`unknown flag ${String(flag)}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) usageError(`${flag} needs a value`);
    index += 1;
    if (flag === '--report') options.report = resolve(value);
    else options.baseline = resolve(value);
  }
  return options;
}

/** Rows of a summary or baseline file: LF split, CRLF and backslashes normalized, blanks dropped. */
function readRows(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/\r$/, '').replaceAll('\\', '/'))
    .filter((line) => line !== '');
}

function isTotalRow(row) {
  return row.startsWith('total\t');
}

function readReport(options) {
  if (options.report !== undefined) {
    try {
      return readFileSync(options.report, 'utf8');
    } catch (error) {
      throw new Error(`cannot read the report ${options.report}: ${String(error)}`, {
        cause: error,
      });
    }
  }
  const run = spawnSync('pnpm', KNIP_PRODUCTION_ARGS, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: MAX_REPORT_BYTES,
  });
  if (run.error !== undefined) {
    throw new Error(`cannot run knip: ${String(run.error)}`, { cause: run.error });
  }
  // knip exits 1 when it has findings; anything else means it did not produce a report.
  if (run.status !== 0 && run.status !== 1) {
    throw new Error(
      `knip exited with status ${String(run.status ?? run.signal)}: ${run.stderr.trim()}`,
    );
  }
  return run.stdout;
}

/** Runs the normalizer on the report text and returns its rows without the total row. */
function currentRows(reportText) {
  let parsed;
  try {
    parsed = JSON.parse(reportText);
  } catch (error) {
    throw new Error(`the knip report is not JSON: ${String(error)}`, { cause: error });
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('the knip report is not a JSON object');
  }
  const dir = mkdtempSync(join(tmpdir(), 'hestia-knip-baseline-'));
  try {
    const reportPath = join(dir, 'report.json');
    const summaryPath = join(dir, 'summary.txt');
    writeFileSync(reportPath, reportText);
    const run = spawnSync(process.execPath, [KNIP_SUMMARY, reportPath, summaryPath], {
      encoding: 'utf8',
    });
    if (run.error !== undefined || run.status !== 0) {
      throw new Error(`knip-summary.mjs failed: ${run.stderr.trim() || String(run.error)}`);
    }
    return readRows(readFileSync(summaryPath, 'utf8')).filter((row) => !isTotalRow(row));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  const options = parseArguments(process.argv.slice(2));

  let baselineText;
  try {
    baselineText = readFileSync(options.baseline, 'utf8');
  } catch (error) {
    return cannotDecide(`cannot read the baseline ${options.baseline}: ${String(error)}`);
  }
  const baselineAll = readRows(baselineText);
  const baselineRows = baselineAll.filter((row) => !isTotalRow(row));
  const totalRows = baselineAll.filter(isTotalRow);
  if (totalRows.length !== 1) {
    return cannotDecide(
      `the baseline needs exactly one total row, found ${String(totalRows.length)}`,
    );
  }
  const declared = Number(totalRows[0].split('\t')[1]);
  if (declared !== baselineRows.length) {
    return cannotDecide(
      `the baseline total row says ${String(declared)} but the file has ${String(baselineRows.length)} rows`,
    );
  }

  let rows;
  try {
    rows = currentRows(readReport(options));
  } catch (error) {
    return cannotDecide(error instanceof Error ? error.message : String(error));
  }

  const baseline = new Set(baselineRows);
  const current = new Set(rows);
  const added = [...current].filter((row) => !baseline.has(row)).sort();
  const stale = [...baseline].filter((row) => !current.has(row)).sort();
  for (const row of added) console.error(`new finding (not in the baseline): ${row}`);
  for (const row of stale) {
    console.error(`stale baseline row (remove it from ${options.baseline}): ${row}`);
  }
  if (added.length > 0 || stale.length > 0) {
    console.log(`knip-baseline: ${String(added.length)} new, ${String(stale.length)} stale`);
    return 1;
  }
  console.log(`knip-baseline: ${String(current.size)} rows match`);
  return 0;
}

process.exit(main());
