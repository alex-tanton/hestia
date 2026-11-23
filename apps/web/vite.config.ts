import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

// Google Material 3 Blue light surface color.
const THEME_COLOR = '#faf8ff';

const DOM_UNIT_TS_TESTS = [
  'src/lib/auth/auth-client.test.ts',
  'src/lib/barcode/detector.test.ts',
  'src/lib/offline/chore-errand-writes.test.ts',
  'src/lib/push/device-subscription.test.ts',
  'src/lib/push/push-port.test.ts',
  'src/screens/deals/refresh-poll.test.ts',
];

const ZBAR_CDN_IMPORT_RE =
  /^https:\/\/cdn\.jsdelivr\.net\/npm\/@undecaf\/zbar-wasm@[^/]+\/dist\/main\.js$/;

/**
 * Redirects `@undecaf/barcode-detector-polyfill`'s hardcoded jsDelivr ESM import to the installed
 * local `@undecaf/zbar-wasm` package so production builds stay CSP (`'self'`) and offline safe.
 */
function localZbarWasmPlugin(): Plugin {
  return {
    name: 'local-zbar-wasm',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!ZBAR_CDN_IMPORT_RE.test(source)) return null;
      return this.resolve('@undecaf/zbar-wasm', importer, { skipSelf: true });
    },
  };
}

/*
 * In production one origin serves the PWA, `/api`, and `/auth/v1`, so the app only ever calls
 * same-origin paths. The dev server and `vite preview` stand in for Caddy by proxying those two
 * prefixes; the addresses default to `supabase start` and a locally run service.
 */
const proxy = {
  '/api': { target: process.env['HESTIA_DEV_API'] ?? 'http://127.0.0.1:3000', changeOrigin: true },
  '/auth/v1': {
    target: process.env['HESTIA_DEV_SUPABASE'] ?? 'http://127.0.0.1:54321',
    changeOrigin: true,
  },
  '/realtime/v1': {
    target: process.env['HESTIA_DEV_SUPABASE'] ?? 'http://127.0.0.1:54321',
    changeOrigin: true,
    ws: true,
  },
};

export default defineConfig({
  envPrefix: 'HESTIA_PUBLIC_',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { proxy },
  preview: { proxy },
  optimizeDeps: {
    exclude: ['@undecaf/barcode-detector-polyfill', '@undecaf/zbar-wasm'],
  },
  plugins: [
    localZbarWasmPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      /*
       * The service worker is ours, not generated: `src/sw.ts`
       * precaches the build and adds the push handlers, and this plugin only injects the precache
       * manifest into it. Every other caching rule lives in that file.
       */
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // A waiting service worker must never reload under the user;
      // the shell shows an "Update available" affordance instead.
      registerType: 'prompt',
      // The app registers the worker itself through useRegisterSW (the update prompt), so no
      // registration script is injected; this also keeps the CSP's script-src 'self' inline-free.
      injectRegister: false,
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Hestia',
        short_name: 'Hestia',
        description: 'Deals, shopping lists, meals, bills, and chores for your household.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: THEME_COLOR,
        background_color: THEME_COLOR,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,wasm}'],
      },
    }),
  ],
  build: {
    modulePreload: {
      resolveDependencies(_filename, deps) {
        return deps.filter((dep) => !dep.includes('Button') && !dep.includes('Icon'));
      },
    },
  },
  test: {
    globalSetup: ['../../test/global-tz.mjs'],
    testTimeout: 30_000,
    projects: [
      {
        extends: false,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: [...DOM_UNIT_TS_TESTS],
          setupFiles: ['../../test/clock-setup.mjs'],
        },
      },
      {
        extends: true,
        resolve: {
          conditions: ['browser', 'development'],
        },
        ssr: {
          resolve: {
            conditions: ['browser', 'development'],
          },
        },
        test: {
          name: 'dom',
          environment: 'jsdom',
          server: {
            deps: {
              // Inline @material/web and Lit packages so Vitest applies the 'browser' export
              // condition instead of Node's default 'node' condition (where isServer === true).
              inline: [/@material\/web/, /^@lit\//, /^lit(?:-|$|\/)/],
            },
          },
          include: ['src/**/*.test.tsx', ...DOM_UNIT_TS_TESTS],
          setupFiles: ['src/test-setup.ts', '../../test/clock-setup.mjs'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/test-setup.ts'],
      reporter: ['text', 'html', 'json-summary'],
      // Measured post-purge of legacy Tailwind bridges, ComingSoon shim, and unused icon shims:
      // 83.45% statements, 78.70% branches, 76.60% functions, and 84.93% lines.
      // Each threshold is calibrated per D-12 (measured value rounded down minus one point).
      // CI's test-unit job runs `pnpm --filter @hestia/web test:coverage` on every pull request and
      // push to main, so these numbers gate every merge.
      thresholds: { statements: 82, branches: 77, functions: 75, lines: 83 },
    },
  },
});
