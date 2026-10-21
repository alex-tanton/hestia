/*
 * Summarizes a jscpd JSON report and lists its clone pairs against tracked paths, so Phase 5 can
 * compare scans taken before and after the test-fixture consolidation (RED-03).
 *
 * Usage:
 *   node jscpd-compare.mjs {report.json} [--max-clones N] [--list cross-test|cross|all] [--root DIR]
 *
 * jscpd names files relative to the scanned arguments (`service/src/x.ts`, or a bare `x.ts`), so
 * each name is resolved to the one tracked path equal to it or ending in `/{name}`. `--root` picks
 * the checkout whose tracked files are used (default: the current directory). An ambiguous or
 * missing name exits 2. With `--max-clones N` the exit status is 1 when the report has more clones.
 *
 * Output keys: clones, duplicatedLines, percentage, cross (pairs in two files), same (pairs inside
 * one file), crossTest (cross pairs with a test, spec, test-helper or e2e side).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const reportPath = args.find((arg) => !arg.startsWith('--') && !isOptionValue(arg));

function isOptionValue(arg) {
  const index = args.indexOf(arg);
  return index > 0 && ['--max-clones', '--list', '--root'].includes(args[index - 1]);
}

function option(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

const maxClonesArg = option('--max-clones');
const listMode = option('--list');
const root = option('--root') ?? process.cwd();

if (reportPath === undefined || (listMode !== undefined && !['cross-test', 'cross', 'all'].includes(listMode))) {
  console.error(
    'usage: node jscpd-compare.mjs {report.json} [--max-clones N] [--list cross-test|cross|all] [--root DIR]',
  );
  process.exit(2);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const tracked = execFileSync('git', ['-C', root, 'ls-files'], { encoding: 'utf8', maxBuffer: 1 << 26 })
  .split('\n')
  .filter((line) => line !== '');

const resolved = new Map();

function resolveName(name) {
  const known = resolved.get(name);
  if (known !== undefined) return known;
  const matches = tracked.filter((path) => path === name || path.endsWith(`/${name}`));
  if (matches.length !== 1) {
    console.error(`cannot resolve jscpd name ${name}: ${String(matches.length)} tracked matches`);
    process.exit(2);
  }
  resolved.set(name, matches[0]);
  return matches[0];
}

function isTestSide(path) {
  return (
    path.includes('.test.') ||
    path.includes('.spec.') ||
    path.includes('/src/test/') ||
    path.startsWith('e2e/')
  );
}

const pairs = report.duplicates.map((duplicate) => {
  const a = resolveName(duplicate.firstFile.name);
  const b = resolveName(duplicate.secondFile.name);
  return {
    lines: duplicate.lines,
    a,
    b,
    first: duplicate.firstFile,
    second: duplicate.secondFile,
    cross: a !== b,
    crossTest: a !== b && (isTestSide(a) || isTestSide(b)),
  };
});

const total = report.statistics.total;
const cross = pairs.filter((pair) => pair.cross).length;
const crossTest = pairs.filter((pair) => pair.crossTest).length;

console.log(`clones=${String(total.clones)}`);
console.log(`duplicatedLines=${String(total.duplicatedLines)}`);
console.log(`percentage=${total.percentage.toFixed(2)}`);
console.log(`cross=${String(cross)}`);
console.log(`same=${String(pairs.length - cross)}`);
console.log(`crossTest=${String(crossTest)}`);

if (listMode !== undefined) {
  const shown = pairs.filter((pair) => {
    if (listMode === 'all') return true;
    if (listMode === 'cross') return pair.cross;
    return pair.crossTest;
  });
  for (const pair of shown) {
    console.log(
      `${String(pair.lines)} ${pair.a}:${String(pair.first.start)}-${String(pair.first.end)} | ${pair.b}:${String(pair.second.start)}-${String(pair.second.end)}`,
    );
  }
}

if (maxClonesArg !== undefined && total.clones > Number(maxClonesArg)) {
  console.error(`clones ${String(total.clones)} exceed --max-clones ${maxClonesArg}`);
  process.exit(1);
}
