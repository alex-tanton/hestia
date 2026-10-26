/*
 * Tests for `scripts/deploy.sh`: where the database password goes when the script applies
 * migrations, and the shape of the deploy itself. A command line is public to every local user (the
 * process list) and to `set -x` and CI logs, so the password must reach the Supabase CLI through its
 * environment and appear in no argument. The deploy must also prepare the whole project before it
 * starts the supporting services, check health from inside the caddy container (nothing publishes
 * a host port) and start the tunnel connector with the supporting services. The real script runs to
 * the end against stub `docker` and `supabase` binaries placed first on PATH, with a fake env file
 * holding made-up passwords; a host HTTP client stub stays linked only so the test can prove it is
 * never called. Nothing starts a container, opens a connection or reads the host's env file. Run by
 * `pnpm test` through `test:harness`.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const DEPLOY = join(REPO_ROOT, 'scripts', 'deploy.sh');

const POSTGRES_PASSWORD = 'sentinel-Pw-9f3a7c1e5b2d';
const SERVICE_PASSWORD = 'svc-sentinel-7d41b09e';
const RESERVED_PASSWORD = 'p@ss/w:rd#1?x%y';
const DEPLOY_SHA = '0123456789abcdef0123456789abcdef01234567';

const scratch = mkdtempSync(join(tmpdir(), 'hestia-deploy-'));
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

// One stub, linked under three names. It records its arguments, the PGPASSWORD and the HESTIA_TAG
// it was given, then answers only what the script reads back: image ids, the db container and its
// address.
const STUB = `#!/usr/bin/env bash
name="$(basename "$0")"
{
  printf 'CALL\\t%s' "$name"
  printf '\\t%s' "$@"
  printf '\\n'
  printf 'ENV\\t%s\\tPGPASSWORD=%s\\n' "$name" "\${PGPASSWORD-<unset>}"
  printf 'TAG\\t%s\\t%s\\n' "$name" "\${HESTIA_TAG-<unset>}"
} >>"$STUB_LOG"
if [[ "$name" == docker ]]; then
  case "$*" in
    *"image inspect"*) echo sha256:stub ;;
    *"ps --quiet db"*) echo db-container ;;
    inspect\\ *) echo 172.16.238.5 ;;
  esac
fi
exit 0
`;

let runs = 0;
const stubDir = join(scratch, 'stub');
const binDir = join(scratch, 'bin');
mkdirSync(stubDir);
mkdirSync(binDir);
writeFileSync(join(stubDir, 'stub'), STUB);
chmodSync(join(stubDir, 'stub'), 0o755);
for (const name of ['docker', 'supabase', 'curl']) {
  symlinkSync(join(stubDir, 'stub'), join(binDir, name));
}

/** Runs the real deploy script against the stubs with the given POSTGRES_PASSWORD. */
function deploy(password) {
  runs += 1;
  const dir = join(scratch, `run-${runs}`);
  mkdirSync(dir);
  const envFile = join(dir, 'env');
  const log = join(dir, 'stub.log');
  writeFileSync(
    envFile,
    `POSTGRES_PASSWORD=${password}\nHESTIA_SERVICE_DB_PASSWORD=${SERVICE_PASSWORD}\n`,
  );
  writeFileSync(log, '');
  const run = spawnSync('bash', [DEPLOY], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'PGPASSWORD')),
      PATH: `${binDir}${delimiter}${process.env['PATH'] ?? ''}`,
      HESTIA_ENV_FILE: envFile,
      HESTIA_DEPLOY_SHA: DEPLOY_SHA,
      STUB_LOG: log,
    },
  });
  const lines = readFileSync(log, 'utf8').split('\n').filter(Boolean);
  const calls = lines
    .filter((line) => line.startsWith('CALL\t'))
    .map((line) => {
      const [, name, ...args] = line.split('\t');
      return { name, args };
    });
  const environments = lines
    .filter((line) => line.startsWith('ENV\t'))
    .map((line) => {
      const [, name, value] = line.split('\t');
      return { name, value };
    });
  // One TAG line follows every CALL line, so tags[i] belongs to calls[i].
  const tags = lines.filter((line) => line.startsWith('TAG\t')).map((line) => line.split('\t')[2]);
  return { status: run.status, stdout: run.stdout, stderr: run.stderr, calls, environments, tags };
}

function migrationCall(result) {
  return result.calls.find(
    (call) => call.name === 'supabase' && call.args.slice(0, 2).join(' ') === 'migration up',
  );
}

describe('deploy.sh: the database password', () => {
  let result;
  before(() => {
    result = deploy(POSTGRES_PASSWORD);
  });

  it('runs to the end against the stubs', () => {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.ok(migrationCall(result), 'no `supabase migration up` call was logged');
  });

  it('is on no command line', () => {
    assert.ok(result.calls.length > 0, 'no stub was called');
    for (const call of result.calls) {
      for (const arg of call.args) {
        assert.ok(!arg.includes(POSTGRES_PASSWORD), `${call.name} was given the password`);
        assert.ok(!arg.includes(SERVICE_PASSWORD), `${call.name} was given the service password`);
      }
    }
  });

  it('is not printed by the script either', () => {
    for (const output of [result.stdout, result.stderr]) {
      assert.ok(!output.includes(POSTGRES_PASSWORD));
      assert.ok(!output.includes(SERVICE_PASSWORD));
    }
  });

  it('reaches the migration command through its environment, and nothing else', () => {
    const supabase = result.environments.filter((entry) => entry.name === 'supabase');
    assert.ok(supabase.length > 0, 'the supabase stub logged no environment');
    for (const entry of supabase) {
      assert.equal(entry.value, `PGPASSWORD=${POSTGRES_PASSWORD}`);
    }
    const others = result.environments.filter((entry) => entry.name !== 'supabase');
    assert.ok(others.length > 0, 'no other stub logged an environment');
    for (const entry of others) {
      assert.equal(entry.value, 'PGPASSWORD=<unset>', `${entry.name} saw PGPASSWORD`);
    }
  });

  it('leaves the connection string as user and host only', () => {
    const args = migrationCall(result)?.args ?? [];
    const index = args.indexOf('--db-url');
    assert.notEqual(index, -1, 'the migration call has no --db-url');
    const url = new URL(args[index + 1] ?? '');
    assert.equal(url.username, 'postgres');
    assert.equal(url.password, '');
    assert.equal(url.host, '172.16.238.5:5432');
  });
});

describe('deploy.sh: a password with URL-reserved characters', () => {
  it('arrives intact, which a password inside a URL would not', () => {
    const reserved = deploy(RESERVED_PASSWORD);
    assert.equal(reserved.status, 0, `${reserved.stdout}\n${reserved.stderr}`);
    const supabase = reserved.environments.filter((entry) => entry.name === 'supabase');
    assert.ok(supabase.length > 0, 'the supabase stub logged no environment');
    for (const entry of supabase) {
      assert.equal(entry.value, `PGPASSWORD=${RESERVED_PASSWORD}`);
    }
    const args = migrationCall(reserved)?.args ?? [];
    for (const arg of args) {
      assert.ok(!arg.includes(RESERVED_PASSWORD), 'the password is in the arguments');
    }
  });
});

describe('deploy.sh: the health gate and the tunnel', () => {
  let result;
  let docker;
  const argsOf = (call) => call.args.join(' ');
  const indexOfCall = (predicate) => docker.findIndex(predicate);
  before(() => {
    result = deploy(POSTGRES_PASSWORD);
    docker = result.calls.filter((call) => call.name === 'docker');
  });

  it('prepares every container and the network before the supporting services start', () => {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const prepare = result.calls
      .map((call, index) => ({ call, index }))
      .filter(
        ({ call }) =>
          call.name === 'docker' &&
          argsOf(call).endsWith(' up --no-start --no-recreate --no-build'),
      );
    assert.equal(prepare.length, 1, 'expected exactly one whole-project prepare call');
    const [{ index }] = prepare;
    assert.equal(result.tags[index], DEPLOY_SHA.slice(0, 12));
    const build = result.calls.findIndex(
      (call) => call.name === 'docker' && call.args.includes('build'),
    );
    const start = result.calls.findIndex(
      (call) =>
        call.name === 'docker' &&
        argsOf(call).includes('up --detach --wait --no-recreate --no-build'),
    );
    assert.ok(build !== -1 && build < index, 'the prepare call does not follow the build');
    assert.ok(start !== -1 && index < start, 'the prepare call does not precede the start');
  });

  it('checks /api/health inside the caddy container, never through a host port', () => {
    const check = docker.find((call) => {
      const wanted = ['compose', 'exec', '-T', 'caddy', 'wget'];
      return wanted.every((arg) => call.args.includes(arg));
    });
    assert.ok(check, `no in-container health check was logged:\n${docker.map(argsOf).join('\n')}`);
    assert.equal(check.args.at(-1), 'http://127.0.0.1:8080/api/health');
    const hostClient = result.calls.filter((call) => call.name === 'curl');
    assert.equal(hostClient.length, 0, 'the host HTTP client was called');
  });

  it('starts cloudflared with the supporting services before anything is restarted', () => {
    const start = indexOfCall((call) => argsOf(call).includes('up --detach --wait --no-recreate'));
    assert.notEqual(start, -1, 'no supporting-services start was logged');
    const named = docker[start]?.args ?? [];
    for (const service of ['db', 'auth', 'realtime', 'kong', 'backup', 'cloudflared']) {
      assert.ok(named.includes(service), `${service} is not in the supporting-services start`);
    }
    const backup = indexOfCall((call) => argsOf(call).endsWith('exec -T backup /backup.sh'));
    const restart = indexOfCall((call) =>
      argsOf(call).endsWith('up --detach --no-deps --no-build hestia-service caddy'),
    );
    assert.ok(backup > start, 'the backup does not follow the supporting-services start');
    assert.ok(restart > start, 'the restart does not follow the supporting-services start');
  });
});
