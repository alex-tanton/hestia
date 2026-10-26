/*
 * Tests for `scripts/check-repo-hygiene.mjs`: tracked-but-ignored files, script modes, index line
 * endings and the product's former name. Each case builds a fresh temporary repository, stages
 * files (the script reads the index, so nothing is committed) and runs the script as a child
 * process with `--repo`. Git runs with the host's configuration and repository variables removed,
 * so a developer's global config or a hook environment cannot change a verdict. Run by `pnpm test`
 * through the root `test:harness` script.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const HYGIENE = join(REPO_ROOT, 'scripts', 'check-repo-hygiene.mjs');

const scratch = mkdtempSync(join(tmpdir(), 'hestia-hygiene-'));
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

/** The environment for every child: no TZ pin, no repository variables, no host git config. */
function childEnvironment() {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !['TZ', 'HESTIA_TEST_NOW', 'GIT_DIR', 'GIT_INDEX_FILE', 'GIT_WORK_TREE'].includes(key),
    ),
  );
  return { ...env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
}

const GIT_IDENTITY = ['-c', 'user.name=hestia-test', '-c', 'user.email=test@example.invalid'];

function git(repo, args, input) {
  const run = spawnSync(
    'git',
    [...GIT_IDENTITY, '-c', 'commit.gpgsign=false', '-C', repo, ...args],
    {
      encoding: 'utf8',
      env: childEnvironment(),
      ...(input === undefined ? {} : { input }),
    },
  );
  assert.equal(run.status, 0, `git ${args.join(' ')}: ${run.stderr}`);
  return run.stdout.trim();
}

let repos = 0;

/** A new empty repository with no `.gitattributes`, so only the index decides line endings. */
function newRepo() {
  repos += 1;
  const repo = join(scratch, `repo-${String(repos)}`);
  mkdirSync(repo);
  git(repo, ['init', '-q', '-b', 'main']);
  return repo;
}

/** Writes a file in the working tree and stages it with the mode the working tree gives it. */
function stage(repo, path, content, { executable = false } = {}) {
  const full = join(repo, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  chmodSync(full, executable ? 0o755 : 0o644);
  git(repo, ['add', '--force', '--', path]);
}

/** Puts bytes in the index exactly as given: no filters, so CRLF survives. */
function stageRaw(repo, path, content, mode) {
  const full = join(repo, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  const sha = git(repo, ['hash-object', '-w', '--no-filters', '--', path]);
  git(repo, ['update-index', '--add', '--cacheinfo', `${mode},${sha},${path}`]);
}

function hygiene(repo, ...extra) {
  const run = spawnSync(process.execPath, [HYGIENE, '--repo', repo, ...extra], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: childEnvironment(),
  });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

describe('check-repo-hygiene: a clean repository', () => {
  it('passes executable scripts, with and without a shebang, and an LF text file', () => {
    const repo = newRepo();
    stage(repo, 'bin/tool', '#!/usr/bin/env node\nconsole.log(1);\n', { executable: true });
    stage(repo, 'scripts/run.sh', '#!/bin/sh\necho hi\n', { executable: true });
    stage(repo, 'README.md', '# readme\n');
    const run = hygiene(repo);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^repo-hygiene: clean \(3 files, 2 scripts\)$/m);
  });

  it('does not treat a #! on the second line as a script', () => {
    const repo = newRepo();
    stage(repo, 'notes.txt', 'title\n#!/bin/sh\n');
    const run = hygiene(repo);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /\(1 files, 0 scripts\)/);
  });

  it('does not treat an empty file as a script', () => {
    const repo = newRepo();
    stage(repo, 'empty', '');
    assert.equal(hygiene(repo).status, 0);
  });

  it('skips a symlink named like a script', () => {
    const repo = newRepo();
    stage(repo, 'real.txt', 'text\n');
    symlinkSync('real.txt', join(repo, 'link.sh'));
    git(repo, ['add', '--', 'link.sh']);
    const run = hygiene(repo);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /\(2 files, 0 scripts\)/);
  });

  it('does not report a binary blob that contains CRLF bytes', () => {
    const repo = newRepo();
    stageRaw(repo, 'image.bin', Buffer.from([0x00, 0x0d, 0x0a, 0x01, 0x0d, 0x0a]), '100644');
    const run = hygiene(repo);
    assert.equal(run.status, 0, run.stderr);
  });
});

describe('check-repo-hygiene: tracked but ignored', () => {
  it('fails on a force-added file that .gitignore ignores and names it', () => {
    const repo = newRepo();
    stage(repo, '.gitignore', '*.log\n');
    stage(repo, 'debug.log', 'noise\n');
    const run = hygiene(repo);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^tracked but ignored by \.gitignore: debug\.log$/m);
    assert.match(run.stdout, /^repo-hygiene: 1 problems$/m);
  });
});

describe('check-repo-hygiene: script modes', () => {
  it('fails on a shebang file at 100644', () => {
    const repo = newRepo();
    stage(repo, 'bin/tool', '#!/usr/bin/env node\n');
    const run = hygiene(repo);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^script is not executable \(100644\): bin\/tool$/m);
  });

  it('fails on a .sh file without a shebang at 100644', () => {
    const repo = newRepo();
    stage(repo, 'scripts/run.sh', 'echo hi\n');
    const run = hygiene(repo);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^script is not executable \(100644\): scripts\/run\.sh$/m);
  });

  it('judges the index mode, not the mode on disk', () => {
    const repo = newRepo();
    stage(repo, 'bin/tool', '#!/usr/bin/env node\n');
    chmodSync(join(repo, 'bin/tool'), 0o755);
    const run = hygiene(repo);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /script is not executable \(100644\): bin\/tool/);
  });

  it('lists every problem in path order', () => {
    const repo = newRepo();
    stage(repo, 'z.sh', 'echo z\n');
    stage(repo, 'a.sh', 'echo a\n');
    const run = hygiene(repo);
    assert.equal(run.status, 1);
    const lines = run.stderr.trim().split('\n');
    assert.deepEqual(lines, [
      'script is not executable (100644): a.sh',
      'script is not executable (100644): z.sh',
    ]);
    assert.match(run.stdout, /^repo-hygiene: 2 problems$/m);
  });
});

describe('check-repo-hygiene: line endings in the index', () => {
  it('fails on an executable .sh whose index blob has CRLF endings', () => {
    const repo = newRepo();
    stageRaw(repo, 'scripts/run.sh', '#!/bin/sh\r\necho hi\r\n', '100755');
    const run = hygiene(repo);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^CRLF line endings in the index: scripts\/run\.sh$/m);
  });

  it('fails on a non-script text file with CRLF in the index', () => {
    const repo = newRepo();
    stageRaw(repo, 'notes.txt', 'one\r\ntwo\r\n', '100644');
    const run = hygiene(repo);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^CRLF line endings in the index: notes\.txt$/m);
  });

  it('fails on mixed endings', () => {
    const repo = newRepo();
    stageRaw(repo, 'notes.txt', 'one\r\ntwo\n', '100644');
    const run = hygiene(repo);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /CRLF line endings in the index: notes\.txt/);
  });

  it('reads the index, so CRLF in the working tree alone does not fail', () => {
    const repo = newRepo();
    stage(repo, 'notes.txt', 'one\ntwo\n');
    writeFileSync(join(repo, 'notes.txt'), 'one\r\ntwo\r\n');
    assert.equal(hygiene(repo).status, 0);
  });

  it('does not report a path whose attributes say -text', () => {
    const repo = newRepo();
    stage(repo, '.gitattributes', 'legacy.txt -text\n');
    stageRaw(repo, 'legacy.txt', 'one\r\ntwo\r\n', '100644');
    const run = hygiene(repo);
    assert.equal(run.status, 0, run.stderr);
  });
});

describe('check-repo-hygiene: cases it cannot decide exit 2', () => {
  it('rejects a directory that is not a git repository', () => {
    const plain = join(scratch, 'not-a-repo');
    mkdirSync(plain);
    const run = hygiene(plain);
    assert.equal(run.status, 2);
    assert.match(run.stderr, /cannot check/);
  });

  it('rejects a directory that does not exist', () => {
    assert.equal(hygiene(join(scratch, 'missing')).status, 2);
  });

  it('rejects an unknown flag with the usage text', () => {
    const run = hygiene(newRepo(), '--fix');
    assert.equal(run.status, 2);
    assert.match(run.stderr, /unknown flag --fix/);
    assert.match(run.stderr, /usage: node scripts\/check-repo-hygiene\.mjs/);
  });

  it('rejects --repo without a value', () => {
    const run = spawnSync(process.execPath, [HYGIENE, '--repo'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /--repo needs a value/);
  });
});

/* The old product name, spelled out so the fixtures below read like the real leftovers. This file
 * is on the guard's allowlist because it must hold the pattern. */
const OLD_NAME = 'hearth';
const PINNED_STATE_LINK = `file:///c:/Users/actanton/Development/Aberrance/${OLD_NAME}/.planning/PROJECT.md`;

describe('check-repo-hygiene: legacy name', () => {
  it('fails on a staged file that contains the old name and names it', () => {
    const repo = newRepo();
    stage(repo, 'src/a.ts', `export const brand = '${OLD_NAME}';\n`);
    stage(repo, 'src/b.ts', 'export const brand = 1;\n');
    const run = hygiene(repo);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^legacy name in src\/a\.ts$/m);
    assert.doesNotMatch(run.stderr, /src\/b\.ts/);
    assert.match(run.stdout, /^repo-hygiene: 1 problems$/m);
  });

  it('matches the old name in any case', () => {
    const repo = newRepo();
    stage(repo, 'src/cap.ts', 'const a = "Hearth";\n');
    stage(repo, 'src/upper.ts', 'const a = "HEARTH_ORIGIN";\n');
    const run = hygiene(repo);
    assert.equal(run.status, 1);
    assert.deepEqual(run.stderr.trim().split('\n'), [
      'legacy name in src/cap.ts',
      'legacy name in src/upper.ts',
    ]);
    assert.match(run.stdout, /^repo-hygiene: 2 problems$/m);
  });

  it('fails on a tracked path whose name contains the old name', () => {
    const repo = newRepo();
    stage(repo, `docs/${OLD_NAME}-notes.md`, 'clean text\n');
    const run = hygiene(repo);
    assert.equal(run.status, 1);
    assert.deepEqual(run.stderr.trim().split('\n'), [
      `legacy name in file name: docs/${OLD_NAME}-notes.md`,
    ]);
    assert.match(run.stdout, /^repo-hygiene: 1 problems$/m);
  });

  it('passes when the old name appears only in allowlisted paths', () => {
    const repo = newRepo();
    const text = `quotes ${OLD_NAME}\n`;
    stage(repo, '.planning/milestones/v1.0/x.md', text);
    stage(repo, '.planning/phases/08-x/notes.md', text);
    stage(repo, '.planning/research/notes.md', text);
    stage(repo, 'scripts/migration-exemptions.json', `{ "fromPath": "${OLD_NAME}" }\n`);
    stage(repo, 'scripts/check-repo-hygiene.mjs', text);
    stage(repo, 'scripts/check-repo-hygiene.test.mjs', text);
    const run = hygiene(repo);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^repo-hygiene: clean \(6 files, 0 scripts\)$/m);
  });

  it('does not extend an exact allowlist entry to a sibling path', () => {
    const repo = newRepo();
    const text = `quotes ${OLD_NAME}\n`;
    stage(repo, 'scripts/migration-exemptions.json.bak', text);
    stage(repo, '.planning/STATE.md.orig', `${PINNED_STATE_LINK}\n`);
    stage(repo, '.planning/environment/setup.md', text);
    const run = hygiene(repo);
    assert.equal(run.status, 1);
    assert.deepEqual(run.stderr.trim().split('\n'), [
      'legacy name in .planning/STATE.md.orig',
      'legacy name in .planning/environment/setup.md',
      'legacy name in scripts/migration-exemptions.json.bak',
    ]);
    assert.match(run.stdout, /^repo-hygiene: 3 problems$/m);
  });

  it('allows only the pinned quotes in a planning state file', () => {
    const repo = newRepo();
    stage(
      repo,
      '.planning/ROADMAP.md',
      [
        '- [x] **[v1.0 Hearth — Cleanup and Hardening](milestones/v1.0/ROADMAP.md)** — 6 phases',
        '- [ ] **Phase 8: Rebrand**',
        '**Goal:** Rebrand the application from Hearth to Hestia across the monorepo',
        '',
      ].join('\n'),
    );
    stage(repo, '.planning/STATE.md', `See: [PROJECT.md](${PINNED_STATE_LINK}) (updated today)\n`);
    const run = hygiene(repo);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^repo-hygiene: clean \(2 files, 0 scripts\)$/m);
  });

  it('fails on old-name text outside the pinned quotes, naming the line', () => {
    const repo = newRepo();
    stage(
      repo,
      '.planning/STATE.md',
      [
        `See: [PROJECT.md](${PINNED_STATE_LINK})`,
        `- decision: the ${OLD_NAME}_service role`,
        '',
      ].join('\n'),
    );
    stage(repo, '.planning/PROJECT.md', `Goddess of the Hearth fits; set HEARTH_ORIGIN to taste\n`);
    stage(
      repo,
      '.planning/ROADMAP.md',
      `**Goal:** Rebrand the application from ${OLD_NAME} to Hestia\n`,
    );
    const run = hygiene(repo);
    assert.equal(run.status, 1);
    assert.deepEqual(run.stderr.trim().split('\n'), [
      'legacy name in .planning/PROJECT.md:1',
      'legacy name in .planning/ROADMAP.md:1',
      'legacy name in .planning/STATE.md:2',
    ]);
    assert.match(run.stdout, /^repo-hygiene: 3 problems$/m);
  });

  it('skips binary files', () => {
    const repo = newRepo();
    stageRaw(
      repo,
      'image.bin',
      Buffer.concat([Buffer.from([0x00]), Buffer.from(OLD_NAME)]),
      '100644',
    );
    const run = hygiene(repo);
    assert.equal(run.status, 0, run.stderr);
  });

  it('judges the index, not the working tree', () => {
    const repo = newRepo();
    stage(repo, 'clean.txt', 'clean\n');
    writeFileSync(join(repo, 'clean.txt'), `${OLD_NAME}\n`);
    stage(repo, 'dirty.txt', `${OLD_NAME}\n`);
    writeFileSync(join(repo, 'dirty.txt'), 'clean\n');
    const run = hygiene(repo);
    assert.equal(run.status, 1);
    assert.deepEqual(run.stderr.trim().split('\n'), ['legacy name in dirty.txt']);
  });
});
