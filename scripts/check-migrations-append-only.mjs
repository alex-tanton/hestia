/*
 * Migration append-only gate: ensures applied migrations in supabase/migrations/
 * are never modified or deleted compared to the base commit.
 *
 * Usage: node scripts/check-migrations-append-only.mjs [--base REF] [--repo DIR]
 */

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const MIGRATIONS_DIR = 'supabase/migrations';

function parseArguments(argv) {
  let base = process.env['BASE_SHA'];
  let repo = REPO_ROOT;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base' && argv[i + 1]) {
      base = argv[++i];
    } else if (argv[i] === '--repo' && argv[i + 1]) {
      repo = resolve(argv[++i]);
    }
  }
  if (!base && repo === REPO_ROOT) {
    const probe = spawnSync('git', ['-C', REPO_ROOT, 'rev-parse', '--verify', 'origin/main'], {
      encoding: 'utf8',
    });
    base = probe.status === 0 ? 'origin/main' : 'HEAD';
  }
  if (!base) {
    console.error('check-migrations-append-only: --base is required');
    process.exit(2);
  }
  return { base, repo };
}

function git(repo, args) {
  const run = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  if (run.error) throw run.error;
  return run;
}

function main() {
  const { base, repo } = parseArguments(process.argv.slice(2));
  if (/^0{40}$/.test(base)) {
    console.error('check-migrations-append-only: base commit is all zeros');
    return 2;
  }

  const resolved = git(repo, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]);
  if (resolved.status !== 0) {
    console.error(`check-migrations-append-only: cannot resolve ${base}; fetch-depth 0 needed`);
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
    console.error(`check-migrations-append-only: git diff failed: ${diff.stderr.trim()}`);
    return 2;
  }

  const fields = diff.stdout.split('\0').filter(Boolean);
  const changes = [];
  for (let i = 0; i < fields.length; i += 2) {
    changes.push({ status: fields[i], path: fields[i + 1] });
  }

  const problems = changes.filter((change) => change.status !== 'A');
  for (const { status, path } of problems) {
    console.error(`${status} ${path}: applied migrations are append-only; only additions allowed`);
  }

  if (problems.length > 0) {
    console.log(`migrations: ${String(problems.length)} problems`);
    return 1;
  }

  console.log(`migrations: ${String(changes.length)} added, nothing else changed`);
  return 0;
}

process.exit(main());
