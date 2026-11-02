/*
 * Production dependency audit gate: runs `pnpm audit --prod --json` and checks
 * any found advisories against `scripts/audit-allowlist.json`.
 *
 * Usage: node scripts/audit-prod.mjs [--report FILE] [--allowlist FILE] [--today YYYY-MM-DD]
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const DEFAULT_ALLOWLIST = join(REPO_ROOT, 'scripts', 'audit-allowlist.json');

function parseArguments(argv) {
  const options = {
    report: undefined,
    allowlist: DEFAULT_ALLOWLIST,
    today: new Date().toISOString().slice(0, 10),
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--report' && argv[i + 1]) options.report = resolve(argv[++i]);
    else if (argv[i] === '--allowlist' && argv[i + 1]) options.allowlist = resolve(argv[++i]);
    else if (argv[i] === '--today' && argv[i + 1]) options.today = argv[++i];
  }
  return options;
}

function runAudit() {
  const run = spawnSync('pnpm', ['audit', '--prod', '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  if (run.error) throw new Error(`cannot run pnpm: ${String(run.error)}`);
  return run.stdout;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  let allowlist;
  try {
    const raw = JSON.parse(readFileSync(options.allowlist, 'utf8'));
    allowlist = Array.isArray(raw?.allow) ? raw.allow : [];
  } catch (error) {
    console.error(`audit-prod: cannot read allowlist: ${String(error)}`);
    return 2;
  }

  let reportText;
  try {
    reportText = options.report ? readFileSync(options.report, 'utf8') : runAudit();
  } catch (error) {
    console.error(`audit-prod: failed to get audit report: ${String(error)}`);
    return 2;
  }

  let report;
  try {
    report = JSON.parse(reportText);
  } catch {
    console.error('audit-prod: audit output is not valid JSON');
    return 2;
  }

  if (report.error) {
    console.error(`audit-prod: audit returned error: ${JSON.stringify(report.error)}`);
    return 2;
  }

  const advisories = Object.entries(report.advisories ?? {});
  const allowMap = new Map(allowlist.map((entry) => [entry.id, entry]));
  const problems = [];
  const notes = [];
  const matched = new Set();

  for (const [key, advisory] of advisories) {
    const ghsa = advisory.github_advisory_id ?? `npm-advisory-${key}`;
    const allowed = allowMap.get(ghsa);
    if (!allowed) {
      const path = advisory.findings?.[0]?.paths?.[0] ?? 'unknown';
      problems.push(
        `${ghsa} ${String(advisory.module_name)} (${String(advisory.severity)}) via ${path} is not allowlisted`,
      );
      continue;
    }
    matched.add(ghsa);
    if (allowed.expires < options.today) {
      problems.push(`${ghsa} allowance expired on ${allowed.expires}`);
    } else {
      notes.push(
        `${ghsa} ${String(advisory.module_name)} allowed until ${allowed.expires}: ${allowed.reason}`,
      );
    }
  }

  for (const entry of allowlist) {
    if (!matched.has(entry.id)) {
      if (entry.expires < options.today) {
        problems.push(`${entry.id} allowance expired on ${entry.expires}; unused`);
      } else {
        notes.push(`${entry.id} matches no active advisory`);
      }
    }
  }

  for (const note of notes) console.log(note);
  for (const problem of problems) console.error(problem);

  const allowedCount = advisories.filter(([k, adv]) => {
    const id = adv.github_advisory_id ?? `npm-advisory-${k}`;
    const e = allowMap.get(id);
    return e && e.expires >= options.today;
  }).length;

  console.log(
    `audit-prod: ${String(advisories.length)} advisories, ${String(allowedCount)} allowed, ${String(problems.length)} problems`,
  );
  return problems.length > 0 ? 1 : 0;
}

process.exit(main());
