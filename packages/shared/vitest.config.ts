import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['../../test/clock-setup.mjs'],
    globalSetup: ['../../test/global-tz.mjs'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // index.ts is a pure re-export barrel (no logic of its own), so it is excluded from
      // coverage rather than carrying a meaningless "import works" test.
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      reporter: ['text', 'html', 'json-summary'],
      // Handoff Phase 4 and Engineering Practices "Coverage": shared's logic is pure and
      // thoroughly tested. Enforced by `pnpm test`, which runs with --coverage, so a drop fails
      // the gate.
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
