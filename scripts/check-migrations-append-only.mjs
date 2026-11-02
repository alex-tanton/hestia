/*
 * Migration append-only gate: an applied migration must never change, because a database that
 * already ran it will not run it again. Compares `supabase/migrations/` at HEAD with the merge base
 * of `--base` and HEAD, and passes only when files were added there and nothing else happened: an
 * edit, a delete, a rename (git reports it as a delete plus an add), a mode change and a type
 * change all fail. Whether new files sort after the existing ones is not checked.
 *
 *   node scripts/check-migrations-append-only.mjs --base REF [--repo DIR] [--exemptions FILE]
 *
 * `--base` is a commit SHA or a ref name. In CI it comes from workflow event data, which a pull
 * request author controls, so it is validated against a strict pattern before git sees it and git
 * runs from an argument array, never a shell. The checkout needs enough history to contain the
 * merge base (`fetch-depth: 0`).
 *
 * Exemptions: `scripts/migration-exemptions.json` (inside `--repo`, or `--exemptions FILE`) lists
 * the one-time edits and renames the owner has reviewed. An entry names a migration path before and
 * after the change and the exact git blob at each end. It applies only while the merge base still
 * holds `fromBlob` and HEAD holds `toBlob`, and it removes only its own changes (`M path` for an
 * edit, `D fromPath` plus `A toPath` for a rename); anything else in the diff still fails. Once the
 * change is on the base branch the merge base holds the new content, so the entry stops matching
 * and the gate is strict again without any edit. Each applied entry prints an `exempt:` line so the
 * CI log shows what was admitted. The file is read as data with `node:fs` and its paths reach git
 * only as a single `rev-parse` argument after validation. A missing file means no exemptions; an
 * unreadable or malformed one is exit 2, never a pass.
 *
 * Exit codes: 0 only additions; 1 an applied migration changed; 2 the check could not decide (bad
 * usage, an all-zero or unresolvable base, a git failure), which is never treated as a pass.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const MIGRATIONS_DIR = 'supabase/migrations';
const MAX_BUFFER = 64 * 1024 * 1024;

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const ZERO_SHA_PATTERN = /^0{40}$/;
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
/** A migration file name: directly under the migrations directory, no separator, no `..` segment. */
const MIGRATION_NAME_PATTERN = /^[\w.-]+\.sql$/;
const EXEMPTION_KEYS = ['fromPath', 'toPath', 'fromBlob', 'toBlob', 'reason'];
const DEFAULT_EXEMPTIONS = join('scripts', 'migration-exemptions.json');

const USAGE = `usage: node scripts/check-migrations-append-only.mjs --base REF [--repo DIR] [--exemptions FILE]
  --base REF          commit SHA or ref name to compare with (required)
  --repo DIR          the repository to check (default: this checkout)
  --exemptions FILE   reviewed one-time exemptions (default: ${DEFAULT_EXEMPTIONS} inside --repo)`;

function usageError(message) {
  console.error(`check-migrations-append-only: ${message}`);
  console.error(USAGE);
  process.exit(2);
}

function parseArguments(argv) {
  const options = { base: undefined, repo: REPO_ROOT, exemptions: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag !== '--base' && flag !== '--repo' && flag !== '--exemptions') {
      usageError(`unknown flag ${String(flag)}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value === '') usageError(`${flag} needs a value`);
    index += 1;
    if (flag === '--base') options.base = value;
    else if (flag === '--repo') options.repo = resolve(value);
    else options.exemptions = resolve(value);
  }
  if (options.base === undefined) {
    if (process.env['BASE_SHA'] !== undefined && process.env['BASE_SHA'] !== '') {
      options.base = process.env['BASE_SHA'];
    } else if (options.repo === REPO_ROOT) {
      const probe = spawnSync('git', ['-C', REPO_ROOT, 'rev-parse', '--verify', 'origin/main'], {
        encoding: 'utf8',
      });
      if (probe.status === 0) {
        options.base = 'origin/main';
      }
    }
  }
  if (options.base === undefined) usageError('--base is required');
  options.exemptions ??= join(options.repo, DEFAULT_EXEMPTIONS);
  if (!SHA_PATTERN.test(options.base) && !REF_PATTERN.test(options.base)) {
    usageError('--base must be a commit SHA or a ref name');
  }
  return options;
}

/** Runs git from an argument array and returns `{ status, stdout, stderr }`. */
function git(repo, args) {
  const run = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: MAX_BUFFER });
  if (run.error !== undefined) {
    throw new Error(`cannot run git: ${String(run.error)}`, { cause: run.error });
  }
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

/** `git diff --name-status -z` output as `{ status, path }` pairs. */
function parseNameStatus(output) {
  const fields = output.split('\0');
  if (fields.at(-1) === '') fields.pop();
  const changes = [];
  for (let index = 0; index < fields.length; index += 2) {
    const status = fields[index];
    const path = fields[index + 1];
    if (status === undefined || path === undefined) {
      throw new Error('unexpected git diff --name-status output');
    }
    changes.push({ status, path });
  }
  return changes;
}

/** Throws unless `value` is a lowercase 40-digit git object id. */
function requireBlob(label, key, value) {
  if (typeof value !== 'string' || !SHA_PATTERN.test(value)) {
    throw new Error(`${label}: ${key} must be 40 lowercase hex digits`);
  }
}

/** Throws unless `value` is `supabase/migrations/<name>.sql` with a flat, plain file name. */
function requireMigrationPath(label, key, value) {
  const prefix = `${MIGRATIONS_DIR}/`;
  const name =
    typeof value === 'string' && value.startsWith(prefix) ? value.slice(prefix.length) : '';
  if (!MIGRATION_NAME_PATTERN.test(name)) {
    throw new Error(`${label}: ${key} must be a .sql file directly under ${MIGRATIONS_DIR}/`);
  }
}

/** Reads the exemptions file as data: a missing file is no exemptions, anything else invalid throws. */
function loadExemptions(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw new Error(
      `cannot read exemptions file ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `exemptions file ${file} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  if (!Array.isArray(parsed)) throw new Error(`exemptions file ${file} must be a JSON array`);
  return parsed.map((entry, index) => {
    const label = `exemptions entry ${String(index)}`;
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`${label}: must be an object`);
    }
    const keys = Object.keys(entry).sort();
    if (keys.join() !== [...EXEMPTION_KEYS].sort().join()) {
      throw new Error(`${label}: keys must be exactly ${EXEMPTION_KEYS.join(', ')}`);
    }
    requireMigrationPath(label, 'fromPath', entry.fromPath);
    requireMigrationPath(label, 'toPath', entry.toPath);
    requireBlob(label, 'fromBlob', entry.fromBlob);
    requireBlob(label, 'toBlob', entry.toBlob);
    if (
      typeof entry.reason !== 'string' ||
      entry.reason.trim() === '' ||
      /[\r\n]/.test(entry.reason)
    ) {
      throw new Error(`${label}: reason must be a non-empty single line`);
    }
    return {
      fromPath: entry.fromPath,
      toPath: entry.toPath,
      fromBlob: entry.fromBlob,
      toBlob: entry.toBlob,
      reason: entry.reason,
    };
  });
}

/** The object id `spec` names (`<commit>:<path>`), or undefined when it does not resolve. */
function blobAt(repo, spec) {
  const run = git(repo, ['rev-parse', '--verify', '--quiet', spec]);
  return run.status === 0 ? run.stdout.trim() : undefined;
}

/**
 * Removes the changes an entry accounts for. An entry applies only when its exact changes are in
 * the diff, the merge base holds `fromBlob` at `fromPath` and HEAD holds `toBlob` at `toPath`.
 * Every other entry is inert. Returns the remaining changes and the entries that applied.
 */
function applyExemptions(repo, base, entries, changes) {
  if (entries.length === 0) return { remaining: changes, applied: [] };
  const mergeBase = git(repo, ['merge-base', base, 'HEAD']);
  if (mergeBase.status !== 0) {
    throw new Error(
      `git merge-base exited with status ${String(mergeBase.status)}: ${mergeBase.stderr.trim()}`,
    );
  }
  const mergeBaseSha = mergeBase.stdout.trim();
  let remaining = changes;
  const applied = [];
  for (const entry of entries) {
    const wanted =
      entry.fromPath === entry.toPath
        ? [{ status: 'M', path: entry.fromPath }]
        : [
            { status: 'D', path: entry.fromPath },
            { status: 'A', path: entry.toPath },
          ];
    const isWanted = (change) =>
      wanted.some(({ status, path }) => change.status === status && change.path === path);
    const present = wanted.every(({ status, path }) =>
      remaining.some((change) => change.status === status && change.path === path),
    );
    if (
      present &&
      blobAt(repo, `${mergeBaseSha}:${entry.fromPath}`) === entry.fromBlob &&
      blobAt(repo, `HEAD:${entry.toPath}`) === entry.toBlob
    ) {
      remaining = remaining.filter((change) => !isWanted(change));
      applied.push(entry);
    }
  }
  return { remaining, applied };
}

function main() {
  const { base, repo, exemptions } = parseArguments(process.argv.slice(2));

  if (ZERO_SHA_PATTERN.test(base)) {
    console.error(
      'check-migrations-append-only: the push has no previous commit (before is all zeros); ' +
        'the migration check cannot run',
    );
    return 2;
  }

  let remaining;
  let applied;
  try {
    const entries = loadExemptions(exemptions);
    const resolved = git(repo, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]);
    if (resolved.status !== 0) {
      console.error(
        `check-migrations-append-only: cannot resolve ${base}; the checkout needs fetch-depth 0`,
      );
      return 2;
    }
    const diff = git(repo, [
      'diff',
      '--name-status',
      '--no-renames',
      '-z',
      `${base}...HEAD`,
      '--',
      MIGRATIONS_DIR,
    ]);
    if (diff.status !== 0) {
      console.error(
        `check-migrations-append-only: git diff exited with status ${String(diff.status)}: ` +
          diff.stderr.trim(),
      );
      return 2;
    }
    ({ remaining, applied } = applyExemptions(repo, base, entries, parseNameStatus(diff.stdout)));
  } catch (error) {
    console.error(
      `check-migrations-append-only: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 2;
  }

  for (const { fromPath, toPath, reason } of applied) {
    console.log(`exempt: ${fromPath} -> ${toPath}: ${reason}`);
  }
  const problems = remaining.filter((change) => change.status !== 'A');
  for (const { status, path } of problems) {
    console.error(
      `${status} ${path}: applied migrations are append-only; only new files may be added`,
    );
  }
  if (problems.length > 0) {
    console.log(`migrations: ${String(problems.length)} problems`);
    return 1;
  }
  const added = `${String(remaining.length)} added, nothing else changed`;
  console.log(
    applied.length === 0
      ? `migrations: ${added}`
      : `migrations: ${added}, ${String(applied.length)} exempt`,
  );
  return 0;
}

process.exit(main());
