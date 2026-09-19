/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest stubs CSS imports (even ?raw) to empty strings, so the token file is read from disk.
const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');

/**
 * Verifies the token file against Branding › Contrast requirements in both themes, so a token
 * edit that breaks WCAG AA fails here rather than in an axe run.
 */
const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const sectionStart = css.indexOf("[data-section='dashboard']");

function declarations(source: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of source.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name && value) map.set(name, value.trim());
  }
  return map;
}

const light = declarations(css.slice(0, darkStart));
const dark = new Map([...light, ...declarations(css.slice(darkStart, sectionStart))]);

function resolve(theme: Map<string, string>, name: string): string {
  const value = theme.get(name);
  if (value === undefined) throw new Error(`Missing token ${name}`);
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  return reference?.[1] ? resolve(theme, reference[1]) : value;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const [red = 0, green = 0, blue = 0] = channels;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(theme: Map<string, string>, foreground: string, background: string): number {
  const a = luminance(resolve(theme, foreground));
  const b = luminance(resolve(theme, background));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const SECTIONS = ['dashboard', 'lists', 'meals', 'bills', 'chores'];
const SURFACES = ['--bg-base', '--bg-raised'];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (_name, theme) => {
  it.each(['--text-primary', '--text-secondary', '--text-muted'])(
    '%s meets 4.5:1 on both surfaces',
    (token) => {
      for (const surface of SURFACES)
        expect(contrast(theme, token, surface)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('border-input meets 3:1 on both surfaces', () => {
    for (const surface of SURFACES) {
      expect(contrast(theme, '--border-input', surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(SECTIONS)('%s: text 4.5:1, filled button 4.5:1, accent 3:1, badge 4.5:1', (section) => {
    expect(contrast(theme, `--${section}`, '--bg-base')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme, `--on-${section}`, `--${section}`)).toBeGreaterThanOrEqual(4.5);
    for (const surface of SURFACES) {
      expect(contrast(theme, `--${section}-accent`, surface)).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(theme, `--${section}-accent`, `--${section}-tint`)).toBeGreaterThanOrEqual(3);
    expect(contrast(theme, `--on-${section}-badge`, `--${section}-badge`)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it.each(['danger', 'warning', 'success', 'info'])(
    '%s: text 4.5:1, filled 4.5:1, icon 3:1',
    (role) => {
      expect(contrast(theme, `--${role}`, '--bg-base')).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme, `--on-${role}`, `--${role}`)).toBeGreaterThanOrEqual(4.5);
      for (const surface of SURFACES) {
        expect(contrast(theme, `--${role}-accent`, surface)).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it.each(['danger', 'warning', 'neutral'])('%s badge meets 4.5:1', (role) => {
    expect(contrast(theme, `--on-${role}-badge`, `--${role}-badge`)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Branding values', () => {
  it('uses the listed section and semantic values', () => {
    expect(resolve(light, '--lists')).toBe('#15803d');
    expect(resolve(light, '--lists-accent')).toBe('#16a34a');
    expect(resolve(dark, '--lists')).toBe('#4ade80');
    expect(resolve(light, '--meals')).toBe('#b45309');
    expect(resolve(dark, '--meals')).toBe('#fbbf24');
    expect(resolve(light, '--bills')).toBe('#2563eb');
    expect(resolve(dark, '--bills')).toBe('#60a5fa');
    expect(resolve(light, '--chores')).toBe('#7c3aed');
    expect(resolve(dark, '--chores')).toBe('#a78bfa');
    expect(resolve(light, '--dashboard')).toBe('#475569');
    expect(resolve(dark, '--dashboard')).toBe('#94a3b8');
    expect(resolve(dark, '--on-lists')).toBe('#0f172a');
    expect(resolve(light, '--info')).toBe('#0e7490');
  });
});
