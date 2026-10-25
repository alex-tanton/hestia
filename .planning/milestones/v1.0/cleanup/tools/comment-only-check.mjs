/*
 * Proves a set of edits is comment-only: for each changed script file it prints the base and the
 * edited version through the TypeScript compiler with comments removed and requires identical
 * output. Empty JSX comment containers and whitespace-only JSX text are normalised away so that
 * deleting a whole `{/* ... *\/}` child passes. A removed line that holds a lint, type or coverage
 * directive fails the file even when the printed output matches.
 *
 * Usage: node comment-only-check.mjs --repo R --base REF [--head REF] [--titles] [-- pathspec...]
 *   --head omitted: the working tree of R is compared against REF.
 *   --titles: also ignore the first argument of describe/it/test calls (title commits only).
 * Output: `FAIL {path}` lines, then `OK {n} files ({k} non-TS skipped)` with exit 0, or exit 1.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const SCRIPT_EXT = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const TITLE_FNS = new Set(['describe', 'it', 'test']);
const CURRIED_TABLE_FNS = new Set(['each', 'for']);
const DIRECTIVE_GUARD =
  /eslint-disable|@ts-|v8 ignore|c8 ignore|istanbul|prettier-ignore|<reference|^#!|^#\s*syntax=/;

function usage() {
  console.error(
    'usage: node comment-only-check.mjs --repo R --base REF [--head REF] [--titles] [-- pathspec...]',
  );
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { repo: null, base: null, head: null, titles: false, paths: [] };
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
    } else if (arg === '--titles') {
      opts.titles = true;
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

function scriptKind(fileName) {
  if (/x$/.test(fileName)) return ts.ScriptKind.TSX;
  if (/\.[cm]?js$/.test(fileName)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/** The identifier a test-title call is rooted at, or null when the callee is anything else. */
function titleRoot(callee) {
  let node = callee;
  let lastName = null;
  while (ts.isPropertyAccessExpression(node)) {
    lastName ??= node.name.text;
    node = node.expression;
  }
  if (!ts.isIdentifier(node) || !TITLE_FNS.has(node.text)) return null;
  return { lastName };
}

export function isTitleCall(call) {
  if (call.arguments.length === 0) return false;
  const callee = call.expression;
  // it.each(table)('title', fn): the outer call's callee is itself a call.
  if (ts.isCallExpression(callee)) {
    const inner = titleRoot(callee.expression);
    return inner !== null && CURRIED_TABLE_FNS.has(inner.lastName);
  }
  const root = titleRoot(callee);
  return root !== null && !CURRIED_TABLE_FNS.has(root.lastName);
}

/** JSX whitespace rule: trim each line, drop empty lines, join with one space. */
function cleanJsxText(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  const kept = [];
  lines.forEach((line, index) => {
    let value = line.replace(/\t/g, ' ');
    if (index !== 0) value = value.replace(/^ +/, '');
    if (index !== lines.length - 1) value = value.replace(/ +$/, '');
    if (value !== '') kept.push(value);
  });
  return kept.join(' ');
}

export function normalize(text, fileName, { titles = false } = {}) {
  const source = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    false,
    scriptKind(fileName),
  );
  const transformer = (context) => {
    const factory = context.factory;
    const visit = (node) => {
      if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
        const children = [];
        for (const child of node.children) {
          if (ts.isJsxExpression(child) && !child.expression) continue;
          if (ts.isJsxText(child)) {
            const cleaned = cleanJsxText(child.text);
            if (cleaned !== '') children.push(factory.createJsxText(cleaned, false));
            continue;
          }
          children.push(ts.visitNode(child, visit));
        }
        return ts.isJsxElement(node)
          ? factory.updateJsxElement(
              node,
              ts.visitNode(node.openingElement, visit),
              children,
              ts.visitNode(node.closingElement, visit),
            )
          : factory.updateJsxFragment(
              node,
              ts.visitNode(node.openingFragment, visit),
              children,
              ts.visitNode(node.closingFragment, visit),
            );
      }
      if (titles && ts.isCallExpression(node) && isTitleCall(node)) {
        const [, ...rest] = node.arguments;
        return factory.updateCallExpression(
          node,
          ts.visitNode(node.expression, visit),
          node.typeArguments,
          [factory.createStringLiteral('<title>'), ...rest.map((arg) => ts.visitNode(arg, visit))],
        );
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (root) => ts.visitNode(root, visit);
  };
  const result = ts.transform(source, [transformer]);
  const printed = ts
    .createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed })
    .printFile(result.transformed[0]);
  result.dispose();
  return printed;
}

function changedFiles(opts) {
  const args = ['diff', '--name-only', '--diff-filter=ACDMRT', opts.base];
  if (opts.head) args.push(opts.head);
  args.push('--', ...(opts.paths.length > 0 ? opts.paths : ['.']));
  return git(opts.repo, args)
    .split('\n')
    .filter((line) => line !== '');
}

function showAt(opts, ref, path) {
  try {
    return git(opts.repo, ['show', `${ref}:${path}`]);
  } catch {
    return null;
  }
}

function readEdited(opts, path) {
  if (opts.head) return showAt(opts, opts.head, path);
  try {
    return readFileSync(join(opts.repo, path), 'utf8');
  } catch {
    return null;
  }
}

function removedDirectiveLines(opts, path) {
  const args = ['diff', '-U0', opts.base];
  if (opts.head) args.push(opts.head);
  args.push('--', path);
  const removed = [];
  for (const line of git(opts.repo, args).split('\n')) {
    if (line.startsWith('-') && !line.startsWith('---') && DIRECTIVE_GUARD.test(line.slice(1))) {
      removed.push(line.slice(1).trim());
    }
  }
  return removed;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const files = changedFiles(opts);
  let checked = 0;
  let skipped = 0;
  let failed = 0;
  for (const path of files) {
    const directives = removedDirectiveLines(opts, path);
    if (directives.length > 0) {
      failed += 1;
      console.log(`FAIL ${path} (removed directive line: ${directives[0]})`);
      continue;
    }
    if (!SCRIPT_EXT.test(path)) {
      skipped += 1;
      continue;
    }
    checked += 1;
    const before = showAt(opts, opts.base, path);
    const after = readEdited(opts, path);
    if (before === null || after === null) {
      failed += 1;
      console.log(`FAIL ${path} (file added or deleted)`);
      continue;
    }
    const same =
      normalize(before, path, { titles: opts.titles }) ===
      normalize(after, path, { titles: opts.titles });
    if (!same) {
      failed += 1;
      console.log(`FAIL ${path}`);
    }
  }
  if (failed > 0) {
    console.log(`FAILED ${failed} of ${files.length} files`);
    process.exit(1);
  }
  console.log(`OK ${checked} files (${skipped} non-TS skipped)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
