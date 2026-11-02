import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

/*
 * `@Query('name') value?: string` claims a string, but Express hands the
 * parameter over as an array for `?name=a&name=b` (the global ValidationPipe
 * then joins it to "a,b") and as an object for nested keys. Controllers read
 * one parameter with `@QueryString('name')` (src/kernel/http), which gives a
 * string or undefined, and a whole query with `@Query() query: SomeDto`.
 */

const API_ROOT = resolve(__dirname, '../..');
const SRC = join(API_ROOT, 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

/** Every `@Query(<argument>)` decorator in the file, as `file:line`. */
function namedQueryDecorators(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isDecorator(node) &&
      ts.isCallExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Query' &&
      node.expression.arguments.length > 0
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      found.push(`${relative(API_ROOT, file)}:${line + 1}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('query parameters', () => {
  it('are read with @QueryString(name), never @Query(name)', () => {
    const offenders = sourceFiles(SRC).flatMap(namedQueryDecorators);
    expect(offenders).toEqual([]);
  });
});
