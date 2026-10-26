/*
 * Post-build checks on `dist/`, run by `pnpm build`.
 *
 * 1. The app shell stays under its 200KB gzipped budget. The shell is the entry chunk plus
 *    everything `index.html` preloads with it.
 * 2. The magic-link screens obey their flag:
 *    with `VITE_MAGIC_LINK_ENABLED` off, none of their copy is in the build at all; with it on,
 *    the copy is there but never in the shell, because both screens are behind lazy routes.
 * 3. The product is named Hestia where it is installed and shown: the Web App Manifest `name` and
 *    `short_name`, and the `<title>` of `index.html`.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const WEB = resolve(import.meta.dirname, '..');
const DIST = join(WEB, 'dist');
const SHELL_BUDGET_BYTES = 200 * 1024;

/**
 * Sentences that exist only on the magic-link screens. Each is checked against the source file
 * that owns it as well, so copy cannot drift out from under this check unnoticed.
 */
const MAGIC_LINK_COPY = [
  { text: 'Email me a sign-in link', source: 'src/screens/onboarding/SignInScreen.tsx' },
  {
    text: 'We sent a sign-in link and a 6-digit code to',
    source: 'src/screens/onboarding/magic-link.ts',
  },
  {
    text: 'Enter the 6-digit code we sent to',
    source: 'src/screens/onboarding/magic-link.ts',
  },
  {
    text: 'That code is incorrect or has expired. Ask for a new one.',
    source: 'src/screens/onboarding/magic-link.ts',
  },
];

const failures = [];

function fail(message) {
  failures.push(message);
}

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const textFiles = walk(DIST).filter((path) => /\.(js|css|html|webmanifest)$/.test(path));
const contents = new Map(textFiles.map((path) => [path, readFileSync(path, 'utf8')]));

// The shell: the module `index.html` loads, the modules it preloads, and the stylesheet.
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const shell = [...html.matchAll(/(?:src|href)="\/([^"]+\.(?:js|css))"/g)].map(([, href]) =>
  join(DIST, href),
);
if (shell.length === 0) fail('index.html referenced no entry chunk; the build looks wrong.');

const shellBytes = shell.reduce(
  (total, path) => total + gzipSync(readFileSync(path)).byteLength,
  gzipSync(Buffer.from(html)).byteLength,
);
const shellKb = (shellBytes / 1024).toFixed(1);
const budgetKb = SHELL_BUDGET_BYTES / 1024;
if (shellBytes > SHELL_BUDGET_BYTES) {
  fail(`App shell is ${shellKb} KB gzipped, over the ${budgetKb} KB budget.`);
}

const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8'));
if (manifest.name !== 'Hestia') {
  fail(`manifest name is ${JSON.stringify(manifest.name)}, expected "Hestia"`);
}
if (manifest.short_name !== 'Hestia') {
  fail(`manifest short_name is ${JSON.stringify(manifest.short_name)}, expected "Hestia"`);
}
if (!html.includes('<title>Hestia</title>')) fail('index.html <title> is not Hestia');

const isMagicLinkEnabled = process.env['VITE_MAGIC_LINK_ENABLED'] === 'true';

for (const { text, source } of MAGIC_LINK_COPY) {
  if (!readFileSync(join(WEB, source), 'utf8').includes(text)) {
    fail(`"${text}" is no longer in ${source}; this check is testing nothing.`);
    continue;
  }

  const built = [...contents].filter(([, content]) => content.includes(text)).map(([path]) => path);
  if (!isMagicLinkEnabled) {
    if (built.length > 0) {
      fail(`Magic link is off, but "${text}" shipped in ${built.join(', ')}.`);
    }
    continue;
  }

  if (built.length === 0) fail(`Magic link is on, but "${text}" is in no built asset.`);
  const inShell = built.filter((path) => shell.includes(path));
  if (inShell.length > 0) {
    fail(`"${text}" is in the app shell (${inShell.join(', ')}); it belongs to a lazy route.`);
  }
}

const flagState = isMagicLinkEnabled ? 'on' : 'off';
if (failures.length > 0) {
  console.error(`Build checks failed (magic link ${flagState}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `App shell ${shellKb} KB gzipped (budget ${budgetKb} KB); magic link ${flagState}, as built.`,
);
