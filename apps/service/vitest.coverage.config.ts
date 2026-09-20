import { defineConfig } from 'vitest/config';

// Coverage over both layers at once (Engineering Practices, "Coverage": 80%+ on the service).
// Many service functions are exercised through the integration tests, so a unit-only number
// would understate what is covered. Needs the `supabase start` stack, like test:integration.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/main.ts', 'src/db/types.ts', 'src/test/**'],
      reporter: ['text', 'html', 'json-summary'],
    },
  },
});
