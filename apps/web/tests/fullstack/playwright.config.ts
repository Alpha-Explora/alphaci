import { defineConfig, devices } from '@playwright/test';

/* The full-stack journeys (journeys.spec.ts). run.ts starts the stack and runs
 * Playwright with this config and FULLSTACK_BASE_URL; use `npm run
 * test:fullstack`, not `playwright test` on its own. One worker: the tests
 * share one API and database. */

const CI = Boolean(process.env.CI);
const baseURL = process.env.FULLSTACK_BASE_URL;
if (!baseURL)
  throw new Error('FULLSTACK_BASE_URL is unset: run npm run test:fullstack.');

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  outputDir: '../../test-results/fullstack/playwright',
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: [
    [CI ? 'github' : 'list'],
    [
      'html',
      { open: 'never', outputFolder: '../../test-results/fullstack/report' },
    ],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
