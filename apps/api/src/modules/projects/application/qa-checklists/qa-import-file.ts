import type {
  ImportSheet,
  QaImportPreviewResponse,
} from '@alphaci/api-contracts';
import { badRequest } from '#kernel/http/coded-errors';
import { Workbook, type CellValue } from 'exceljs';
import { Readable } from 'node:stream';
import { inflateRawSync } from 'node:zlib';
import { isPlaywrightFile, playwrightSheet } from './qa-import-playwright';

export interface QaImportFile {
  originalname: string;
  buffer: Buffer;
}
export type { ImportSheet, QaImportPreviewResponse };
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_EXPANDED = 10 * 1024 * 1024;
const MAX_ROWS = 1000;
const MAX_COLUMNS = 12;

/** Bounds actual inflated bytes before ExcelJS parses any XML. Rejects ZIP64,
 * encryption, macros, external links, duplicate names and inconsistent sizes. */
function checkXlsxZip(data: Buffer): void {
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
    if (
      data.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + data.readUInt16LE(i + 20) === data.length
    ) {
      end = i;
      break;
    }
  }
  if (end < 0 || data.readUInt32LE(end + 4) !== 0)
    throw new Error('Unsupported ZIP');
  const count = data.readUInt16LE(end + 10);
  let offset = data.readUInt32LE(end + 16);
  if (count > 256 || count === 0 || data.readUInt16LE(end + 8) !== count)
    throw new Error('Too many entries');
  const names = new Set<string>();
  let expanded = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || data.readUInt32LE(offset) !== 0x02014b50)
      throw new Error('Invalid ZIP');
    const flags = data.readUInt16LE(offset + 8);
    const method = data.readUInt16LE(offset + 10);
    const size = data.readUInt32LE(offset + 20);
    const expected = data.readUInt32LE(offset + 24);
    const nameLength = data.readUInt16LE(offset + 28);
    const name = data
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString('utf8');
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      names.has(name) ||
      /vbaproject|externallinks|\.\.|^[/\\]/i.test(name)
    )
      throw new Error('Unsafe workbook');
    names.add(name);
    const local = data.readUInt32LE(offset + 42);
    if (local + 30 > data.length || data.readUInt32LE(local) !== 0x04034b50)
      throw new Error('Invalid entry');
    const start =
      local +
      30 +
      data.readUInt16LE(local + 26) +
      data.readUInt16LE(local + 28);
    if (start + size > data.length || expected > MAX_EXPANDED - expanded)
      throw new Error('Workbook too large');
    const compressed = data.subarray(start, start + size);
    const bytes =
      method === 0
        ? compressed
        : inflateRawSync(compressed, {
            maxOutputLength: MAX_EXPANDED - expanded + 1,
          });
    expanded += bytes.length;
    if (bytes.length !== expected || expanded > MAX_EXPANDED)
      throw new Error('Workbook too large');
    offset +=
      46 +
      nameLength +
      data.readUInt16LE(offset + 30) +
      data.readUInt16LE(offset + 32);
  }
  if (offset !== end || !names.has('xl/workbook.xml'))
    throw new Error('Invalid workbook');
}

function cellText(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value || 'error' in value)
      throw new Error('Use plain values, not formulas or errors');
    if ('richText' in value)
      return value.richText.map((part) => part.text).join('');
    if ('text' in value) return value.text;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Unsupported cell');
  }
  return String(value);
}

/** A Playwright spec or JSON report, scanned as text: never executed or imported. */
function parsePlaywrightFile(file: QaImportFile): { sheets: ImportSheet[] } {
  try {
    return {
      sheets: [
        playwrightSheet(file.originalname, file.buffer.toString('utf8')),
      ],
    };
  } catch (error) {
    const reason =
      error instanceof Error && /^(At most|Include)/.test(error.message)
        ? error.message
        : 'The Playwright file could not be read';
    throw badRequest(
      'QA_IMPORT_PLAYWRIGHT_UNREADABLE',
      `${reason}. Upload a Playwright spec file or its JSON report.`,
    );
  }
}

/** Read-only preview. No formulas or scripts execute, no URLs are followed, no file is stored. */
export async function parseQaImportFile(
  file: QaImportFile | undefined,
): Promise<QaImportPreviewResponse> {
  if (!file || !file.buffer.length || file.buffer.length > MAX_BYTES) {
    throw badRequest(
      'QA_IMPORT_FILE_EMPTY',
      'Choose a non-empty file up to 2 MB.',
    );
  }
  if (isPlaywrightFile(file.originalname)) return parsePlaywrightFile(file);
  const extension = file.originalname.split('.').at(-1)?.toLowerCase();
  if (!extension || !['xlsx', 'csv', 'tsv'].includes(extension)) {
    throw badRequest(
      'QA_IMPORT_FILE_UNSUPPORTED',
      'Supported files: .xlsx, .csv and .tsv, or a Playwright spec (.ts, .js) or JSON report.',
    );
  }
  try {
    const workbook = new Workbook();
    if (extension === 'xlsx') {
      checkXlsxZip(file.buffer);
      await workbook.xlsx.load(
        file.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
      );
    } else {
      await workbook.csv.read(Readable.from([file.buffer]), {
        parserOptions: {
          delimiter: extension === 'tsv' ? '\t' : ',',
          maxRows: MAX_ROWS + 2,
        },
      });
    }
    if (workbook.worksheets.length > 20) throw new Error('At most 20 sheets');
    let total = 0;
    const sheets: ImportSheet[] = [];
    for (const worksheet of workbook.worksheets) {
      if (
        worksheet.rowCount > MAX_ROWS + 1 ||
        worksheet.columnCount > MAX_COLUMNS
      )
        throw new Error('At most 1000 rows and 12 columns');
      const values: string[][] = [];
      worksheet.eachRow({ includeEmpty: true }, (row) => {
        const cells = Array.from({ length: worksheet.columnCount }, (_, i) =>
          cellText(row.getCell(i + 1).value).trim(),
        );
        if (cells.some((cell) => cell.length > 4000))
          throw new Error('Cell exceeds 4000 characters');
        values.push(cells);
      });
      const headers = values.shift();
      if (!headers || values.length === 0) continue;
      total += values.length;
      if (total > MAX_ROWS)
        throw new Error('At most 1000 data rows across sheets');
      sheets.push({ name: worksheet.name, headers, rows: values });
    }
    if (sheets.length === 0)
      throw new Error('Include a header and at least one data row');
    return { sheets };
  } catch (error) {
    const reason =
      error instanceof Error &&
      /^(At most|Cell exceeds|Use plain|Include)/.test(error.message)
        ? error.message
        : 'The file is malformed or contains unsupported workbook content';
    throw badRequest(
      'QA_IMPORT_SHEET_UNREADABLE',
      `${reason}. Use the import template and plain values.`,
    );
  }
}
