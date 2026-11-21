import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const SEED_HEX = '#B4532A';

const STATUS_SEEDS = [
  ['success', '#15803D'],
  ['warning', '#A16207'],
  ['info', '#0369A1'],
];

const SYSTEM_FONT_STACK = [
  '',
  "    ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,",
  "    'Helvetica Neue', Arial, sans-serif",
].join('\n');

const TYPEFACE_TOKENS = [
  ['--md-ref-typeface-brand', SYSTEM_FONT_STACK],
  ['--md-ref-typeface-plain', SYSTEM_FONT_STACK],
  ['--md-ref-typeface-weight-regular', '400'],
  ['--md-ref-typeface-weight-medium', '600'],
  ['--md-ref-typeface-weight-bold', '600'],
];

// Strictly locked to 4 contract sizes (0.875rem, 1rem, 1.25rem, 1.75rem) and 2 weights (400, 600).
const TYPESCALE_GROUPS = [
  ['display-large', 'var(--md-ref-typeface-plain)', '1.2', '1.75rem', '600'],
  ['display-medium', 'var(--md-ref-typeface-plain)', '1.2', '1.75rem', '600'],
  ['display-small', 'var(--md-ref-typeface-plain)', '1.2', '1.75rem', '600'],
  ['headline-large', 'var(--md-ref-typeface-plain)', '1.2', '1.25rem', '600'],
  ['headline-medium', 'var(--md-ref-typeface-plain)', '1.2', '1.25rem', '600'],
  ['headline-small', 'var(--md-ref-typeface-plain)', '1.2', '1.25rem', '600'],
  ['title-large', 'var(--md-ref-typeface-plain)', '1.2', '1.25rem', '600'],
  ['title-medium', 'var(--md-ref-typeface-plain)', '1.5', '1rem', '600'],
  ['title-small', 'var(--md-ref-typeface-plain)', '1.4', '0.875rem', '600'],
  ['body-large', 'var(--md-ref-typeface-plain)', '1.5', '1rem', '400'],
  ['body-medium', 'var(--md-ref-typeface-plain)', '1.4', '0.875rem', '400'],
  ['body-small', 'var(--md-ref-typeface-plain)', '1.4', '0.875rem', '400'],
  ['label-large', 'var(--md-ref-typeface-plain)', '1.4', '0.875rem', '600'],
  ['label-medium', 'var(--md-ref-typeface-plain)', '1.4', '0.875rem', '600'],
  ['label-small', 'var(--md-ref-typeface-plain)', '1.4', '0.875rem', '600'],
];

const SHAPE_TOKENS = [
  ['--md-sys-shape-corner-none', '0px'],
  ['--md-sys-shape-corner-extra-small', '4px'],
  ['--md-sys-shape-corner-small', '8px'],
  ['--md-sys-shape-corner-medium', '12px'],
  ['--md-sys-shape-corner-large', '16px'],
  ['--md-sys-shape-corner-extra-large', '28px'],
  ['--md-sys-shape-corner-full', '9999px'],
];

const ELEVATION_TOKENS = [
  ['--md-sys-elevation-level0', 'none'],
  ['--md-sys-elevation-level1', '0 1px 2px 0 rgb(0 0 0 / 0.3), 0 1px 3px 1px rgb(0 0 0 / 0.15)'],
  ['--md-sys-elevation-level2', '0 1px 2px 0 rgb(0 0 0 / 0.3), 0 2px 6px 2px rgb(0 0 0 / 0.15)'],
  ['--md-sys-elevation-level3', '0 1px 3px 0 rgb(0 0 0 / 0.3), 0 4px 8px 3px rgb(0 0 0 / 0.15)'],
  ['--md-sys-elevation-level4', '0 2px 3px 0 rgb(0 0 0 / 0.3), 0 6px 10px 4px rgb(0 0 0 / 0.15)'],
  ['--md-sys-elevation-level5', '0 4px 4px 0 rgb(0 0 0 / 0.3), 0 8px 12px 6px rgb(0 0 0 / 0.15)'],
  ['--md-sys-elevation-0', 'var(--md-sys-elevation-level0)'],
  ['--md-sys-elevation-1', 'var(--md-sys-elevation-level1)'],
  ['--md-sys-elevation-2', 'var(--md-sys-elevation-level2)'],
  ['--md-sys-elevation-3', 'var(--md-sys-elevation-level3)'],
];

const COLOR_ROLE_MAP = [
  ['--md-sys-color-primary', 'primary'],
  ['--md-sys-color-on-primary', 'onPrimary'],
  ['--md-sys-color-primary-container', 'primaryContainer'],
  ['--md-sys-color-on-primary-container', 'onPrimaryContainer'],
  ['--md-sys-color-secondary', 'secondary'],
  ['--md-sys-color-on-secondary', 'onSecondary'],
  ['--md-sys-color-secondary-container', 'secondaryContainer'],
  ['--md-sys-color-on-secondary-container', 'onSecondaryContainer'],
  ['--md-sys-color-tertiary', 'tertiary'],
  ['--md-sys-color-on-tertiary', 'onTertiary'],
  ['--md-sys-color-tertiary-container', 'tertiaryContainer'],
  ['--md-sys-color-on-tertiary-container', 'onTertiaryContainer'],
  ['--md-sys-color-error', 'error'],
  ['--md-sys-color-on-error', 'onError'],
  ['--md-sys-color-error-container', 'errorContainer'],
  ['--md-sys-color-on-error-container', 'onErrorContainer'],
  ['--md-sys-color-surface', 'surface'],
  ['--md-sys-color-surface-dim', 'surfaceDim'],
  ['--md-sys-color-surface-bright', 'surfaceBright'],
  ['--md-sys-color-surface-container-lowest', 'surfaceContainerLowest'],
  ['--md-sys-color-surface-container-low', 'surfaceContainerLow'],
  ['--md-sys-color-surface-container', 'surfaceContainer'],
  ['--md-sys-color-surface-container-high', 'surfaceContainerHigh'],
  ['--md-sys-color-surface-container-highest', 'surfaceContainerHighest'],
  ['--md-sys-color-on-surface', 'onSurface'],
  ['--md-sys-color-on-surface-variant', 'onSurfaceVariant'],
  ['--md-sys-color-outline', 'outline'],
  ['--md-sys-color-outline-variant', 'outlineVariant'],
  ['--md-sys-color-inverse-surface', 'inverseSurface'],
  ['--md-sys-color-inverse-on-surface', 'inverseOnSurface'],
  ['--md-sys-color-inverse-primary', 'inversePrimary'],
  ['--md-sys-color-scrim', 'scrim'],
  ['--md-sys-color-shadow', 'shadow'],
];

async function loadMaterialColorUtilities() {
  // @material/material-color-utilities@0.4.0 ships extensionless ESM specifiers; Vite SSR transforms it cleanly.
  const server = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true },
    configFile: false,
  });
  try {
    return await server.ssrLoadModule('@material/material-color-utilities');
  } finally {
    await server.close();
  }
}

function assertHex(value, name) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`Invalid hex color generated for ${name}: ${String(value)}`);
  }
  return value.toLowerCase();
}

function buildThemeColorEntries(mcu, isDark) {
  const {
    argbFromHex,
    hexFromArgb,
    Hct,
    SchemeTonalSpot,
    MaterialDynamicColors,
    Blend,
    TonalPalette,
  } = mcu;
  const seedArgb = argbFromHex(SEED_HEX);
  const scheme = new SchemeTonalSpot(Hct.fromInt(seedArgb), isDark, 0.0);

  const entries = COLOR_ROLE_MAP.map(([cssVar, colorKey]) => {
    const dynamicColor = MaterialDynamicColors[colorKey];
    if (!dynamicColor) {
      throw new Error(`Missing MaterialDynamicColors.${colorKey}`);
    }
    const hex = assertHex(hexFromArgb(dynamicColor.getArgb(scheme)), cssVar);
    return [cssVar, hex];
  });

  // Harmonized status tones clamped to Material TonalPalette roles to preserve WCAG AA contrast.
  for (const [role, baseHex] of STATUS_SEEDS) {
    const harmonized = Blend.harmonize(argbFromHex(baseHex), seedArgb);
    const harmonizedHct = Hct.fromInt(harmonized);
    const palette = TonalPalette.fromHueAndChroma(harmonizedHct.hue, harmonizedHct.chroma);

    const tones = isDark
      ? {
          main: 80,
          on: 20,
          container: 30,
          onContainer: 90,
        }
      : {
          main: 40,
          on: 100,
          container: 90,
          onContainer: 10,
        };

    entries.push(
      [
        `--md-sys-color-${role}`,
        assertHex(hexFromArgb(palette.tone(tones.main)), `--md-sys-color-${role}`),
      ],
      [
        `--md-sys-color-on-${role}`,
        assertHex(hexFromArgb(palette.tone(tones.on)), `--md-sys-color-on-${role}`),
      ],
      [
        `--md-sys-color-${role}-container`,
        assertHex(hexFromArgb(palette.tone(tones.container)), `--md-sys-color-${role}-container`),
      ],
      [
        `--md-sys-color-on-${role}-container`,
        assertHex(
          hexFromArgb(palette.tone(tones.onContainer)),
          `--md-sys-color-on-${role}-container`,
        ),
      ],
    );
  }

  return entries;
}

function buildStaticEntries() {
  const typescaleEntries = TYPESCALE_GROUPS.flatMap(([name, font, lineHeight, size, weight]) => [
    [`--md-sys-typescale-${name}-font`, font],
    [`--md-sys-typescale-${name}-line-height`, lineHeight],
    [`--md-sys-typescale-${name}-size`, size],
    [`--md-sys-typescale-${name}-weight`, weight],
  ]);

  return [...TYPEFACE_TOKENS, ...typescaleEntries, ...SHAPE_TOKENS, ...ELEVATION_TOKENS];
}

function formatDeclarations(entries, indent = '  ') {
  return entries
    .map(([name, value]) =>
      value.startsWith('\n') ? `${indent}${name}:${value};` : `${indent}${name}: ${value};`,
    )
    .join('\n');
}

function renderTokensCss(lightColors, darkColors) {
  const staticEntries = buildStaticEntries();

  return [
    '/* Generated by scripts/generate-tokens.mjs from Warm Terracotta seed #B4532A. Do not edit by hand. */',
    '',
    ':root {',
    formatDeclarations([['color-scheme', 'light dark'], ...staticEntries, ...lightColors]),
    '}',
    '',
    '@media (prefers-color-scheme: dark) {',
    "  :root:not([data-theme='light']) {",
    formatDeclarations([['color-scheme', 'dark'], ...darkColors], '    '),
    '  }',
    '}',
    '',
    ":root[data-theme='light'] {",
    formatDeclarations([['color-scheme', 'light'], ...lightColors]),
    '}',
    '',
    ":root[data-theme='dark'] {",
    formatDeclarations([['color-scheme', 'dark'], ...darkColors]),
    '}',
    '',
  ].join('\n');
}

async function main() {
  const mcu = await loadMaterialColorUtilities();
  const lightColors = buildThemeColorEntries(mcu, false);
  const darkColors = buildThemeColorEntries(mcu, true);
  const css = renderTokensCss(lightColors, darkColors);

  const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  const outPath = join(webRoot, 'src', 'styles', 'tokens.css');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, css, 'utf8');
}

await main();
