import {
  importRequirements,
  initialMapping,
  previewImport,
} from '../../../../../src/features/checklists/model/qa-import-rules';
const sheet = {
  name: 'Features',
  headers: ['Feature', 'User story', 'Acceptance criteria'],
  rows: [
    ['Account', 'Sign in', 'Profile shown'],
    ['', 'Sign out', 'Login shown'],
  ],
};
describe('Grouped checklist imports', () => {
  it('requires explicit carry-forward and preserves acceptance criteria in the batch', () => {
    const mapping = initialMapping(sheet, 'requirements');
    expect(previewImport(sheet, mapping, 'requirements', false).errors).toEqual(
      ['Row 3: Group and Title are required.'],
    );
    const result = previewImport(sheet, mapping, 'requirements', true);
    expect(result.errors).toEqual([]);
    expect(importRequirements(result.rows)).toEqual([
      {
        name: 'Account',
        items: [
          {
            title: 'Sign in',
            acceptanceCriteria: 'Profile shown',
            verificationType: 'manual',
          },
          {
            title: 'Sign out',
            acceptanceCriteria: 'Login shown',
            verificationType: 'manual',
          },
        ],
      },
    ]);
  });
  it('rejects ambiguous column mappings, duplicates and overlong fields', () => {
    expect(
      previewImport(
        sheet,
        { group: 0, title: 0, details: -1 },
        'requirements',
        true,
      ).errors,
    ).toHaveLength(1);
    const duplicates = {
      ...sheet,
      rows: [
        ['Account', 'Sign in', 'ok'],
        ['account', 'sign IN', 'different'],
      ],
    };
    expect(
      previewImport(
        duplicates,
        initialMapping(sheet, 'requirements'),
        'requirements',
        false,
      ).errors[0],
    ).toContain('duplicate');
    expect(
      previewImport(
        { ...sheet, rows: [['Account', 'x'.repeat(301)]] },
        initialMapping(sheet, 'requirements'),
        'requirements',
        false,
      ).errors[0],
    ).toContain('length');
  });
  it('groups test cases without interpreting statuses or formulas', () => {
    const cases = {
      name: 'Cases',
      headers: ['Category', 'Test case', 'Expected result', 'Status'],
      rows: [['Happy', 'Login', '@literal', 'passed']],
    };
    expect(
      previewImport(
        cases,
        initialMapping(cases, 'test-cases'),
        'test-cases',
        false,
      ).rows,
    ).toEqual([
      { row: 2, group: 'Happy', title: 'Login', details: '@literal' },
    ]);
  });
});
