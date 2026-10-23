/*
 * Migration append-only gate: an applied migration must never change, because a database that
 * already ran it will not run it again. Compares `supabase/migrations/` at HEAD with the merge base
 * of `--base` and HEAD, and passes only when files were added there and nothing else happened: an
 * edit, a delete, a rename (git reports it as a delete plus an add), a mode change and a type
 * change all fail. Whether new files sort after the existing ones is not checked.
 *
 *   node scripts/check-migrations-append-only.mjs --base REF [--repo DIR]
 *
 * `--base` is a commit SHA or a ref name. In CI it comes from workflow event data, which a pull
 * request author controls, so it is validated against a strict pattern before git sees it and git
 * runs from an argument array, never a shell. The checkout needs enough history to contain the
 * merge base (`fetch-depth: 0`).
 *
 * Exit codes: 0 only additions; 1 an applied migration changed; 2 the check could not decide (bad
 * usage, an all-zero or unresolvable base, a git failure), which is never treated as a pass.
 */

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const MIGRATIONS_DIR = 'supabase/migrations';
const MAX_BUFFER = 64 * 1024 * 1024;

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const ZERO_SHA_PATTERN = /^0{40}$/;
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

const USAGE = `usage: node scripts/check-migrations-append-only.mjs --base REF [--repo DIR]
  --base REF   commit SHA or ref name to compare with (required)
  --repo DIR   the repository to check (default: this checkout)`;

function usageError(message) {
  console.error(`check-migrations-append-only: ${message}`);
  console.error(USAGE);
  process.exit(2);
}

function parseArguments(argv) {
  const options = { base: undefined, repo: REPO_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag !== '--base' && flag !== '--repo') usageError(`unknown flag ${String(flag)}`);
    const value = argv[index + 1];
    if (value === undefined || value === '') usageError(`${flag} needs a value`);
    index += 1;
    if (flag === '--base') options.base = value;
    else options.repo = resolve(value);
  }
  if (options.base === undefined) usageError('--base is required');
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

function main() {
  const { base, repo } = parseArguments(process.argv.slice(2));

  if (ZERO_SHA_PATTERN.test(base)) {
    console.error(
      'check-migrations-append-only: the push has no previous commit (before is all zeros); ' +
        'the migration check cannot run',
    );
    return 2;
  }

  let changes;
  try {
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
    changes = parseNameStatus(diff.stdout);
  } catch (error) {
    console.error(
      `check-migrations-append-only: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 2;
  }

  const problems = changes.filter((change) => change.status !== 'A');
  for (const { status, path } of problems) {
    console.error(
      `${status} ${path}: applied migrations are append-only; only new files may be added`,
    );
  }
  if (problems.length > 0) {
    console.log(`migrations: ${String(problems.length)} problems`);
    return 1;
  }
  console.log(`migrations: ${String(changes.length)} added, nothing else changed`);
  return 0;
}

process.exit(main());
