import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

// Branding: the Dashboard slate is the section-neutral color.
const THEME_COLOR = '#475569';

/*
 * In production one origin serves the PWA, `/api`, and `/auth/v1`, so the app only ever calls
 * same-origin paths. The dev server and `vite preview` stand in for Caddy by proxying those two
 * prefixes; the addresses default to `supabase start` and a locally run service.
 */
const proxy = {
  '/api': { target: process.env['HEARTH_DEV_API'] ?? 'http://127.0.0.1:3000', changeOrigin: true },
  '/auth/v1': {
    target: process.env['HEARTH_DEV_SUPABASE'] ?? 'http://127.0.0.1:54321',
    changeOrigin: true,
  },
  '/realtime/v1': {
    target: process.env['HEARTH_DEV_SUPABASE'] ?? 'http://127.0.0.1:54321',
    changeOrigin: true,
    ws: true,
  },
};

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { proxy },
  preview: { proxy },
  plugins: [
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
        name: 'Hearth',
        short_name: 'Hearth',
        description: 'Deals, shopping lists, meals, bills, and chores for your household.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: THEME_COLOR,
        background_color: '#FFFFFF',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts', '../../test/clock-setup.mjs'],
    globalSetup: ['../../test/global-tz.mjs'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/test-setup.ts'],
      reporter: ['text', 'html', 'json-summary'],
      // Measured on this branch after closing the worst coverage gaps (sw.ts, the realtime and
      // push ports, and the untested screens); each number sits a few points under that measured
      // value as a safety margin, so normal drift doesn't fail the gate while a real regression
      // still does. Enforced by `pnpm --filter @hearth/web test:coverage`.
      thresholds: { statements: 82, branches: 78, functions: 74, lines: 84 },
    },
  },
});
