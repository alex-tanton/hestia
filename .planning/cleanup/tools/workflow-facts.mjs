/*
 * Prints the facts of one GitHub Actions workflow file as `key=value` lines, so the Phase 6 ledger
 * and the verify commands can compare a workflow with what the plan promises without reading YAML
 * by eye.
 *
 * Usage: node workflow-facts.mjs [--resolve-from DIR] {workflow.yml}
 *
 * `yaml` is a dependency of the service workspace, so it is resolved with createRequire from
 * {DIR}/apps/service/package.json; DIR defaults to the repository that holds this tool.
 *
 * Output keys: name, on (trigger keys in file order), jobs (ids in file order), permissions (JSON),
 * concurrency.group, push.branches, push.paths-ignore, schedule (crons), workflow_run.workflows,
 * workflow_run.branches, workflow_run.types; per job job.{id}.runs-on, .if, .timeout, .checkout
 * (each actions/checkout step as `{persist-credentials}/{fetch-depth}`, `unset` when absent, joined
 * by ` ; `) and, counting the steps from 1, job.{id}.step.{n}.name, .run (newlines written as \n)
 * and .if (`none` when absent); and run-interpolation (the number of run values that contain a
 * ${{ }} expression). A key that does not apply prints nothing, except where `none` is stated.
 *
 * Exit codes: 0 facts printed; 2 bad usage, unreadable file or a YAML parse error.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKOUT_PREFIX = 'actions/checkout@';
const NONE = 'none';
const UNSET = 'unset';

const usage = () => {
  console.error('usage: node workflow-facts.mjs [--resolve-from DIR] {workflow.yml}');
  process.exit(2);
};

const args = process.argv.slice(2);
let resolveFrom = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const files = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--resolve-from') {
    const dir = args[i + 1];
    if (!dir) usage();
    resolveFrom = resolve(dir);
    i += 1;
  } else {
    files.push(args[i]);
  }
}
if (files.length !== 1 || !files[0]) usage();

const asList = (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value]);
const text = (value) => (value === undefined || value === null ? NONE : String(value));
const oneLine = (value) => String(value).replace(/\n$/, '').replaceAll('\n', '\\n');

let workflow;
try {
  const require = createRequire(resolve(resolveFrom, 'apps/service/package.json'));
  const { parse } = require('yaml');
  workflow = parse(readFileSync(files[0], 'utf8'));
} catch (error) {
  console.error(`workflow-facts: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
if (workflow === null || typeof workflow !== 'object' || typeof workflow.jobs !== 'object') {
  console.error('workflow-facts: the file is not a workflow (no jobs mapping)');
  process.exit(2);
}

const out = [];
const emit = (key, value) => out.push(`${key}=${value}`);

emit('name', text(workflow.name));

const triggers = workflow.on;
const triggerKeys =
  triggers !== null && typeof triggers === 'object' && !Array.isArray(triggers)
    ? Object.keys(triggers)
    : asList(triggers);
emit('on', triggerKeys.join(','));
emit('jobs', Object.keys(workflow.jobs).join(','));
emit('permissions', workflow.permissions === undefined ? NONE : JSON.stringify(workflow.permissions));
if (workflow.concurrency !== undefined) {
  emit('concurrency.group', text(workflow.concurrency.group));
}

const trigger = (key) => (triggers !== null && typeof triggers === 'object' ? triggers[key] : undefined);
const push = trigger('push');
if (push && typeof push === 'object') {
  if (push.branches) emit('push.branches', asList(push.branches).join(','));
  if (push['paths-ignore']) emit('push.paths-ignore', asList(push['paths-ignore']).join(','));
}
const schedule = trigger('schedule');
if (schedule) emit('schedule', asList(schedule).map((entry) => entry.cron).join(','));
const workflowRun = trigger('workflow_run');
if (workflowRun && typeof workflowRun === 'object') {
  emit('workflow_run.workflows', asList(workflowRun.workflows).join(','));
  emit('workflow_run.branches', asList(workflowRun.branches).join(','));
  emit('workflow_run.types', asList(workflowRun.types).join(','));
}

let interpolated = 0;
for (const [id, job] of Object.entries(workflow.jobs)) {
  emit(`job.${id}.runs-on`, asList(job['runs-on']).join(','));
  emit(`job.${id}.if`, text(job.if));
  emit(`job.${id}.timeout`, text(job['timeout-minutes']));
  const steps = asList(job.steps);
  const checkouts = steps
    .filter((step) => typeof step.uses === 'string' && step.uses.startsWith(CHECKOUT_PREFIX))
    .map((step) => {
      const persist = step.with?.['persist-credentials'];
      const depth = step.with?.['fetch-depth'];
      return `${persist === undefined ? UNSET : String(persist)}/${depth === undefined ? UNSET : String(depth)}`;
    });
  emit(`job.${id}.checkout`, checkouts.length === 0 ? NONE : checkouts.join(' ; '));
  steps.forEach((step, index) => {
    const n = index + 1;
    emit(`job.${id}.step.${n}.name`, text(step.name));
    emit(`job.${id}.step.${n}.run`, step.run === undefined ? NONE : oneLine(step.run));
    emit(`job.${id}.step.${n}.if`, text(step.if));
    if (typeof step.run === 'string' && step.run.includes('${{')) interpolated += 1;
  });
}
emit('run-interpolation', interpolated);

console.log(out.join('\n'));
