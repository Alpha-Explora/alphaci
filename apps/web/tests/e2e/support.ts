import type { Page, Route } from 'playwright';

/* Helpers shared by every scenario the E2E runner (playwright-e2e.ts) drives:
 * fulfilling a mocked /api/v1 route, and waiting for text a person would see. */

export function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export function text(route: Route, status: number, body: string, contentType = 'text/plain') {
  return route.fulfill({
    status,
    contentType,
    body,
  });
}

export async function expectVisibleText(page: Page, textValue: string) {
  try {
    await page.getByText(textValue, { exact: false }).first().waitFor({
      state: 'visible',
      timeout: 15_000,
    });
  } catch (error) {
    const visibleText = await page.locator('body').evaluate((element) =>
      element instanceof HTMLElement ? element.innerText.slice(0, 2000) : '',
    );
    throw new Error(
      `Expected visible text not found: ${textValue}\nVisible text snapshot:\n${visibleText}`,
      { cause: error },
    );
  }
}
