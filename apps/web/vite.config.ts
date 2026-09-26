import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

// Branding: the Dashboard slate is the section-neutral color.
const THEME_COLOR = '#475569';

/*
 * In production one origin serves the PWA, `/api`, and `/auth/v1` (Technical Architecture,
 * "Routing"), so the app only ever calls same-origin paths. The dev server and `vite preview`
 * stand in for Caddy by proxying those two prefixes; the addresses default to `supabase start`
 * and a locally run service.
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
      // Engineering Practices: a waiting service worker must never reload under the user;
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
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        // API responses are never cached by the service worker (TanStack Query persists them).
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/realtime\//],
        runtimeCaching: [
          {
            /*
             * Deal images load straight from Flipp's CDN: cache-first, 7-day expiry, 100-entry
             * cap (Engineering Practices › PWA implementation). `f.wishabi.net` serves item and
             * flyer images and `images.wishabi.net` serves merchant logos; they are the only two
             * hosts the CSP's `img-src` allows (Technical Architecture, "Routing"). Workbox
             * serializes this matcher into the worker, so the origins are written inline — a
             * reference to a constant out here would be undefined by the time it runs.
             * Cross-origin responses are opaque, so status 0 counts as cacheable alongside 200.
             */
            urlPattern: ({ url }) =>
              url.origin === 'https://f.wishabi.net' || url.origin === 'https://images.wishabi.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'deal-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/test-setup.ts'],
    },
  },
});
