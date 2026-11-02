/*
 * Documentation checks for phase 7: no broken Markdown link, no lost fact, no dropped clause.
 * Dependency-free; run from the repository root.
 *
 *   node 07-doc-checks.mjs links [file...]
 *   node 07-doc-checks.mjs facts [--source PATH] [--dest PATH] PLAN.md...
 *   node 07-doc-checks.mjs coverage [--source PATH] [--dest PATH] PLAN.md...
 *
 * links     Checks every inline Markdown link and image target. Default files: README.md,
 *           CONTRIBUTING.md, docs/*.md (sorted) and .claude/CLAUDE.md. Fenced blocks and inline
 *           code are skipped; URL-scheme targets are not checked. The path must exist, and a
 *           fragment on a .md target must equal the GitHub anchor of one of its headings.
 *           Output: BROKEN <file>:<line>: <target> (missing file|missing anchor), then
 *           `doc-links: files=N links=N broken=N`.
 * facts     Reads `fact: <source> -> <dest> :: <literal>` rows from the plans. The literal must be
 *           in the source (at the pre-phase commit) and in the destination (working tree), or, for
 *           a reworded row `<source literal> => <destination literal>`, each in its own text.
 *           Output: MAP-ERROR / MISSING lines, then
 *           `fact-map: facts=N plans=N missing=N map-errors=N`.
 * coverage  Reads `cover: <source> <first>-<last> -> <dest>[,<dest>...]` rows and splits that line
 *           range of the source (at the pre-phase commit) into units: code lines, table rows and
 *           prose clauses. A unit is verbatim in a destination, or backed by a passing fact row
 *           whose source literal occurs in it; any other unit is UNCOVERED.
 *           Output: UNCOVERED <source>:<line> [kind] <unit>, then
 *           `coverage: plans=N ranges=N units=N verbatim=N backed=N uncovered=N`.
 *
 * Whitespace runs collapse and a leading `>` blockquote marker is dropped before any comparison,
 * so rewrapping a paragraph is not a loss.
 *
 * Exit codes: 0 pass; 1 findings; 2 the check could not decide (unreadable input, a row that does
 * not parse, a map error, nothing to check).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const BASE = 'a21db4731f9fdf7939a56ca2d7bcc9d731fc4a2b';
const FENCE = /^\s*(```|~~~)/;

class Undecidable extends Error {}

function fail(message) {
  console.error(`07-doc-checks: ${message}`);
  process.exit(2);
}

function readWorking(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new Undecidable(`cannot read ${path}`);
  }
}

const baseCache = new Map();
function readBase(path) {
  if (!baseCache.has(path)) {
    try {
      const text = execFileSync('git', ['show', `${BASE}:${path}`], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      baseCache.set(path, text);
    } catch {
      throw new Undecidable(`cannot read ${path} at ${BASE}`);
    }
  }
  return baseCache.get(path);
}

/** Drops carriage returns and one leading `>` marker per line, then collapses whitespace. */
function normalize(text) {
  return text
    .replaceAll('\r', '')
    .split('\n')
    .map((line) => line.replace(/^\s*>\s?/, ''))
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------------------------
// links

function stripInlineCode(line) {
  return line.replace(/(`+)(.+?)\1/g, '');
}

function headingText(raw) {
  return raw
    .replace(/\s+#+\s*$/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .trim();
}

function githubAnchors(markdown) {
  const seen = new Map();
  const anchors = new Set();
  let fence = false;
  for (const line of markdown.split('\n')) {
    if (FENCE.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const match = /^ {0,3}#{1,6}\s+(.*)$/.exec(line);
    if (match?.[1] === undefined) continue;
    const base = headingText(match[1])
      .toLowerCase()
      .replace(/[^\p{L}\p{N} _-]/gu, '')
      .replaceAll(' ', '-');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${String(count)}`);
  }
  return anchors;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function runLinks(args) {
  let files = args;
  if (files.length === 0) {
    const docs = readdirSync('docs')
      .filter((name) => name.endsWith('.md'))
      .sort()
      .map((name) => `docs/${name}`);
    files = ['README.md', 'CONTRIBUTING.md', ...docs, '.claude/CLAUDE.md'];
  }
  const anchorCache = new Map();
  let links = 0;
  let broken = 0;
  for (const file of files) {
    const lines = readWorking(file).split('\n');
    let fence = false;
    lines.forEach((rawLine, index) => {
      if (FENCE.test(rawLine)) {
        fence = !fence;
        return;
      }
      if (fence) return;
      for (const match of stripInlineCode(rawLine).matchAll(
        /\]\(([^)\s]*)(?:\s+"[^"]*")?\)/g,
      )) {
        const target = match[1] ?? '';
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target)) continue;
        links += 1;
        const hash = target.indexOf('#');
        const pathPart = safeDecode(hash === -1 ? target : target.slice(0, hash));
        const fragment = hash === -1 ? '' : safeDecode(target.slice(hash + 1));
        const resolved =
          pathPart === ''
            ? file
            : pathPart.startsWith('/')
              ? resolve(pathPart.slice(1))
              : join(dirname(file), pathPart);
        const where = `${file}:${String(index + 1)}`;
        if (!existsSync(resolved)) {
          broken += 1;
          console.log(`BROKEN ${where}: ${target} (missing file)`);
          continue;
        }
        if (fragment === '' || !resolved.endsWith('.md') || !statSync(resolved).isFile()) continue;
        if (!anchorCache.has(resolved)) {
          anchorCache.set(resolved, githubAnchors(readWorking(resolved)));
        }
        if (!anchorCache.get(resolved).has(fragment)) {
          broken += 1;
          console.log(`BROKEN ${where}: ${target} (missing anchor)`);
        }
      }
    });
  }
  console.log(`doc-links: files=${String(files.length)} links=${String(links)} broken=${String(broken)}`);
  if (links === 0) return 2;
  return broken > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------------------------
// plan rows

function parseFilters(args) {
  const filters = { source: undefined, dest: undefined, plans: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--source' || arg === '--dest') {
      const value = args[index + 1];
      if (value === undefined) throw new Undecidable(`${arg} needs a value`);
      filters[arg === '--source' ? 'source' : 'dest'] = value;
      index += 1;
    } else if (arg !== undefined) {
      filters.plans.push(arg);
    }
  }
  if (filters.plans.length === 0) throw new Undecidable('no plan file given');
  return filters;
}

function planLines(plans) {
  return plans.flatMap((plan) => readWorking(plan).split('\n').map((line) => line.replace(/\r$/, '')));
}

/** Parses every `fact:` row; a row that does not parse is a map error. */
function loadFacts(lines, errors) {
  const rows = [];
  for (const line of lines) {
    if (!line.startsWith('fact: ')) continue;
    const match = /^fact: (\S+) -> (\S+) :: (.*)$/.exec(line);
    if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) {
      errors.push(`MAP-ERROR unparsable row: ${line}`);
      continue;
    }
    const written = match[3];
    const split = written.indexOf(' => ');
    const sourceLiteral = split === -1 ? written : written.slice(0, split);
    const destLiteral = split === -1 ? written : written.slice(split + 4);
    rows.push({
      source: match[1],
      dest: match[2],
      written,
      sourceLiteral: normalize(sourceLiteral),
      destLiteral: normalize(destLiteral),
    });
  }
  return rows;
}

/** True when the row's source literal is in its source at the base commit (else records an error). */
function checkSource(row, errors) {
  if (!normalize(readBase(row.source)).includes(row.sourceLiteral)) {
    errors.push(`MAP-ERROR ${row.source} -> ${row.dest} :: ${row.written} (not in the source at ${BASE})`);
    return false;
  }
  return true;
}

function destPasses(row) {
  return normalize(readWorking(row.dest)).includes(row.destLiteral);
}

function runFacts(args) {
  const filters = parseFilters(args);
  const errors = [];
  const rows = loadFacts(planLines(filters.plans), errors).filter(
    (row) =>
      (filters.source === undefined || row.source === filters.source) &&
      (filters.dest === undefined || row.dest === filters.dest),
  );
  let missing = 0;
  for (const row of rows) {
    if (!checkSource(row, errors)) continue;
    if (!destPasses(row)) {
      missing += 1;
      console.log(`MISSING ${row.source} -> ${row.dest} :: ${row.written}`);
    }
  }
  for (const error of errors) console.log(error);
  console.log(
    `fact-map: facts=${String(rows.length)} plans=${String(filters.plans.length)} missing=${String(missing)} map-errors=${String(errors.length)}`,
  );
  if (errors.length > 0 || rows.length === 0) return 2;
  return missing > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------------------------
// coverage

function splitOutsideCode(text, isBoundary) {
  const parts = [];
  let inCode = false;
  let start = 0;
  let index = 0;
  while (index < text.length) {
    if (text[index] === '`') {
      inCode = !inCode;
      index += 1;
      continue;
    }
    const cut = inCode ? undefined : isBoundary(text, index);
    if (cut === undefined) {
      index += 1;
      continue;
    }
    parts.push(text.slice(start, cut.end));
    start = cut.next;
    index = cut.next;
  }
  parts.push(text.slice(start));
  return parts;
}

function sentenceBoundary(text, index) {
  if (!'.!?'.includes(text[index])) return undefined;
  if (text[index + 1] !== ' ') return undefined;
  if (!/[A-Z`(*["]/.test(text[index + 2] ?? '')) return undefined;
  return { end: index + 1, next: index + 2 };
}

function clauseBoundary(text, index) {
  if ((text[index] === ';' || text[index] === ':') && text[index + 1] === ' ') {
    return { end: index + 1, next: index + 2 };
  }
  if (text.startsWith(' — ', index)) return { end: index, next: index + 3 };
  return undefined;
}

function proseUnits(paragraph) {
  const units = [];
  for (const sentence of splitOutsideCode(normalize(paragraph.lines.join('\n')), sentenceBoundary)) {
    for (const clause of splitOutsideCode(sentence, clauseBoundary)) {
      const cleaned = clause.trim().replace(/[.,;:]+$/, '').trim();
      if (cleaned !== '') units.push({ line: paragraph.first, kind: 'prose', text: cleaned });
    }
  }
  return units;
}

function rangeUnits(sourceText, first, last, label) {
  const all = sourceText.split('\n');
  if (first < 1 || last > all.length || first > last) {
    throw new Undecidable(`range ${String(first)}-${String(last)} is outside ${label}`);
  }
  const units = [];
  let fence = false;
  let paragraph;
  const flush = () => {
    if (paragraph !== undefined) units.push(...proseUnits(paragraph));
    paragraph = undefined;
  };
  for (let number = first; number <= last; number += 1) {
    const line = (all[number - 1] ?? '').replace(/\r$/, '');
    if (FENCE.test(line)) {
      flush();
      fence = !fence;
      continue;
    }
    if (fence) {
      if (line.trim() !== '') units.push({ line: number, kind: 'code', text: normalize(line) });
      continue;
    }
    if (line.trim() === '' || /^#{1,6} /.test(line)) {
      flush();
    } else if (/^\s*\|/.test(line)) {
      flush();
      if (!/^[\s|:-]+$/.test(line)) units.push({ line: number, kind: 'table', text: normalize(line) });
    } else {
      const item = /^\s*(?:[-*+]|\d+\.)\s+(.*)$/.exec(line);
      if (item?.[1] !== undefined) {
        flush();
        paragraph = { first: number, lines: [item[1]] };
      } else if (paragraph === undefined) {
        paragraph = { first: number, lines: [line] };
      } else {
        paragraph.lines.push(line);
      }
    }
  }
  flush();
  return units;
}

function runCoverage(args) {
  const filters = parseFilters(args);
  const lines = planLines(filters.plans);
  const errors = [];
  const facts = loadFacts(lines, errors);
  for (const row of facts) checkSource(row, errors);
  const passing = facts.filter((row) => destPasses(row));

  const covers = [];
  for (const line of lines) {
    if (!line.startsWith('cover: ')) continue;
    const match = /^cover: (\S+) (\d+)-(\d+) -> (\S+)$/.exec(line);
    if (match?.[1] === undefined) {
      errors.push(`MAP-ERROR unparsable row: ${line}`);
      continue;
    }
    const dests = (match[4] ?? '').split(',');
    covers.push({ source: match[1], first: Number(match[2]), last: Number(match[3]), dests });
  }
  const kept = covers.filter(
    (cover) =>
      (filters.source === undefined || cover.source === filters.source) &&
      (filters.dest === undefined || cover.dests.includes(filters.dest)),
  );

  const counts = { units: 0, verbatim: 0, backed: 0, uncovered: 0 };
  for (const cover of kept) {
    const units = rangeUnits(readBase(cover.source), cover.first, cover.last, cover.source);
    const destLines = cover.dests.map((dest) => {
      const text = readWorking(dest);
      return {
        whole: normalize(text),
        lines: new Set(text.split('\n').map((entry) => normalize(entry))),
      };
    });
    const backing = passing.filter(
      (row) => row.source === cover.source && cover.dests.includes(row.dest),
    );
    for (const unit of units) {
      counts.units += 1;
      const verbatim = destLines.some((dest) =>
        unit.kind === 'prose' ? dest.whole.includes(unit.text) : dest.lines.has(unit.text),
      );
      if (verbatim) {
        counts.verbatim += 1;
      } else if (backing.some((row) => unit.text.includes(row.sourceLiteral))) {
        counts.backed += 1;
      } else {
        counts.uncovered += 1;
        console.log(`UNCOVERED ${cover.source}:${String(unit.line)} [${unit.kind}] ${unit.text}`);
      }
    }
  }
  for (const error of errors) console.log(error);
  console.log(
    `coverage: plans=${String(filters.plans.length)} ranges=${String(kept.length)} units=${String(counts.units)} verbatim=${String(counts.verbatim)} backed=${String(counts.backed)} uncovered=${String(counts.uncovered)}`,
  );
  if (errors.length > 0 || counts.units === 0) return 2;
  return counts.uncovered > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------------------------

const [mode, ...rest] = process.argv.slice(2);
const MODES = { links: runLinks, facts: runFacts, coverage: runCoverage };
const run = mode !== undefined && Object.hasOwn(MODES, mode) ? MODES[mode] : undefined;
if (run === undefined) fail('usage: 07-doc-checks.mjs links|facts|coverage [options] [files]');
try {
  process.exitCode = run(rest);
} catch (error) {
  if (!(error instanceof Undecidable)) throw error;
  fail(error.message);
}
