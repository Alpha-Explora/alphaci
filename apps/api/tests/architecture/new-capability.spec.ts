import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const apiRoot = resolve(__dirname, '../..');
let fixture: string;

beforeEach(() => {
  fixture = mkdtempSync(join(tmpdir(), 'alphaci-capability-'));
  mkdirSync(join(fixture, 'scripts/lib'), { recursive: true });
  mkdirSync(join(fixture, 'src/kernel/composition'), { recursive: true });
  for (const file of [
    'new-capability.cjs',
    'lib/composition-source.cjs',
    'lib/feature-inventory.cjs',
  ]) {
    copyFileSync(
      join(apiRoot, 'scripts', file),
      join(fixture, 'scripts', file),
    );
  }
  writeFileSync(
    join(fixture, 'src/kernel/composition/catalog.source.json'),
    JSON.stringify({
      capabilities: [
        {
          key: 'projects.fixture',
          context: 'projects',
          description: 'Fixture',
          maturity: 'not-implemented',
          configuration: 'Not implemented',
          configurationFlags: [],
          requires: [],
          editions: ['saas', 'edu', 'enterprise'],
          surface: {
            apiField: null,
            viewFlag: null,
            domains: [],
            routes: [],
            featureBarrels: [],
          },
        },
      ],
    }),
  );
});

afterEach(() => {
  if (!fixture.startsWith(join(tmpdir(), 'alphaci-capability-'))) {
    throw new Error('Unexpected fixture directory');
  }
  rmSync(fixture, { recursive: true, force: true });
});

function files() {
  return readdirSync(fixture, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => [
      join(entry.parentPath, entry.name).slice(fixture.length),
      readFileSync(join(entry.parentPath, entry.name), 'utf8'),
    ]);
}

function run(editions: string | undefined, extra: string[] = []) {
  return spawnSync(
    process.execPath,
    [
      join(fixture, 'scripts/new-capability.cjs'),
      '--key',
      'projects.example',
      '--description',
      'Example',
      '--summary',
      'Test',
      ...(editions === undefined ? [] : ['--editions', editions]),
      ...extra,
    ],
    { cwd: fixture, encoding: 'utf8' },
  );
}

describe('capability authoring CLI', () => {
  it.each([
    undefined,
    '',
    'internal',
    'enterprsie',
    'edu,internal',
    'edu,edu',
    '--dry-run',
  ])('rejects edition selection %s without writing files', (editions) => {
    const before = files();
    const result = run(editions);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/edition/i);
    expect(files()).toEqual(before);
  });

  it('previews a valid assignment in canonical order without any writes', () => {
    const before = files();
    const result = run('enterprise,edu', ['--dry-run']);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      dryRun: true,
      record: {
        key: 'projects.example',
        editions: ['edu', 'enterprise'],
        maturity: 'not-implemented',
      },
    });
    expect(files()).toEqual(before);
  });

  it('still validates the document in preview mode', () => {
    const before = files();
    const result = run('enterprise', [
      '--dry-run',
      '--requires',
      'projects.missing',
    ]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/requires unknown capability/);
    expect(files()).toEqual(before);
  });
});
