/*
 * Tests for the duplication gate: the committed `.jscpd.json` (minimum 60 tokens and 8 lines,
 * threshold 2) run through the installed `jscpd` binary against fixture trees. Every fixture
 * config is the repository's own `.jscpd.json` read at test time with only `path` replaced by the
 * fixture's `src` directory and `reporters` set to `silent`, so the committed threshold and token
 * settings are what gets exercised. Run by `pnpm test` through `test:harness`.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const JSCPD = join(REPO_ROOT, 'node_modules', '.bin', 'jscpd');
const CONFIG = JSON.parse(readFileSync(join(REPO_ROOT, '.jscpd.json'), 'utf8'));
const PACKAGE = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));

const scratch = mkdtempSync(join(tmpdir(), 'hestia-jscpd-'));
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

let fixtures = 0;

/** A TypeScript block of `lines` distinct statements; `tag` keeps two blocks from matching. */
function block(tag, lines) {
  return Array.from(
    { length: lines },
    (_, index) =>
      `export const ${tag}Value${String(index)} = compute${tag}(${String(index)}, '${tag}-${String(index)}');`,
  ).join('\n');
}

/** Builds a fixture whose `src` holds `files` (name to content) and returns the jscpd result. */
function scan(files) {
  fixtures += 1;
  const dir = join(scratch, `fixture-${String(fixtures)}`);
  const src = join(dir, 'src');
  mkdirSync(src, { recursive: true });
  for (const [name, content] of Object.entries(files)) writeFileSync(join(src, name), content);
  const config = join(dir, 'jscpd.json');
  writeFileSync(config, JSON.stringify({ ...CONFIG, path: [src], reporters: ['silent'] }));
  const run = spawnSync(JSCPD, ['--config', config, '--fail-on-empty'], {
    cwd: dir,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return { status: run.status, output: `${run.stdout}\n${run.stderr}` };
}

describe('.jscpd.json', () => {
  it('holds the Phase 2 parameters and the 2% threshold', () => {
    assert.equal(CONFIG.minTokens, 60);
    assert.equal(CONFIG.minLines, 8);
    assert.equal(CONFIG.threshold, 2);
    assert.deepEqual(CONFIG.path, ['apps', 'packages', 'e2e', 'supabase/seed']);
    assert.deepEqual(CONFIG.format, ['typescript', 'tsx']);
    assert.ok(CONFIG.ignore.includes('**/db/types.ts'));
  });

  it('is run by the root script with --fail-on-empty', () => {
    assert.equal(PACKAGE.scripts.jscpd, 'jscpd --fail-on-empty');
    assert.equal(PACKAGE.devDependencies.jscpd, '5.4.1');
  });
});

describe('jscpd with the repository settings', () => {
  it('exits 1 for two files that share an identical 40-line block', () => {
    const shared = block('shared', 40);
    const result = scan({ 'first.ts': shared, 'second.ts': shared });
    assert.equal(result.status, 1, result.output);
  });

  it('exits 0 for files that share no 8-line, 60-token sequence', () => {
    const result = scan({ 'first.ts': block('alpha', 40), 'second.ts': block('omega', 40) });
    assert.equal(result.status, 0, result.output);
  });

  it('exits 1 when the scanned directory has no TypeScript file', () => {
    const result = scan({ 'notes.md': '# nothing to scan\n' });
    assert.equal(result.status, 1, result.output);
  });
});
