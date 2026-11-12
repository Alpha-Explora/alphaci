import type { BatchRequirementInput } from './requirement-types';
import type {
  ImportSheet,
  ImportMapping,
  ImportMode,
  ImportRow,
} from './qa-import-types';

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const SHEET_FILE = /\.(xlsx|csv|tsv)$/i;
/** A Playwright spec (.ts, .js) or the JSON reporter's output: test cases only. */
const PLAYWRIGHT_FILE = /\.(json|[cm]?[jt]sx?)$/i;

/** What the file picker offers: test cases also take Playwright files. */
export function importFileAccept(mode: ImportMode): string {
  return mode === 'test-cases'
    ? '.xlsx,.csv,.tsv,.ts,.js,.mjs,.cjs,.json'
    : '.xlsx,.csv,.tsv';
}

/** Null when the server can preview the file; the reason otherwise. */
export function importFileProblem(
  file: { name: string; size: number },
  mode: ImportMode,
): string | null {
  const playwright = mode === 'test-cases' && PLAYWRIGHT_FILE.test(file.name);
  if (
    file.size <= IMPORT_MAX_BYTES &&
    (SHEET_FILE.test(file.name) || playwright)
  )
    return null;
  return mode === 'test-cases'
    ? 'Choose an XLSX, CSV or TSV file, or a Playwright spec or JSON report, up to 2 MB.'
    : 'Choose an XLSX, CSV or TSV file up to 2 MB.';
}

export function initialMapping(
  sheet: ImportSheet,
  mode: ImportMode,
): ImportMapping {
  const find = (aliases: string[]) =>
    sheet.headers.findIndex((header) =>
      aliases.includes(header.toLowerCase().trim()),
    );
  return {
    group: find(
      mode === 'requirements'
        ? ['feature', 'requirement', 'group']
        : ['category', 'group'],
    ),
    title: find(
      mode === 'requirements'
        ? ['user story', 'story', 'item', 'title']
        : ['test case', 'test', 'title'],
    ),
    details: find(
      mode === 'requirements'
        ? ['acceptance criteria', 'criteria']
        : ['expected result', 'expected'],
    ),
  };
}

function validMapping(mapping: ImportMapping): boolean {
  const indexes = [mapping.group, mapping.title];
  if (mapping.details >= 0) indexes.push(mapping.details);
  return (
    mapping.group >= 0 &&
    mapping.title >= 0 &&
    new Set(indexes).size === indexes.length
  );
}
function mappedRow(
  cells: string[],
  row: number,
  mapping: ImportMapping,
  previousGroup: string,
  carryGroup: boolean,
): ImportRow {
  const rawGroup = cells[mapping.group]?.trim() ?? '';
  return {
    row,
    group: rawGroup || (carryGroup ? previousGroup : ''),
    title: cells[mapping.title]?.trim() ?? '',
    details: mapping.details >= 0 ? (cells[mapping.details]?.trim() ?? '') : '',
  };
}
function fieldError(entry: ImportRow, mode: ImportMode): string | null {
  if (!entry.group || !entry.title)
    return `Row ${entry.row}: Group and Title are required.`;
  const limits = mode === 'requirements' ? [200, 300, 4000] : [120, 300, 2000];
  return [entry.group, entry.title, entry.details].some(
    (value, i) => value.length > limits[i]!,
  )
    ? `Row ${entry.row}: a field exceeds the allowed length.`
    : null;
}
function groupErrors(rows: ImportRow[], mode: ImportMode): string[] {
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(
      row.group.toLowerCase(),
      (counts.get(row.group.toLowerCase()) ?? 0) + 1,
    );
  const errors: string[] = [];
  if (counts.size > 20) errors.push('Import at most 20 groups at a time.');
  if (
    [...counts.values()].some(
      (count) => count > (mode === 'requirements' ? 200 : 50),
    )
  )
    errors.push(
      `A group holds at most ${mode === 'requirements' ? '200 stories' : '50 test cases'}.`,
    );
  return errors;
}
export function previewImport(
  sheet: ImportSheet | undefined,
  mapping: ImportMapping,
  mode: ImportMode,
  carryGroup: boolean,
) {
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  if (!sheet) return { rows, errors };
  if (!validMapping(mapping))
    return {
      rows,
      errors: [
        'Map Group and Title to different columns; map details separately or leave it unused.',
      ],
    };
  let previousGroup = '';
  const seen = new Map<string, ImportRow>();
  for (const [index, cells] of sheet.rows.entries()) {
    if (cells.every((cell) => !cell.trim())) continue;
    const entry = mappedRow(
      cells,
      index + 2,
      mapping,
      previousGroup,
      carryGroup,
    );
    previousGroup = entry.group;
    const error = fieldError(entry, mode);
    if (error) {
      errors.push(error);
      continue;
    }
    const key = JSON.stringify([
      entry.group.toLowerCase(),
      entry.title.toLowerCase(),
    ]);
    const duplicate = seen.get(key);
    if (duplicate) {
      errors.push(
        `Row ${entry.row}: duplicate title in this group (first at row ${duplicate.row}). Remove the duplicate before importing.`,
      );
      continue;
    }
    seen.set(key, entry);
    rows.push(entry);
  }
  errors.push(...groupErrors(rows, mode));
  if (rows.length === 0 && errors.length === 0)
    errors.push('No importable rows.');
  return { rows, errors };
}

export function importRequirements(rows: ImportRow[]): BatchRequirementInput[] {
  const groups = new Map<string, BatchRequirementInput>();
  for (const row of rows) {
    const key = row.group.toLowerCase();
    const group = groups.get(key) ?? { name: row.group, items: [] };
    group.items?.push({
      title: row.title,
      acceptanceCriteria: row.details || null,
      verificationType: 'manual',
    });
    groups.set(key, group);
  }
  return [...groups.values()];
}
