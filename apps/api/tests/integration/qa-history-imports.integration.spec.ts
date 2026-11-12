import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { Client } from 'pg';
import type { PoolClient } from 'pg';

import type { DatabaseService } from '../../src/kernel/db/database.service';
import { QaRunsRepository } from '../../src/modules/projects/infrastructure/qa-runs.repository';
import { QaHistoryRepository } from '../../src/modules/projects/infrastructure/qa-history.repository';
import { QaRequirementsRepository } from '../../src/modules/projects/infrastructure/qa-requirements.repository';
import { QaTestCasesRepository } from '../../src/modules/projects/infrastructure/qa-test-cases.repository';

/**
 * Applies the whole migration tree to an EMPTY database, then exercises atomic imports, preserved QA rounds and transactional progress history through the real repositories. The optional embedded engine uses the QA migration subset and minimal parent fixtures.
 *
 * Runs only when MIGRATION_TEST_DB_URL points at a throwaway, empty database
 * (same rule as project-requirements.migration.integration.spec.ts).
 */
const dbUrl = process.env['MIGRATION_TEST_DB_URL'];
const embeddedModule = process.env['QA_HISTORY_PGLITE_MODULE'];
const describeDatabase = dbUrl || embeddedModule ? describe : describe.skip;

const MIGRATION = join('projects', '20261027000000_qa_progress_history.sql');
const migrationsRoot = resolve(__dirname, '../../supabase/migrations');

function migrationFiles(dir: string, relative = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    const name = join(relative, entry.name);
    if (entry.isDirectory()) return migrationFiles(full, name);
    return entry.name.endsWith('.sql') ? [name] : [];
  });
}

const orderedFiles = migrationFiles(migrationsRoot).sort((a, b) =>
  basename(a).localeCompare(basename(b)),
);

describeDatabase('QA import and history transactions', () => {
  const client = embeddedModule
    ? embeddedClient(embeddedModule)
    : new Client({ connectionString: dbUrl });
  const owner = randomUUID();
  const workspaceId = randomUUID();
  const deliveryProject = randomUUID();
  const actor = { id: owner, login: 'qa' };
  let iterationId = '';
  let storyId = '';
  let runId = '';
  let runItemId = '';

  const asDatabaseService = (): DatabaseService =>
    ({
      query: (sql: string, values?: unknown[]) => client.query(sql, values),
      withClient: <T>(fn: (c: PoolClient) => Promise<T>) =>
        fn(client as unknown as PoolClient),
      withTransaction: async <T>(fn: (c: PoolClient) => Promise<T>) => {
        await client.query('BEGIN');
        try {
          const result = await fn(client as unknown as PoolClient);
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      },
    }) as unknown as DatabaseService;

  const testCases = () => new QaTestCasesRepository(asDatabaseService());
  const runs = () => new QaRunsRepository(asDatabaseService());

  const copies = async () =>
    (
      await client.query<{
        title: string;
        status: string;
        source: string | null;
      }>(
        'SELECT title, status, source_test_case_id AS source FROM projects.qa_run_test_cases WHERE run_id = $1 ORDER BY category_position, "position";',
        [runId],
      )
    ).rows;
  beforeAll(async () => {
    await client.connect();
    await client.query(
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
       END $$;
       CREATE SCHEMA IF NOT EXISTS extensions;`,
    );
    if (embeddedModule)
      await client.query(`
      CREATE SCHEMA projects; CREATE SCHEMA identity; CREATE SCHEMA orgs; CREATE SCHEMA hierarchy;
      CREATE TABLE projects.provisioned_projects(id UUID PRIMARY KEY);
      CREATE TABLE identity.app_users(id UUID PRIMARY KEY, login TEXT);
      CREATE TABLE orgs.workspaces(id UUID PRIMARY KEY, owner_user_id UUID, name TEXT, kind TEXT);
      CREATE TABLE hierarchy.delivery_projects(id UUID PRIMARY KEY, group_id UUID, created_at TIMESTAMPTZ DEFAULT NOW(), status TEXT);
      CREATE TABLE hierarchy.repositories(provisioned_project_id UUID, delivery_project_id UUID, status TEXT);
    `);
    const qaMigrations = new Set([
      '20260925010000_qa_checklists.sql',
      '20260925020000_qa_runs.sql',
      '20260925030000_qa_runs_checklist_optional.sql',
      '20260925040000_qa_signoff_superseded_login.sql',
      '20261001010000_project_requirements.sql',
      '20261015010000_project_iterations.sql',
      '20261020010000_qa_test_cases.sql',
      '20261021010000_qa_po_acceptance.sql',
      '20261027000000_qa_progress_history.sql',
    ]);
    for (const file of orderedFiles) {
      if (!embeddedModule || qaMigrations.has(basename(file))) {
        await client.query(readFileSync(join(migrationsRoot, file), 'utf8'));
      }
    }

    await client.query(
      "INSERT INTO identity.app_users (id, login) VALUES ($1, 'qa');",
      [owner],
    );
    await client.query(
      "INSERT INTO orgs.workspaces (id, owner_user_id, name, kind) VALUES ($1, $2, 'Team', 'team');",
      [workspaceId, owner],
    );
    iterationId = (
      await client.query<{ id: string }>(
        'INSERT INTO projects.project_iterations (delivery_project_id, number) VALUES ($1, 1) RETURNING id;',
        [deliveryProject],
      )
    ).rows[0]!.id;
    const feature = (
      await client.query<{ id: string }>(
        `INSERT INTO projects.qa_checklists
           (workspace_id, name, created_by, kind, delivery_project_id, iteration_id)
         VALUES ($1, 'Customer Authentication', $2, 'functional', $3, $4) RETURNING id;`,
        [workspaceId, owner, deliveryProject, iterationId],
      )
    ).rows[0]!.id;
    storyId = (
      await client.query<{ id: string }>(
        `INSERT INTO projects.qa_checklist_items (checklist_id, "position", title, progress)
         VALUES ($1, 0, 'Returning customer logs in', 'done') RETURNING id;`,
        [feature],
      )
    ).rows[0]!.id;
    runId = (
      await client.query<{ id: string }>(
        `INSERT INTO projects.qa_verification_runs
           (scope, delivery_project_id, iteration_id, heads_fingerprint, checklist_version,
            checklist_name, branch, commit_source, created_by, created_by_login)
         VALUES ('project', $1, $2, $3, 0, 'Checkout', 'uat', 'branch_head', $4, 'qa')
         RETURNING id;`,
        [deliveryProject, iterationId, 'a'.repeat(64), owner],
      )
    ).rows[0]!.id;
    runItemId = (
      await client.query<{ id: string }>(
        `INSERT INTO projects.qa_run_items
           (run_id, source_item_id, "position", title, target_persona, verification_type,
            requirement_id, requirement_name, requirement_kind)
         VALUES ($1, $2, 0, 'Returning customer logs in', 'all', 'manual', $3,
                 'Customer Authentication', 'functional')
         RETURNING id;`,
        [runId, storyId, feature],
      )
    ).rows[0]!.id;
  }, 180_000);

  afterAll(async () => {
    await client.end();
  });

  const importRows = [
    {
      category: 'Happy path',
      title: 'Saved password',
      expectedResult: 'Profile shown',
    },
    {
      category: 'Validation',
      title: 'Wrong password',
      expectedResult: 'Error shown',
    },
  ];
  const requirementId = async () =>
    (
      await client.query<{ checklist_id: string }>(
        'SELECT checklist_id FROM projects.qa_checklist_items WHERE id = $1;',
        [storyId],
      )
    ).rows[0]!.checklist_id;
  const version = async () =>
    Number(
      (
        await client.query(
          'SELECT row_version FROM projects.qa_run_items WHERE id = $1',
          [runItemId],
        )
      ).rows[0].row_version,
    );

  it('imports grouped definitions atomically, updates open copies, and skips an identical retry', async () => {
    const repository = testCases();
    const requirement = await requirementId();
    await expect(
      repository.importCases(
        storyId,
        requirement,
        iterationId,
        importRows,
        actor,
      ),
    ).resolves.toEqual({ added: 2, skipped: 0 });
    expect(await copies()).toHaveLength(2);
    const before = await version();
    await expect(
      repository.importCases(
        storyId,
        requirement,
        iterationId,
        importRows,
        actor,
      ),
    ).resolves.toEqual({ added: 0, skipped: 2 });
    expect(await version()).toBe(before);
    expect(await copies()).toHaveLength(2);
  });

  it('rolls back additions when a later definition conflicts', async () => {
    await expect(
      testCases().importCases(
        storyId,
        await requirementId(),
        iterationId,
        [
          {
            category: 'New group',
            title: 'Must roll back',
            expectedResult: '',
          },
          { ...importRows[0]!, expectedResult: 'Changed expectation' },
        ],
        actor,
      ),
    ).rejects.toThrow('different or ambiguous');
    const definitions = (await testCases().listByItemIds([storyId])).get(
      storyId,
    )!;
    expect(definitions.map((entry) => entry.category.name)).not.toContain(
      'New group',
    );
    expect(await copies()).toHaveLength(2);
  });

  it('keeps two failure rounds, automatic development resets and the intervening fix request', async () => {
    const repository = runs();
    await repository.updateItem(
      runId,
      runItemId,
      await version(),
      {
        status: 'failed',
        notes: 'First failure',
        defectSeverity: 'major',
        reproductionSteps: undefined,
      },
      actor,
      'pending',
      { resetProgressOnReturn: true, requireProgressDoneForPass: true },
    );
    const source = (
      await client.query(
        'SELECT row_version FROM projects.qa_checklist_items WHERE id = $1',
        [storyId],
      )
    ).rows[0];
    await new QaRequirementsRepository(asDatabaseService()).setProgress(
      await requirementId(),
      storyId,
      Number(source.row_version),
      'done',
      actor,
    );
    await repository.requestRetest(
      runId,
      runItemId,
      actor,
      'Fixed the profile',
    );
    await repository.updateItem(
      runId,
      runItemId,
      await version(),
      {
        status: 'failed',
        notes: 'Second failure',
        defectSeverity: 'major',
        reproductionSteps: undefined,
      },
      actor,
      'pending',
      { resetProgressOnReturn: true, requireProgressDoneForPass: true },
    );
    const history = await new QaHistoryRepository(asDatabaseService()).list(
      deliveryProject,
      { itemId: storyId },
    );
    expect(
      history.filter((event) => event.type === 'progress_changed'),
    ).toHaveLength(3);
    expect(
      history
        .filter((event) => event.toStatus === 'failed')
        .map((event) => event.payload.notes),
    ).toEqual(['Second failure', 'First failure']);
    expect(
      history.some(
        (event) =>
          event.type === 'fix_requested' &&
          event.payload.note === 'Fixed the profile',
      ),
    ).toBe(true);
    expect(
      await new QaHistoryRepository(asDatabaseService()).list(randomUUID(), {}),
    ).toEqual([]);
  });

  it('adding test definitions does not clear a failed story or its developer return', async () => {
    await testCases().importCases(
      storyId,
      await requirementId(),
      iterationId,
      [
        {
          category: 'Validation',
          title: 'Expired credentials',
          expectedResult: 'Error shown',
        },
      ],
      actor,
    );
    const item = (
      await client.query(
        'SELECT status, notes, verified_by FROM projects.qa_run_items WHERE id = $1',
        [runItemId],
      )
    ).rows[0];
    expect(item.status).toBe('failed');
    expect(item.notes).toBe('Second failure');
    expect(item.verified_by).toBe(owner);
  });

  it('keeps signed-off copies frozen while new definitions close the release gate', async () => {
    const frozen = await copies();
    await client.query(
      "UPDATE projects.qa_verification_runs SET status = 'signed_off' WHERE id = $1",
      [runId],
    );
    const signedAt = new Date().toISOString();
    await client.query(
      `INSERT INTO projects.qa_run_signoffs(run_id, verdict, signed_by, signed_by_login, signed_at, report_json)
      VALUES ($1, 'REJECTED', $2, 'qa', $3, '{}'::jsonb)`,
      [runId, owner, signedAt],
    );
    await testCases().importCases(
      storyId,
      await requirementId(),
      iterationId,
      [
        {
          category: 'Happy path',
          title: 'New session',
          expectedResult: 'Profile shown',
        },
      ],
      actor,
    );
    expect(await copies()).toEqual(frozen);
    expect(
      await new QaRequirementsRepository(
        asDatabaseService(),
      ).requirementsChangedSince(iterationId, signedAt),
    ).toBe(true);
    const history = await new QaHistoryRepository(asDatabaseService()).list(
      deliveryProject,
      {},
    );
    expect(
      history.some(
        (event) => event.type === 'signed_off' && event.toStatus === 'REJECTED',
      ),
    ).toBe(true);
  });

  it('pages tied timestamps without repeating events and keeps project filters applied', async () => {
    const history = new QaHistoryRepository(asDatabaseService());
    const first = (await history.list(deliveryProject, { iterationId }))[0]!;
    const next = await history.list(deliveryProject, {
      iterationId,
      before: { at: first.createdAt, id: first.id },
    });
    expect(next.some((event) => event.id === first.id)).toBe(false);
    expect(next.every((event) => event.iterationId === iterationId)).toBe(true);
  });

  it('refuses a data-removing rollback once progress events exist', async () => {
    const rollback = readFileSync(
      resolve(
        __dirname,
        '../../supabase/rollbacks/20261027000000_qa_progress_history_down.sql',
      ),
      'utf8',
    );
    await expect(client.query(rollback)).rejects.toThrow(
      'Progress history exists',
    );
    await client.query('ROLLBACK');
    expect(
      (
        await client.query(
          'SELECT count(*)::int AS n FROM projects.qa_progress_events',
        )
      ).rows[0].n,
    ).toBe(3);
  });

  it('replays the migration and refuses direct authenticated reads', async () => {
    await client.query(readFileSync(join(migrationsRoot, MIGRATION), 'utf8'));
    await client.query('SET ROLE authenticated');
    try {
      await expect(
        client.query('SELECT * FROM projects.qa_progress_events'),
      ).rejects.toThrow('permission denied');
    } finally {
      await client.query('RESET ROLE');
    }
  });
});

/** Optional in-process PostgreSQL/WASM adapter for machines without a Docker
 * engine. Runs the real QA migrations against minimal parent-context fixtures;
 * it does not claim a full migration-tree replay or multi-session lock testing.
 * Resolve an externally installed @electric-sql/pglite with QA_HISTORY_PGLITE_MODULE.
 */
function embeddedClient(modulePath: string): Client {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require(modulePath) as {
    PGlite: new () => {
      waitReady: Promise<void>;
      close(): Promise<void>;
      query(sql: string, params: unknown[]): Promise<unknown>;
      exec(sql: string): Promise<unknown[]>;
    };
  };
  const db = new PGlite();
  return {
    connect: () => db.waitReady,
    end: () => db.close(),
    query: async (sql: string, params?: unknown[]) => {
      if (params?.length) return db.query(sql, params);
      const results = await db.exec(sql);
      return results.at(-1) ?? { rows: [], rowCount: 0 };
    },
  } as unknown as Client;
}
