import { defineConfig, devices } from '@playwright/test';

/* The mocked end-to-end suite (tests/e2e): a production build of the web, its
 * /api/v1 calls answered in the browser by each spec's mock backend.
 *
 * `npm run test:e2e` builds the app and starts it on port 4173; it never
 * reuses a server already there, which could be a stale build. To iterate
 * against `next dev`, set E2E_BASE_URL to it. The full-stack suite has its
 * own config (tests/fullstack/playwright.config.ts). */

const CI = Boolean(process.env.CI);
const PORT = 4173;
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.ts',
  outputDir: 'test-results/e2e',
  fullyParallel: true,
  forbidOnly: CI,
  // A test that passes only on its retry is reported as flaky, not hidden.
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  timeout: 120_000,
  reporter: CI
    ? [
        ['github'],
        ['html', { open: 'never', outputFolder: 'playwright-report/e2e' }],
      ]
    : [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report/e2e' }],
      ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: external ?? `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.E2E_BROWSER_EXECUTABLE_PATH,
    },
  },
  webServer: external
    ? undefined
    : {
        command: `npm run build && npx next start --port ${PORT}`,
        url: `http://localhost:${PORT}/healthz`,
        reuseExistingServer: false,
        timeout: 600_000,
        env: {
          // Same origin, so every call reaches the specs' **/api/v1/** routes.
          NEXT_PUBLIC_API_BASE_URL: '/api/v1',
          NEXT_PUBLIC_USE_MOCK: 'false',
          NEXT_PUBLIC_DEV_QUICK_LOGIN: 'false',
        },
      },
});
