/*
 * Production dependency audit gate: runs `pnpm audit --prod --json` and decides only from the
 * parsed report. An advisory passes only when `scripts/audit-allowlist.json` allows its GHSA id and
 * the allowance has not expired, so no allowance can hide an advisory forever.
 *
 *   node scripts/audit-prod.mjs [--report FILE] [--allowlist FILE] [--today YYYY-MM-DD]
 *
 * `--report` reads a saved `pnpm audit --prod --json` output instead of running pnpm (the tests use
 * it). `--today` is the UTC date the allowances are judged against (default: today).
 *
 * pnpm's exit status is ignored: it is 1 when advisories exist and 0 when the registry is
 * unreachable, where stdout is `{"error": {...}}` with no `advisories` object. A report with an
 * `error` key, without an `advisories` object, or that is not JSON is "unavailable"; it is tried
 * three times (waits of 10 s and 30 s, multiplied by `AUDIT_RETRY_DELAY_SCALE`, default 1) and then
 * fails closed instead of reading as "no advisories".
 *
 * Allowlist: `{ "allow": [{ "id": "GHSA-xxxx-xxxx-xxxx", "expires": "YYYY-MM-DD", "reason": "..." }] }`.
 * An allowance is valid through its `expires` day and may be at most 180 days ahead. An expired
 * entry fails whether or not it still matches an advisory; an unexpired entry that matches nothing
 * only prints a note.
 *
 * Exit codes: 0 no problems; 1 an advisory that is not allowed, or an expired allowance; 2 the check
 * could not decide (bad usage, unreadable or invalid allowlist, audit unavailable).
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const DEFAULT_ALLOWLIST = join(REPO_ROOT, 'scripts', 'audit-allowlist.json');
const MAX_REPORT_BYTES = 256 * 1024 * 1024;
const MAX_ALLOWANCE_DAYS = 180;
const ATTEMPTS = 3;
const RETRY_DELAYS_SECONDS = [10, 30];
const GHSA_PATTERN = /^GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
// Held in a constant so knip does not resolve the arguments to a binary name.
const AUDIT_ARGS = ['audit', '--prod', '--json'];

const USAGE = `usage: node scripts/audit-prod.mjs [options]
  --report FILE      use a saved \`pnpm audit --prod --json\` output instead of running pnpm
  --allowlist FILE   default scripts/audit-allowlist.json
  --today YYYY-MM-DD the UTC date allowances are judged against (default: today)`;

class CannotDecide extends Error {}

function usageError(message) {
  console.error(`audit-prod: ${message}`);
  console.error(USAGE);
  process.exit(2);
}

/** Milliseconds at UTC midnight of a real `YYYY-MM-DD` date, or `undefined` for anything else. */
function dayNumber(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const time = Date.parse(`${text}T00:00:00Z`);
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== text) return undefined;
  return time;
}

function parseArguments(argv) {
  const options = { report: undefined, allowlist: DEFAULT_ALLOWLIST, today: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag !== '--report' && flag !== '--allowlist' && flag !== '--today') {
      usageError(`unknown flag ${String(flag)}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) usageError(`${flag} needs a value`);
    index += 1;
    if (flag === '--report') options.report = resolve(value);
    else if (flag === '--allowlist') options.allowlist = resolve(value);
    else options.today = value;
  }
  options.today ??= new Date().toISOString().slice(0, 10);
  if (dayNumber(options.today) === undefined) {
    usageError(`--today ${options.today} is not a real YYYY-MM-DD date`);
  }
  return options;
}

function readAllowlist(file, today) {
  const problem = (message) => new CannotDecide(`allowlist ${file}: ${message}`);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw problem(`cannot read it as JSON: ${String(error)}`);
  }
  if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.allow)) {
    throw problem('it must be a JSON object with an "allow" array');
  }
  const seen = new Set();
  const latest = dayNumber(today) + MAX_ALLOWANCE_DAYS * DAY_MS;
  for (const [position, entry] of parsed.allow.entries()) {
    const where = `entry ${String(position)}`;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw problem(`${where} is not an object`);
    }
    if (typeof entry.id !== 'string' || !GHSA_PATTERN.test(entry.id)) {
      throw problem(`${where} needs an "id" like GHSA-xxxx-xxxx-xxxx`);
    }
    if (seen.has(entry.id)) throw problem(`${entry.id} appears more than once`);
    seen.add(entry.id);
    const expires = dayNumber(entry.expires);
    if (expires === undefined) {
      throw problem(`${entry.id} needs "expires" as a real YYYY-MM-DD date`);
    }
    if (expires > latest) {
      throw problem(
        `${entry.id} expires ${entry.expires}, more than ${String(MAX_ALLOWANCE_DAYS)} days after ${today}`,
      );
    }
    if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
      throw problem(`${entry.id} needs a non-empty "reason"`);
    }
  }
  return parsed.allow;
}

/** Returns the parsed report, or `{ unavailable }` saying why the text is not a usable report. */
function checkReport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { unavailable: 'the output is not JSON' };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { unavailable: 'the output is not a JSON object' };
  }
  if (parsed.error !== undefined) {
    const { code, message } = parsed.error ?? {};
    const detail = [code, message].filter((part) => typeof part === 'string').join(' ');
    return { unavailable: `the report has an error: ${detail || JSON.stringify(parsed.error)}` };
  }
  if (
    parsed.advisories === null ||
    typeof parsed.advisories !== 'object' ||
    Array.isArray(parsed.advisories)
  ) {
    return { unavailable: 'the report has no advisories object' };
  }
  return { report: parsed };
}

function runAudit() {
  const run = spawnSync('pnpm', AUDIT_ARGS, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: MAX_REPORT_BYTES,
  });
  if (run.error !== undefined) return { unavailable: `cannot run pnpm: ${String(run.error)}` };
  return checkReport(run.stdout);
}

function delayScale() {
  const raw = process.env['AUDIT_RETRY_DELAY_SCALE'];
  if (raw === undefined || raw === '') return 1;
  const scale = Number(raw);
  if (!Number.isFinite(scale) || scale < 0) {
    throw new CannotDecide(`AUDIT_RETRY_DELAY_SCALE=${raw} is not a number of at least 0`);
  }
  return scale;
}

async function loadReport(options) {
  if (options.report !== undefined) {
    let text;
    try {
      text = readFileSync(options.report, 'utf8');
    } catch (error) {
      throw new CannotDecide(`cannot read the report ${options.report}: ${String(error)}`, {
        cause: error,
      });
    }
    const checked = checkReport(text);
    if (checked.report === undefined) {
      throw new CannotDecide(`pnpm audit is unavailable: ${checked.unavailable}`);
    }
    return checked.report;
  }
  const scale = delayScale();
  let last = 'it was never run';
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const checked = runAudit();
    if (checked.report !== undefined) return checked.report;
    last = checked.unavailable;
    console.error(`audit-prod: attempt ${String(attempt)} of ${String(ATTEMPTS)}: ${last}`);
    const wait = RETRY_DELAYS_SECONDS[attempt - 1];
    if (wait !== undefined) {
      await new Promise((done) => setTimeout(done, wait * scale * 1000));
    }
  }
  throw new CannotDecide(`pnpm audit is unavailable: ${last}`);
}

function evaluate(report, allow, today) {
  const problems = [];
  const notes = [];
  const byId = new Map(allow.map((entry) => [entry.id, entry]));
  const matched = new Set();
  const advisories = Object.entries(report.advisories);
  for (const [key, advisory] of advisories) {
    const ghsa = advisory.github_advisory_id ?? `npm-advisory-${key}`;
    const entry = byId.get(ghsa);
    if (entry === undefined) {
      const path = advisory.findings?.[0]?.paths?.[0] ?? 'an unknown path';
      problems.push(
        `${ghsa} ${String(advisory.module_name)} (${String(advisory.severity)}) via ${path} is not allowlisted`,
      );
      continue;
    }
    matched.add(ghsa);
    if (entry.expires < today) problems.push(`${ghsa} allowance expired on ${entry.expires}`);
    else
      notes.push(
        `${ghsa} ${String(advisory.module_name)} allowed until ${entry.expires}: ${entry.reason}`,
      );
  }
  let allowed = 0;
  for (const entry of allow) {
    if (matched.has(entry.id)) {
      if (entry.expires >= today) allowed += 1;
      continue;
    }
    if (entry.expires < today) {
      problems.push(
        `${entry.id} allowance expired on ${entry.expires}; it matches no advisory, delete it`,
      );
    } else {
      notes.push(`${entry.id} matches no advisory; delete it when it is no longer needed`);
    }
  }
  return { problems, notes, advisories: advisories.length, allowed };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  try {
    const allow = readAllowlist(options.allowlist, options.today);
    const report = await loadReport(options);
    const result = evaluate(report, allow, options.today);
    for (const note of result.notes) console.log(note);
    for (const problem of result.problems) console.error(problem);
    console.log(
      `audit-prod: ${String(result.advisories)} advisories, ${String(result.allowed)} allowed, ${String(result.problems.length)} problems`,
    );
    return result.problems.length > 0 ? 1 : 0;
  } catch (error) {
    if (!(error instanceof CannotDecide)) throw error;
    console.error(`audit-prod: ${error.message}`);
    return 2;
  }
}

process.exit(await main());
