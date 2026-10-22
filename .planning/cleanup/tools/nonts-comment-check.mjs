/*
 * Proves a set of edits to non-TypeScript files is comment-only (D-09, D-10), with one rule per
 * file type:
 *   - YAML:       both versions parse (yaml package) and the parsed values are deep-equal.
 *   - `#` files:  `.sh`, `.toml`, `Caddyfile`, Dockerfiles and `.env*`; with whole-line comments
 *                 and blank lines dropped both versions are equal, every changed diff line is a
 *                 whole-line comment or blank, and a shebang or a leading Dockerfile parser
 *                 directive is not touched.
 *   - SQL:        the base has no `--` after an odd number of single quotes on a line (else the
 *                 file is unsafe to judge); with `--` to end of line and blank lines dropped both
 *                 versions are equal.
 *   - CSS:        with block comments removed and whitespace runs collapsed both versions are equal.
 *   - HTML (only with --html): the ld+json script blocks are byte-identical, and with the content
 *                 of every paragraph element blanked both versions are equal.
 * Any other changed file fails as an unknown type (script files belong to comment-only-check.mjs).
 *
 * Usage: node nonts-comment-check.mjs --repo R --base REF [--head REF] [--html] [-- pathspec...]
 *   --head omitted: the working tree of R is compared against REF.
 * Output: `OK {path} ({rule})` or `FAIL {path}: {reason}` per file, then `OK {n} files`, exit 0,
 * or exit 1.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, extname, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const PRIMARY = resolve(import.meta.dirname, '..', '..', '..');
const requireFromService = createRequire(join(PRIMARY, 'apps', 'service', 'package.json'));
const YAML = requireFromService('yaml');

const HASH_DIRECTIVE = /^#\s*(syntax|escape|check)\s*=/i;
const LD_JSON = /<script\s+type="application\/ld\+json"\s*>[\s\S]*?<\/script>/g;

function usage() {
  console.error(
    'usage: node nonts-comment-check.mjs --repo R --base REF [--head REF] [--html] [-- pathspec...]',
  );
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { repo: null, base: null, head: null, html: false, paths: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      opts.paths = argv.slice(i + 1);
      break;
    } else if (arg === '--repo') {
      opts.repo = argv[++i];
    } else if (arg === '--base') {
      opts.base = argv[++i];
    } else if (arg === '--head') {
      opts.head = argv[++i];
    } else if (arg === '--html') {
      opts.html = true;
    } else {
      usage();
    }
  }
  if (!opts.repo || !opts.base) usage();
  return opts;
}

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
}

function typeOf(path) {
  const base = basename(path);
  const ext = extname(path);
  if (['.yml', '.yaml'].includes(ext)) return 'yaml';
  if (['.sh', '.toml'].includes(ext)) return 'hash';
  if (base === 'Caddyfile' || base.includes('Dockerfile') || base.startsWith('.env')) return 'hash';
  if (ext === '.sql') return 'sql';
  if (ext === '.css') return 'css';
  if (ext === '.html') return 'html';
  return 'unknown';
}

const isCommentLine = (line) => /^\s*#/.test(line);
const lines = (text) => text.split(/\r\n|\n|\r/);

function hashCode(text) {
  return lines(text)
    .filter((line) => line.trim() !== '' && !isCommentLine(line))
    .join('\n');
}

function sqlCode(text) {
  return lines(text)
    .map((line) => line.replace(/--.*$/, '').trimEnd())
    .filter((line) => line.trim() !== '')
    .join('\n');
}

function sqlUnsafeLine(text) {
  for (const [index, line] of lines(text).entries()) {
    const at = line.indexOf('--');
    if (at === -1) continue;
    const quotes = line.slice(0, at).split("'").length - 1;
    if (quotes % 2 === 1) return index + 1;
  }
  return null;
}

function cssCode(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function yamlValue(text) {
  const docs = YAML.parseAllDocuments(text);
  for (const doc of docs) {
    if (doc.errors.length > 0) throw new Error(doc.errors[0].message);
  }
  return docs.map((doc) => doc.toJS());
}

function htmlParts(text) {
  return {
    ld: text.match(LD_JSON) ?? [],
    rest: text.replace(/<p\b([^>]*)>[\s\S]*?<\/p>/g, '<p$1></p>'),
  };
}

/** Every changed line of `git diff -U0` for one file, as `{sign, text}`. */
function diffLines(opts, path) {
  const args = ['diff', '-U0', '--no-color', opts.base];
  if (opts.head) args.push(opts.head);
  args.push('--', path);
  return git(opts.repo, args)
    .split('\n')
    .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---)/.test(line))
    .map((line) => ({ sign: line[0], text: line.slice(1) }));
}

function checkFile(opts, path, before, after) {
  const type = typeOf(path);
  if (type === 'yaml') {
    let left;
    let right;
    try {
      left = yamlValue(before);
      right = yamlValue(after);
    } catch (error) {
      return { rule: 'yaml', fail: `does not parse: ${error.message}` };
    }
    return { rule: 'parsed YAML deep-equal', fail: isDeepStrictEqual(left, right) ? null : 'parsed value differs' };
  }
  if (type === 'hash') {
    const firstBefore = lines(before)[0] ?? '';
    const firstAfter = lines(after)[0] ?? '';
    if (firstBefore.startsWith('#!') && firstBefore !== firstAfter) {
      return { rule: '# comments', fail: 'shebang changed' };
    }
    if (HASH_DIRECTIVE.test(firstBefore) && firstBefore !== firstAfter) {
      return { rule: '# comments', fail: 'parser directive changed' };
    }
    if (hashCode(before) !== hashCode(after)) {
      return { rule: '# comments', fail: 'non-comment text differs' };
    }
    const bad = diffLines(opts, path).find((l) => l.text.trim() !== '' && !isCommentLine(l.text));
    if (bad) return { rule: '# comments', fail: `changed line is not a comment: ${bad.text}` };
    return { rule: '# comments', fail: null };
  }
  if (type === 'sql') {
    const unsafe = sqlUnsafeLine(before);
    if (unsafe !== null) return { rule: '-- comments', fail: `unsafe: quote before -- on line ${unsafe}` };
    return { rule: '-- comments', fail: sqlCode(before) === sqlCode(after) ? null : 'SQL text differs' };
  }
  if (type === 'css') {
    return { rule: '/* */ comments', fail: cssCode(before) === cssCode(after) ? null : 'CSS text differs' };
  }
  if (type === 'html') {
    if (!opts.html) return { rule: 'html', fail: 'HTML needs --html' };
    const left = htmlParts(before);
    const right = htmlParts(after);
    if (!isDeepStrictEqual(left.ld, right.ld)) return { rule: 'html', fail: 'ld+json block differs' };
    if (left.ld.length === 0 && /ld\+json/.test(before)) {
      return { rule: 'html', fail: 'ld+json block not recognised' };
    }
    return {
      rule: 'JSON-LD byte-identical, text outside paragraphs equal',
      fail: left.rest === right.rest ? null : 'text outside the paragraphs differs',
    };
  }
  return { rule: type, fail: 'unknown file type' };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const range = [opts.base, ...(opts.head ? [opts.head] : [])];
  const changed = git(opts.repo, ['diff', '--name-only', ...range, '--', ...opts.paths])
    .split('\n')
    .filter(Boolean);
  let failures = 0;
  for (const path of changed) {
    let before;
    let after;
    try {
      before = git(opts.repo, ['show', `${opts.base}:${path}`]);
      after = opts.head
        ? git(opts.repo, ['show', `${opts.head}:${path}`])
        : readFileSync(join(opts.repo, path), 'utf8');
    } catch {
      console.log(`FAIL ${path}: added or deleted file`);
      failures += 1;
      continue;
    }
    const result = checkFile(opts, path, before, after);
    if (result.fail) {
      console.log(`FAIL ${path}: ${result.fail}`);
      failures += 1;
    } else {
      console.log(`OK ${path} (${result.rule})`);
    }
  }
  if (failures > 0) process.exit(1);
  console.log(`OK ${changed.length} files`);
}

main();
