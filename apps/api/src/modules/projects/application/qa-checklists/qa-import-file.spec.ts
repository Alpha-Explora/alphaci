import { Workbook } from 'exceljs';
import { parseQaImportFile } from './qa-import-file';

const csv = (text: string, originalname = 'cases.csv') => ({
  originalname,
  buffer: Buffer.from(text),
});
async function xlsx(rows: unknown[][]) {
  const workbook = new Workbook();
  workbook.addWorksheet('Cases').addRows(rows);
  return {
    originalname: 'cases.xlsx',
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  };
}
describe('QA import preview', () => {
  it('reads grouped XLSX with blank grouping cells and multiline expected results', async () => {
    const file = await xlsx([
      ['Category', 'Test case', 'Expected result'],
      ['Happy path', 'Sign in', 'Profile\nshown'],
      ['', 'Sign out', 'Login shown'],
    ]);
    await expect(parseQaImportFile(file)).resolves.toEqual({
      sheets: [
        {
          name: 'Cases',
          headers: ['Category', 'Test case', 'Expected result'],
          rows: [
            ['Happy path', 'Sign in', 'Profile\nshown'],
            ['', 'Sign out', 'Login shown'],
          ],
        },
      ],
    });
  });
  it('reads quoted CSV and TSV as literal values', async () => {
    const result = await parseQaImportFile(
      csv(
        'Feature,User story,Acceptance criteria\r\nAccount,"Sign in, then out","Profile\nshown"\r\n',
      ),
    );
    expect(result.sheets[0]?.rows).toEqual([
      ['Account', 'Sign in, then out', 'Profile\nshown'],
    ]);
    expect(
      (
        await parseQaImportFile(
          csv('Category\tTest case\nHappy\tSign in', 'cases.tsv'),
        )
      ).sheets[0]?.rows,
    ).toEqual([['Happy', 'Sign in']]);
  });
  it('rejects actual workbook formulas rather than trusting their cached result', async () => {
    const file = await xlsx([
      ['Feature', 'Story'],
      [
        'Account',
        {
          formula: 'HYPERLINK("https://invalid.test", "run")',
          result: 'looks safe',
        },
      ],
    ]);
    await expect(parseQaImportFile(file)).rejects.toThrow('Use plain values');
  });
  it.each(['file.xlsm', 'file.xls', 'file.pdf', 'file.zip'])(
    'rejects unsupported %s',
    async (name) => {
      await expect(parseQaImportFile(csv('a,b\nx,y', name))).rejects.toThrow(
        'Supported files',
      );
    },
  );
  it('rejects oversized, malformed, too many rows and columns', async () => {
    await expect(
      parseQaImportFile({
        originalname: 'x.csv',
        buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
      }),
    ).rejects.toThrow('2 MB');
    await expect(parseQaImportFile(csv('not a zip', 'x.xlsx'))).rejects.toThrow(
      'malformed',
    );
    await expect(
      parseQaImportFile(csv('a,b\n' + 'x,y\n'.repeat(1001))),
    ).rejects.toThrow('1000');
    await expect(
      parseQaImportFile(await xlsx([Array(13).fill('Header'), ['x', 'y']])),
    ).rejects.toThrow('12 columns');
  });
  it('does not silently truncate long CSV files', async () => {
    await expect(
      parseQaImportFile(csv('a,b\n' + 'x,y\n'.repeat(4000))),
    ).rejects.toThrow('1000');
  });
  it('previews a Playwright spec as a test case sheet, and says what a bad one lacks', async () => {
    const spec = {
      originalname: 'login.spec.ts',
      buffer: Buffer.from(
        "test.describe('Login', () => { test('signs in', async () => {}); });",
      ),
    };
    await expect(parseQaImportFile(spec)).resolves.toEqual({
      sheets: [
        {
          name: 'Playwright tests',
          headers: [
            'Category',
            'Test case',
            'Expected result',
            'Playwright title',
          ],
          rows: [['Login', 'signs in', '', 'Login › signs in']],
        },
      ],
    });
    await expect(
      parseQaImportFile({ originalname: 'x.json', buffer: Buffer.from('{}') }),
    ).rejects.toThrow('Upload a Playwright spec file or its JSON report');
  });
});
