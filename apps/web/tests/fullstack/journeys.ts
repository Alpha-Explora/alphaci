import type { Page } from 'playwright';

import { expectVisibleText } from '../e2e/support';

/* Journeys the full-stack runner (run.ts) drives against the real API. They
 * run in order in one browser context, so later journeys start signed in.
 * Every assertion here can only pass with data the API returned. */

/**
 * The account POST /auth/dev/quick-login creates. Mirrors
 * apps/api/src/modules/identity-access/auth/application/dev-quick-login.fixture.ts.
 */
const QUICK_LOGIN_ACCOUNT = {
  login: 'alphaci-local-dev',
  email: 'alphaci-local-dev@example.invalid',
} as const;

/** A 4xx/5xx same-origin response the journey causes on purpose. */
export interface ExpectedResponse {
  readonly status: number;
  readonly method: string;
  readonly path: string;
}

export interface Journey {
  readonly name: string;
  /** Every other 4xx/5xx same-origin response fails the journey. */
  readonly expectedResponses?: readonly ExpectedResponse[];
  run(page: Page, baseUrl: string): Promise<void>;
}

function expectEqual(actual: unknown, expected: unknown, what: string): void {
  if (actual !== expected) {
    throw new Error(
      `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

const signInWithQuickLogin: Journey = {
  name: 'sign in with dev quick login',
  // The API answers a visitor without a session with 401; the web reads that
  // as signed out.
  expectedResponses: [{ status: 401, method: 'GET', path: '/api/v1/auth/me' }],
  async run(page, baseUrl) {
    const session = page.waitForResponse(
      (response) => response.url() === `${baseUrl}/api/v1/auth/me`,
    );
    await page.goto(`${baseUrl}/login`);
    expectEqual(
      (await session).status(),
      401,
      'GET /api/v1/auth/me before sign-in',
    );
    await expectVisibleText(page, 'Continue with GitHub');
    // A production build never offers the button, whatever the flags say.
    expectEqual(
      await page.getByRole('button', { name: /quick login/i }).count(),
      0,
      'quick-login buttons on the login page of a production build',
    );

    // So the journey makes the call the button makes: from the page, same
    // origin, through the web server's /api/v1 proxy to the API.
    const status = await page.evaluate(async () => {
      const response = await fetch('/api/v1/auth/dev/quick-login', {
        method: 'POST',
        credentials: 'include',
      });
      return response.status;
    });
    expectEqual(status, 201, 'POST /api/v1/auth/dev/quick-login');

    // The login page sends a signed-in visitor home.
    await page.goto(`${baseUrl}/login`);
    await page.waitForURL(`${baseUrl}/home`, { timeout: 15_000 });
    // The first-visit welcome greets the account by login; it opens because
    // the API reports that this new account has not finished onboarding.
    await expectVisibleText(
      page,
      `Welcome to ALPHACI, @${QUICK_LOGIN_ACCOUNT.login}`,
    );
  },
};

const settingsShowsTheAccount: Journey = {
  name: 'settings show the signed-in account',
  async run(page, baseUrl) {
    await page.goto(`${baseUrl}/settings`);
    await expectVisibleText(page, `@${QUICK_LOGIN_ACCOUNT.login}`);
    await expectVisibleText(page, QUICK_LOGIN_ACCOUNT.email);
  },
};

export const journeys: readonly Journey[] = [
  signInWithQuickLogin,
  settingsShowsTheAccount,
];
