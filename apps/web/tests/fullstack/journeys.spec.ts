import { expect, test as base, type Page } from '@playwright/test';

import { expectVisibleText } from '../e2e/support';
import { setQuickLoginRole } from './stack';

/* Journeys against the real API, started by run.ts (npm run test:fullstack).
 * Each test signs in on its own, so they run in any order. Every assertion
 * here can only pass with data the API returned. */

/**
 * The account POST /auth/dev/quick-login creates. Mirrors
 * apps/api/src/modules/identity-access/auth/application/dev-quick-login.fixture.ts.
 */
const QUICK_LOGIN_ACCOUNT = {
  login: 'alphaci-local-dev',
  email: 'alphaci-local-dev@example.invalid',
} as const;

/** A 4xx/5xx same-origin response the test causes on purpose. */
interface ExpectedResponse {
  readonly status: number;
  readonly method: string;
  readonly path: string;
}

function isLoopback(url: URL): boolean {
  return ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
}

const test = base.extend<{
  /** Every other 4xx/5xx same-origin response fails the test. */
  expectedResponses: readonly ExpectedResponse[];
  /** Fails the test on any page error, console error, failed or 4xx/5xx
   * same-origin request, or request to a non-loopback host. */
  browserProblems: void;
}>({
  expectedResponses: [[], { option: true }],
  browserProblems: [
    async ({ context, page, baseURL, expectedResponses }, use) => {
      const origin = baseURL!;
      const problems: string[] = [];
      await context.route(
        (url) => !isLoopback(url),
        (route) => {
          problems.push(
            `left the runner: ${route.request().method()} ${route.request().url()}`,
          );
          return route.abort('blockedbyclient');
        },
      );
      const isExpected = (status: number, url: string, method?: string) =>
        expectedResponses.some(
          (response) =>
            response.status === status &&
            url === `${origin}${response.path}` &&
            (method === undefined || response.method === method),
        );
      page.on('pageerror', (error) =>
        problems.push(`page error: ${error.message}`),
      );
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const resourceStatus =
          /^Failed to load resource: .* status of (\d+)/.exec(message.text());
        if (
          resourceStatus &&
          isExpected(Number(resourceStatus[1]), message.location().url)
        )
          return;
        problems.push(`console error: ${message.text()}`);
      });
      page.on('requestfailed', (request) => {
        const failure = request.failure()?.errorText ?? 'unknown';
        // Navigating away cancels in-flight requests and prefetches; not a failure.
        if (request.url().startsWith(origin) && failure !== 'net::ERR_ABORTED')
          problems.push(
            `request failed: ${request.method()} ${request.url()} (${failure})`,
          );
      });
      page.on('response', (response) => {
        const method = response.request().method();
        if (!response.url().startsWith(origin) || response.status() < 400)
          return;
        if (isExpected(response.status(), response.url(), method)) return;
        problems.push(`HTTP ${response.status()}: ${method} ${response.url()}`);
      });

      await use();

      // Let late requests land so they are charged to this test.
      await page
        .waitForLoadState('networkidle', { timeout: 5_000 })
        .catch(() => undefined);
      expect(problems, 'browser problems').toEqual([]);
    },
    { auto: true },
  ],
});

test.describe('workspace projects', () => {
  test.use({
    expectedResponses: [
      { status: 401, method: 'GET', path: '/api/v1/auth/me' },
    ],
  });

  test('creates a Project and lists it before a repository is added', async ({
    page,
  }) => {
    await quickLogin(page);
    setQuickLoginRole('lead');
    try {
      const response = await page.request.post('/api/v1/groups', {
        data: { name: 'Full-stack Project team' },
      });
      expect(response.status()).toBe(201);
      const team = (await response.json()) as { id: string };
      const projectsPath = `/groups/${team.id}/systems`;

      await page.goto(projectsPath);
      await expectVisibleText(page, 'No projects yet');
      await page
        .getByRole('link', { name: 'Create project', exact: true })
        .first()
        .click();
      const dialog = page.getByRole('dialog', { name: 'New Project' });
      await dialog
        .getByRole('textbox', { name: 'Name', exact: true })
        .fill('Checkout');
      await dialog
        .getByRole('button', { name: 'Create Project', exact: true })
        .click();
      await expect(dialog).toBeHidden();

      await page.goto(projectsPath);
      const project = page.getByRole('link', { name: /Checkout/ });
      await expect(project).toContainText('0 repositories');
      await project.click();
      await expect(
        page.getByRole('heading', { name: 'Checkout', exact: true }),
      ).toBeVisible();
    } finally {
      setQuickLoginRole('member');
    }
  });
});

/** Signs in the way the quick-login button does: from the page, same origin,
 * through the web server's /api/v1 proxy to the API. */
async function quickLogin(page: Page): Promise<void> {
  await page.goto('/login');
  const status = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/dev/quick-login', {
      method: 'POST',
      credentials: 'include',
    });
    return response.status;
  });
  expect(status, 'POST /api/v1/auth/dev/quick-login').toBe(201);
}

test.describe('sign-in', () => {
  // The API answers a visitor without a session with 401; the web reads that
  // as signed out.
  test.use({
    expectedResponses: [
      { status: 401, method: 'GET', path: '/api/v1/auth/me' },
    ],
  });

  test('dev quick login signs in and lands on Home', async ({
    page,
    baseURL,
  }) => {
    const session = page.waitForResponse(
      (response) => response.url() === `${baseURL}/api/v1/auth/me`,
    );
    await page.goto('/login');
    expect((await session).status(), 'GET /api/v1/auth/me before sign-in').toBe(
      401,
    );
    await expectVisibleText(page, 'Continue with GitHub');
    // A production build never offers the button, whatever the flags say.
    await expect(
      page.getByRole('button', { name: /quick login/i }),
    ).toHaveCount(0);

    await quickLogin(page);

    // The login page sends a signed-in visitor home.
    await page.goto('/login');
    await page.waitForURL('**/home', { timeout: 15_000 });
    // The first-visit welcome greets the account by login; it opens because
    // the API reports that this account has not finished onboarding.
    await expectVisibleText(
      page,
      `Welcome to ALPHACI, @${QUICK_LOGIN_ACCOUNT.login}`,
    );
  });

  test('settings show the signed-in account', async ({ page }) => {
    await quickLogin(page);
    await page.goto('/settings');
    await expectVisibleText(page, `@${QUICK_LOGIN_ACCOUNT.login}`);
    await expectVisibleText(page, QUICK_LOGIN_ACCOUNT.email);
  });

  test('a signed-out admin visit preserves its destination at sign-in', async ({
    page,
  }) => {
    await page.goto('/admin/feedback');
    await expect
      .poll(() => {
        const url = new URL(page.url());
        return [url.pathname, url.searchParams.get('next')];
      })
      .toEqual(['/login', '/admin/feedback']);
    await expectVisibleText(page, 'Continue with GitHub');
  });
});
