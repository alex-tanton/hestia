import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// Branding: the Dashboard slate is the section-neutral color.
const THEME_COLOR = '#475569';

export default defineConfig({
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
