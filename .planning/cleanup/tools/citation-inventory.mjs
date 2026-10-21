/*
 * Inventory, removal and review queue for citations of the retired spec documents (RED-04).
 * The vocabulary is the single-line regex in cit-rx.txt beside this file.
 *
 * Usage:
 *   node citation-inventory.mjs inventory --repo R [--out F.tsv|-] [-- pathspec...]
 *   node citation-inventory.mjs apply-pure --repo R [-- pathspec...]
 *   node citation-inventory.mjs queue --repo R [--out F.md] [-- pathspec...]
 *
 * Every scan skips `.planning/`, `docs/` and `supabase/migrations/`. One inventory row is written
 * per matching line: `path line end_line kind class text`.
 *   kind:  comment | string | jsx-text | html-text | prose | code
 *   class: pure   a parenthetical that only points at a retired document (auto-removable)
 *          mixed  any other parenthetical (it also carries a rule: rewrite by hand)
 *          title  a string that is part of the first argument of describe/it/test
 *          prose  everything else (text outside parentheses, other strings, non-comment text)
 * `apply-pure` removes only `pure` parentheticals inside comments and edits nothing else.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { isTitleCall } from './comment-only-check.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const VOCAB_FILE = join(HERE, 'cit-rx.txt');
const VOCAB = readFileSync(VOCAB_FILE, 'utf8').trim();
const EXCLUDES = [':!.planning', ':!docs', ':!supabase/migrations'];
const CONTEXT_LINES = 3;
const PRINT_WIDTH = 100;

const STYLES = {
  '//': { type: 'line', open: /^\/\/+\s?/ },
  '#': { type: 'line', open: /^#\s?/ },
  '--': { type: 'line', open: /^--\s?/ },
  c: { type: 'block', open: /^\/\*+\s?/, close: 2, mid: /^\s*\*(?!\/)\s?/ },
  html: { type: 'block', open: /^<!--\s?/, close: 3, mid: /^\s*/ },
};

// ---------------------------------------------------------------------------------------------
// git and arguments

function usage() {
  console.error(
    'usage: node citation-inventory.mjs {inventory|apply-pure|queue} --repo R [--out F] [-- pathspec...]',
  );
  process.exit(2);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!['inventory', 'apply-pure', 'queue'].includes(command ?? '')) usage();
  const opts = { command, repo: null, out: '-', paths: [] };
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--') {
      opts.paths = rest.slice(i + 1);
      break;
    } else if (rest[i] === '--repo') {
      opts.repo = rest[++i];
    } else if (rest[i] === '--out') {
      opts.out = rest[++i];
    } else {
      usage();
    }
  }
  if (!opts.repo) usage();
  return opts;
}

function listFiles(repo, paths) {
  const spec = paths.length > 0 ? paths : ['.'];
  try {
    return execFileSync(
      'git',
      ['-C', repo, 'grep', '-lE', '-f', VOCAB_FILE, '--', ...spec, ...EXCLUDES],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    )
      .split('\n')
      .filter((line) => line !== '')
      .sort();
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// file syntax and comment ranges

function syntaxOf(path) {
  const base = basename(path);
  const ext = extname(path);
  if (/\.(?:[cm]?[jt]s|[jt]sx)$/.test(path)) return 'ts';
  if (['.sh', '.yml', '.yaml', '.toml'].includes(ext)) return 'hash';
  if (base === 'Caddyfile' || base.includes('Dockerfile') || base.startsWith('.env')) return 'hash';
  if (ext === '.sql') return 'sql';
  if (ext === '.css') return 'css';
  if (ext === '.html') return 'html';
  if (ext === '.md') return 'md';
  return 'other';
}

function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function lineIndex(starts, offset) {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (starts[mid] <= offset) low = mid;
    else high = mid - 1;
  }
  return low;
}

function lineEndOf(text, starts, index) {
  const end = index + 1 < starts.length ? starts[index + 1] - 1 : text.length;
  return end > starts[index] && text[end - 1] === '\r' ? end - 1 : end;
}

/** Line comments introduced by `marker`, ignoring markers inside quotes. */
function lineMarkerRanges(text, marker, skip) {
  const ranges = [];
  const starts = lineStarts(text);
  starts.forEach((start, index) => {
    const end = lineEndOf(text, starts, index);
    let quote = null;
    for (let i = start; i < end; i += 1) {
      const ch = text[i];
      if (skip(i)) continue;
      if (quote) {
        if (ch === '\\' && quote === '"') i += 1;
        else if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (text.startsWith(marker, i)) {
        const standalone = text.slice(start, i).trim() === '';
        const spaced = i === start || /\s/.test(text[i - 1]);
        const shebang = i === 0 && text.startsWith('#!');
        if (!shebang && (standalone || spaced || marker === '--')) {
          ranges.push({ pos: i, end, style: marker });
        }
        break;
      }
    }
  });
  return ranges;
}

function blockRanges(text, open, close, style) {
  const ranges = [];
  let from = 0;
  for (;;) {
    const pos = text.indexOf(open, from);
    if (pos === -1) break;
    const closeAt = text.indexOf(close, pos + open.length);
    const end = closeAt === -1 ? text.length : closeAt + close.length;
    ranges.push({ pos, end, style });
    from = end;
  }
  return ranges;
}

function inAny(ranges, offset) {
  return ranges.some((range) => range.pos <= offset && offset < range.end);
}

function titleOf(node) {
  let current = node;
  while (
    current.parent &&
    (ts.isParenthesizedExpression(current.parent) ||
      ts.isTemplateExpression(current.parent) ||
      ts.isTemplateSpan(current.parent) ||
      (ts.isBinaryExpression(current.parent) &&
        current.parent.operatorToken.kind === ts.SyntaxKind.PlusToken))
  ) {
    current = current.parent;
  }
  const parent = current.parent;
  return Boolean(
    parent &&
      ts.isCallExpression(parent) &&
      parent.arguments[0] === current &&
      isTitleCall(parent),
  );
}

function analyzeTs(text, path) {
  const kind = /x$/.test(path)
    ? ts.ScriptKind.TSX
    : /\.[cm]?js$/.test(path)
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
  const found = new Map();
  const literals = [];
  const addComments = (list) => {
    for (const range of list ?? []) {
      found.set(range.pos, {
        pos: range.pos,
        end: range.end,
        style: text.startsWith('//', range.pos) ? '//' : 'c',
      });
    }
  };
  const visit = (node) => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) {
      return;
    }
    const children = node.getChildren(source);
    if (children.length > 0) {
      children.forEach(visit);
      return;
    }
    if (ts.isJsxText(node)) {
      literals.push({ pos: node.pos, end: node.end, kind: 'jsx-text', title: false });
      return;
    }
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isRegularExpressionLiteral(node)
    ) {
      literals.push({
        pos: node.getStart(source),
        end: node.end,
        kind: 'string',
        title: !ts.isRegularExpressionLiteral(node) && titleOf(node),
      });
    }
    addComments(ts.getLeadingCommentRanges(text, node.pos));
    addComments(ts.getTrailingCommentRanges(text, node.end));
  };
  visit(source);
  // Trailing-trivia scans can start inside JSX text or a template; those are not comments.
  const ranges = [...found.values()]
    .filter((range) => !inAny(literals, range.pos))
    .sort((a, b) => a.pos - b.pos);
  return { ranges, literals };
}

function analyzeOther(text, syntax) {
  if (syntax === 'hash') return { ranges: lineMarkerRanges(text, '#', () => false), literals: [] };
  if (syntax === 'css') return { ranges: blockRanges(text, '/*', '*/', 'c'), literals: [] };
  if (syntax === 'html') return { ranges: blockRanges(text, '<!--', '-->', 'html'), literals: [] };
  if (syntax === 'sql') {
    const blocks = blockRanges(text, '/*', '*/', 'c');
    const lines = lineMarkerRanges(text, '--', (offset) => inAny(blocks, offset));
    return { ranges: [...blocks, ...lines].sort((a, b) => a.pos - b.pos), literals: [] };
  }
  return { ranges: [], literals: [] };
}

// ---------------------------------------------------------------------------------------------
// comment units: a block comment, or a run of adjacent standalone line comments

function recordsForRange(text, starts, range) {
  const style = STYLES[range.style];
  const first = lineIndex(starts, range.pos);
  const records = [];
  if (style.type === 'line') {
    const lineEnd = lineEndOf(text, starts, first);
    const opened = text.slice(range.pos, lineEnd).match(style.open);
    const preEnd = range.pos + (opened ? opened[0].length : 0);
    records.push({
      line: first,
      pre: text.slice(starts[first], preEnd),
      body: text.slice(preEnd, lineEnd).replace(/\s+$/, ''),
      suf: '',
    });
    return records;
  }
  const last = lineIndex(starts, Math.max(range.pos, range.end - 1));
  const bodyLimit = range.end - style.close;
  for (let index = first; index <= last; index += 1) {
    const lineStart = starts[index];
    const lineEnd = lineEndOf(text, starts, index);
    let preEnd;
    if (index === first) {
      const opened = text.slice(range.pos, lineEnd).match(style.open);
      preEnd = range.pos + (opened ? opened[0].length : 0);
    } else {
      const lead = text.slice(lineStart, lineEnd).match(style.mid);
      preEnd = lineStart + (lead ? lead[0].length : 0);
    }
    let bodyEnd = index === last ? Math.min(bodyLimit, lineEnd) : lineEnd;
    if (bodyEnd < preEnd) bodyEnd = preEnd;
    while (bodyEnd > preEnd && /\s/.test(text[bodyEnd - 1])) bodyEnd -= 1;
    records.push({
      line: index,
      pre: text.slice(lineStart, preEnd),
      body: text.slice(preEnd, bodyEnd),
      suf: text.slice(bodyEnd, lineEnd),
    });
  }
  return records;
}

function buildUnits(text, starts, ranges) {
  const units = [];
  for (const range of ranges) {
    const style = STYLES[range.style];
    const records = recordsForRange(text, starts, range);
    const standalone = text.slice(starts[records[0].line], range.pos).trim() === '';
    const previous = units.at(-1);
    if (
      style.type === 'line' &&
      standalone &&
      previous &&
      previous.style === range.style &&
      previous.type === 'line' &&
      previous.records.at(-1).line + 1 === records[0].line
    ) {
      previous.records.push(...records);
      previous.end = range.end;
    } else {
      units.push({
        style: range.style,
        type: style.type,
        pos: range.pos,
        end: range.end,
        records,
      });
    }
  }
  return units;
}

function logicalText(unit) {
  const offsets = [];
  let offset = 0;
  const parts = unit.records.map((record) => {
    offsets.push(offset);
    offset += record.body.length + 1;
    return record.body;
  });
  return { text: parts.join('\n'), offsets };
}

function locate(offsets, offset) {
  let index = 0;
  for (let i = 0; i < offsets.length; i += 1) {
    if (offsets[i] <= offset) index = i;
  }
  return { index, col: offset - offsets[index] };
}

// ---------------------------------------------------------------------------------------------
// parenthetical groups and the pure test

function scanGroups(text, quoteAware) {
  const groups = [];
  const stack = [];
  let inQuote = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoteAware && ch === '"') {
      inQuote = !inQuote;
    } else if (!inQuote) {
      if (ch === '(') stack.push(i);
      else if (ch === ')' && stack.length > 0) groups.push({ start: stack.pop(), end: i + 1 });
    }
  }
  return { groups, balanced: stack.length === 0 && !inQuote };
}

function findGroups(text) {
  const aware = scanGroups(text, true);
  return aware.balanced ? aware.groups : scanGroups(text, false).groups;
}

function innermostGroup(groups, offset) {
  let best = null;
  for (const group of groups) {
    if (group.start <= offset && offset < group.end) {
      if (!best || group.end - group.start < best.end - best.start) best = group;
    }
  }
  return best;
}

const DOC_NAMES =
  'Product Requirements Document|Technical Architecture|Engineering Practices|Design System and UI Specification|Design System|Seed Data|Implementation Handoff|Handoff|PRD|Requirements|Design|Branding|Use Cases';
const PURE_TOKEN = new RegExp(
  `\\s+|${DOC_NAMES}|non-negotiables?|[Pp]hases? \\d+|[Aa]ppendix(?: [A-Z])?|[Ss]creens?|[Rr]ules?|[Ss]ections?|nos?\\.|and|see|per|cf\\.?|also|Q|\\d+(?:\\.\\d+)*[a-z]?(?:\\s*[–-]\\s*\\d+)?|[,;›→>—–/&-]`,
  'y',
);

function isPure(inner) {
  let value = inner.replace(/\s+/g, ' ').replace(/"[^"]*"/g, 'Q').replace(/“[^”]*”/g, 'Q');
  // Capitalised words after a section separator name a section of the retired document.
  value = value.replace(
    /›\s*[A-Z0-9][\w&/-]*(?:\s+(?:and|&|[A-Z0-9][\w&/-]*))*/g,
    '›',
  );
  PURE_TOKEN.lastIndex = 0;
  while (PURE_TOKEN.lastIndex < value.length) {
    const before = PURE_TOKEN.lastIndex;
    if (!PURE_TOKEN.test(value) || PURE_TOKEN.lastIndex === before) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// per-file analysis

function analyzeFile(path, text) {
  const syntax = syntaxOf(path);
  const starts = lineStarts(text);
  const { ranges, literals } =
    syntax === 'ts' ? analyzeTs(text, path) : analyzeOther(text, syntax);
  const units = buildUnits(text, starts, ranges);
  const unitByLine = new Map();
  units.forEach((unit) => {
    unit.logical = logicalText(unit);
    unit.groups = findGroups(unit.logical.text);
    unit.records.forEach((record, index) => unitByLine.set(record.line, { unit, index }));
  });
  return { syntax, starts, units, literals, unitByLine };
}

/** Classify the match that begins at `col` of line `lineIdx`. */
function classifyMatch(analysis, lineIdx, col, absolute) {
  const entry = analysis.unitByLine.get(lineIdx);
  if (entry) {
    const record = entry.unit.records[entry.index];
    const bodyCol = col - record.pre.length;
    if (bodyCol >= 0 && bodyCol < record.body.length) {
      const offset = entry.unit.logical.offsets[entry.index] + bodyCol;
      const group = innermostGroup(entry.unit.groups, offset);
      if (!group) return { kind: 'comment', klass: 'prose', endLine: lineIdx, group: null, entry };
      const inner = entry.unit.logical.text.slice(group.start + 1, group.end - 1);
      const end = locate(entry.unit.logical.offsets, group.end - 1);
      return {
        kind: 'comment',
        klass: isPure(inner) ? 'pure' : 'mixed',
        endLine: entry.unit.records[end.index].line,
        group,
        entry,
      };
    }
  }
  const literal = analysis.literals.find((item) => item.pos <= absolute && absolute < item.end);
  if (literal) {
    return {
      kind: literal.kind,
      klass: literal.title ? 'title' : 'prose',
      endLine: lineIdx,
      group: null,
    };
  }
  const fallback = { ts: 'code', html: 'html-text', md: 'prose', other: 'prose' }[analysis.syntax];
  return { kind: fallback ?? 'string', klass: 'prose', endLine: lineIdx, group: null };
}

function rowsForFile(path, text) {
  const analysis = analyzeFile(path, text);
  const lines = text.split('\n');
  const rows = [];
  const matcher = new RegExp(VOCAB, 'g');
  lines.forEach((raw, lineIdx) => {
    const line = raw.replace(/\r$/, '');
    const matches = [...line.matchAll(matcher)];
    if (matches.length === 0) return;
    const results = matches.map((match) =>
      classifyMatch(analysis, lineIdx, match.index, analysis.starts[lineIdx] + match.index),
    );
    const klasses = new Set(results.map((result) => result.klass));
    const klass = ['mixed', 'prose', 'pure', 'title'].find((name) => klasses.has(name));
    const kind = results.every((result) => result.kind === 'comment')
      ? 'comment'
      : results.find((result) => result.kind !== 'comment').kind;
    rows.push({
      path,
      line: lineIdx + 1,
      endLine: Math.max(...results.map((result) => result.endLine)) + 1,
      kind,
      klass,
      text: line.trim().replace(/\t/g, ' '),
    });
  });
  return { rows, analysis };
}

function readTracked(repo, path) {
  return readFileSync(join(repo, path), 'utf8');
}

function collectRows(opts) {
  const all = [];
  for (const path of listFiles(opts.repo, opts.paths)) {
    all.push(...rowsForFile(path, readTracked(opts.repo, path)).rows);
  }
  return all;
}

// ---------------------------------------------------------------------------------------------
// subcommands

function writeOut(target, content) {
  if (target === '-') process.stdout.write(content);
  else writeFileSync(target, content);
}

function inventory(opts) {
  const rows = collectRows(opts);
  const out = ['path\tline\tend_line\tkind\tclass\ttext'];
  for (const row of rows) {
    out.push([row.path, row.line, row.endLine, row.kind, row.klass, row.text].join('\t'));
  }
  writeOut(opts.out, `${out.join('\n')}\n`);
  console.error(`rows=${rows.length}`);
}

function queue(opts) {
  const rows = collectRows(opts);
  const out = [`# Citation queue (${rows.length} sites)`, ''];
  const cache = new Map();
  for (const row of rows) {
    if (!cache.has(row.path)) cache.set(row.path, readTracked(opts.repo, row.path).split('\n'));
    const lines = cache.get(row.path);
    const from = Math.max(1, row.line - CONTEXT_LINES);
    const to = Math.min(lines.length, Math.max(row.line, row.endLine) + CONTEXT_LINES);
    out.push(`## ${row.path}:${row.line}-${row.endLine} (${row.kind}, ${row.klass})`, '```');
    for (let n = from; n <= to; n += 1) out.push(`${n}: ${lines[n - 1] ?? ''}`);
    out.push('```', '');
  }
  writeOut(opts.out, `${out.join('\n')}\n`);
  console.error(`sites=${rows.length}`);
}

const PUNCTUATION_ONLY = /^[\s.,;:—-]*$/;

function render(record) {
  if (record.body === '') {
    if (/^\s*\*\s*$/.test(record.pre) && record.suf.trim().startsWith('*/')) {
      return `${record.pre.match(/^\s*/)[0]}${record.suf.trim()}`;
    }
    if (record.suf.trim() === '') return record.pre.trimEnd();
    return record.pre.trimEnd() + record.suf;
  }
  return record.pre + record.body + record.suf;
}

/** Remove the group [start, end) of the unit's logical text from its records. */
function removeGroup(unit, offsets, group) {
  const begin = locate(offsets, group.start);
  const finish = locate(offsets, group.end - 1);
  const first = unit.records[begin.index];
  const last = unit.records[finish.index];
  let left = first.body.slice(0, begin.col);
  let right = last.body.slice(finish.col + 1);
  if (left.trim() === '') {
    left = '';
    right = right.replace(/^\s+/, '');
    // A group that opened its line leaves its trailing punctuation to the previous line.
    const previous = unit.records[begin.index - 1];
    const trailing = right.match(/^([.,;:]+)\s*([\s\S]*)$/);
    if (previous && previous.body.trim() !== '' && trailing) {
      previous.body += trailing[1];
      right = trailing[2];
    }
  } else {
    left = left.replace(/\s+$/, '');
  }
  const merged = {
    line: first.line,
    pre: first.pre,
    body: left + right,
    suf: last.suf,
    modified: true,
  };
  // A merged line that would run past the print width keeps the original break instead.
  const tooLong = merged.pre.length + merged.body.length + merged.suf.length > PRINT_WIDTH;
  const split = right.match(/^([.,;:)\]]*)\s+(\S[\s\S]*)$/);
  const replacement = [merged];
  if (tooLong && begin.index !== finish.index && left !== '' && split) {
    replacement.splice(
      0,
      1,
      { line: first.line, pre: first.pre, body: left + split[1], suf: '', modified: true },
      { line: last.line, pre: last.pre, body: split[2], suf: last.suf, modified: true },
    );
  }
  unit.records.splice(begin.index, finish.index - begin.index + 1, ...replacement);
}

const SPECIAL_BODY = /^(?:[-*+•]\s|\d+[.)]\s|@\w|\||>|```|#\s)/;

function isPlain(record) {
  const body = record.body;
  return (
    body.trim() !== '' &&
    !/^\s{2,}/.test(body) &&
    !/\S {2,}\S/.test(body) &&
    !SPECIAL_BODY.test(body.trim())
  );
}

/** Refill each edited paragraph so a removal does not leave short, ragged lines behind. */
function reflow(records) {
  for (let i = 0; i < records.length; i += 1) {
    if (!records[i].modified || !isPlain(records[i])) continue;
    let j = i;
    while (records[j].suf.trim() === '' && j + 1 < records.length && isPlain(records[j + 1])) {
      j += 1;
    }
    if (j === i) continue;
    const continuation = records[i + 1].pre;
    const words = records
      .slice(i, j + 1)
      .map((record) => record.body.trim())
      .join(' ')
      .split(' ')
      .filter((word) => word !== '');
    const suffix = records[j].suf;
    const lines = [];
    let current = '';
    for (const word of words) {
      const pre = lines.length === 0 ? records[i].pre : continuation;
      if (current !== '' && pre.length + current.length + 1 + word.length > PRINT_WIDTH) {
        lines.push(current);
        current = word;
      } else {
        current = current === '' ? word : `${current} ${word}`;
      }
    }
    lines.push(current);
    const replacement = lines.map((body, index) => ({
      line: records[i].line,
      pre: index === 0 ? records[i].pre : continuation,
      body,
      suf: index === lines.length - 1 ? suffix : '',
      modified: true,
    }));
    records.splice(i, j - i + 1, ...replacement);
    i += replacement.length - 1;
  }
}

function applyToUnit(starts, lines, unit) {
  const candidates = [];
  for (const record of unit.records) {
    const row = unit.records.indexOf(record);
    const matcher = new RegExp(VOCAB, 'g');
    for (const match of record.body.matchAll(matcher)) {
      const offset = unit.logical.offsets[row] + match.index;
      const group = innermostGroup(unit.groups, offset);
      if (!group) continue;
      const inner = unit.logical.text.slice(group.start + 1, group.end - 1);
      if (isPure(inner) && !candidates.some((c) => c.start === group.start)) candidates.push(group);
    }
  }
  const chosen = candidates.filter(
    (group) =>
      !candidates.some(
        (other) =>
          other !== group &&
          other.start <= group.start &&
          group.end <= other.end &&
          other.end - other.start > group.end - group.start,
      ),
  );
  if (chosen.length === 0) return null;
  const originalFirst = unit.records[0].line;
  const originalLast = unit.records.at(-1).line;
  const offsets = unit.logical.offsets;
  const work = { ...unit, records: unit.records.map((record) => ({ ...record })) };
  for (const group of chosen.sort((a, b) => b.start - a.start)) removeGroup(work, offsets, group);
  reflow(work.records);
  const kept = work.records.filter((record) => {
    const droppable =
      record.modified &&
      PUNCTUATION_ONLY.test(record.body) &&
      !/\/\*|<!--/.test(record.pre) &&
      record.suf.trim() === '';
    return !droppable;
  });
  const blank = kept.every((record) => PUNCTUATION_ONLY.test(record.body));
  let replacement;
  if (blank) {
    const firstLine = lines[originalFirst];
    const lastLine = lines[originalLast];
    let before = firstLine.slice(0, unit.pos - starts[originalFirst]);
    let after = lastLine.slice(unit.end - starts[originalLast]);
    if (/\{\s*$/.test(before) && /^\s*\}/.test(after)) {
      before = before.replace(/\{\s*$/, '');
      after = after.replace(/^\s*\}/, '');
    }
    const rest = `${before.trimEnd()}${after.trim() === '' ? '' : ` ${after.trim()}`}`;
    replacement = rest.trim() === '' ? [] : [rest];
  } else {
    replacement = kept.map(render);
  }
  return { from: originalFirst, to: originalLast, replacement, removed: chosen.length };
}

function applyPure(opts) {
  let removed = 0;
  let files = 0;
  for (const path of listFiles(opts.repo, opts.paths)) {
    const text = readTracked(opts.repo, path);
    const { analysis } = rowsForFile(path, text);
    const lines = text.split('\n');
    const edits = [];
    for (const unit of analysis.units) {
      const edit = applyToUnit(analysis.starts, lines, unit);
      if (edit) edits.push(edit);
    }
    // Skip units whose lines overlap another edited unit's lines.
    const usable = edits.filter(
      (edit) =>
        !edits.some((other) => other !== edit && other.from <= edit.to && edit.from <= other.to),
    );
    if (usable.length === 0) continue;
    usable.sort((a, b) => b.from - a.from);
    for (const edit of usable) {
      lines.splice(edit.from, edit.to - edit.from + 1, ...edit.replacement);
      removed += edit.removed;
    }
    writeFileSync(join(opts.repo, path), lines.join('\n'));
    files += 1;
  }
  console.log(`removed=${removed} files=${files}`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.command === 'inventory') inventory(opts);
  else if (opts.command === 'queue') queue(opts);
  else applyPure(opts);
}

main();
