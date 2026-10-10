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
      exclude: [
        'src/**/*.test.ts',
        'src/main.ts',
        'src/db/types.ts',
        'src/test/**',
        // A build-time script invoked only by `pnpm build` (writes dist/openapi.json); never run
        // at service runtime or by any test.
        'src/write-openapi.ts',
        // Pure `export interface`/`export type` declarations with no runtime logic to exercise.
        'src/deals/deal-source.ts',
        'src/jobs/types.ts',
        // A `.d.ts` ambient module declaration for the untyped `web-push` package; no runtime code.
        'src/push/web-push.d.ts',
        // A pure `export {...} from '...'` re-export barrel: V8 attributes no statement coverage
        // to bare re-exports even when the module is imported and its exports called (confirmed by
        // `jobs/index.test.ts`, which does exactly that and still measures 0% here) — there is no
        // test that can move this number, so it is excluded rather than chased.
        'src/jobs/index.ts',
      ],
      reporter: ['text', 'html', 'json-summary'],
      // Measured at 96.65% stmts / 85.78% branch / 98.07% funcs / 98.56% lines as of the coverage
      // unit (test/service-coverage-and-fixtures); each number below sits a few points under that,
      // a real floor rather than the exact measurement, so ordinary churn doesn't fail CI on noise.
      thresholds: {
        statements: 95,
        branches: 83,
        functions: 96,
        lines: 97,
      },
    },
  },
});
