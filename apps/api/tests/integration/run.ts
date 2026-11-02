/**
 * Runs every tests/integration/*.integration.spec.ts against real PostgreSQL.
 *
 *   npm run test:integration               start the disposable fixture
 *   INTEGRATION_ADMIN_URL=... npm run ...  use a running loopback server
 *
 * Each spec skips itself unless the database URL it reads is set, so without
 * this runner they never run. The runner gives each spec what it declares:
 *
 *   MIGRATION_TEST_DB_URL              a fresh, empty database of its own
 *   SUPABASE_DB_URL                    a fresh database with every migration
 *   SELFHOST_MIGRATION_TEST_ADMIN_URL  the admin connection (it makes its own)
 *
 * A spec that reads any other *_URL fails the run, so a new kind of database
 * test cannot be skipped silently: add how to provide it here.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  FIXTURE_ADMIN_URL,
  FIXTURE_COMPOSE_FILE,
  applySqlFiles,
  assertLoopbackDatabaseUrl,
  createDatabase,
  dropDatabase,
  migrationFiles,
  uniqueDatabaseName,
} from '../e2e/support/database';

const APP_ROOT = join(__dirname, '..', '..');
const SPEC_ROOT = join(APP_ROOT, 'tests', 'integration');
const JEST = join(
  APP_ROOT,
  '..',
  '..',
  'node_modules',
  'jest',
  'bin',
  'jest.js',
);
const COMPOSE_PROJECT = 'alphaci-integration';

type Provide = (
  adminUrl: string,
) => Promise<{ url: string; database?: string }>;

const PROVIDERS: Record<string, Provide> = {
  MIGRATION_TEST_DB_URL: async (adminUrl) => {
    const database = uniqueDatabaseName('it');
    return { url: await createDatabase(adminUrl, database), database };
  },
  SUPABASE_DB_URL: async (adminUrl) => {
    const database = uniqueDatabaseName('it');
    const url = await createDatabase(adminUrl, database);
    await applySqlFiles(url, migrationFiles());
    return { url, database };
  },
  SELFHOST_MIGRATION_TEST_ADMIN_URL: (adminUrl) =>
    Promise.resolve({ url: adminUrl }),
};

function specs(): string[] {
  return readdirSync(SPEC_ROOT)
    .filter((name) => name.endsWith('.integration.spec.ts'))
    .sort()
    .map((name) => join(SPEC_ROOT, name));
}

/** The *_URL variables a spec reads; each must have a provider. */
function databaseVariables(spec: string): string[] {
  const source = readFileSync(spec, 'utf8');
  const names = [
    ...source.matchAll(/process\.env\[['"]([A-Z0-9_]+_URL)['"]\]/g),
  ].flatMap((match) => (match[1] ? [match[1]] : []));
  return [...new Set(names)];
}

function compose(...args: string[]): void {
  execFileSync(
    'docker',
    ['compose', '-f', FIXTURE_COMPOSE_FILE, '-p', COMPOSE_PROJECT, ...args],
    { stdio: 'inherit' },
  );
}

async function main(): Promise<number> {
  const unprovided: string[] = [];
  const plan = specs().map((spec) => {
    const variables = databaseVariables(spec);
    const providers = variables.flatMap((name): Array<[string, Provide]> => {
      const provide = PROVIDERS[name];
      if (provide) return [[name, provide]];
      unprovided.push(
        `${relative(APP_ROOT, spec)} reads ${name}, which tests/integration/run.ts cannot provide`,
      );
      return [];
    });
    return { spec, variables, providers };
  });
  if (unprovided.length > 0) {
    unprovided.forEach((line) => console.error(line));
    return 1;
  }

  const explicitUrl = process.env['INTEGRATION_ADMIN_URL'];
  const adminUrl = explicitUrl ?? FIXTURE_ADMIN_URL;
  assertLoopbackDatabaseUrl(adminUrl);
  if (!explicitUrl) compose('up', '-d', '--wait');

  const failed: string[] = [];
  try {
    for (const { spec, variables, providers } of plan) {
      const env: NodeJS.ProcessEnv = { ...process.env };
      const created: string[] = [];
      for (const [name, provide] of providers) {
        const provided = await provide(adminUrl);
        env[name] = provided.url;
        if (provided.database) created.push(provided.database);
      }
      console.log(
        `\n▶ ${relative(APP_ROOT, spec)} (${variables.join(', ') || 'no database'})`,
      );
      const result = spawnSync(
        process.execPath,
        [
          '--experimental-vm-modules',
          JEST,
          '--ci',
          '--runInBand',
          relative(APP_ROOT, spec),
        ],
        { cwd: APP_ROOT, env, stdio: 'inherit' },
      );
      if (result.status !== 0) failed.push(relative(APP_ROOT, spec));
      for (const database of created) await dropDatabase(adminUrl, database);
    }
  } finally {
    if (!explicitUrl) compose('down', '-v');
  }

  if (failed.length > 0) {
    console.error(`\nIntegration specs failed: ${failed.join(', ')}`);
    return 1;
  }
  console.log(
    `\nAll ${plan.length} integration specs passed against PostgreSQL.`,
  );
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
