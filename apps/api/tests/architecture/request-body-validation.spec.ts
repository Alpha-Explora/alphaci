import { readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

/*
 * The global ValidationPipe checks a request body only when its declared type
 * is a class with class-validator decorators. An interface, a type alias or an
 * inline `{ ... }` type is erased at runtime, so the body reaches the service
 * unchecked while the code reads it as typed: a number where a string was
 * declared, an unknown enum value, or a 10 MB string. That is how
 * `POST /ci/validate` answered 500 for `{"repo":123}` and workflow previews
 * stored `{"0":"y","1":"e","2":"s"}` for `checks`.
 *
 * Every @Body() parameter is therefore one of:
 *   - a class (validated by the pipe), or
 *   - explicitly unchecked and parsed by hand: `unknown`,
 *     `Record<string, unknown>` (optionally `| undefined`), or an object type
 *     whose every property is `unknown`.
 * A body declared with concrete field types that is not a class fails here.
 */

const API_ROOT = resolve(__dirname, '../..');

function controllerFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return controllerFiles(path);
    return path.endsWith('.controller.ts') ? [path] : [];
  });
}

function isUnknownRecord(type: ts.Type, checker: ts.TypeChecker): boolean {
  const index = checker.getIndexInfoOfType(type, ts.IndexKind.String);
  return (
    index !== undefined &&
    (index.type.flags & ts.TypeFlags.Unknown) !== 0 &&
    type.getProperties().length === 0
  );
}

function isExplicitlyUnchecked(
  type: ts.Type,
  checker: ts.TypeChecker,
): boolean {
  if (type.flags & ts.TypeFlags.Unknown) return true;
  if (type.isUnion()) {
    const parts = type.types.filter(
      (part) => !(part.flags & ts.TypeFlags.Undefined),
    );
    return (
      parts.length > 0 &&
      parts.every((part) => isExplicitlyUnchecked(part, checker))
    );
  }
  if (isUnknownRecord(type, checker)) return true;
  const properties = type.getProperties();
  return (
    properties.length > 0 &&
    type.getCallSignatures().length === 0 &&
    properties.every((property) => {
      const declaration = property.valueDeclaration;
      if (!declaration) return false;
      // Not getNonNullableType: NonNullable<unknown> is {}.
      const propertyType = checker.getTypeOfSymbolAtLocation(
        property,
        declaration,
      );
      return (propertyType.flags & ts.TypeFlags.Unknown) !== 0;
    })
  );
}

function isClass(type: ts.Type): boolean {
  const symbol = type.aliasSymbol ?? type.getSymbol();
  return (
    symbol?.declarations?.some((declaration) =>
      ts.isClassDeclaration(declaration),
    ) ?? false
  );
}

function uncheckedBodies(): string[] {
  const configPath = join(API_ROOT, 'tsconfig.json');
  const config = ts.parseJsonConfigFileContent(
    ts.readConfigFile(configPath, ts.sys.readFile).config as unknown,
    ts.sys,
    API_ROOT,
  );
  const files = controllerFiles(join(API_ROOT, 'src'));
  const program = ts.createProgram(files, config.options);
  const checker = program.getTypeChecker();
  const offenders: string[] = [];

  for (const file of files) {
    const source = program.getSourceFile(file);
    if (!source) continue;
    const visit = (node: ts.Node): void => {
      if (ts.isParameter(node)) {
        const isBody = (ts.getDecorators(node) ?? []).some(
          (decorator) =>
            ts.isCallExpression(decorator.expression) &&
            decorator.expression.expression.getText(source) === 'Body',
        );
        if (isBody) {
          const type = node.type
            ? checker.getTypeFromTypeNode(node.type)
            : undefined;
          if (
            !type ||
            (!isClass(type) && !isExplicitlyUnchecked(type, checker))
          ) {
            const { line } = source.getLineAndCharacterOfPosition(
              node.getStart(source),
            );
            offenders.push(
              `${relative(API_ROOT, file).split(sep).join('/')}:${line + 1} ${node.getText(source).replace(/\s+/g, ' ')}`,
            );
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return offenders;
}

describe('request bodies', () => {
  it('are a validated class, or explicitly unknown and parsed by hand', () => {
    expect(uncheckedBodies()).toEqual([]);
  }, 120_000);
});
