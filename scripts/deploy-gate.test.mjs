/*
 * Tests for `scripts/deploy-gate.sh`: which commits the deploy workflow ships. Every case builds a
 * throwaway git repository, copies the real script into it, and runs it with a stub `docker` that
 * answers `image inspect hearth-service:current` with the running revision label (or fails, as when
 * no image exists). Nothing reaches a real Docker daemon, the network or the host's repository.
 * The cases pin the deploy rules (a commit equal to or older than the running revision is skipped,
 * a change confined to docs/ and .planning/ is skipped, anything else deploys, including an unknown
 * running revision) and that a hostile `HEARTH_DEPLOY_SHA` never reaches a shell. Run by
 * `pnpm test` through the root `test:harness` script.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const GATE = join(REPO_ROOT, 'scripts', 'deploy-gate.sh');

const scratch = mkdtempSync(join(tmpdir(), 'hearth-gate-'));
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

// Answers `image inspect` with $STUB_REVISION, or exits 1 when it is empty (no such image), and
// records every call so a case can prove the gate asked about nothing but the running service.
const DOCKER_STUB = `#!/usr/bin/env bash
printf '%s\\n' "$*" >>"$STUB_LOG"
if [[ "$1 $2" == "image inspect" && -n "\${STUB_REVISION-}" ]]; then
  printf '%s\\n' "$STUB_REVISION"
  exit 0
fi
exit 1
`;

const binDir = join(scratch, 'bin');
mkdirSync(binDir);
writeFileSync(join(binDir, 'docker'), DOCKER_STUB);
chmodSync(join(binDir, 'docker'), 0o755);

/** The environment for git: no inherited repository, no user or system configuration. */
function gitEnvironment() {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !['GIT_DIR', 'GIT_INDEX_FILE', 'GIT_WORK_TREE'].includes(key),
    ),
  );
  return { ...env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
}

function git(cwd, ...args) {
  const run = spawnSync(
    'git',
    ['-c', 'user.name=hearth-test', '-c', 'user.email=test@example.invalid', ...args],
    { cwd, encoding: 'utf8', env: gitEnvironment() },
  );
  assert.equal(run.status, 0, `git ${args.join(' ')}: ${run.stderr}`);
  return run.stdout.trim();
}

let repositories = 0;

/** A repository with a root commit `base` (app.txt) and the real gate script, untracked. */
function createRepository() {
  repositories += 1;
  const dir = join(scratch, `repo-${String(repositories)}`);
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  git(dir, 'init', '--quiet', '--initial-branch=main');
  copyFileSync(GATE, join(dir, 'scripts', 'deploy-gate.sh'));
  chmodSync(join(dir, 'scripts', 'deploy-gate.sh'), 0o755);
  commit(dir, 'base', { 'app.txt': 'base\n' });
  return dir;
}

/** Commits the given files (path to content, `null` removes) and returns the new commit's SHA. */
function commit(dir, message, files) {
  for (const [path, content] of Object.entries(files)) {
    if (content === null) {
      git(dir, 'rm', '--quiet', '--', path);
      continue;
    }
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
    git(dir, 'add', '--', path);
  }
  git(dir, '-c', 'commit.gpgsign=false', 'commit', '--quiet', '--allow-empty', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}

let runs = 0;

/**
 * Runs the repository's copy of the gate. `revision` is what the stub reports as the running
 * image's label (`undefined`: no such image); `deploySha` defaults to the repository's HEAD.
 */
function gate(dir, { revision, deploySha, omitSha = false } = {}) {
  runs += 1;
  const log = join(scratch, `docker-${String(runs)}.log`);
  writeFileSync(log, '');
  const env = { ...gitEnvironment(), PATH: `${binDir}${delimiter}${process.env['PATH'] ?? ''}` };
  delete env['HEARTH_DEPLOY_SHA'];
  delete env['STUB_REVISION'];
  env['STUB_LOG'] = log;
  if (revision !== undefined) env['STUB_REVISION'] = revision;
  if (!omitSha) env['HEARTH_DEPLOY_SHA'] = deploySha ?? git(dir, 'rev-parse', 'HEAD');
  const run = spawnSync('bash', [join(dir, 'scripts', 'deploy-gate.sh')], {
    cwd: dir,
    encoding: 'utf8',
    env,
  });
  return {
    status: run.status,
    stdout: run.stdout,
    stderr: run.stderr,
    dockerCalls: readFileSync(log, 'utf8').split('\n').filter(Boolean),
  };
}

/** Asserts a decision: exit 0, exactly one stdout line, a stderr reason, only the service asked. */
function assertDecision(run, decision, reason) {
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.equal(run.stdout, `deploy=${decision}\n`);
  assert.match(run.stderr, /^deploy-gate: running revision .+: .+\n$/);
  if (reason !== undefined) assert.match(run.stderr, reason);
  for (const call of run.dockerCalls) {
    assert.match(call, /^image inspect .* hearth-service:current$/);
  }
  assert.equal(run.dockerCalls.length, 1, run.dockerCalls.join('\n'));
}

describe('deploy-gate: an unknown running revision deploys', () => {
  it('no running image', () => {
    const dir = createRepository();
    commit(dir, 'code', { 'app.txt': 'one\n' });
    assertDecision(gate(dir), 'true', /no revision label or does not exist/);
  });

  it('an empty label', () => {
    const dir = createRepository();
    commit(dir, 'code', { 'app.txt': 'one\n' });
    assertDecision(gate(dir, { revision: '' }), 'true', /no revision label or does not exist/);
  });

  for (const label of ['dev', 'DEADBEEF', 'abc123', 'main', '$(touch x)']) {
    it(`a label that is not a commit: ${label}`, () => {
      const dir = createRepository();
      commit(dir, 'code', { 'app.txt': 'one\n' });
      assertDecision(gate(dir, { revision: label }), 'true', /is not a commit/);
      assert.equal(existsSync(join(dir, 'x')), false);
    });
  }

  it('a revision that is not in this history', () => {
    const dir = createRepository();
    commit(dir, 'code', { 'app.txt': 'one\n' });
    assertDecision(gate(dir, { revision: 'deadbeefcafe' }), 'true', /not a unique commit/);
  });

  it('a revision on a diverged branch', () => {
    const dir = createRepository();
    const fork = git(dir, 'rev-parse', 'HEAD');
    git(dir, 'switch', '--quiet', '--create', 'side');
    const side = commit(dir, 'side code', { 'side.txt': 'side\n' });
    git(dir, 'switch', '--quiet', 'main');
    commit(dir, 'main docs', { 'docs/x.md': 'x\n' });
    assert.notEqual(side, fork);
    assertDecision(gate(dir, { revision: side.slice(0, 12) }), 'true', /diverged/);
  });
});

describe('deploy-gate: the running revision is the checked-out commit (skipped)', () => {
  it('a 12-digit label equal to HEAD is skipped (already running)', () => {
    const dir = createRepository();
    const head = commit(dir, 'code', { 'app.txt': 'one\n' });
    assertDecision(
      gate(dir, { revision: head.slice(0, 12) }),
      'false',
      /equal to HEAD.*already running/,
    );
  });

  it('a full 40-digit label equal to HEAD is skipped (already running)', () => {
    const dir = createRepository();
    const head = commit(dir, 'code', { 'app.txt': 'one\n' });
    assertDecision(gate(dir, { revision: head }), 'false', /equal to HEAD.*already running/);
  });
});

describe('deploy-gate: a commit older than the running revision is skipped', () => {
  it('HEAD is an ancestor of the running revision', () => {
    const dir = createRepository();
    const older = commit(dir, 'code', { 'app.txt': 'one\n' });
    const running = commit(dir, 'newer code', { 'app.txt': 'two\n' });
    git(dir, 'switch', '--quiet', '--detach', older);
    const run = gate(dir, { revision: running.slice(0, 12) });
    assertDecision(run, 'false', /older than the running revision/);
  });

  it('even when the older commit changed code', () => {
    const dir = createRepository();
    const older = commit(dir, 'code', { 'src/a.ts': 'a\n' });
    const running = commit(dir, 'docs', { 'docs/a.md': 'a\n' });
    git(dir, 'switch', '--quiet', '--detach', older);
    assertDecision(gate(dir, { revision: running.slice(0, 7) }), 'false', /older/);
  });
});

describe('deploy-gate: only docs/ and .planning/ changed since the running revision', () => {
  const cases = [
    ['docs/ only', { 'docs/x.md': 'x\n' }],
    ['.planning/ only', { '.planning/y.md': 'y\n' }],
    ['docs/ and .planning/', { 'docs/x.md': 'x\n', '.planning/y.md': 'y\n' }],
    ['nested paths', { 'docs/a/b/c.md': 'c\n', '.planning/phases/06/PLAN.md': 'p\n' }],
  ];
  for (const [name, files] of cases) {
    it(`${name} skips the deploy`, () => {
      const dir = createRepository();
      const running = commit(dir, 'code', { 'app.txt': 'one\n' });
      commit(dir, 'docs', files);
      assertDecision(
        gate(dir, { revision: running.slice(0, 12) }),
        'false',
        /only docs\/ and \.planning\/ changed/,
      );
    });
  }

  it('several docs-only commits in a row skip the deploy', () => {
    const dir = createRepository();
    const running = commit(dir, 'code', { 'app.txt': 'one\n' });
    commit(dir, 'docs 1', { 'docs/a.md': 'a\n' });
    commit(dir, 'planning', { '.planning/b.md': 'b\n' });
    commit(dir, 'docs 2', { 'docs/c.md': 'c\n' });
    assertDecision(gate(dir, { revision: running.slice(0, 12) }), 'false', /3 paths/);
  });
});

describe('deploy-gate: anything else since the running revision deploys', () => {
  it('a root CONTRIBUTING.md change', () => {
    const dir = createRepository();
    const running = commit(dir, 'code', { 'app.txt': 'one\n' });
    commit(dir, 'contributing', { 'CONTRIBUTING.md': 'rules\n' });
    assertDecision(
      gate(dir, { revision: running.slice(0, 12) }),
      'true',
      /code or config changed.*CONTRIBUTING\.md/,
    );
  });

  it('a path that only starts like docs or .planning', () => {
    const dir = createRepository();
    const running = commit(dir, 'code', { 'app.txt': 'one\n' });
    commit(dir, 'lookalikes', { 'docs-extra/x.md': 'x\n', '.planning-old/y.md': 'y\n' });
    assertDecision(gate(dir, { revision: running.slice(0, 12) }), 'true', /code or config changed/);
  });

  it('a code commit followed by a docs-only tip (a superseded deploy still ships)', () => {
    const dir = createRepository();
    const running = commit(dir, 'previously deployed', { 'app.txt': 'one\n' });
    commit(dir, 'code never deployed', { 'src/b.ts': 'b\n' });
    commit(dir, 'docs only tip', { 'docs/x.md': 'x\n' });
    assertDecision(gate(dir, { revision: running.slice(0, 12) }), 'true', /src\/b\.ts/);
  });

  it('code moved into docs/ still counts as a code change', () => {
    const dir = createRepository();
    const running = commit(dir, 'code', { 'src/moved.ts': 'moved\n' });
    mkdirSync(join(dir, 'docs'), { recursive: true });
    git(dir, 'mv', 'src/moved.ts', 'docs/moved.ts');
    git(dir, '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'move');
    assertDecision(gate(dir, { revision: running.slice(0, 12) }), 'true', /src\/moved\.ts/);
  });

  it('a deleted code file', () => {
    const dir = createRepository();
    const running = commit(dir, 'code', { 'src/gone.ts': 'gone\n' });
    commit(dir, 'delete', { 'src/gone.ts': null });
    assertDecision(gate(dir, { revision: running.slice(0, 12) }), 'true', /src\/gone\.ts/);
  });

  it('a path with an odd character', () => {
    const dir = createRepository();
    const running = commit(dir, 'code', { 'app.txt': 'one\n' });
    commit(dir, 'odd', { 'docs/ok.md': 'ok\n', 'src/with spaceé.ts': 'x\n' });
    assertDecision(gate(dir, { revision: running.slice(0, 12) }), 'true', /code or config changed/);
  });
});

describe('deploy-gate: a bad HEARTH_DEPLOY_SHA is refused before anything else runs', () => {
  const marker = join(scratch, 'pwned');
  const hostile = [
    ['unset', { omitSha: true }],
    ['empty', { deploySha: '' }],
    ['a command substitution', { deploySha: `$(touch ${marker})` }],
    ['a backtick substitution', { deploySha: `\`touch ${marker}\`` }],
    ['a command separator', { deploySha: `${'a'.repeat(40)};touch ${marker}` }],
    ['an option-like value', { deploySha: '--help' }],
    ['a trailing newline', { deploySha: `${'a'.repeat(40)}\n` }],
    ['uppercase digits', { deploySha: 'A'.repeat(40) }],
    ['a short SHA', { deploySha: 'a'.repeat(12) }],
    ['a 41-digit SHA', { deploySha: 'a'.repeat(41) }],
    ['a valid SHA that is not HEAD', { deploySha: 'a'.repeat(40) }],
  ];
  for (const [name, options] of hostile) {
    it(name, () => {
      const dir = createRepository();
      commit(dir, 'code', { 'app.txt': 'one\n' });
      const run = gate(dir, { revision: 'deadbeefcafe', ...options });
      assert.notEqual(run.status, 0, `${run.stdout}\n${run.stderr}`);
      assert.equal(run.stdout, '', 'no decision may be printed');
      assert.match(run.stderr, /^deploy-gate: HEARTH_DEPLOY_SHA /);
      assert.deepEqual(run.dockerCalls, [], 'docker must not be asked before the SHA is checked');
      assert.equal(existsSync(marker), false, 'the value reached a shell');
    });
  }

  it('the previous commit of the same repository is not HEAD either', () => {
    const dir = createRepository();
    const previous = git(dir, 'rev-parse', 'HEAD');
    commit(dir, 'code', { 'app.txt': 'one\n' });
    const run = gate(dir, { revision: 'deadbeefcafe', deploySha: previous });
    assert.notEqual(run.status, 0);
    assert.equal(run.stdout, '');
    assert.match(run.stderr, /is not the checked-out HEAD/);
  });
});
