/*
 * Runs a throwaway Vitest project that uses `test/clock-setup.mjs` as its setup file, so the
 * harness tests can observe the clock pin from inside a real Vitest worker. The project lives in
 * a temporary directory, so no fixture is ever picked up by a workspace's own `pnpm test`.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

const CLOCK_SETUP = join(REPO_ROOT, 'test', 'clock-setup.mjs');
// Any workspace's Vitest will do: they all pin the same version.
const VITEST_BIN = join(REPO_ROOT, 'packages', 'shared', 'node_modules', 'vitest', 'vitest.mjs');

/**
 * Writes `files` (name to source) into a fresh project and runs Vitest over it with the clock
 * setup file. `env` is layered over the parent environment minus `TZ` and `HEARTH_TEST_NOW`, so a
 * run never inherits the sweep's cell. `testConfig` is merged into the project's `test` options
 * (for example `{ isolate: false }`). Returns one entry per test (`fullName`, `status`,
 * `message`) plus the exit status and the combined output.
 */
export function runVitestProject({ files, env = {}, testConfig = {} }) {
  const directory = mkdtempSync(join(tmpdir(), 'hearth-clock-'));
  try {
    for (const [name, source] of Object.entries(files)) {
      const path = join(directory, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, source);
    }
    writeFileSync(
      join(directory, 'vitest.config.mjs'),
      `export default { test: ${JSON.stringify({
        include: ['**/*.test.mjs'],
        setupFiles: [CLOCK_SETUP],
        ...testConfig,
      })} };\n`,
    );
    const report = join(directory, 'report.json');
    const childEnvironment = { ...process.env };
    delete childEnvironment['TZ'];
    delete childEnvironment['HEARTH_TEST_NOW'];
    const run = spawnSync(
      process.execPath,
      [
        VITEST_BIN,
        'run',
        '--root',
        directory,
        '--config',
        join(directory, 'vitest.config.mjs'),
        '--reporter=json',
        '--outputFile',
        report,
      ],
      { cwd: directory, env: { ...childEnvironment, ...env }, encoding: 'utf8' },
    );

    let tests = [];
    let fileMessages = '';
    try {
      const parsed = JSON.parse(readFileSync(report, 'utf8'));
      fileMessages = parsed.testResults.map((file) => file.message).join('\n');
      tests = parsed.testResults.flatMap((file) =>
        file.assertionResults.map((result) => ({
          fullName: result.fullName,
          status: result.status,
          message: result.failureMessages.join('\n'),
        })),
      );
    } catch {
      // No report: the run failed before reporting, and the output below says why.
    }
    return {
      status: run.status,
      output: `${run.stdout}\n${run.stderr}\n${fileMessages}`,
      tests,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
