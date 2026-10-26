/*
 * Tests for `docker/caddy-entrypoint.sh`, which starts Caddy in production. It must refuse an
 * origin that is not https and a missing or empty trust list before Caddy starts (an empty trust
 * list is accepted silently by Caddy, and every visitor would then share the tunnel connector's
 * address), and it derives the CSP's WebSocket host from the origin. The real script runs under
 * `sh` against a stub `caddy` placed first on PATH, so no Caddy starts. Run by `pnpm test` through
 * `test:harness`.
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
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const ENTRYPOINT = join(REPO_ROOT, 'docker', 'caddy-entrypoint.sh');
const ORIGIN = 'https://hestia.aberrance.app';
const SUBNET = '172.16.238.0/24';

const scratch = mkdtempSync(join(tmpdir(), 'hestia-caddy-entrypoint-'));
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

// The stub records what the real `caddy` would have been started with.
const binDir = join(scratch, 'bin');
mkdirSync(binDir);
writeFileSync(
  join(binDir, 'caddy'),
  `#!/bin/sh
{
  printf 'HESTIA_HOST=%s\\n' "\${HESTIA_HOST-<unset>}"
  printf 'HESTIA_TRUSTED_PROXIES=%s\\n' "\${HESTIA_TRUSTED_PROXIES-<unset>}"
  printf 'ARGS=%s\\n' "$*"
} >"$STUB_LOG"
`,
);
chmodSync(join(binDir, 'caddy'), 0o755);

let runs = 0;

/** Runs the real entrypoint with only the HESTIA_* values a case sets. */
function entrypoint(values) {
  runs += 1;
  const log = join(scratch, `run-${runs}.log`);
  const run = spawnSync('sh', [ENTRYPOINT], {
    encoding: 'utf8',
    env: {
      PATH: `${binDir}${delimiter}${process.env['PATH'] ?? ''}`,
      STUB_LOG: log,
      ...values,
    },
  });
  const seen = existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : null;
  return { status: run.status, stderr: run.stderr, seen };
}

describe('caddy-entrypoint.sh', () => {
  it('derives HESTIA_HOST from the origin and runs Caddy with the baked-in Caddyfile', () => {
    const result = entrypoint({ HESTIA_ORIGIN: ORIGIN, HESTIA_TRUSTED_PROXIES: SUBNET });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.seen, [
      'HESTIA_HOST=hestia.aberrance.app',
      `HESTIA_TRUSTED_PROXIES=${SUBNET}`,
      'ARGS=run --config /etc/caddy/Caddyfile --adapter caddyfile',
    ]);
  });

  it('drops a trailing slash from the origin', () => {
    const result = entrypoint({ HESTIA_ORIGIN: `${ORIGIN}/`, HESTIA_TRUSTED_PROXIES: SUBNET });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.seen?.[0], 'HESTIA_HOST=hestia.aberrance.app');
  });

  it('refuses an origin that is not https, before Caddy starts', () => {
    for (const values of [
      { HESTIA_ORIGIN: 'http://127.0.0.1:8080', HESTIA_TRUSTED_PROXIES: SUBNET },
      { HESTIA_TRUSTED_PROXIES: SUBNET },
    ]) {
      const result = entrypoint(values);
      assert.equal(result.status, 1, JSON.stringify(values));
      assert.ok(result.stderr.includes(ORIGIN), result.stderr);
      assert.equal(result.seen, null, 'Caddy was started');
    }
  });

  it('refuses an empty or missing trust list, before Caddy starts', () => {
    for (const values of [
      { HESTIA_ORIGIN: ORIGIN },
      { HESTIA_ORIGIN: ORIGIN, HESTIA_TRUSTED_PROXIES: '' },
    ]) {
      const result = entrypoint(values);
      assert.equal(result.status, 1, JSON.stringify(values));
      assert.ok(result.stderr.includes('HESTIA_TRUSTED_PROXIES'), result.stderr);
      assert.equal(result.seen, null, 'Caddy was started');
    }
  });
});
