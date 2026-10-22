import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['../../test/clock-setup.mjs'],
    globalSetup: ['../../test/global-tz.mjs'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text', 'html', 'json-summary'],
      // The recurrence suite is 90%+.
      // Enforced by `pnpm test`, which runs with --coverage, so a drop fails the gate.
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
