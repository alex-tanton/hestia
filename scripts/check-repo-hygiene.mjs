/*
 * Repository hygiene gate: checks git index for:
 * 1. Tracked files ignored by .gitignore
 * 2. Scripts without executable mode (100755)
 * 3. Text files with CRLF / mixed line endings
 * 4. Legacy name ("hearth") outside allowlist/quotes
 * 5. Retired ingress terms outside allowlist/quotes
 */

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const MAX_BUFFER = 512 * 1024 * 1024;
const EXECUTABLE_MODE = '100755';

const LEGACY_NAME = 'hearth';
const LEGACY_NAME_ALLOWLIST = Object.freeze([
  '.planning/milestones/',
  'scripts/check-repo-hygiene.mjs',
]);

const LEGACY_NAME_QUOTES = Object.freeze({
  '.planning/PROJECT.md': Object.freeze([
    'from Hearth to Hestia',
    'from `hearth-admin` to `hestia-admin`',
    'from `@hearth/*` to `@hestia/*`',
    'from `HEARTH_*` to `HESTIA_*`',
    'Goddess of the Hearth',
  ]),
  '.planning/REQUIREMENTS.md': Object.freeze([
    'refers to Hearth',
    'from `hearth-admin` to `hestia-admin`',
    'from `@hearth/*` to `@hestia/*`',
    'from `HEARTH_*` to `HESTIA_*`',
  ]),
  '.planning/ROADMAP.md': Object.freeze([
    'v1.0 Hearth — Cleanup and Hardening',
    'from Hearth to Hestia',
  ]),
  '.planning/STATE.md': Object.freeze([
    'file:///c:/Users/actanton/Development/Aberrance/hearth/.planning/PROJECT.md',
  ]),
});

const RETIRED_INGRESS_TERMS = Object.freeze(['tailscale', 'tailnet', 'funnel', 'ts.net']);
const RETIRED_INGRESS_ALLOWLIST = Object.freeze(['.planning/', 'scripts/check-repo-hygiene.mjs']);

const RETIRED_INGRESS_QUOTES = Object.freeze({
  'packages/recurrence/src/occurrence.ts': Object.freeze(['funnel through here']),
});

const TERM_RULES = Object.freeze([
  {
    label: 'legacy name',
    terms: Object.freeze([LEGACY_NAME]),
    allowlist: LEGACY_NAME_ALLOWLIST,
    quotes: LEGACY_NAME_QUOTES,
  },
  {
    label: 'retired ingress term',
    terms: RETIRED_INGRESS_TERMS,
    allowlist: RETIRED_INGRESS_ALLOWLIST,
    quotes: RETIRED_INGRESS_QUOTES,
  },
]);

function git(repo, args, input) {
  const run = spawnSync('git', ['-C', repo, ...args], {
    maxBuffer: MAX_BUFFER,
    ...(input === undefined ? {} : { input }),
  });
  if (run.error !== undefined) {
    throw new Error(`cannot run git: ${String(run.error)}`, { cause: run.error });
  }
  if (run.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} exited with status ${String(run.status)}: ${run.stderr.toString('utf8').trim()}`,
    );
  }
  return run.stdout;
}

function records(buffer) {
  return buffer.toString('utf8').split('\0').filter(Boolean);
}

function indexEntries(repo) {
  const entries = new Map();
  for (const record of records(git(repo, ['ls-files', '-s', '-z']))) {
    const match = /^(\d{6}) ([0-9a-f]{40,64}) (\d)\t(.*)$/s.exec(record);
    if (!match) throw new Error(`unexpected git ls-files -s record: ${record}`);
    entries.set(match[4], { mode: match[1], sha: match[2], path: match[4] });
  }
  return [...entries.values()];
}

function leadingBytes(repo, shas) {
  const leading = new Map();
  if (shas.length === 0) return leading;
  const output = git(repo, ['cat-file', '--batch'], `${shas.join('\n')}\n`);
  let position = 0;
  for (const sha of shas) {
    const newline = output.indexOf(0x0a, position);
    if (newline === -1) break;
    const header = output.toString('latin1', position, newline);
    const match = /^[0-9a-f]+ blob (\d+)$/.exec(header);
    if (!match) break;
    const size = Number(match[1]);
    const start = newline + 1;
    leading.set(sha, output.toString('latin1', start, start + Math.min(size, 2)));
    position = start + size + 1;
  }
  return leading;
}

function eolEntries(repo) {
  return records(git(repo, ['ls-files', '--eol', '-z'])).map((record) => {
    const match = /^i\/(\S*)\s+w\/(\S*)\s+attr\/([^\t]*)\t(.*)$/s.exec(record);
    if (!match) throw new Error(`unexpected git ls-files --eol record: ${record}`);
    return { eol: match[1], attributes: match[3].trim().split(/\s+/), path: match[4] };
  });
}

function isAllowlisted(rule, path) {
  return rule.allowlist.some((entry) =>
    entry.endsWith('/') ? path.startsWith(entry) : path === entry,
  );
}

function mentionsTerm(terms, text) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function termHits(repo, terms) {
  const run = spawnSync(
    'git',
    [
      '-C',
      repo,
      'grep',
      '--cached',
      '-I',
      '-l',
      '-i',
      '-z',
      '-F',
      ...terms.flatMap((t) => ['-e', t]),
    ],
    { maxBuffer: MAX_BUFFER },
  );
  if (run.error !== undefined) throw new Error(`cannot run git: ${String(run.error)}`);
  if (run.status !== 0 && run.status !== 1) {
    throw new Error(
      `git grep exited with status ${String(run.status)}: ${run.stderr.toString('utf8').trim()}`,
    );
  }
  return records(run.stdout);
}

function linesOutsideQuotes(repo, sha, terms, quotes) {
  const lines = git(repo, ['cat-file', 'blob', sha]).toString('utf8').split('\n');
  const numbers = [];
  lines.forEach((line, index) => {
    let rest = line;
    for (const quote of quotes) rest = rest.split(quote).join(' ');
    if (mentionsTerm(terms, rest)) numbers.push(index + 1);
  });
  return numbers;
}

function termProblems(repo, entries, rule) {
  const problems = [];
  const shaByPath = new Map(entries.map((entry) => [entry.path, entry.sha]));
  for (const path of termHits(repo, rule.terms)) {
    if (isAllowlisted(rule, path)) continue;
    const sha = shaByPath.get(path);
    if (Object.hasOwn(rule.quotes, path) && sha !== undefined) {
      for (const line of linesOutsideQuotes(repo, sha, rule.terms, rule.quotes[path])) {
        problems.push({ path, text: `${rule.label} in ${path}:${String(line)}` });
      }
    } else {
      problems.push({ path, text: `${rule.label} in ${path}` });
    }
  }
  for (const { path } of entries) {
    if (!isAllowlisted(rule, path) && mentionsTerm(rule.terms, path)) {
      problems.push({ path, text: `${rule.label} in file name: ${path}` });
    }
  }
  return problems;
}

function main() {
  const repoIndex = process.argv.indexOf('--repo');
  const repo =
    repoIndex !== -1 && process.argv[repoIndex + 1]
      ? resolve(process.argv[repoIndex + 1])
      : REPO_ROOT;
  const problems = [];
  let files;
  let scripts = 0;
  try {
    const inside = git(repo, ['rev-parse', '--is-inside-work-tree']).toString('utf8').trim();
    if (inside !== 'true') throw new Error(`${repo} is not inside a git work tree`);

    for (const path of records(git(repo, ['ls-files', '-ci', '--exclude-standard', '-z']))) {
      problems.push({ path, text: `tracked but ignored by .gitignore: ${path}` });
    }

    const entries = indexEntries(repo);
    files = entries.length;
    const regular = entries.filter((entry) => entry.mode !== '120000' && entry.mode !== '160000');
    const leading = leadingBytes(repo, [...new Set(regular.map((entry) => entry.sha))]);
    for (const entry of regular) {
      const isScript = leading.get(entry.sha) === '#!' || entry.path.endsWith('.sh');
      if (!isScript) continue;
      scripts += 1;
      if (entry.mode !== EXECUTABLE_MODE) {
        problems.push({
          path: entry.path,
          text: `script is not executable (${entry.mode}): ${entry.path}`,
        });
      }
    }

    for (const entry of eolEntries(repo)) {
      if ((entry.eol === 'crlf' || entry.eol === 'mixed') && !entry.attributes.includes('-text')) {
        problems.push({ path: entry.path, text: `CRLF line endings in the index: ${entry.path}` });
      }
    }

    for (const rule of TERM_RULES) problems.push(...termProblems(repo, entries, rule));
  } catch (error) {
    console.error(`check-repo-hygiene: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }

  problems.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.text < b.text ? -1 : 1));
  for (const problem of problems) console.error(problem.text);
  if (problems.length > 0) {
    console.log(`repo-hygiene: ${String(problems.length)} problems`);
    return 1;
  }
  console.log(`repo-hygiene: clean (${String(files)} files, ${String(scripts)} scripts)`);
  return 0;
}

process.exit(main());
