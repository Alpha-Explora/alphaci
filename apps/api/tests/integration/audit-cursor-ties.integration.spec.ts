import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

import type { DatabaseService } from '../../src/kernel/db/database.service';
import { AuditEventsService } from '../../src/modules/platform-ops/audit/application/audit-events.service';
import { AuditEventsRepository } from '../../src/modules/platform-ops/audit/infrastructure/audit-events.repository';

/**
 * Paging the repository Audit tab through events that share a timestamp.
 * GitHub events carry GitHub's own times, so ties are common, and a cursor of
 * the last timestamp alone skipped every tied event past the page boundary.
 * Paging has to return each event exactly once, in the order the database
 * sorts them.
 *
 * Seeds inside a transaction that is rolled back, with foreign-key triggers
 * off so no workspace or project rows are needed. Runs only against the
 * disposable Postgres of the integration runner (SUPABASE_DB_URL).
 */
const dbUrl = process.env['SUPABASE_DB_URL'];
const describeDatabase = dbUrl ? describe : describe.skip;

describeDatabase('Audit tab paging with tied timestamps (postgres)', () => {
  const client = new Client({ connectionString: dbUrl });
  const database = {
    query: (sql: string, params?: unknown[]) => client.query(sql, params),
  } as unknown as DatabaseService;
  const capabilities = { deployment: () => ({ has: () => true }) } as never;
  const service = new AuditEventsService(
    new AuditEventsRepository(database),
    capabilities,
  );

  beforeAll(async () => {
    await client.connect();
  });
  afterAll(async () => {
    await client.end();
  });
  beforeEach(async () => {
    await client.query('BEGIN');
    await client.query('SET LOCAL session_replication_role = replica');
  });
  afterEach(async () => {
    await client.query('ROLLBACK');
  });

  async function seed(occurredAt: string[]): Promise<string> {
    const projectId = randomUUID();
    await service.ingestExternalEvents({
      workspaceId: randomUUID(),
      projectId,
      events: occurredAt.map((at, index) => ({
        externalId: `github:${randomUUID()}`,
        eventCode: 'github_push',
        message: `event ${String(index)}`,
        metadata: {},
        actorLogin: null,
        occurredAt: at,
      })),
    } as never);
    return projectId;
  }

  async function pageThrough(projectId: string, limit: number) {
    const ids: string[] = [];
    let before: string | null = null;
    for (let guard = 0; guard < 20; guard += 1) {
      const page = await service.listProjectEvents({
        projectId,
        limit,
        before,
      });
      ids.push(...page.items.map((item) => item.id));
      if (!page.next) return ids;
      before = page.next;
    }
    throw new Error('paging did not end');
  }

  async function inDatabaseOrder(projectId: string): Promise<string[]> {
    const result = await client.query<{ id: string }>(
      'SELECT id FROM audit.audit_events WHERE project_id = $1 ORDER BY created_at DESC, id DESC',
      [projectId],
    );
    return result.rows.map((row) => row.id);
  }

  it('returns every event exactly once when a page boundary falls inside a tie', async () => {
    const tied = '2026-11-01T10:00:00Z';
    const projectId = await seed([
      tied,
      tied,
      tied,
      tied,
      tied,
      '2026-11-01T09:00:00Z',
    ]);

    const seen = await pageThrough(projectId, 2);

    expect(seen).toHaveLength(6);
    expect(new Set(seen).size).toBe(6);
    expect(seen).toEqual(await inDatabaseOrder(projectId));
  }, 30_000);

  it('still pages events with distinct timestamps', async () => {
    const projectId = await seed([
      '2026-11-01T10:00:03Z',
      '2026-11-01T10:00:02Z',
      '2026-11-01T10:00:01Z',
    ]);

    expect(await pageThrough(projectId, 1)).toEqual(
      await inDatabaseOrder(projectId),
    );
  }, 30_000);

  it('keeps reading a bare-timestamp cursor handed out before this change', async () => {
    const projectId = await seed([
      '2026-11-01T10:00:03Z',
      '2026-11-01T10:00:02Z',
      '2026-11-01T10:00:01Z',
    ]);

    const page = await service.listProjectEvents({
      projectId,
      before: '2026-11-01T10:00:02.000000Z',
    });

    expect(page.items.map((item) => item.message)).toEqual(['event 2']);
  }, 30_000);
});
