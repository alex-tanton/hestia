/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const cssBuffer = readFileSync(join(process.cwd(), 'src/styles/tokens.css'));
const css = cssBuffer.toString('utf8');

const rootIndex = css.indexOf(':root {');
const mediaDarkIndex = css.indexOf('@media (prefers-color-scheme: dark) {');
const notLightIndex = css.indexOf(":root:not([data-theme='light']) {");
const lightOverrideIndex = css.indexOf(":root[data-theme='light'] {");
const darkOverrideIndex = css.indexOf(":root[data-theme='dark'] {");

function declarations(source: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of source.matchAll(/(--[\w-]+):\s*([^;]*);/g)) {
    const [, name, value] = match;
    if (name && value !== undefined) {
      map.set(name, value.trim());
    }
  }
  return map;
}

const rootBlock = css.slice(rootIndex, mediaDarkIndex);
const osDarkBlock = css.slice(notLightIndex, lightOverrideIndex);
const explicitLightBlock = css.slice(lightOverrideIndex, darkOverrideIndex);
const explicitDarkBlock = css.slice(darkOverrideIndex);

const defaultLight = declarations(rootBlock);
const osDark = new Map([...defaultLight, ...declarations(osDarkBlock)]);
const explicitLight = new Map([...osDark, ...declarations(explicitLightBlock)]);
const explicitDark = new Map([...defaultLight, ...declarations(explicitDarkBlock)]);

function resolve(theme: Map<string, string>, name: string): string {
  const value = theme.get(name);
  if (value === undefined) {
    throw new Error(`Missing token ${name}`);
  }
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

const SURFACE_TIERS = [
  '--md-sys-color-surface',
  '--md-sys-color-surface-container-lowest',
  '--md-sys-color-surface-container-low',
  '--md-sys-color-surface-container',
  '--md-sys-color-surface-container-high',
  '--md-sys-color-surface-container-highest',
] as const;

const CONTAINER_TIERS = [
  '--md-sys-color-surface-container-lowest',
  '--md-sys-color-surface-container-low',
  '--md-sys-color-surface-container',
  '--md-sys-color-surface-container-high',
  '--md-sys-color-surface-container-highest',
] as const;

const FOREGROUND_TEXT_ROLES = [
  '--md-sys-color-on-surface',
  '--md-sys-color-on-surface-variant',
  '--md-sys-color-primary',
  '--md-sys-color-error',
  '--md-sys-color-success',
  '--md-sys-color-warning',
  '--md-sys-color-info',
] as const;

const ON_PAIR_ROLES = [
  ['--md-sys-color-on-primary', '--md-sys-color-primary'],
  ['--md-sys-color-on-secondary', '--md-sys-color-secondary'],
  ['--md-sys-color-on-tertiary', '--md-sys-color-tertiary'],
  ['--md-sys-color-on-error', '--md-sys-color-error'],
  ['--md-sys-color-on-success', '--md-sys-color-success'],
  ['--md-sys-color-on-warning', '--md-sys-color-warning'],
  ['--md-sys-color-on-info', '--md-sys-color-info'],
  ['--md-sys-color-on-primary-container', '--md-sys-color-primary-container'],
  ['--md-sys-color-on-secondary-container', '--md-sys-color-secondary-container'],
  ['--md-sys-color-on-tertiary-container', '--md-sys-color-tertiary-container'],
  ['--md-sys-color-on-error-container', '--md-sys-color-error-container'],
  ['--md-sys-color-on-success-container', '--md-sys-color-success-container'],
  ['--md-sys-color-on-warning-container', '--md-sys-color-warning-container'],
  ['--md-sys-color-on-info-container', '--md-sys-color-info-container'],
  ['--md-sys-color-inverse-on-surface', '--md-sys-color-inverse-surface'],
  ['--md-sys-color-inverse-primary', '--md-sys-color-inverse-surface'],
] as const;

describe('tokens.css file invariants and cascade determinism', () => {
  it('uses pure LF endings and zero empty values or external font CDN URLs', () => {
    expect(cssBuffer.includes(0x0d)).toBe(false);
    expect(css).not.toMatch(/fonts\.googleapis|fonts\.gstatic|https?:\/\//i);

    for (const [name, value] of defaultLight) {
      expect(value.length, `empty value for ${name}`).toBeGreaterThan(0);
    }
    for (const block of [osDarkBlock, explicitLightBlock, explicitDarkBlock]) {
      for (const [name, value] of declarations(block)) {
        expect(value.length, `empty value for ${name}`).toBeGreaterThan(0);
      }
    }
  });

  it('orders :root, dark prefers-color-scheme fallback, [data-theme=light], and [data-theme=dark]', () => {
    expect(rootIndex).toBeGreaterThan(-1);
    expect(mediaDarkIndex).toBeGreaterThan(rootIndex);
    expect(notLightIndex).toBeGreaterThan(mediaDarkIndex);
    expect(lightOverrideIndex).toBeGreaterThan(notLightIndex);
    expect(darkOverrideIndex).toBeGreaterThan(lightOverrideIndex);

    expect(resolve(defaultLight, '--md-sys-color-surface')).toBe(
      resolve(explicitLight, '--md-sys-color-surface'),
    );
    expect(resolve(osDark, '--md-sys-color-surface')).toBe(
      resolve(explicitDark, '--md-sys-color-surface'),
    );

    const osDarkKeys = [...declarations(osDarkBlock).keys()];
    const lightOverrideKeys = [...declarations(explicitLightBlock).keys()];
    const darkOverrideKeys = [...declarations(explicitDarkBlock).keys()];
    expect(lightOverrideKeys).toEqual(osDarkKeys);
    expect(darkOverrideKeys).toEqual(osDarkKeys);
  });

  it('defines static system sans-serif stack, 4 contract typescale sizes, shape, and elevation tokens', () => {
    const plainFont = resolve(defaultLight, '--md-ref-typeface-plain');
    expect(plainFont).toContain('ui-sans-serif');
    expect(plainFont).toContain('system-ui');
    expect(resolve(defaultLight, '--md-ref-typeface-brand')).toBe(plainFont);
    expect(resolve(defaultLight, '--md-sys-typescale-body-large-font')).toBe(plainFont);

    const sizeMatches = [...css.matchAll(/--md-sys-typescale-[\w-]+-size:\s*([^;]+);/g)].map(
      (match) => match[1]?.trim(),
    );
    expect(sizeMatches.length).toBeGreaterThan(0);
    for (const size of sizeMatches) {
      expect(['0.875rem', '1rem', '1.25rem', '1.75rem']).toContain(size);
    }

    const weightMatches = [...css.matchAll(/--md-sys-typescale-[\w-]+-weight:\s*([^;]+);/g)].map(
      (match) => match[1]?.trim(),
    );
    expect(weightMatches.length).toBeGreaterThan(0);
    for (const weight of weightMatches) {
      expect(['400', '600']).toContain(weight);
    }

    expect(resolve(defaultLight, '--md-sys-shape-corner-medium')).toBe('12px');
    expect(resolve(defaultLight, '--md-sys-elevation-level0')).toBe('none');
    expect(resolve(defaultLight, '--md-sys-elevation-1')).toBe(
      resolve(defaultLight, '--md-sys-elevation-level1'),
    );
    expect(resolve(defaultLight, '--md-sys-elevation-3')).toBe(
      resolve(defaultLight, '--md-sys-elevation-level3'),
    );
    expect(resolve(defaultLight, '--md-sys-elevation-level5')).not.toBe('none');
  });
});

// Computed via @material/material-color-utilities SchemeTonalSpot(Hct('#B4532A'), isDark, 0.0)
const EXPECTED_SCHEME_TIERS = [
  [
    'light',
    defaultLight,
    {
      '--md-sys-color-primary': '#8e4c32',
      '--md-sys-color-surface': '#fff8f6',
      '--md-sys-color-on-surface': '#231a16',
      '--md-sys-color-surface-container-lowest': '#ffffff',
      '--md-sys-color-surface-container-low': '#fff1ec',
      '--md-sys-color-surface-container': '#fceae4',
      '--md-sys-color-surface-container-high': '#f7e4df',
      '--md-sys-color-surface-container-highest': '#f1dfd9',
    },
  ],
  [
    'dark',
    explicitDark,
    {
      '--md-sys-color-primary': '#ffb599',
      '--md-sys-color-surface': '#1a110e',
      '--md-sys-color-on-surface': '#f1dfd9',
      '--md-sys-color-surface-container-lowest': '#140c09',
      '--md-sys-color-surface-container-low': '#231a16',
      '--md-sys-color-surface-container': '#271e1a',
      '--md-sys-color-surface-container-high': '#322824',
      '--md-sys-color-surface-container-highest': '#3d322f',
    },
  ],
] as const;

describe('Warm Terracotta #B4532A SchemeTonalSpot fidelity', () => {
  it.each(EXPECTED_SCHEME_TIERS)(
    '%s block matches SchemeTonalSpot and has 5 distinct surface-container-* tiers',
    (_mode, theme, expected) => {
      for (const [token, hex] of Object.entries(expected)) {
        expect(resolve(theme, token), token).toBe(hex);
      }

      const containerValues = CONTAINER_TIERS.map((tier) => resolve(theme, tier));
      expect(new Set(containerValues).size).toBe(5);
    },
  );
});

describe.each([
  ['default light (:root)', defaultLight],
  ['OS dark fallback (:root:not([data-theme="light"]))', osDark],
  ['explicit light (:root[data-theme="light"])', explicitLight],
  ['explicit dark (:root[data-theme="dark"])', explicitDark],
])('%s WCAG AA contrast across all surface elevation tiers', (_mode, theme) => {
  it.each(SURFACE_TIERS)(
    '%s satisfies >= 4.5:1 text contrast and >= 3.0:1 outline contrast',
    (surfaceToken) => {
      for (const fgToken of FOREGROUND_TEXT_ROLES) {
        expect(
          contrast(theme, fgToken, surfaceToken),
          `${fgToken} on ${surfaceToken}`,
        ).toBeGreaterThanOrEqual(4.5);
      }

      expect(
        contrast(theme, '--md-sys-color-outline', surfaceToken),
        `--md-sys-color-outline on ${surfaceToken}`,
      ).toBeGreaterThanOrEqual(3.0);
    },
  );

  it.each(ON_PAIR_ROLES)('%s on %s meets >= 4.5:1 AA contrast', (foreground, background) => {
    expect(contrast(theme, foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
