import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './support/env.ts';

const isCi = process.env['CI'] !== undefined;

/**
 * Journeys run against the full Compose stack through Caddy, never against Flipp itself.
 * global-setup brings that stack up from an empty database and global-teardown takes it down, so
 * `pnpm test:e2e` is the whole command.
 *
 * One worker, in file order: the journeys share one database and each leaves the seeded
 * households in a state the next accounts for. For the same reason there are no retries — a retry
 * of "remove Sam from Oak Street" would find Sam already gone and report a failure that says
 * nothing. A flake has to be fixed rather than retried away.
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCi,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: isCi
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env['HEARTH_E2E_BASE_URL'] ?? BASE_URL,
    // The seed households run on New York time, and the app renders instants such as "As of"
    // stamps in the viewer's zone, so pinning the browser keeps rendered times independent of the
    // runner's zone (CI runs in UTC). Calendar dates already follow the household.
    timezoneId: 'America/New_York',
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
