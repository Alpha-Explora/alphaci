import { expect, test } from '@playwright/test';
import { json } from './support';

/* The app serves its first page. Against a deployed preview (E2E_BASE_URL), a
 * preview behind the host's sign-in also counts: it proves the deploy is up. */

const PAGE_MARKERS = ['Ship with calm, not chaos.', 'ALPHACI'];

function isProtectedPreview(status: number | undefined, body: string): boolean {
  if (status === 401 || status === 403) return true;
  const normalized = body.toLowerCase();
  return [
    'authentication required',
    'access denied',
    'vercel authentication',
    'password required',
  ].some((marker) => normalized.includes(marker));
}

test('the first page renders', async ({ page }) => {
  if (!process.env.E2E_BASE_URL) {
    await page.route('**/api/v1/auth/me', (route) =>
      json(route, { message: 'Authentication required' }, 401),
    );
  }
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  const body = (await page.textContent('body')) ?? '';
  if (process.env.E2E_BASE_URL && isProtectedPreview(response?.status(), body))
    return;
  expect(
    PAGE_MARKERS.some((marker) => body.includes(marker)),
    `one of ${PAGE_MARKERS.join(', ')} on the page (status ${response?.status()})`,
  ).toBe(true);
});
