import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

/*
 * A refusal the web app has to tell apart carries a `code`
 * (src/kernel/http/coded-errors.ts); a bare `throw new NotFoundException('…')`
 * gives the client only English to match on. This is a ratchet over
 * src/modules: a Nest exception thrown with no `code` is counted per file, and
 * the count may only go down. A new throw needs a code; migrating a file lowers
 * its entry.
 *
 * Fixing a file: replace the throw with a factory (badRequest, notFound, …),
 * then run `UPDATE_CODED_ERRORS_BASELINE=1 npm test -w @alphaci/api --
 * coded-errors` to write the lower count.
 */

const API_ROOT = resolve(__dirname, '../..');
const SRC = join(API_ROOT, 'src/modules');
const BASELINE = join(__dirname, 'coded-errors.baseline.json');

const NEST_EXCEPTIONS = new Set([
  'BadRequestException',
  'UnauthorizedException',
  'ForbiddenException',
  'NotFoundException',
  'ConflictException',
  'GoneException',
  'PayloadTooLargeException',
  'UnprocessableEntityException',
  'ServiceUnavailableException',
  'InternalServerErrorException',
  'BadGatewayException',
  'GatewayTimeoutException',
  'NotAcceptableException',
  'HttpException',
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

function hasCode(object: ts.ObjectLiteralExpression): boolean {
  return object.properties.some(
    (property) =>
      property.name !== undefined &&
      ts.isIdentifier(property.name) &&
      property.name.text === 'code',
  );
}

/** Nest exceptions thrown without a `code`, as `file:line`. */
function uncodedThrows(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      NEST_EXCEPTIONS.has(node.expression.text)
    ) {
      const [first] = node.arguments ?? [];
      const coded =
        first !== undefined &&
        ts.isObjectLiteralExpression(first) &&
        hasCode(first);
      if (!coded)
        found.push(
          String(
            source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          ),
        );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function currentCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of sourceFiles(SRC).sort()) {
    const lines = uncodedThrows(file);
    if (lines.length > 0) {
      counts[relative(API_ROOT, file).split(sep).join('/')] = lines.length;
    }
  }
  return counts;
}

describe('coded errors', () => {
  const counts = currentCounts();

  if (process.env['UPDATE_CODED_ERRORS_BASELINE'] === '1') {
    writeFileSync(BASELINE, `${JSON.stringify(counts, null, 2)}\n`);
  }
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<
    string,
    number
  >;

  it('adds no Nest exception without a code', () => {
    const grew = Object.entries(counts)
      .filter(([file, count]) => count > (baseline[file] ?? 0))
      .map(
        ([file, count]) =>
          `${file}: ${String(count)} (baseline ${String(baseline[file] ?? 0)})`,
      );
    expect(grew).toEqual([]);
  });

  it('keeps the baseline equal to what is left to migrate', () => {
    const stale = Object.entries(baseline)
      .filter(([file, count]) => (counts[file] ?? 0) < count)
      .map(
        ([file, count]) =>
          `${file}: ${String(counts[file] ?? 0)} (baseline ${String(count)})`,
      );
    expect(stale).toEqual([]);
  });
});
