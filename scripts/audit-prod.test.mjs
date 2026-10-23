/*
 * Tests for `scripts/audit-prod.mjs`, the `pnpm audit --prod` gate. The script runs as a child
 * process. Reports are built from the verified shape of `pnpm audit --prod --json`, with the braces
 * advisory as the advisory under test, and every case passes `--today 2026-10-22`. Two cases put a
 * stub `pnpm` first on PATH so no registry is contacted. Run by `pnpm test` through `test:harness`.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'audit-prod.mjs');
const TODAY = '2026-10-22';

const BRACES_ID = 'GHSA-vfj7-8cjw-p6xm';
const BRACES_PATH = 'apps__service>kysely-codegen>micromatch>braces';

const scratch = mkdtempSync(join(tmpdir(), 'hearth-audit-prod-'));
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

const CLEAN_REPORT = {
  actions: [],
  advisories: {},
  muted: [],
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 },
    totalDependencies: 218,
  },
};

const BRACES_REPORT = {
  ...CLEAN_REPORT,
  advisories: {
    1240992: {
      id: 1240992,
      github_advisory_id: BRACES_ID,
      module_name: 'braces',
      severity: 'high',
      vulnerable_versions: '<=3.0.3',
      patched_versions: '<0.0.0',
      findings: [{ version: '3.0.3', paths: [BRACES_PATH] }],
    },
  },
};

let files = 0;

/** Writes `content` (a string, or an object as JSON) to a fresh file and returns its path. */
function write(content) {
  files += 1;
  const file = join(scratch, `file-${files}`);
  writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}

const entry = (overrides = {}) => ({
  id: BRACES_ID,
  expires: '2026-12-01',
  reason: 'fixture',
  ...overrides,
});

/** Runs the script with a saved report and an allowlist; `extra` appends raw arguments. */
function audit({ report = CLEAN_REPORT, reportFile, allow = [], extra = [], env = {} } = {}) {
  const args = [
    SCRIPT,
    '--report',
    reportFile ?? write(report),
    '--allowlist',
    write({ allow }),
    '--today',
    TODAY,
    ...extra,
  ];
  return run(args, env);
}

function run(args, env = {}) {
  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const output = (result) => `${result.stdout}\n${result.stderr}`;

describe('audit-prod.mjs: decisions', () => {
  it('passes an empty report with an empty allowlist', () => {
    const result = audit();
    assert.equal(result.status, 0, output(result));
    assert.ok(result.stdout.includes('audit-prod: 0 advisories, 0 allowed, 0 problems'));
  });

  it('fails an advisory that has no allowlist entry and names it with its path', () => {
    const result = audit({ report: BRACES_REPORT });
    assert.equal(result.status, 1, output(result));
    assert.ok(
      result.stderr.includes(`${BRACES_ID} braces (high) via ${BRACES_PATH}`),
      result.stderr,
    );
    assert.ok(result.stderr.includes('is not allowlisted'));
    assert.ok(result.stdout.includes('1 advisories, 0 allowed, 1 problems'), result.stdout);
  });

  it('passes an advisory whose allowance expires today, with a note', () => {
    const result = audit({ report: BRACES_REPORT, allow: [entry({ expires: TODAY })] });
    assert.equal(result.status, 0, output(result));
    assert.ok(result.stdout.includes(`${BRACES_ID} braces allowed until ${TODAY}: fixture`));
    assert.ok(result.stdout.includes('1 advisories, 1 allowed, 0 problems'), result.stdout);
  });

  it('fails an advisory whose allowance expired yesterday', () => {
    const result = audit({ report: BRACES_REPORT, allow: [entry({ expires: '2026-10-21' })] });
    assert.equal(result.status, 1, output(result));
    assert.ok(
      result.stderr.includes(`${BRACES_ID} allowance expired on 2026-10-21`),
      result.stderr,
    );
  });

  it('fails an expired entry that matches no advisory and notes an unexpired one', () => {
    const expired = audit({ allow: [entry({ expires: '2026-10-21' })] });
    assert.equal(expired.status, 1, output(expired));
    assert.ok(expired.stderr.includes('matches no advisory, delete it'), expired.stderr);

    const valid = audit({ allow: [entry({ expires: '2026-12-01' })] });
    assert.equal(valid.status, 0, output(valid));
    assert.ok(valid.stdout.includes(`${BRACES_ID} matches no advisory; delete it`), valid.stdout);
  });

  it('judges the allowlist by the injected date, not the clock', () => {
    const allow = write({ allow: [entry({ expires: '2026-11-01' })] });
    const report = write(BRACES_REPORT);
    const before = run([SCRIPT, '--report', report, '--allowlist', allow, '--today', '2026-11-01']);
    assert.equal(before.status, 0, output(before));
    const after = run([SCRIPT, '--report', report, '--allowlist', allow, '--today', '2026-11-02']);
    assert.equal(after.status, 1, output(after));
  });
});

describe('audit-prod.mjs: a report that cannot be trusted exits 2', () => {
  const cases = [
    ['an error object', { error: { code: 'ECONNREFUSED', message: 'stub' } }],
    ['no advisories object', { actions: [], muted: [] }],
    ['advisories that is not an object', { advisories: [] }],
    ['text that is not JSON', 'not json at all'],
    ['a JSON array', []],
  ];
  for (const [name, report] of cases) {
    it(`fails closed on ${name}`, () => {
      const result = audit({ report });
      assert.equal(result.status, 2, output(result));
      assert.ok(result.stderr.includes('audit-prod: pnpm audit is unavailable'), result.stderr);
    });
  }

  it('reports the error code and message of an error object', () => {
    const result = audit({ report: { error: { code: 'ECONNREFUSED', message: 'stub' } } });
    assert.ok(result.stderr.includes('ECONNREFUSED stub'), result.stderr);
  });

  it('fails when the report file does not exist', () => {
    const result = audit({ reportFile: join(scratch, 'missing.json') });
    assert.equal(result.status, 2, output(result));
  });
});

describe('audit-prod.mjs: allowlist validation exits 2', () => {
  const bad = [
    ['an entry without a reason', [{ id: BRACES_ID, expires: '2026-12-01' }]],
    ['an entry with a blank reason', [entry({ reason: '  ' })]],
    ['a bad id', [entry({ id: 'GHSA-nope' })]],
    ['an impossible date', [entry({ expires: '2026-02-30' })]],
    ['a date in another shape', [entry({ expires: '22-10-2026' })]],
    ['an allowance 181 days ahead', [entry({ expires: '2027-04-21' })]],
    ['a duplicated id', [entry(), entry()]],
    ['an entry that is not an object', ['GHSA-vfj7-8cjw-p6xm']],
  ];
  for (const [name, allow] of bad) {
    it(`rejects ${name}`, () => {
      const result = audit({ allow });
      assert.equal(result.status, 2, output(result));
      assert.ok(/audit-prod: allowlist \S+: /.test(result.stderr), result.stderr);
    });
  }

  it('accepts an allowance exactly 180 days ahead', () => {
    const result = audit({ allow: [entry({ expires: '2027-04-20' })] });
    assert.equal(result.status, 0, output(result));
  });

  it('rejects an allowlist that is not an object with an allow array', () => {
    for (const content of ['[]', '{"allow": {}}', '{', '{"entries": []}']) {
      const result = run([
        SCRIPT,
        '--report',
        write(CLEAN_REPORT),
        '--allowlist',
        write(content),
        '--today',
        TODAY,
      ]);
      assert.equal(result.status, 2, `${content}: ${output(result)}`);
    }
  });

  it('rejects a missing allowlist file', () => {
    const result = run([
      SCRIPT,
      '--report',
      write(CLEAN_REPORT),
      '--allowlist',
      join(scratch, 'missing.json'),
      '--today',
      TODAY,
    ]);
    assert.equal(result.status, 2, output(result));
  });

  it('ships an empty allowlist', () => {
    const shipped = JSON.parse(
      readFileSync(join(REPO_ROOT, 'scripts', 'audit-allowlist.json'), 'utf8'),
    );
    assert.deepEqual(shipped, { allow: [] });
  });
});

describe('audit-prod.mjs: usage', () => {
  it('rejects an impossible --today and an unknown flag', () => {
    const report = write(CLEAN_REPORT);
    const date = run([SCRIPT, '--report', report, '--today', '2026-13-01']);
    assert.equal(date.status, 2, output(date));
    const shape = run([SCRIPT, '--report', report, '--today', 'yesterday']);
    assert.equal(shape.status, 2, output(shape));
    const flag = run([SCRIPT, '--report', report, '--bogus']);
    assert.equal(flag.status, 2, output(flag));
    const missing = run([SCRIPT, '--report']);
    assert.equal(missing.status, 2, output(missing));
  });
});

describe('audit-prod.mjs: running pnpm', () => {
  const bin = join(scratch, 'bin');
  mkdirSync(bin);
  // Records its arguments, then prints the canned output and exits with the canned status.
  writeFileSync(
    join(bin, 'pnpm'),
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >>"$STUB_LOG"
cat "$STUB_OUTPUT"
exit "\${STUB_EXIT:-0}"
`,
  );
  chmodSync(join(bin, 'pnpm'), 0o755);

  function withStub(output, status = '0') {
    const log = write('');
    const env = {
      PATH: `${bin}${delimiter}${process.env['PATH'] ?? ''}`,
      STUB_LOG: log,
      STUB_OUTPUT: write(output),
      STUB_EXIT: status,
      AUDIT_RETRY_DELAY_SCALE: '0',
    };
    const result = run([SCRIPT, '--allowlist', write({ allow: [] }), '--today', TODAY], env);
    const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean);
    return { result, calls };
  }

  it('calls `pnpm audit --prod --json` once for a clean report and exits 0', () => {
    const { result, calls } = withStub(JSON.stringify(CLEAN_REPORT));
    assert.equal(result.status, 0, output(result));
    assert.deepEqual(calls, ['audit --prod --json']);
  });

  it('ignores pnpm exit status 1 and decides from the report', () => {
    const clean = withStub(JSON.stringify(CLEAN_REPORT), '1');
    assert.equal(clean.result.status, 0, output(clean.result));
    const found = withStub(JSON.stringify(BRACES_REPORT), '1');
    assert.equal(found.result.status, 1, output(found.result));
    assert.equal(found.calls.length, 1);
  });

  it('tries three times on an error object, then exits 2', () => {
    const { result, calls } = withStub('{"error":{"code":"ECONNREFUSED","message":"stub"}}');
    assert.equal(result.status, 2, output(result));
    assert.equal(calls.length, 3, calls.join('\n'));
    assert.ok(result.stderr.includes('attempt 3 of 3'), result.stderr);
    assert.ok(result.stderr.includes('audit-prod: pnpm audit is unavailable'), result.stderr);
  });

  it('rejects a bad AUDIT_RETRY_DELAY_SCALE', () => {
    const log = write('');
    const result = run([SCRIPT, '--allowlist', write({ allow: [] }), '--today', TODAY], {
      PATH: `${bin}${delimiter}${process.env['PATH'] ?? ''}`,
      STUB_LOG: log,
      STUB_OUTPUT: write('{"error":{}}'),
      AUDIT_RETRY_DELAY_SCALE: 'x',
    });
    assert.equal(result.status, 2, output(result));
  });
});
