/*
 * Proves the composite setup action is a pure refactor: expanding it back into every job that calls
 * it must reproduce the original workflow exactly.
 *
 * Usage: node expand-compare.mjs {old-ci.yml} {new-ci.yml} {action.yml}
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ACTION_USES = './.github/actions/setup';

// yaml is a dependency of the service workspace, so it is resolved from there.
const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const require = createRequire(resolve(root, 'apps/service/package.json'));
const { parse } = require('yaml');

const [oldPath, newPath, actionPath] = process.argv.slice(2);
if (!oldPath || !newPath || !actionPath) {
  console.error('usage: node expand-compare.mjs {old-ci.yml} {new-ci.yml} {action.yml}');
  process.exit(2);
}

const load = (path) => parse(readFileSync(path, 'utf8'));

try {
  const oldWorkflow = load(oldPath);
  const newWorkflow = load(newPath);
  const action = load(actionPath);

  assert.equal(action.runs?.using, 'composite', 'the action is not a composite action');
  // `shell` exists only on composite steps, so it is dropped when a step goes back into a job.
  const expandedSteps = action.runs.steps.map((step) => {
    const copy = structuredClone(step);
    delete copy.shell;
    return copy;
  });

  assert.equal(newWorkflow.name, 'CI', 'the workflow must stay named CI');

  const expanded = structuredClone(newWorkflow);
  for (const job of Object.values(expanded.jobs)) {
    job.steps = job.steps.flatMap((step) => (step.uses === ACTION_USES ? expandedSteps : [step]));
  }

  assert.deepEqual(
    Object.keys(newWorkflow.jobs),
    Object.keys(oldWorkflow.jobs),
    'the job ids, in order, changed',
  );
  assert.deepEqual(expanded, oldWorkflow, 'the expanded workflow differs from the original');

  console.log(
    `OK: expanded workflow deep-equals the original; jobs: ${Object.keys(newWorkflow.jobs).join(', ')}`,
  );
} catch (error) {
  console.log(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
