#!/usr/bin/env node
// Normalizes `knip --reporter json` output into sorted `kind<TAB>path<TAB>symbol` lines
// followed by `total<TAB>n<TAB>-`. Usage: knip-summary.mjs {knip.json} {out.txt}
// JSON shape (knip 6.41.0): { issues: [{ file, <kind>: [{ name, ... }] }] }; `files` entries
// carry the path as `name`; `duplicates` entries are arrays of { name } groups.
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: knip-summary.mjs {knip json} {out txt}');
  process.exit(2);
}

const report = JSON.parse(readFileSync(input, 'utf8'));
const lines = [];
for (const issue of report.issues ?? []) {
  for (const [kind, entries] of Object.entries(issue)) {
    if (kind === 'file' || !Array.isArray(entries)) continue;
    for (const entry of entries) {
      let path = issue.file;
      let symbol = '-';
      if (kind === 'files') {
        path = entry.name ?? issue.file;
      } else if (Array.isArray(entry)) {
        symbol = entry.map((e) => e.name).join('|');
      } else if (entry && typeof entry === 'object') {
        symbol = entry.name ?? '-';
      } else {
        symbol = String(entry);
      }
      lines.push([kind, path, symbol]);
    }
  }
}
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
lines.sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]) || cmp(a[2], b[2]));
const out = lines.map((l) => l.join('\t'));
out.push(`total\t${lines.length}\t-`);
writeFileSync(output, out.join('\n') + '\n');
