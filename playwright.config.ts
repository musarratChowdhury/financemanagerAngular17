import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests. Not part of CI (the GitHub Actions workflow only runs the
 * Karma unit suite) — run them by hand against a deployed build:
 *
 *   npx playwright install chromium
 *   npx playwright test
 *
 * Set BASE_URL to point at a local dev server, e.g. BASE_URL=http://localhost:4200.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://financemanager.muhit.dev',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});