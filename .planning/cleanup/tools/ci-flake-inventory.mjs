/*
 * Mines GitHub Actions CI and Sweep history into a classified inventory of test and job failures.
 *
 * Usage:
 *   node ci-flake-inventory.mjs --repo {owner/repo} --out {dir} [--workflow {file}]... [--run {id}]... [--artifacts {dir}]
 *
 * Defaults:
 *   --workflow ci.yml and sweep.yml (Deploy and Dependabot Updates run no tests).
 *
 * Outputs in {dir}:
 *   runs.tsv     (run_id, workflow, event, head_branch, head_sha, attempts, conclusion, created_at)
 *   jobs.tsv     (run_id, attempt, job_id, job_name, conclusion, started_at, completed_at, head_sha)
 *   failures.tsv (id, run_id, attempt, job_id, job_name, workflow, event, head_branch, head_sha, start_utc, start_new_york, kind, signature, artifact, hint)
 *   logs/{id}.log (cached raw job logs for failed or timed out jobs)
 *
 * Exit codes:
 *   0 when inventory is written successfully
 *   2 on bad usage, gh failure, unreadable input, or failure to parse runs
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const usage = () => {
  console.error(
    'usage: node ci-flake-inventory.mjs --repo {owner/repo} --out {dir} [--workflow {file}]... [--run {id}]... [--artifacts {dir}]',
  );
  process.exit(2);
};

const args = process.argv.slice(2);
let repo = '';
let outDir = '';
let artifactsDir = '';
const workflows = [];
const runIdFilters = [];

for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--repo') {
    repo = args[i + 1] ?? '';
    if (!repo) usage();
    i += 1;
  } else if (args[i] === '--out') {
    outDir = args[i + 1] ?? '';
    if (!outDir) usage();
    i += 1;
  } else if (args[i] === '--artifacts') {
    artifactsDir = args[i + 1] ?? '';
    if (!artifactsDir) usage();
    i += 1;
  } else if (args[i] === '--workflow') {
    const wf = args[i + 1] ?? '';
    if (!wf) usage();
    workflows.push(wf);
    i += 1;
  } else if (args[i] === '--run') {
    const rId = args[i + 1] ?? '';
    if (!rId) usage();
    runIdFilters.push(rId);
    i += 1;
  } else {
    usage();
  }
}

if (!repo || !outDir) {
  usage();
}

if (workflows.length === 0) {
  workflows.push('ci.yml', 'sweep.yml');
}

const resolvedOut = resolve(outDir);
const logsDir = resolve(resolvedOut, 'logs');
mkdirSync(logsDir, { recursive: true });

// Formatter for New York and UTC using API timestamps (never the real clock)
const nyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const utcFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const formatInstant = (fmt, isoString) => {
  const d = new Date(isoString);
  return fmt.format(d).replace(', ', ' ');
};

const runGh = (apiArgs) => {
  const res = spawnSync('gh', ['api', ...apiArgs], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  if (res.status !== 0) {
    console.error(`gh api failed: ${res.stderr || res.stdout}`);
    process.exit(2);
  }
  return res.stdout;
};

// 1. Fetch runs
const allRuns = [];
if (runIdFilters.length > 0) {
  for (const rid of runIdFilters) {
    const jsonStr = runGh([`repos/${repo}/actions/runs/${rid}`]);
    try {
      const run = JSON.parse(jsonStr);
      allRuns.push(run);
    } catch (err) {
      console.error(`Failed to parse run ${rid}: ${String(err)}`);
      process.exit(2);
    }
  }
} else {
  for (const wf of workflows) {
    const stdout = runGh([
      '--paginate',
      `repos/${repo}/actions/workflows/${wf}/runs?per_page=100`,
    ]);
    const pages = stdout.trim().split(/(?=\{\s*"total_count")/);
    for (const page of pages) {
      if (!page.trim()) continue;
      try {
        const data = JSON.parse(page);
        if (Array.isArray(data.workflow_runs)) {
          allRuns.push(...data.workflow_runs);
        }
      } catch (err) {
        console.error(`Failed to parse workflow runs for ${wf}: ${String(err)}`);
        process.exit(2);
      }
    }
  }
}

if (allRuns.length === 0) {
  console.error('No workflow runs found.');
  process.exit(2);
}

// 2. Fetch jobs and attempts
const runsTsvRows = [];
const jobsTsvRows = [];
const allJobs = [];

// Track success across jobs: map head_sha -> Set of successful job names
const successesBySha = new Map();
// map run_id -> Map of attempt -> Map of jobName -> conclusion
const runJobConclusions = new Map();

for (const run of allRuns) {
  const wfName = run.path ? basename(run.path) : workflows[0];
  runsTsvRows.push([
    run.id,
    wfName,
    run.event,
    run.head_branch ?? '',
    run.head_sha,
    run.run_attempt,
    run.conclusion ?? 'in_progress',
    run.created_at,
  ]);

  if (!runJobConclusions.has(run.id)) {
    runJobConclusions.set(run.id, new Map());
  }
  const attemptMap = runJobConclusions.get(run.id);

  const totalAttempts = run.run_attempt || 1;
  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    const jobsJson = runGh([
      '--paginate',
      `repos/${repo}/actions/runs/${run.id}/attempts/${attempt}/jobs?per_page=100`,
    ]);

    let attemptJobs = [];
    const pages = jobsJson.trim().split(/(?=\{\s*"total_count")/);
    for (const page of pages) {
      if (!page.trim()) continue;
      try {
        const data = JSON.parse(page);
        if (Array.isArray(data.jobs)) {
          attemptJobs.push(...data.jobs);
        }
      } catch (err) {
        console.error(`Failed to parse jobs for run ${run.id} attempt ${attempt}: ${String(err)}`);
        process.exit(2);
      }
    }

    if (!attemptMap.has(attempt)) {
      attemptMap.set(attempt, new Map());
    }
    const jobConclusionMap = attemptMap.get(attempt);

    for (const j of attemptJobs) {
      jobConclusionMap.set(j.name, j.conclusion);
      if (j.conclusion === 'success') {
        if (!successesBySha.has(run.head_sha)) {
          successesBySha.set(run.head_sha, new Map());
        }
        successesBySha.get(run.head_sha).set(j.name, run.id);
      }

      jobsTsvRows.push([
        run.id,
        attempt,
        j.id,
        j.name,
        j.conclusion ?? 'in_progress',
        j.started_at,
        j.completed_at,
        run.head_sha,
      ]);

      allJobs.push({
        run,
        wfName,
        attempt,
        job: j,
      });
    }
  }
}

// 3. Artifacts lookup helper
// Cache run artifacts: run.id -> list of artifact objects
const runArtifactsCache = new Map();
const getRunArtifacts = (runId) => {
  if (runArtifactsCache.has(runId)) {
    return runArtifactsCache.get(runId);
  }
  let artList = [];
  try {
    const artJson = runGh([`repos/${repo}/actions/runs/${runId}/artifacts`]);
    const data = JSON.parse(artJson);
    if (Array.isArray(data.artifacts)) {
      artList = data.artifacts;
    }
  } catch {
    artList = [];
  }
  runArtifactsCache.set(runId, artList);
  return artList;
};

// Check local artifacts files if artifactsDir is provided
const availableArtifactFiles = new Set();
if (artifactsDir && existsSync(artifactsDir)) {
  for (const f of readdirSync(artifactsDir)) {
    if (f.endsWith('.zip')) {
      availableArtifactFiles.add(f);
    }
  }
}

// 4. Process failed or timed_out jobs
const rawFailures = [];

for (const { run, wfName, attempt, job } of allJobs) {
  if (job.conclusion !== 'failure' && job.conclusion !== 'timed_out') {
    continue;
  }

  const logFile = resolve(logsDir, `${job.id}.log`);
  if (!existsSync(logFile)) {
    const logRes = spawnSync(
      'gh',
      ['api', '--allow-escape-sequences', `repos/${repo}/actions/jobs/${job.id}/logs`],
      {
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
      },
    );
    if (logRes.status === 0) {
      writeFileSync(logFile, logRes.stdout, 'utf8');
    } else {
      writeFileSync(logFile, '', 'utf8');
    }
  }

  const logContent = readFileSync(logFile, 'utf8');
  // Strip ANSI sequences
  // eslint-disable-next-line no-control-regex
  const cleanLog = logContent.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
  const lines = cleanLog.split(/\r?\n/);

  const hasPlaywrightResults =
    /\[chromium\]\s*›|\b\d+\s+(?:passed|failed|skipped)\b/.test(cleanLog);

  let currentStep = '';
  const playwrightSignatures = new Set();
  const vitestSignatures = new Set();
  const nodeTestSignatures = new Set();
  const infraSignatures = new Set();
  const otherSignatures = [];

  for (const rawLine of lines) {
    // Strip leading timestamp
    const line = rawLine.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, '');

    if (line.startsWith('##[group]')) {
      currentStep = line.replace('##[group]', '').trim();
    }

    // 1. Playwright error lines: N) [chromium] › tests/{file}:{line}:{col} › {title}
    if (line.includes('##[error]') && line.includes('[chromium] ›')) {
      const match = line.match(/(?:##\[error\]\s*)?(?:\d+\)\s*)?\[chromium\]\s*›\s*(tests\/[^\r\n]+)/);
      if (match?.[1]) {
        playwrightSignatures.add(match[1].trim());
      }
    }

    // 2. Vitest FAIL lines
    if (line.includes(' FAIL ') && !line.includes('##[error]')) {
      const match = line.match(/FAIL\s+([^\s].+)/);
      if (match?.[1]) {
        vitestSignatures.add(match[1].trim());
      }
    }

    // 3. Node test not ok lines
    if (line.startsWith('not ok ') || line.includes(' not ok ')) {
      const match = line.match(/(?:^|\s)not ok\s+\d+\s+-\s+(.+)/);
      if (match?.[1]) {
        nodeTestSignatures.add(match[1].trim());
      }
    }

    // 4. Infrastructure lines in allowed steps
    const isSetupStep =
      currentStep.includes('actions/setup') ||
      currentStep.includes('action-setup') ||
      currentStep.includes('pnpm install') ||
      currentStep.includes('setup-node') ||
      currentStep.includes('setup-cli');
    const isPrePullStep =
      currentStep.includes('ci-prepull-images') || currentStep.includes('docker pull');
    const isSupabaseStartStep = currentStep.includes('supabase start');
    const isE2EWithoutResults = currentStep.includes('pnpm test:e2e') && !hasPlaywrightResults;

    const allowedInfraStep =
      isSetupStep || isPrePullStep || isSupabaseStartStep || isE2EWithoutResults;

    if (allowedInfraStep) {
      if (
        line.includes('toomanyrequests') ||
        /Could not pull .* after \d+ attempts/.test(line) ||
        line.includes('ERR_PNPM_PNPM_ENGINE_IDENTITY_UNVERIFIABLE') ||
        line.includes('ERR_PNPM_FETCH_') ||
        line.includes('runner has shut down') ||
        line.includes('has exceeded the maximum execution time')
      ) {
        const sig = line.replace('##[error]', '').trim();
        infraSignatures.add(sig);
      }
    }

    // 5. Candidate for other
    if (line.includes('##[error]')) {
      const err = line.replace('##[error]', '').trim();
      if (err && !err.startsWith('Process completed with exit code')) {
        otherSignatures.push(err);
      }
    }
  }

  // Determine matching artifact for test-e2e job
  let artifactCol = 'none';
  if (job.name === 'test-e2e') {
    const runArtifacts = getRunArtifacts(run.id);
    const jobCompTime = new Date(job.completed_at).getTime();

    // Find playwright-report artifact created within 10 minutes around job completion
    const matchingArt = runArtifacts.find((a) => {
      if (a.name !== 'playwright-report') return false;
      const artTime = new Date(a.created_at).getTime();
      return Math.abs(artTime - jobCompTime) <= 10 * 60 * 1000;
    });

    if (matchingArt) {
      const zipName = `${run.id}-${matchingArt.id}.zip`;
      if (availableArtifactFiles.has(zipName)) {
        artifactCol = zipName;
      } else if (matchingArt.expired) {
        artifactCol = 'expired';
      } else {
        artifactCol = zipName; // saved artifact reference
      }
    }
  }

  // Determine hint
  const getHint = (kind) => {
    if (kind === 'infra') {
      return 'infra-signature';
    }
    // Check later attempts in this run
    const attemptMap = runJobConclusions.get(run.id);
    if (attemptMap) {
      const totalAttempts = run.run_attempt || 1;
      for (let nextAtt = attempt + 1; nextAtt <= totalAttempts; nextAtt += 1) {
        if (attemptMap.get(nextAtt)?.get(job.name) === 'success') {
          return `green-on-attempt ${nextAtt}`;
        }
      }
    }
    // Check elsewhere on same SHA
    const shaMap = successesBySha.get(run.head_sha);
    if (shaMap && shaMap.has(job.name)) {
      const otherRun = shaMap.get(job.name);
      if (otherRun !== run.id) {
        return `green-elsewhere ${otherRun}`;
      }
    }
    return '';
  };

  const startUtc = formatInstant(utcFormatter, job.started_at);
  const startNy = formatInstant(nyFormatter, job.started_at);

  let signaturesFound = false;

  if (playwrightSignatures.size > 0) {
    signaturesFound = true;
    for (const sig of playwrightSignatures) {
      rawFailures.push({
        jobStart: job.started_at,
        runId: run.id,
        attempt,
        jobId: job.id,
        jobName: job.name,
        wfName,
        event: run.event,
        branch: run.head_branch ?? '',
        headSha: run.head_sha,
        startUtc,
        startNy,
        kind: 'playwright',
        signature: sig,
        artifact: artifactCol,
        hint: getHint('playwright'),
      });
    }
  }

  if (vitestSignatures.size > 0) {
    signaturesFound = true;
    for (const sig of vitestSignatures) {
      rawFailures.push({
        jobStart: job.started_at,
        runId: run.id,
        attempt,
        jobId: job.id,
        jobName: job.name,
        wfName,
        event: run.event,
        branch: run.head_branch ?? '',
        headSha: run.head_sha,
        startUtc,
        startNy,
        kind: 'vitest',
        signature: sig,
        artifact: artifactCol,
        hint: getHint('vitest'),
      });
    }
  }

  if (nodeTestSignatures.size > 0) {
    signaturesFound = true;
    for (const sig of nodeTestSignatures) {
      rawFailures.push({
        jobStart: job.started_at,
        runId: run.id,
        attempt,
        jobId: job.id,
        jobName: job.name,
        wfName,
        event: run.event,
        branch: run.head_branch ?? '',
        headSha: run.head_sha,
        startUtc,
        startNy,
        kind: 'node-test',
        signature: sig,
        artifact: artifactCol,
        hint: getHint('node-test'),
      });
    }
  }

  if (infraSignatures.size > 0) {
    signaturesFound = true;
    for (const sig of infraSignatures) {
      rawFailures.push({
        jobStart: job.started_at,
        runId: run.id,
        attempt,
        jobId: job.id,
        jobName: job.name,
        wfName,
        event: run.event,
        branch: run.head_branch ?? '',
        headSha: run.head_sha,
        startUtc,
        startNy,
        kind: 'infra',
        signature: sig,
        artifact: artifactCol,
        hint: getHint('infra'),
      });
    }
  }

  if (!signaturesFound) {
    const firstOther = otherSignatures[0] || 'Unknown job failure';
    rawFailures.push({
      jobStart: job.started_at,
      runId: run.id,
      attempt,
      jobId: job.id,
      jobName: job.name,
      wfName,
      event: run.event,
      branch: run.head_branch ?? '',
      headSha: run.head_sha,
      startUtc,
      startNy,
      kind: 'other',
      signature: firstOther,
      artifact: artifactCol,
      hint: getHint('other'),
    });
  }
}

// 5. Sort rawFailures: job start, run, attempt, job, signature
rawFailures.sort((a, b) => {
  const tA = new Date(a.jobStart).getTime();
  const tB = new Date(b.jobStart).getTime();
  if (tA !== tB) return tA - tB;
  if (a.runId !== b.runId) return a.runId - b.runId;
  if (a.attempt !== b.attempt) return a.attempt - b.attempt;
  if (a.jobId !== b.jobId) return a.jobId - b.jobId;
  return a.signature.localeCompare(b.signature);
});

// Assign O-nnn ids
const failuresTsvRows = rawFailures.map((item, idx) => {
  const id = `O-${String(idx + 1).padStart(3, '0')}`;
  return [
    id,
    item.runId,
    item.attempt,
    item.jobId,
    item.jobName,
    item.wfName,
    item.event,
    item.branch,
    item.headSha,
    item.startUtc,
    item.startNy,
    item.kind,
    item.signature,
    item.artifact,
    item.hint,
  ];
});

// Write TSV files
const runsHeader = [
  'run_id',
  'workflow',
  'event',
  'head_branch',
  'head_sha',
  'attempts',
  'conclusion',
  'created_at',
];
writeFileSync(
  resolve(resolvedOut, 'runs.tsv'),
  [runsHeader.join('\t'), ...runsTsvRows.map((r) => r.join('\t'))].join('\n') + '\n',
  'utf8',
);

const jobsHeader = [
  'run_id',
  'attempt',
  'job_id',
  'job_name',
  'conclusion',
  'started_at',
  'completed_at',
  'head_sha',
];
writeFileSync(
  resolve(resolvedOut, 'jobs.tsv'),
  [jobsHeader.join('\t'), ...jobsTsvRows.map((r) => r.join('\t'))].join('\n') + '\n',
  'utf8',
);

const failuresHeader = [
  'id',
  'run_id',
  'attempt',
  'job_id',
  'job_name',
  'workflow',
  'event',
  'head_branch',
  'head_sha',
  'start_utc',
  'start_new_york',
  'kind',
  'signature',
  'artifact',
  'hint',
];
writeFileSync(
  resolve(resolvedOut, 'failures.tsv'),
  [failuresHeader.join('\t'), ...failuresTsvRows.map((r) => r.join('\t'))].join('\n') + '\n',
  'utf8',
);

console.log(
  `Inventory written to ${resolvedOut}: ${runsTsvRows.length} runs, ${jobsTsvRows.length} jobs, ${failuresTsvRows.length} failures.`,
);
