/*
 * Checks the backticked paths, script names and `pnpm` commands in markdown files against the
 * tracked files and the workspace package.json scripts of a checkout (Phase 5, RED-05, D-18).
 *
 * Usage:
 *   node docs-claims-check.mjs --repo R [--allow F.tsv] {markdown files...}
 * Phase 8 copy: finds the root workspace by its directory (`.`), because the root package was renamed.
 *
 * Tokens come from inline code spans, plus lines that start with `pnpm` inside fenced blocks.
 * Out of scope: tokens with spaces (other than pnpm commands), `=`, `<`, `{`, `$`, URLs, tokens
 * that start with `/`, `~` or `@` (host paths, URL routes and package names), and bare words.
 * A path-like token (a `/`, a known extension, a dot-file or a tracked top-level name) must match
 * `git ls-files` exactly, then as a directory prefix, then as one unique suffix; an ambiguous
 * suffix is reported as `ambiguous`. A token with `*` is matched as a glob against a tracked path
 * or one of its directories.
 * A `pnpm` token resolves its script against the root package.json, or, with `--filter {name}`,
 * against that workspace; `-r` accepts any workspace. A bare token shaped like `test:coverage` is
 * a script name and must exist in some workspace.
 *
 * The allowlist is a TSV of `token<TAB>reason`; a listed token is never reported. Output is a TSV
 * of `file line token verdict` for every miss, then `checked={n} misses={m}`; exit 1 on a miss.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const files = [];
let repo;
let allowPath;
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--repo') {
    repo = args[(i += 1)];
  } else if (arg === '--allow') {
    allowPath = args[(i += 1)];
  } else if (arg !== undefined) {
    files.push(arg);
  }
}
if (repo === undefined || files.length === 0) {
  console.error('usage: node docs-claims-check.mjs --repo R [--allow F.tsv] {markdown files...}');
  process.exit(2);
}

const tracked = execFileSync('git', ['-C', repo, 'ls-files'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
  .split('\n')
  .filter((line) => line !== '');
const trackedSet = new Set(tracked);
const topLevel = new Set(tracked.map((path) => path.split('/')[0]));

const allowed = new Set();
if (allowPath !== undefined) {
  for (const line of readFileSync(allowPath, 'utf8').split('\n')) {
    if (line === '' || line.startsWith('#')) continue;
    const [token, reason] = line.split('\t');
    if (token === undefined || reason === undefined || reason.trim() === '') {
      console.error(`allowlist row without a reason: ${line}`);
      process.exit(2);
    }
    allowed.add(token);
  }
}

// Workspace scripts: root and every tracked package.json.
const workspaces = new Map();
for (const path of tracked.filter((p) => p === 'package.json' || p.endsWith('/package.json'))) {
  if (path.includes('node_modules/')) continue;
  const pkg = JSON.parse(readFileSync(join(repo, path), 'utf8'));
  workspaces.set(pkg.name ?? path, {
    dir: dirname(path),
    scripts: new Set(Object.keys(pkg.scripts ?? {})),
  });
}
const rootScripts = [...workspaces.values()].find((ws) => ws.dir === '.')?.scripts ?? new Set();
const everyScript = new Set([...workspaces.values()].flatMap((ws) => [...ws.scripts]));

const EXTENSIONS =
  /\.(ts|tsx|mjs|cjs|js|json|md|ya?ml|sh|sql|css|html|toml|tsv|conf|example|txt|svg|png|Dockerfile)$/;
const PNPM_BUILTINS = new Set([
  'install',
  'i',
  'exec',
  'dlx',
  'add',
  'remove',
  'update',
  'fetch',
  'run',
  'prune',
  'store',
  'approve-builds',
  'rebuild',
  'config',
  'list',
  'why',
  'outdated',
  'audit',
  'licenses',
  'patch',
  'deploy',
  'dedupe',
]);

function checkPath(raw) {
  let token = raw.replace(/^\.\//, '').replace(/:\d+(-\d+)?$/, '');
  token = token.replace(/\/+$/, '');
  if (token === '') return undefined;
  if (token.includes('*')) {
    const source = token
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*|\*/g, (star) => (star === '**' ? '.*' : '[^/]*'));
    const rx = new RegExp(`(^|/)${source}(/|$)`);
    return tracked.some((path) => rx.test(path)) ? undefined : 'missing';
  }
  if (trackedSet.has(token)) return undefined;
  const prefix = `${token}/`;
  if (tracked.some((path) => path.startsWith(prefix))) return undefined;
  const suffix = `/${token}`;
  const bySuffix = tracked.filter((path) => path.endsWith(suffix));
  if (bySuffix.length === 1) return undefined;
  if (bySuffix.length > 1) return 'ambiguous';
  const directories = new Set();
  for (const path of tracked) {
    const at = path.indexOf(`${suffix}/`);
    if (at !== -1) directories.add(path.slice(0, at + suffix.length));
  }
  if (directories.size === 1) return undefined;
  return directories.size > 1 ? 'ambiguous' : 'missing';
}

function checkPnpm(command) {
  const words = command.split(/\s+/).slice(1);
  let scripts = rootScripts;
  let anyWorkspace = false;
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    if (word === undefined) break;
    if (word === '--filter' || word === '-F') {
      const name = words[(i += 1)] ?? '';
      const workspace = workspaces.get(name);
      if (workspace === undefined) return `no workspace ${name}`;
      scripts = workspace.scripts;
      continue;
    }
    if (word === '--dir' || word === '-C') {
      i += 1;
      continue;
    }
    if (word === '-r' || word === '--recursive' || word === '--parallel') {
      anyWorkspace = true;
      continue;
    }
    if (word.startsWith('-')) continue;
    if (word === 'run') continue;
    if (PNPM_BUILTINS.has(word)) return undefined;
    const pool = anyWorkspace ? everyScript : scripts;
    return pool.has(word) ? undefined : `no script ${word}`;
  }
  return undefined;
}

function classify(token) {
  const text = token.trim();
  if (/^pnpm\s/.test(text)) return { kind: 'pnpm', text };
  if (text === '' || /[\s=<{$]|:\/\//.test(text)) return undefined;
  if (/^[/~@]/.test(text)) return undefined;
  if (/^[a-z][a-z0-9-]*(:[a-z0-9-]+)+$/.test(text)) return { kind: 'script', text };
  const pathLike =
    text.includes('/') || EXTENSIONS.test(text) || /^\.[a-z]/.test(text) || topLevel.has(text);
  return pathLike ? { kind: 'path', text } : undefined;
}

let checked = 0;
const misses = [];
for (const file of files) {
  let inFence = false;
  const lines = readFileSync(file, 'utf8').split('\n');
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    const tokens = [];
    if (inFence) {
      const command = /^\s*(?:\$\s+)?(pnpm\s+[^|;&<>\\]*)/.exec(line);
      if (command?.[1] !== undefined) tokens.push(command[1].trim());
    } else {
      for (const match of line.matchAll(/`([^`]+)`/g)) {
        if (match[1] !== undefined) tokens.push(match[1]);
      }
    }
    for (const token of tokens) {
      const item = classify(token);
      if (item === undefined) continue;
      checked += 1;
      if (allowed.has(item.text)) continue;
      let verdict;
      if (item.kind === 'pnpm') verdict = checkPnpm(item.text);
      else if (item.kind === 'script') verdict = everyScript.has(item.text) ? undefined : 'no script';
      else verdict = checkPath(item.text);
      if (verdict !== undefined) misses.push([file, lineNumber, item.text, verdict].join('\t'));
    }
  }
}

for (const row of misses) console.log(row);
console.log(`checked=${checked} misses=${misses.length}`);
process.exit(misses.length > 0 ? 1 : 0);
