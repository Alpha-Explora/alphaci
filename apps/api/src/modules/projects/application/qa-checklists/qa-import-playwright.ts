/**
 * Playwright tests as an import sheet: each `describe` path becomes a QA test
 * case Category and each `test` a test case. Reads the JSON reporter's output
 * (`npx playwright test --list --reporter=json`) or a spec file's source.
 * Pure: the source is scanned, never executed or imported.
 */

/** The import preview's sheet shape (`ImportSheet` in qa-import-file.ts). */
export interface PlaywrightImportSheet {
  name: string;
  headers: string[];
  rows: string[][];
}

export const PLAYWRIGHT_HEADERS = [
  'Category',
  'Test case',
  'Expected result',
  'Playwright title',
];
const SEPARATOR = ' › ';
const MAX_TESTS = 1000;
const MAX_SUITE_DEPTH = 32;

interface FoundTest {
  describes: string[];
  title: string;
}

/** True for the files this parser reads instead of a spreadsheet. */
export function isPlaywrightFile(fileName: string): boolean {
  return /\.(json|[cm]?[jt]sx?)$/i.test(fileName);
}

export function playwrightSheet(
  fileName: string,
  content: string,
): PlaywrightImportSheet {
  const tests = /\.json$/i.test(fileName)
    ? testsFromReport(content)
    : testsFromSource(content);
  if (tests.length === 0)
    throw new Error('Include at least one Playwright test');
  if (tests.length > MAX_TESTS)
    throw new Error('At most 1000 tests per import');
  const fallback = fileCategory(fileName);
  return {
    name: 'Playwright tests',
    headers: [...PLAYWRIGHT_HEADERS],
    rows: tests.map((test) => [
      test.describes.join(SEPARATOR) || fallback,
      test.title,
      '',
      [...test.describes, test.title].join(SEPARATOR),
    ]),
  };
}

/** "tests/e2e/login.spec.ts" -> "login". */
function fileCategory(fileName: string): string {
  const base = fileName.split(/[\\/]/).at(-1) ?? fileName;
  return base.replace(/(\.(spec|test))?\.[a-z]+$/i, '') || 'Playwright';
}

// ---------------------------------------------------------------------------
// JSON report
// ---------------------------------------------------------------------------

interface ReportSuite {
  title?: unknown;
  specs?: unknown;
  suites?: unknown;
}

function asArray(value: unknown): ReportSuite[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is ReportSuite =>
          typeof entry === 'object' && entry !== null,
      )
    : [];
}

function testsFromReport(content: string): FoundTest[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Include a Playwright JSON report');
  }
  const suites = (parsed as { suites?: unknown } | null)?.suites;
  if (!Array.isArray(suites)) {
    throw new Error('Include a Playwright JSON report with suites');
  }
  const tests: FoundTest[] = [];
  // Top-level suites are files; their titles are paths, not describes.
  for (const file of asArray(suites)) collectSuite(file, [], tests, 0);
  return tests;
}

function collectSuite(
  suite: ReportSuite,
  describes: string[],
  tests: FoundTest[],
  depth: number,
): void {
  if (depth > MAX_SUITE_DEPTH || tests.length > MAX_TESTS) return;
  for (const spec of asArray(suite.specs)) {
    if (typeof spec.title === 'string' && spec.title.trim()) {
      tests.push({ describes, title: spec.title.trim() });
    }
  }
  for (const child of asArray(suite.suites)) {
    const title = typeof child.title === 'string' ? child.title.trim() : '';
    collectSuite(
      child,
      title ? [...describes, title] : describes,
      tests,
      depth + 1,
    );
  }
}

// ---------------------------------------------------------------------------
// Spec source
// ---------------------------------------------------------------------------

type Token =
  | { kind: 'name'; value: string }
  | { kind: 'string'; value: string }
  | { kind: 'punct'; value: string };

const DESCRIBE_MODIFIERS = new Set([
  'only',
  'skip',
  'fixme',
  'serial',
  'parallel',
]);
const TEST_MODIFIERS = new Set(['only', 'skip', 'fixme', 'fail', 'slow']);
const REGEX_AFTER = new Set([
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '=>',
]);

function testsFromSource(source: string): FoundTest[] {
  const tokens = tokenize(source);
  const tests: FoundTest[] = [];
  const stack: { title: string; depth: number }[] = [];
  let depth = 0;
  let pending: string | null = null;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) break;
    if (token.kind === 'punct' && token.value === '{') {
      depth++;
      if (pending !== null && opensBody(tokens[i - 1])) {
        stack.push({ title: pending, depth });
        pending = null;
      }
    } else if (token.kind === 'punct' && token.value === '}') {
      if (stack.at(-1)?.depth === depth) stack.pop();
      depth--;
    } else if (token.kind === 'name' && !isMember(tokens[i - 1])) {
      const call = readCall(tokens, i);
      if (call?.kind === 'describe') pending = call.title;
      if (call?.kind === 'test') {
        tests.push({
          describes: stack.map((entry) => entry.title),
          title: call.title,
        });
      }
      if (call) i = call.end;
    }
  }
  return tests;
}

/** A describe's callback body opens after `=>` or `function (…)`, not at an options object. */
function opensBody(previous: Token | undefined): boolean {
  return (
    previous?.kind === 'punct' &&
    (previous.value === '=>' || previous.value === ')')
  );
}

function isMember(previous: Token | undefined): boolean {
  return previous?.kind === 'punct' && previous.value === '.';
}

/** `test.describe.only('Title'` or `test.skip('Title'`: what it declares, its title and last token. */
function readCall(
  tokens: Token[],
  start: number,
): { kind: 'describe' | 'test'; title: string; end: number } | null {
  const names: string[] = [];
  let i = start;
  for (let token = tokens[i]; token?.kind === 'name'; token = tokens[i]) {
    names.push(token.value);
    const dot = tokens[i + 1];
    if (dot?.kind !== 'punct' || dot.value !== '.') break;
    i += 2;
  }
  const open = tokens[i + 1];
  const title = tokens[i + 2];
  if (
    open?.kind !== 'punct' ||
    open.value !== '(' ||
    title?.kind !== 'string'
  ) {
    return null;
  }
  const kind = classify(names);
  const text = title.value.trim();
  return kind && text ? { kind, title: text, end: i + 2 } : null;
}

function classify(names: string[]): 'describe' | 'test' | null {
  const [head, ...rest] = names;
  const afterDescribe =
    head === 'test' && rest[0] === 'describe' ? rest.slice(1) : null;
  if (head === 'describe' || afterDescribe) {
    const modifiers = afterDescribe ?? rest;
    return modifiers.every((name) => DESCRIBE_MODIFIERS.has(name))
      ? 'describe'
      : null;
  }
  if (head === 'test' || head === 'it') {
    return rest.length <= 1 && rest.every((name) => TEST_MODIFIERS.has(name))
      ? 'test'
      : null;
  }
  return null;
}

/** Names, string literals and punctuation; comments, regexes and whitespace are dropped. */
function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    i = readToken(source, i, tokens);
  }
  return tokens;
}

function readToken(source: string, i: number, tokens: Token[]): number {
  const char = source.charAt(i);
  if (/\s/.test(char)) return i + 1;
  if (source.startsWith('//', i)) return lineEnd(source, i);
  if (source.startsWith('/*', i)) return blockEnd(source, i);
  if (char === "'" || char === '"' || char === '`') {
    const [value, end] = readString(source, i);
    tokens.push({ kind: 'string', value });
    return end;
  }
  if (char === '/' && regexAllowed(tokens.at(-1))) return regexEnd(source, i);
  const name = /^[A-Za-z_$][\w$]*/.exec(source.slice(i, i + 256));
  if (name) {
    tokens.push({ kind: 'name', value: name[0] });
    return i + name[0].length;
  }
  if (source.startsWith('=>', i)) {
    tokens.push({ kind: 'punct', value: '=>' });
    return i + 2;
  }
  tokens.push({ kind: 'punct', value: char });
  return i + 1;
}

function lineEnd(source: string, i: number): number {
  const end = source.indexOf('\n', i);
  return end < 0 ? source.length : end + 1;
}

function blockEnd(source: string, i: number): number {
  const end = source.indexOf('*/', i + 2);
  return end < 0 ? source.length : end + 2;
}

function regexAllowed(previous: Token | undefined): boolean {
  if (!previous) return true;
  if (previous.kind === 'name') return previous.value === 'return';
  return previous.kind === 'punct' && REGEX_AFTER.has(previous.value);
}

function regexEnd(source: string, start: number): number {
  let inClass = false;
  for (let i = start + 1; i < source.length; i++) {
    const char = source[i];
    if (char === '\\') i++;
    else if (char === '\n') return i;
    else if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    else if (char === '/' && !inClass) return i + 1;
  }
  return source.length;
}

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r' };

/** A quoted or template literal's text; a template keeps its `${…}` as written. */
function readString(source: string, start: number): [string, number] {
  const quote = source[start];
  let value = '';
  let i = start + 1;
  while (i < source.length && source[i] !== quote) {
    if (source[i] === '\\') {
      const next = source[i + 1] ?? '';
      value += ESCAPES[next] ?? next;
      i += 2;
    } else if (quote === '`' && source.startsWith('${', i)) {
      const end = templateExpressionEnd(source, i + 2);
      value += source.slice(i, end);
      i = end;
    } else {
      value += source[i];
      i++;
    }
  }
  return [value, i + 1];
}

function templateExpressionEnd(source: string, start: number): number {
  let depth = 1;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return i + 1;
  }
  return source.length;
}
