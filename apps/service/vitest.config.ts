import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['../../test/clock-setup.mjs'],
    globalSetup: ['../../test/global-tz.mjs'],
    // Integration tests need the supabase start database: pnpm test:integration.
    exclude: ['src/**/*.integration.test.ts', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/main.ts', 'src/db/types.ts', 'src/test/**'],
      reporter: ['text', 'html', 'json-summary'],
    },
  },
});
