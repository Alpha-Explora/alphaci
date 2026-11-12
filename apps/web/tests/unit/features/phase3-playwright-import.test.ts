import {
  importFileAccept,
  importFileProblem,
  initialMapping,
  previewImport,
} from '@/features/checklists/model/qa-import-rules';

/* Phase 3, item 15: Playwright spec files or reports as test case imports,
 * beside the Excel (XLSX), CSV and TSV file import. */

describe('import sources', () => {
  it('takes Playwright files for test cases only', () => {
    expect(
      importFileProblem({ name: 'login.spec.ts', size: 10 }, 'test-cases'),
    ).toBeNull();
    expect(
      importFileProblem({ name: 'report.json', size: 10 }, 'test-cases'),
    ).toBeNull();
    expect(
      importFileProblem({ name: 'cases.xlsx', size: 10 }, 'test-cases'),
    ).toBeNull();
    expect(
      importFileProblem({ name: 'login.spec.ts', size: 10 }, 'requirements'),
    ).toBe('Choose an XLSX, CSV or TSV file up to 2 MB.');
    expect(
      importFileProblem(
        { name: 'big.xlsx', size: 3 * 1024 * 1024 },
        'requirements',
      ),
    ).not.toBeNull();
    expect(importFileAccept('test-cases')).toContain('.json');
    expect(importFileAccept('requirements').split(',')).toEqual([
      '.xlsx',
      '.csv',
      '.tsv',
    ]);
  });

  it("maps the Playwright sheet's columns without help", () => {
    const sheet = {
      name: 'Playwright tests',
      headers: ['Category', 'Test case', 'Expected result', 'Playwright title'],
      rows: [['Login', 'signs in', '', 'Login › signs in']],
    };
    const mapping = initialMapping(sheet, 'test-cases');
    expect(mapping).toEqual({ group: 0, title: 1, details: 2 });
    expect(previewImport(sheet, mapping, 'test-cases', false).rows).toEqual([
      { row: 2, group: 'Login', title: 'signs in', details: '' },
    ]);
  });
});
