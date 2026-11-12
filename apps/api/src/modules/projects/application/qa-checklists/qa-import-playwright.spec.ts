import { playwrightSheet, isPlaywrightFile } from './qa-import-playwright';

describe('Playwright import sheet', () => {
  it('reads describes as categories and tests as test cases from a spec file', () => {
    const source = `
      import { test, expect } from '@playwright/test';
      // test('commented out', () => {});
      /* test('also commented', () => {}) */
      test.describe('Checkout', { tag: '@smoke' }, () => {
        test.beforeEach(async ({ page }) => { await page.goto('/'); });
        test('pays with a saved card', async ({ page }) => {
          await test.step('opens the cart', async () => {});
          expect(page.url()).toMatch(/cart\\/'quoted'/);
        });
        test.describe.serial("Coupons", () => {
          test.skip('applies a "10%" coupon', async () => {});
        });
        test(\`rejects \${'expired'} cards\`, async () => {});
      });
      test('top level test', async () => {});
      it('mocha style', () => {});
      test.describe.configure({ mode: 'serial' });
    `;

    const sheet = playwrightSheet('tests/e2e/checkout.spec.ts', source);

    expect(sheet.headers).toEqual([
      'Category',
      'Test case',
      'Expected result',
      'Playwright title',
    ]);
    expect(sheet.rows).toEqual([
      [
        'Checkout',
        'pays with a saved card',
        '',
        'Checkout › pays with a saved card',
      ],
      [
        'Checkout › Coupons',
        'applies a "10%" coupon',
        '',
        'Checkout › Coupons › applies a "10%" coupon',
      ],
      [
        'Checkout',
        "rejects ${'expired'} cards",
        '',
        "Checkout › rejects ${'expired'} cards",
      ],
      ['checkout', 'top level test', '', 'top level test'],
      ['checkout', 'mocha style', '', 'mocha style'],
    ]);
  });

  it('reads the JSON reporter output, skipping the file-level suite title', () => {
    const report = JSON.stringify({
      suites: [
        {
          title: 'tests/login.spec.ts',
          file: 'tests/login.spec.ts',
          specs: [{ title: 'shows the form' }],
          suites: [
            {
              title: 'Login',
              specs: [{ title: 'signs in' }, { title: '  ' }],
              suites: [
                { title: 'Errors', specs: [{ title: 'wrong password' }] },
              ],
            },
          ],
        },
      ],
    });

    expect(playwrightSheet('report.json', report).rows).toEqual([
      ['report', 'shows the form', '', 'shows the form'],
      ['Login', 'signs in', '', 'Login › signs in'],
      [
        'Login › Errors',
        'wrong password',
        '',
        'Login › Errors › wrong password',
      ],
    ]);
  });

  it('refuses a file with no tests and JSON that is not a report', () => {
    expect(() => playwrightSheet('empty.spec.ts', 'const x = 1;')).toThrow(
      'Include at least one Playwright test',
    );
    expect(() => playwrightSheet('x.json', '{"nope":1}')).toThrow(
      'Include a Playwright JSON report with suites',
    );
    expect(() => playwrightSheet('x.json', 'not json')).toThrow(
      'Include a Playwright JSON report',
    );
  });

  it('caps an import at 1000 tests', () => {
    const source = Array.from(
      { length: 1001 },
      (_, i) => `test('t${String(i)}', () => {});`,
    ).join('\n');
    expect(() => playwrightSheet('many.spec.ts', source)).toThrow(
      'At most 1000 tests',
    );
  });

  it('recognises spec sources and reports by extension', () => {
    expect(
      ['a.spec.ts', 'a.test.js', 'r.json', 'a.mjs'].every(isPlaywrightFile),
    ).toBe(true);
    expect(['a.xlsx', 'a.csv', 'a.tsv'].some(isPlaywrightFile)).toBe(false);
  });
});
