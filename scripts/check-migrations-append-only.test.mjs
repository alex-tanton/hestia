/*
 * Tests for `scripts/check-migrations-append-only.mjs`: only new files may appear under
 * `supabase/migrations/` between the merge base and HEAD. Each case builds a temporary repository
 * with two applied migrations on `main`, commits the case's change on a branch and runs the script
 * with `--repo` and `--base`. The hostile-value cases check that a `--base` taken from workflow
 * event data never reaches a shell: the marker file a command substitution would create must stay
 * absent. Run by `pnpm test` through the root `test:harness` script.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const CHECKER = join(REPO_ROOT, 'scripts', 'check-migrations-append-only.mjs');

const scratch = mkdtempSync(join(tmpdir(), 'hearth-migrations-'));
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

const FIRST = 'supabase/migrations/20260101000000_a.sql';
const SECOND = 'supabase/migrations/20260102000000_b.sql';
const ALL_ZEROS = '0'.repeat(40);

/** A change that touches nothing: the branch still gets an (empty) commit. */
const NO_CHANGE = () => undefined;

/** No TZ pin, no repository variables, no host git configuration. */
function childEnvironment() {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !['TZ', 'HESTIA_TEST_NOW', 'GIT_DIR', 'GIT_INDEX_FILE', 'GIT_WORK_TREE'].includes(key),
    ),
  );
  return { ...env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
}

function git(repo, ...args) {
  const run = spawnSync(
    'git',
    [
      '-c',
      'user.name=hearth-test',
      '-c',
      'user.email=test@example.invalid',
      '-c',
      'commit.gpgsign=false',
      '-C',
      repo,
      ...args,
    ],
    { encoding: 'utf8', env: childEnvironment() },
  );
  assert.equal(run.status, 0, `git ${args.join(' ')}: ${run.stderr}`);
  return run.stdout.trim();
}

let repos = 0;

function write(repo, path, content) {
  const full = join(repo, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function commitAll(repo, message) {
  git(repo, 'add', '--all');
  git(repo, 'commit', '-q', '--allow-empty', '-m', message);
  return git(repo, 'rev-parse', 'HEAD');
}

/**
 * A repository whose `main` holds two applied migrations. `change(repo)` runs on a new branch
 * `feature` and is committed; the result is the repository path and the base commit.
 */
function repoWith(change) {
  repos += 1;
  const repo = join(scratch, `repo-${String(repos)}`);
  mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  write(repo, FIRST, 'create table a ();\n');
  write(repo, SECOND, 'create table b ();\n');
  write(repo, 'README.md', 'readme\n');
  const base = commitAll(repo, 'base');
  git(repo, 'switch', '-q', '-c', 'feature');
  change(repo);
  commitAll(repo, 'change');
  return { repo, base };
}

function check(repo, ...args) {
  const run = spawnSync(process.execPath, [CHECKER, '--repo', repo, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: childEnvironment(),
  });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

describe('check-migrations-append-only: allowed changes', () => {
  it('passes when only a new migration is added', () => {
    const { repo, base } = repoWith((dir) =>
      write(dir, 'supabase/migrations/20260103000000_c.sql', 'create table c ();\n'),
    );
    const run = check(repo, '--base', base);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^migrations: 1 added, nothing else changed$/m);
  });

  it('passes with 0 added when the change is outside supabase/migrations', () => {
    const { repo, base } = repoWith((dir) => write(dir, 'README.md', 'changed\n'));
    const run = check(repo, '--base', base);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^migrations: 0 added, nothing else changed$/m);
  });

  it('accepts a ref name as the base', () => {
    const { repo } = repoWith((dir) =>
      write(dir, 'supabase/migrations/20260103000000_c.sql', 'create table c ();\n'),
    );
    const run = check(repo, '--base', 'main');
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /1 added/);
  });

  it('compares with the merge base, so a migration the base branch gained later does not count', () => {
    const { repo } = repoWith((dir) =>
      write(dir, 'supabase/migrations/20260103000000_c.sql', 'create table c ();\n'),
    );
    git(repo, 'switch', '-q', 'main');
    write(repo, 'supabase/migrations/20260104000000_d.sql', 'create table d ();\n');
    const moved = commitAll(repo, 'main gains a migration');
    git(repo, 'switch', '-q', 'feature');
    const run = check(repo, '--base', moved);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^migrations: 1 added, nothing else changed$/m);
  });
});

describe('check-migrations-append-only: forbidden changes', () => {
  it('fails on an edited migration and names it with M', () => {
    const { repo, base } = repoWith((dir) => write(dir, FIRST, 'create table a (id int);\n'));
    const run = check(repo, '--base', base);
    assert.equal(run.status, 1);
    assert.match(
      run.stderr,
      new RegExp(`^M ${FIRST.replaceAll('.', '\\.')}: applied migrations`, 'm'),
    );
    assert.match(run.stdout, /^migrations: 1 problems$/m);
  });

  it('fails on a deleted migration and names it with D', () => {
    const { repo, base } = repoWith((dir) => unlinkSync(join(dir, SECOND)));
    const run = check(repo, '--base', base);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^D supabase\/migrations\/20260102000000_b\.sql: /m);
  });

  it('fails on a rename, which is a delete plus an add', () => {
    const { repo, base } = repoWith((dir) => {
      git(dir, 'mv', SECOND, 'supabase/migrations/20260102000000_renamed.sql');
    });
    const run = check(repo, '--base', base);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^D supabase\/migrations\/20260102000000_b\.sql: /m);
    assert.doesNotMatch(run.stderr, /^A /m);
  });

  it('fails on a mode-only change', () => {
    const { repo, base } = repoWith((dir) => {
      chmodSync(join(dir, FIRST), 0o755);
      git(dir, 'update-index', '--chmod=+x', FIRST);
    });
    const run = check(repo, '--base', base);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^M supabase\/migrations\/20260101000000_a\.sql: /m);
  });

  it('fails when a migration is replaced by a symlink (type change)', () => {
    const { repo, base } = repoWith((dir) => {
      unlinkSync(join(dir, FIRST));
      symlinkSync('20260102000000_b.sql', join(dir, FIRST));
    });
    const run = check(repo, '--base', base);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^T supabase\/migrations\/20260101000000_a\.sql: /m);
  });

  it('fails when an edit comes together with a valid addition', () => {
    const { repo, base } = repoWith((dir) => {
      write(dir, FIRST, 'create table a (id int);\n');
      write(dir, 'supabase/migrations/20260103000000_c.sql', 'create table c ();\n');
    });
    const run = check(repo, '--base', base);
    assert.equal(run.status, 1);
    assert.match(run.stdout, /^migrations: 1 problems$/m);
  });
});

describe('check-migrations-append-only: a base it cannot use exits 2', () => {
  const marker = join(scratch, 'pwned');

  it('requires --base', () => {
    const { repo } = repoWith(NO_CHANGE);
    const run = check(repo);
    assert.equal(run.status, 2);
    assert.match(run.stderr, /--base is required/);
    assert.match(run.stderr, /usage: node scripts\/check-migrations-append-only\.mjs/);
  });

  it('rejects the all-zero SHA that a first push reports as before', () => {
    const { repo } = repoWith(NO_CHANGE);
    const run = check(repo, '--base', ALL_ZEROS);
    assert.equal(run.status, 2);
    assert.match(run.stderr, /the push has no previous commit \(before is all zeros\)/);
  });

  it('rejects a SHA that does not exist in the checkout', () => {
    const { repo } = repoWith(NO_CHANGE);
    const run = check(repo, '--base', 'a'.repeat(40));
    assert.equal(run.status, 2);
    assert.match(run.stderr, /cannot resolve a{40}; the checkout needs fetch-depth 0/);
  });

  it('rejects a ref name that does not exist', () => {
    const { repo } = repoWith(NO_CHANGE);
    const run = check(repo, '--base', 'no-such-branch');
    assert.equal(run.status, 2);
    assert.match(run.stderr, /cannot resolve no-such-branch/);
  });

  for (const hostile of [
    `$(touch ${marker})`,
    `\`touch ${marker}\``,
    `a;touch ${marker}`,
    `a b`,
    `a\ntouch ${marker}`,
    '-x',
    '--help',
    '../escape',
    '',
  ]) {
    it(`rejects ${JSON.stringify(hostile)} without running it`, () => {
      const { repo } = repoWith(NO_CHANGE);
      const run = check(repo, '--base', hostile);
      assert.equal(run.status, 2);
      assert.equal(existsSync(marker), false, 'the marker file must never be created');
    });
  }

  it('rejects a directory that is not a git repository', () => {
    const plain = join(scratch, 'not-a-repo');
    mkdirSync(plain);
    const run = check(plain, '--base', 'main');
    assert.equal(run.status, 2);
  });

  it('rejects an unknown flag', () => {
    const { repo, base } = repoWith(NO_CHANGE);
    const run = check(repo, '--base', base, '--fix');
    assert.equal(run.status, 2);
    assert.match(run.stderr, /unknown flag --fix/);
  });
});

const RENAMED = 'supabase/migrations/20260102000000_renamed.sql';

/** The git blob id of `path` at `revision`. */
function blobOf(repo, revision, path) {
  return git(repo, 'rev-parse', `${revision}:${path}`);
}

/** An exemption entry pinned to the blobs the repository really holds before and after. */
function pinnedEntry(repo, base, fromPath, toPath, reason = 'fixture change') {
  return {
    fromPath,
    toPath,
    fromBlob: blobOf(repo, base, fromPath),
    toBlob: blobOf(repo, 'HEAD', toPath),
    reason,
  };
}

let exemptionFiles = 0;

/** Writes an exemptions file under `scratch` and returns its path. */
function exemptionsFile(entries) {
  exemptionFiles += 1;
  const file = join(scratch, `exemptions-${String(exemptionFiles)}.json`);
  writeFileSync(file, JSON.stringify(entries));
  return file;
}

describe('check-migrations-append-only: content-pinned exemptions', () => {
  it('passes an exempted rename and an exempted edit pinned to both blobs, and says so', () => {
    const { repo, base } = repoWith((dir) => {
      git(dir, 'mv', SECOND, RENAMED);
      write(dir, RENAMED, 'create table b (id int);\n');
      write(dir, FIRST, 'create table a (id int);\n');
    });
    const file = exemptionsFile([
      pinnedEntry(repo, base, FIRST, FIRST, 'edit fixture'),
      pinnedEntry(repo, base, SECOND, RENAMED, 'rename fixture'),
    ]);
    const run = check(repo, '--base', base, '--exemptions', file);
    assert.equal(run.status, 0, run.stderr);
    const exempt = run.stdout.split('\n').filter((line) => line.startsWith('exempt: '));
    assert.equal(exempt.length, 2);
    assert.ok(exempt.includes(`exempt: ${FIRST} -> ${FIRST}: edit fixture`));
    assert.ok(exempt.includes(`exempt: ${SECOND} -> ${RENAMED}: rename fixture`));
    assert.match(run.stdout, /^migrations: 0 added, nothing else changed, 2 exempt$/m);
  });

  it('fails an edit whose head blob is not the pinned toBlob', () => {
    const { repo, base } = repoWith((dir) => write(dir, FIRST, 'create table a (id int);\n'));
    const file = exemptionsFile([
      { ...pinnedEntry(repo, base, FIRST, FIRST), toBlob: blobOf(repo, 'HEAD', SECOND) },
    ]);
    const run = check(repo, '--base', base, '--exemptions', file);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^M supabase\/migrations\/20260101000000_a\.sql: /m);
    assert.doesNotMatch(run.stdout, /exempt:/);
  });

  it('fails once the merge base no longer holds fromBlob, so an entry expires after it lands', () => {
    const { repo, base } = repoWith(NO_CHANGE);
    git(repo, 'switch', '-q', 'main');
    write(repo, FIRST, 'create table a (id int);\n');
    const landed = commitAll(repo, 'the pinned edit lands on main');
    git(repo, 'switch', '-q', 'feature');
    git(repo, 'merge', '-q', '--no-edit', 'main');
    write(repo, FIRST, 'create table a (id int, note text);\n');
    commitAll(repo, 'edit the file again');
    const file = exemptionsFile([pinnedEntry(repo, base, FIRST, FIRST)]);
    assert.notEqual(blobOf(repo, landed, FIRST), blobOf(repo, base, FIRST));
    const run = check(repo, '--base', landed, '--exemptions', file);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^M supabase\/migrations\/20260101000000_a\.sql: /m);
  });

  it('fails an exempted edit committed together with an unrelated edit, naming only the unrelated file', () => {
    const { repo, base } = repoWith((dir) => {
      write(dir, FIRST, 'create table a (id int);\n');
      write(dir, SECOND, 'create table b (id int);\n');
    });
    const file = exemptionsFile([pinnedEntry(repo, base, FIRST, FIRST)]);
    const run = check(repo, '--base', base, '--exemptions', file);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^M supabase\/migrations\/20260102000000_b\.sql: /m);
    assert.doesNotMatch(run.stderr, /20260101000000_a/);
    assert.match(run.stdout, /^migrations: 1 problems$/m);
  });

  it('fails a rename to a target the entry does not name', () => {
    const { repo, base } = repoWith((dir) => {
      git(dir, 'mv', SECOND, RENAMED);
      write(dir, RENAMED, 'create table b (id int);\n');
    });
    const file = exemptionsFile([
      {
        ...pinnedEntry(repo, base, SECOND, RENAMED),
        toPath: 'supabase/migrations/20260102000000_other.sql',
      },
    ]);
    const run = check(repo, '--base', base, '--exemptions', file);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^D supabase\/migrations\/20260102000000_b\.sql: /m);
    assert.doesNotMatch(run.stdout, /exempt:/);
  });

  it('treats a missing exemptions file as no exemptions', () => {
    const { repo, base } = repoWith((dir) => write(dir, FIRST, 'create table a (id int);\n'));
    const run = check(
      repo,
      '--base',
      base,
      '--exemptions',
      join(scratch, 'no-such-exemptions.json'),
    );
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^M supabase\/migrations\/20260101000000_a\.sql: /m);
  });

  it('reads scripts/migration-exemptions.json inside --repo by default', () => {
    const { repo, base } = repoWith((dir) => write(dir, FIRST, 'create table a (id int);\n'));
    write(
      repo,
      'scripts/migration-exemptions.json',
      JSON.stringify([pinnedEntry(repo, base, FIRST, FIRST)]),
    );
    const run = check(repo, '--base', base);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.split('\n').filter((line) => line.startsWith('exempt: ')).length, 1);
    assert.match(run.stdout, /^migrations: 0 added, nothing else changed, 1 exempt$/m);
  });

  it('exits 2 on an exemptions file that is not JSON', () => {
    const { repo, base } = repoWith((dir) => write(dir, FIRST, 'create table a (id int);\n'));
    exemptionFiles += 1;
    const file = join(scratch, `exemptions-${String(exemptionFiles)}.json`);
    writeFileSync(file, '[{ not json');
    const run = check(repo, '--base', base, '--exemptions', file);
    assert.equal(run.status, 2);
    assert.match(run.stderr, /^check-migrations-append-only: /);
  });

  it('exits 2 on an entry with a path outside supabase/migrations or a blob that is not 40 hex digits', () => {
    const { repo, base } = repoWith((dir) => write(dir, FIRST, 'create table a (id int);\n'));
    const good = pinnedEntry(repo, base, FIRST, FIRST);
    const withoutReason = { ...good };
    delete withoutReason.reason;
    const bad = {
      'a ../ path': { ...good, fromPath: 'supabase/migrations/../../etc/hosts.sql' },
      'a path outside the directory': { ...good, toPath: 'scripts/20260101000000_a.sql' },
      'a path without the .sql suffix': { ...good, fromPath: 'supabase/migrations/readme.md' },
      'a backslash in a path': { ...good, toPath: 'supabase/migrations\\20260101000000_a.sql' },
      'a 39-digit blob': { ...good, fromBlob: good.fromBlob.slice(1) },
      'an uppercase blob': { ...good, toBlob: good.toBlob.toUpperCase() },
      'an empty reason': { ...good, reason: ' ' },
      'a missing key': withoutReason,
      'an extra key': { ...good, note: 'not part of the contract' },
    };
    for (const [name, entry] of Object.entries(bad)) {
      const run = check(repo, '--base', base, '--exemptions', exemptionsFile([entry]));
      assert.equal(run.status, 2, `${name}: expected exit 2, got ${String(run.status)}`);
      assert.match(run.stderr, /^check-migrations-append-only: /, name);
      assert.doesNotMatch(run.stdout, /exempt:/, name);
    }
    const notAnArray = check(repo, '--base', base, '--exemptions', exemptionsFile(good));
    assert.equal(notAnArray.status, 2, 'an object instead of an array');
  });

  it('prints the unchanged summary when no entry applies', () => {
    const { repo, base } = repoWith((dir) =>
      write(dir, 'supabase/migrations/20260103000000_c.sql', 'create table c ();\n'),
    );
    const inert = {
      fromPath: FIRST,
      toPath: FIRST,
      fromBlob: blobOf(repo, base, FIRST),
      toBlob: blobOf(repo, base, SECOND),
      reason: 'fixture change',
    };
    const run = check(repo, '--base', base, '--exemptions', exemptionsFile([inert]));
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^migrations: 1 added, nothing else changed$/m);
    assert.doesNotMatch(run.stdout, /exempt/);
  });
});
