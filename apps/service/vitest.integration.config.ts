import { defineConfig } from 'vitest/config';

// Runs against the `supabase start` Postgres, migrated from supabase/migrations/. Requests made
// through the route-level tests commit for real, so isolation comes from each test creating its own
// users, households and unique keys (see docs/testing.md). Files run one at a time: fixtures share
// natural keys (a postal code's refresh row), and concurrent uncommitted inserts of the same key
// would wait on each other. Integration tests run on the real clock that Postgres also uses, so the
// config validates `TZ` (globalSetup) and pins nothing.
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['../../test/global-tz.mjs'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
