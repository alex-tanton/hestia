import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMON_PASSWORD_MESSAGE } from '@hestia/shared';
import { validateNewPassword } from './password.ts';

describe('validateNewPassword', () => {
  it('passes a long, uncommon password', () => {
    expect(validateNewPassword('violet-teapot-harbor-17')).toBeUndefined();
  });

  it('gives the common-password sentence for a common password', () => {
    expect(validateNewPassword('Password1')).toBe(COMMON_PASSWORD_MESSAGE);
  });

  it('gives the length rule for a short password', () => {
    expect(validateNewPassword('a1b2')).toBe('Use at least 8 characters.');
  });
});

const REPO = resolve(import.meta.dirname, '../../../..');
const SHARED = join(REPO, 'packages/shared/src');
const COMMON_PASSWORDS = join(SHARED, 'common-passwords.ts');

/* Static specifiers only: a lazy route's `import(...)` is exactly what must not be followed. */
const PATTERNS = [
  /^import\s+[^;]*?\sfrom\s*'([^']+)'/gm,
  /^import\s*'([^']+)'/gm,
  /^export\s+(?:\*|\{[^;]*?\})\s*from\s*'([^']+)'/gm,
];

function resolveSpecifier(specifier: string, fromFile: string): string | undefined {
  if (specifier === '@hestia/shared') return join(SHARED, 'index.ts');
  if (specifier.startsWith('@hestia/shared/')) {
    return join(SHARED, `${specifier.slice('@hestia/shared/'.length)}.ts`);
  }
  if (!specifier.startsWith('.')) return undefined; // node_modules: not our graph
  // Shared compiles for NodeNext and so writes `.js`; the file next to it is the `.ts`.
  const path = resolve(dirname(fromFile), specifier.replace(/\.js$/, '.ts'));
  return /\.(ts|tsx)$/.test(path) ? path : undefined;
}

function staticImportGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const pattern of PATTERNS) {
      for (const [, specifier] of source.matchAll(pattern)) {
        const next = specifier === undefined ? undefined : resolveSpecifier(specifier, file);
        if (next !== undefined) queue.push(next);
      }
    }
  }
  return seen;
}

/**
 * The app shell has a budget of 200 KB gzipped and
 * the common-password list is 99 KB of text, so nothing the shell loads eagerly may reach it.
 * Walking the static imports from the entry point is what "eagerly" means to the bundler.
 */
describe('the app shell', () => {
  const eager = staticImportGraph(join(import.meta.dirname, '../main.tsx'));

  it('never reaches the common-password list', () => {
    expect(eager).not.toContain(COMMON_PASSWORDS);
    expect(eager).not.toContain(join(SHARED, 'data/common-passwords.ts'));
  });

  it('is walking a real graph, not an empty one', () => {
    expect(eager).toContain(join(SHARED, 'index.ts'));
    expect(eager.size).toBeGreaterThan(30);
  });

  it('leaves the list to the screens that set a password', () => {
    for (const screen of [
      'screens/onboarding/SignUpScreen.tsx',
      'screens/onboarding/SetPasswordScreen.tsx',
      'screens/settings/account/ChangePasswordForm.tsx',
    ]) {
      expect(staticImportGraph(join(import.meta.dirname, '..', screen))).toContain(
        COMMON_PASSWORDS,
      );
    }
  });
});
