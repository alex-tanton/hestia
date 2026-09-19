import { defineConfig, devices } from '@playwright/test';

// Journeys run against the full stack through Caddy, never against Flipp itself.
const baseURL = process.env['HEARTH_E2E_BASE_URL'] ?? 'http://127.0.0.1:8080';
const isCi = process.env['CI'] !== undefined;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
