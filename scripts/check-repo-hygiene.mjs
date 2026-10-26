/*
 * Repository hygiene gate: reads the git index (what a commit would contain, never the working
 * tree a checkout may have rewritten) and fails on four kinds of drift that review misses.
 *
 *   node scripts/check-repo-hygiene.mjs [--repo DIR]
 *
 * 1. A tracked file that `.gitignore` ignores (it was force-added, or was tracked before the
 *    ignore rule existed).
 * 2. A script that is not mode 100755: a file whose first two bytes are `#!`, or whose name ends in
 *    `.sh`. A script that loses its executable bit fails only on the machine that runs it. Symlinks
 *    and submodules are skipped.
 * 3. A text file whose index copy has CRLF or mixed line endings, unless its attributes mark it
 *    `-text`. `.gitattributes` normalizes line endings in a checkout, so only the index shows what
 *    was really committed.
 * 4. The product's former name, in any case, in the content of a tracked text file or in a tracked
 *    path (binary files are not judged). `LEGACY_NAME_ALLOWLIST` and `LEGACY_NAME_QUOTES` are the
 *    only places text may carry the former name: the allowlist exempts whole paths, and the quotes
 *    exempt exact substrings of the four planning state files, which are scanned line by line.
 *
 * Exit codes: 0 clean; 1 problems found; 2 the check could not run (not a git work tree, a failing
 * git call, bad usage), which is never treated as a pass.
 */

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const MAX_BUFFER = 512 * 1024 * 1024;

const SYMLINK_MODE = '120000';
const SUBMODULE_MODE = '160000';
const EXECUTABLE_MODE = '100755';

/** The product's former name, matched in any case. */
const LEGACY_NAME = 'hearth';

/**
 * Whole paths that may carry the former name. An entry ending in `/` covers that directory prefix;
 * any other entry covers exactly one path, never a sibling such as `<entry>.bak`. Keep this list
 * short: adding an entry needs the owner's review.
 */
const LEGACY_NAME_ALLOWLIST = Object.freeze([
  // The v1.0 archive is history; the rebrand decisions name it as exempt.
  '.planning/milestones/',
  // Records of the rename itself. These two prefixes rest on the planner's reading of the decision
  // that text which must quote the former name is exempt; the decision does not list them.
  '.planning/phases/',
  '.planning/research/',
  // This script and its test hold the pattern, so they must spell the name.
  'scripts/check-repo-hygiene.mjs',
  'scripts/check-repo-hygiene.test.mjs',
  // Its fromPath values keep the file name the pinned migrations had before the rename.
  'scripts/migration-exemptions.json',
]);

/**
 * Exact quotes that may carry the former name in the four planning state files. Those files
 * describe the current state under the new name, so they are scanned line by line and are not on
 * the allowlist. A quote is an exact, case-sensitive substring of a line; any other occurrence on
 * the line, including one next to a quote, still fails. Anything else in these files must call it
 * "the former name".
 */
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

const USAGE = `usage: node scripts/check-repo-hygiene.mjs [--repo DIR]
  --repo DIR   the repository to check (default: this checkout)`;

function usageError(message) {
  console.error(`check-repo-hygiene: ${message}`);
  console.error(USAGE);
  process.exit(2);
}

function parseArguments(argv) {
  const options = { repo: REPO_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag !== '--repo') usageError(`unknown flag ${String(flag)}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) usageError('--repo needs a value');
    options.repo = resolve(value);
    index += 1;
  }
  return options;
}

/** Runs git with an argument array (no shell) and returns stdout as a Buffer; throws on failure. */
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
      `git ${args.join(' ')} exited with status ${String(run.status ?? run.signal)}: ` +
        run.stderr.toString('utf8').trim(),
    );
  }
  return run.stdout;
}

/** Splits NUL-terminated git output into its records. */
function records(buffer) {
  return buffer
    .toString('utf8')
    .split('\0')
    .filter((record) => record !== '');
}

/** Index entries as `{ mode, sha, path }`, one per path (a conflicted path appears once). */
function indexEntries(repo) {
  const entries = new Map();
  for (const record of records(git(repo, ['ls-files', '-s', '-z']))) {
    const match = /^(\d{6}) ([0-9a-f]{40,64}) (\d)\t(.*)$/s.exec(record);
    if (match === null) throw new Error(`unexpected git ls-files -s record: ${record}`);
    entries.set(match[4], { mode: match[1], sha: match[2], path: match[4] });
  }
  return [...entries.values()];
}

/** The first two bytes of each blob, read with one `git cat-file --batch` process. */
function leadingBytes(repo, shas) {
  const leading = new Map();
  if (shas.length === 0) return leading;
  const output = git(repo, ['cat-file', '--batch'], `${shas.join('\n')}\n`);
  let position = 0;
  for (const sha of shas) {
    const newline = output.indexOf(0x0a, position);
    if (newline === -1) throw new Error('git cat-file ended before every blob was read');
    const header = output.toString('latin1', position, newline);
    const match = /^[0-9a-f]+ blob (\d+)$/.exec(header);
    if (match === null) throw new Error(`git cat-file did not return a blob for ${sha}: ${header}`);
    const size = Number(match[1]);
    const start = newline + 1;
    leading.set(sha, output.toString('latin1', start, start + Math.min(size, 2)));
    position = start + size + 1;
  }
  return leading;
}

/** Index line endings: `{ path, eol, attributes }` for every record of `git ls-files --eol`. */
function eolEntries(repo) {
  return records(git(repo, ['ls-files', '--eol', '-z'])).map((record) => {
    const match = /^i\/(\S*)\s+w\/(\S*)\s+attr\/([^\t]*)\t(.*)$/s.exec(record);
    if (match === null) throw new Error(`unexpected git ls-files --eol record: ${record}`);
    return { eol: match[1], attributes: match[3].trim().split(/\s+/), path: match[4] };
  });
}

function isLegacyNameAllowlisted(path) {
  return LEGACY_NAME_ALLOWLIST.some((entry) =>
    entry.endsWith('/') ? path.startsWith(entry) : path === entry,
  );
}

function mentionsLegacyName(text) {
  return text.toLowerCase().includes(LEGACY_NAME);
}

/**
 * Paths whose index copy is a text file containing the former name in any case. `git grep` exits 1
 * when nothing matches, so status 0 and 1 are both answers; any other status is a failure.
 */
function legacyNameHits(repo) {
  const run = spawnSync(
    'git',
    ['-C', repo, 'grep', '--cached', '-I', '-l', '-i', '-z', '-F', '-e', LEGACY_NAME],
    { maxBuffer: MAX_BUFFER },
  );
  if (run.error !== undefined) {
    throw new Error(`cannot run git: ${String(run.error)}`, { cause: run.error });
  }
  if (run.status !== 0 && run.status !== 1) {
    throw new Error(
      `git grep exited with status ${String(run.status ?? run.signal)}: ` +
        run.stderr.toString('utf8').trim(),
    );
  }
  return records(run.stdout);
}

/** The 1-based numbers of the lines that carry the former name outside the file's pinned quotes. */
function linesOutsideQuotes(repo, sha, quotes) {
  const lines = git(repo, ['cat-file', 'blob', sha]).toString('utf8').split('\n');
  const numbers = [];
  lines.forEach((line, index) => {
    let rest = line;
    for (const quote of quotes) rest = rest.split(quote).join(' ');
    if (mentionsLegacyName(rest)) numbers.push(index + 1);
  });
  return numbers;
}

function main() {
  const { repo } = parseArguments(process.argv.slice(2));
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
    const regular = entries.filter(
      (entry) => entry.mode !== SYMLINK_MODE && entry.mode !== SUBMODULE_MODE,
    );
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

    const shaByPath = new Map(entries.map((entry) => [entry.path, entry.sha]));
    for (const path of legacyNameHits(repo)) {
      if (isLegacyNameAllowlisted(path)) continue;
      const sha = shaByPath.get(path);
      if (Object.hasOwn(LEGACY_NAME_QUOTES, path) && sha !== undefined) {
        for (const line of linesOutsideQuotes(repo, sha, LEGACY_NAME_QUOTES[path])) {
          problems.push({ path, text: `legacy name in ${path}:${String(line)}` });
        }
      } else {
        problems.push({ path, text: `legacy name in ${path}` });
      }
    }
    for (const { path } of entries) {
      if (!isLegacyNameAllowlisted(path) && mentionsLegacyName(path)) {
        problems.push({ path, text: `legacy name in file name: ${path}` });
      }
    }
  } catch (error) {
    console.error(
      `check-repo-hygiene: cannot check ${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
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
