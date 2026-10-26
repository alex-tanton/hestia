/*
 * Tests for `scripts/ci-prepull-images.sh`, the image pre-pull in CI's `test-e2e` job. The three
 * Supabase images are pulled from ghcr.io/supabase first and tagged with their public.ecr.aws names,
 * because anonymous public.ecr.aws pulls are rate limited per IP and hosted runners share IPs;
 * public.ecr.aws stays the fallback. The real script runs against stub `docker` and `sleep`
 * binaries placed first on PATH, in fixture `docker/` folders, so nothing pulls an image or needs
 * a Docker daemon. Run by `pnpm test` through `test:harness`.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
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
const SCRIPT = join(REPO_ROOT, 'scripts', 'ci-prepull-images.sh');

const ECR = 'public.ecr.aws/supabase/';
const GHCR = 'ghcr.io/supabase/';
const POSTGRES = 'postgres:1.0.0.1';
const GOTRUE = 'gotrue:v1.0.0';
const REALTIME = 'realtime:v1.0.0';
const SUPABASE = [POSTGRES, GOTRUE, REALTIME];
const HUB = ['caddy:1.0.0-alpine', 'docker/dockerfile:1', 'kong/kong:1.0.0', 'node:1.0.0-slim'];

const scratch = mkdtempSync(join(tmpdir(), 'hestia-prepull-'));
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

// One stub, linked under two names. It records its arguments, then answers only what the script
// asks: whether an image is present, and whether a pull is refused the way a registry would.
const STUB = `#!/usr/bin/env bash
name="$(basename "$0")"
{
  printf 'CALL\\t%s' "$name"
  printf '\\t%s' "$@"
  printf '\\n'
} >>"$STUB_LOG"
[[ "$name" == docker ]] || exit 0
case "\${1-}" in
  image)
    [[ "\${2-}" == inspect ]] && grep -qxF -- "\${3-}" "$STUB_PRESENT"
    exit $?
    ;;
  pull)
    ref="\${2-}"
    limit=$(awk -v r="$ref" '$1 == r { print $2 }' "$STUB_FAILS")
    if [[ -n "$limit" ]]; then
      seen=$(grep -cxF -- "$(printf 'CALL\\tdocker\\tpull\\t%s' "$ref")" "$STUB_LOG")
      if (( seen <= limit )); then
        echo 'Error response from daemon: toomanyrequests: Data limit exceeded' >&2
        exit 1
      fi
    fi
    ;;
esac
exit 0
`;

const stubDir = join(scratch, 'stub');
const binDir = join(scratch, 'bin');
mkdirSync(stubDir);
mkdirSync(binDir);
writeFileSync(join(stubDir, 'stub'), STUB);
chmodSync(join(stubDir, 'stub'), 0o755);
for (const name of ['docker', 'sleep']) {
  symlinkSync(join(stubDir, 'stub'), join(binDir, name));
}

let fixtures = 0;

/** Writes a fixture repository root holding only `docker/`, and returns its path. */
function fixture(extraComposeLines = '') {
  fixtures += 1;
  const root = join(scratch, `fixture-${fixtures}`);
  mkdirSync(join(root, 'docker'), { recursive: true });
  writeFileSync(
    join(root, 'docker', 'docker-compose.yml'),
    `services:
  db:
    image: ${ECR}${POSTGRES}
  auth:
    image: ${ECR}${GOTRUE}
  realtime:
    image: ${ECR}${REALTIME}
  kong:
    image: kong/kong:1.0.0
  hestia-service:
    image: hestia-service:\${HESTIA_TAG:-current}
    build:
      context: ..
  caddy:
    image: hestia-caddy:\${HESTIA_TAG:-current}
    build:
      context: ..
  backup:
    image: prodrigestivill/postgres-backup-local:1-debian-test
${extraComposeLines}`,
  );
  writeFileSync(
    join(root, 'docker', 'service.Dockerfile'),
    `# syntax=docker/dockerfile:1
FROM node:1.0.0-slim AS source
FROM source AS build
FROM node:1.0.0-slim
`,
  );
  writeFileSync(
    join(root, 'docker', 'caddy.Dockerfile'),
    `# syntax=docker/dockerfile:1
FROM node:1.0.0-slim AS build
FROM --platform=linux/amd64 caddy:1.0.0-alpine
`,
  );
  return root;
}

let runs = 0;

/**
 * Runs the real script against the stubs. `present` lists images `docker image inspect` finds,
 * `fails` maps an image to how many of its first pulls are refused, and `scale` is the delay scale
 * (`null` leaves it unset so the script's own default applies).
 */
function prepull({ cwd, present = [], fails = {}, scale = '0' }) {
  runs += 1;
  const dir = join(scratch, `run-${runs}`);
  mkdirSync(dir);
  const log = join(dir, 'stub.log');
  const presentFile = join(dir, 'present');
  const failsFile = join(dir, 'fails');
  writeFileSync(log, '');
  writeFileSync(presentFile, present.map((ref) => `${ref}\n`).join(''));
  writeFileSync(
    failsFile,
    Object.entries(fails)
      .map(([ref, count]) => `${ref} ${count}\n`)
      .join(''),
  );
  const env = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key !== 'CI_PREPULL_DELAY_SCALE'),
    ),
    PATH: `${binDir}${delimiter}${process.env['PATH'] ?? ''}`,
    STUB_LOG: log,
    STUB_PRESENT: presentFile,
    STUB_FAILS: failsFile,
  };
  if (scale !== null) env['CI_PREPULL_DELAY_SCALE'] = scale;
  const run = spawnSync('bash', [SCRIPT], { cwd, encoding: 'utf8', env });
  const calls = readFileSync(log, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [, name, ...args] = line.split('\t');
      return { name, args };
    });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr, calls };
}

const dockerCalls = (result, verb) =>
  result.calls.filter((call) => call.name === 'docker' && call.args[0] === verb);
const pullsOf = (result, ref) => dockerCalls(result, 'pull').filter((call) => call.args[1] === ref);
const tagsOf = (result, source, target) =>
  dockerCalls(result, 'tag').filter((call) => call.args[1] === source && call.args[2] === target);
const describeCall = (call) => [call.name, ...call.args].join(' ');
const output = (result) => `${result.stdout}\n${result.stderr}`;

describe('ci-prepull-images.sh: a clean run', () => {
  let result;
  before(() => {
    result = prepull({ cwd: fixture() });
  });

  it('pulls each public.ecr.aws/supabase image from ghcr.io first and tags it with its ECR name', () => {
    assert.equal(result.status, 0, output(result));
    for (const ref of SUPABASE) {
      const ecr = `${ECR}${ref}`;
      const ghcr = `${GHCR}${ref}`;
      const log = result.calls.map(describeCall);
      const pulled = log.indexOf(`docker pull ${ghcr}`);
      assert.notEqual(pulled, -1, `${ghcr} was never pulled`);
      assert.equal(log[pulled + 1], `docker tag ${ghcr} ${ecr}`, `${ghcr} was not tagged ${ecr}`);
      assert.equal(pullsOf(result, ecr).length, 0, `${ecr} was pulled`);
    }
    const ghcrArgs = result.calls
      .flatMap((call) => call.args)
      .filter((arg) => arg.includes('ghcr.io/'));
    assert.equal(ghcrArgs.length, SUPABASE.length * 2, ghcrArgs.join(' '));
    for (const call of result.calls) {
      assert.equal(call.name, 'docker', describeCall(call));
      assert.ok(['image', 'pull', 'tag'].includes(call.args[0]), describeCall(call));
    }
  });

  it('pulls Docker Hub images directly with no ghcr.io attempt', () => {
    assert.equal(result.status, 0, output(result));
    for (const ref of HUB) {
      assert.equal(pullsOf(result, ref).length, 1, `${ref} was not pulled exactly once`);
    }
    const ghcrArgs = result.calls
      .flatMap((call) => call.args)
      .filter((arg) => arg.includes('ghcr.io/'));
    for (const arg of ghcrArgs) assert.ok(arg.startsWith(GHCR), arg);
  });

  it('never pulls the hestia-built images, the backup image or a build stage', () => {
    assert.equal(result.status, 0, output(result));
    assert.ok(result.calls.length > 0, 'no stub was called');
    for (const arg of result.calls.flatMap((call) => call.args)) {
      assert.ok(!arg.startsWith('hestia-'), arg);
      assert.ok(!arg.startsWith('prodrigestivill/'), arg);
      assert.notEqual(arg, 'source');
    }
  });
});

describe('ci-prepull-images.sh: the tunnel connector', () => {
  it('never pulls the tunnel connector, which E2E never starts', () => {
    const root = fixture('  cloudflared:\n    image: cloudflare/cloudflared:1.0.0\n');
    const result = prepull({ cwd: root });
    assert.equal(result.status, 0, output(result));
    assert.ok(result.calls.length > 0, 'no stub was called');
    for (const arg of result.calls.flatMap((call) => call.args)) {
      assert.ok(!arg.startsWith('cloudflare/'), arg);
    }
  });
});

describe('ci-prepull-images.sh: fallbacks and retries', () => {
  it('falls back to public.ecr.aws when the ghcr.io pull fails', () => {
    const ecr = `${ECR}${GOTRUE}`;
    const ghcr = `${GHCR}${GOTRUE}`;
    const result = prepull({ cwd: fixture(), fails: { [ghcr]: 999 } });
    assert.equal(result.status, 0, output(result));
    const log = result.calls.map(describeCall);
    const mirror = log.indexOf(`docker pull ${ghcr}`);
    const fallback = log.indexOf(`docker pull ${ecr}`);
    assert.notEqual(mirror, -1);
    assert.ok(fallback > mirror, `the ECR pull did not follow the mirror pull:\n${log.join('\n')}`);
    assert.equal(pullsOf(result, ecr).length, 1);
    assert.equal(tagsOf(result, ghcr, ecr).length, 0);
  });

  it('tries ghcr.io again in every attempt before public.ecr.aws', () => {
    const ecr = `${ECR}${GOTRUE}`;
    const ghcr = `${GHCR}${GOTRUE}`;
    const result = prepull({ cwd: fixture(), fails: { [ghcr]: 1, [ecr]: 999 } });
    assert.equal(result.status, 0, output(result));
    const relevant = result.calls
      .filter((call) => call.name === 'sleep' || ['pull', 'tag'].includes(call.args[0]))
      .filter((call) => call.name === 'sleep' || call.args.some((arg) => arg.includes('/gotrue:')))
      .map(describeCall);
    assert.deepEqual(relevant, [
      `docker pull ${ghcr}`,
      `docker pull ${ecr}`,
      'sleep 0',
      `docker pull ${ghcr}`,
      `docker tag ${ghcr} ${ecr}`,
    ]);
    assert.equal(pullsOf(result, ecr).length, 1);
  });

  it('skips an image that is already present', () => {
    const present = [`${ECR}${POSTGRES}`, 'kong/kong:1.0.0'];
    const result = prepull({ cwd: fixture(), present });
    assert.equal(result.status, 0, output(result));
    for (const ref of present) {
      assert.equal(
        dockerCalls(result, 'image').filter((call) => call.args[2] === ref).length,
        1,
        `${ref} was not inspected`,
      );
      assert.equal(pullsOf(result, ref).length, 0, `${ref} was pulled`);
    }
    const mirror = `${GHCR}${POSTGRES}`;
    assert.equal(pullsOf(result, mirror).length, 0, `${mirror} was pulled`);
    assert.equal(tagsOf(result, mirror, `${ECR}${POSTGRES}`).length, 0);
  });

  it('stops after six attempts with an ::error:: annotation naming the image', () => {
    const ecr = `${ECR}${GOTRUE}`;
    const result = prepull({
      cwd: fixture(),
      scale: null,
      fails: { [`${GHCR}${GOTRUE}`]: 999, [ecr]: 999 },
    });
    assert.notEqual(result.status, 0);
    assert.ok(
      result.stdout.includes(`::error::Could not pull ${ecr} after 6 attempts`),
      output(result),
    );
    assert.equal(pullsOf(result, ecr).length, 6);
    const delays = result.calls.filter((call) => call.name === 'sleep').map((call) => call.args[0]);
    assert.equal(delays.join(' '), '30 60 90 120 150');
  });

  it('retries a failed pull and scales the delay by CI_PREPULL_DELAY_SCALE', () => {
    const result = prepull({ cwd: fixture(), scale: '0', fails: { 'kong/kong:1.0.0': 2 } });
    assert.equal(result.status, 0, output(result));
    assert.equal(pullsOf(result, 'kong/kong:1.0.0').length, 3);
    const delays = result.calls.filter((call) => call.name === 'sleep').map((call) => call.args[0]);
    assert.equal(delays.join(' '), '0 0');
    assert.ok(result.stdout.includes('attempt 2 of 6'), result.stdout);

    const scaled = prepull({ cwd: fixture(), scale: '2', fails: { 'kong/kong:1.0.0': 2 } });
    assert.equal(scaled.status, 0, output(scaled));
    const scaledDelays = scaled.calls
      .filter((call) => call.name === 'sleep')
      .map((call) => call.args[0]);
    assert.equal(scaledDelays.join(' '), '60 120');

    const bad = prepull({ cwd: fixture(), scale: 'x' });
    assert.notEqual(bad.status, 0);
    assert.ok(/::error::.*CI_PREPULL_DELAY_SCALE/.test(bad.stdout), output(bad));
    assert.equal(dockerCalls(bad, 'pull').length, 0);
  });
});

describe('ci-prepull-images.sh: unsafe input', () => {
  it('refuses an image name that is not a plain reference before pulling anything', () => {
    const canary = join(scratch, 'canary');
    const root = fixture(`    image: kong/kong:1.0.0;touch ${canary}\n`);
    const result = prepull({ cwd: root });
    assert.notEqual(result.status, 0);
    assert.ok(result.stdout.includes('::error::'), output(result));
    assert.equal(dockerCalls(result, 'pull').length, 0);
    assert.equal(existsSync(canary), false, 'the canary file was created');
  });
});

describe('ci-prepull-images.sh: the real docker/ files', () => {
  it('sends every Supabase image in the real docker/ files through ghcr.io', () => {
    const compose = readFileSync(join(REPO_ROOT, 'docker', 'docker-compose.yml'), 'utf8');
    const images = [
      ...compose.matchAll(/^\s*image:\s*(public\.ecr\.aws\/supabase\/\S+)\s*$/gm),
    ].map((match) => match[1]);
    assert.ok(images.length >= 1, 'no public.ecr.aws/supabase image found in docker-compose.yml');
    const result = prepull({ cwd: REPO_ROOT });
    assert.equal(result.status, 0, output(result));
    for (const ecr of images) {
      const ghcr = ecr.replace('public.ecr.aws/', 'ghcr.io/');
      assert.equal(pullsOf(result, ghcr).length, 1, `${ghcr} was not pulled once`);
      assert.equal(tagsOf(result, ghcr, ecr).length, 1, `${ghcr} was not tagged ${ecr}`);
      assert.equal(pullsOf(result, ecr).length, 0, `${ecr} was pulled`);
    }
  });
});
