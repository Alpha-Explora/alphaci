import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

import { postgresSslConfig } from '../../src/kernel/db/postgres-ssl.config.js';
import type { DatabaseService } from '../../src/kernel/db/database.service';
import type { OutboxRepository } from '../../src/kernel/events/outbox.repository';
import { AssignmentsRepository } from '../../src/modules/identity-access/hierarchy/infrastructure/assignments.repository';
import { GithubAccessSyncRepository } from '../../src/modules/identity-access/hierarchy/infrastructure/github-access-sync.repository';

/**
 * The GitHub grant retry budget against real Postgres. The sync row lives as
 * long as its assignment, so every new grant or revoke request, and every
 * verified result, has to start the count again: GithubSyncService stops
 * requeueing a failed job once the count reaches its limit.
 *
 * Seeds one assignment with foreign-key triggers off, inside a transaction
 * that is rolled back, so it needs no team, Project or user rows.
 */
const dbUrl = process.env['SUPABASE_DB_URL'];
const describeDatabase = dbUrl ? describe : describe.skip;

describeDatabase('GitHub access sync retry budget (postgres)', () => {
  const client = new Client({
    connectionString: dbUrl,
    ssl: dbUrl
      ? postgresSslConfig(dbUrl, process.env['SUPABASE_DB_CA_CERT'])
      : undefined,
  });
  // Every repository call runs on the one client, inside the test transaction.
  const database = {
    query: (sql: string, params?: unknown[]) => client.query(sql, params),
  } as unknown as DatabaseService;
  const assignments = new AssignmentsRepository(
    database,
    {} as OutboxRepository,
  );
  const sync = new GithubAccessSyncRepository(database, {} as OutboxRepository);

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

  async function newAssignment(): Promise<string> {
    const assignment = await assignments.createOrResetWithClient(client, {
      repositoryId: randomUUID(),
      userId: randomUUID(),
      assignedBy: randomUUID(),
    });
    await sync.upsertPendingWithClient(client, assignment.id);
    return assignment.id;
  }

  async function failTimes(assignmentId: string, times: number) {
    let retryCount = 0;
    for (let attempt = 0; attempt < times; attempt += 1) {
      retryCount = await sync.markFailed({ assignmentId, error: 'GitHub 502' });
    }
    return retryCount;
  }

  it('a new grant request starts a fresh retry budget', async () => {
    const assignmentId = await newAssignment();
    expect(await failTimes(assignmentId, 5)).toBe(5);

    const record = await sync.upsertPendingWithClient(client, assignmentId);

    expect(record).toEqual(
      expect.objectContaining({
        syncState: 'pending',
        retryCount: 0,
        lastError: null,
      }),
    );
    expect(await failTimes(assignmentId, 1)).toBe(1);
  }, 30_000);

  it('a verified result clears the failures that came before it', async () => {
    const assignmentId = await newAssignment();
    await failTimes(assignmentId, 3);

    await sync.markVerified({
      assignmentId,
      githubTeamId: '7',
      githubTeamSlug: 'web-app-developers',
      verificationResult: { hasAccess: true },
    });

    expect(await sync.findByAssignmentId(assignmentId)).toEqual(
      expect.objectContaining({ syncState: 'verified', retryCount: 0 }),
    );
  }, 30_000);

  it('a revoke request starts a fresh retry budget', async () => {
    const assignmentId = await newAssignment();
    await failTimes(assignmentId, 5);

    const revoked = await assignments.setDesiredUnassignedWithClient(
      client,
      assignmentId,
    );

    expect(revoked).toEqual(
      expect.objectContaining({
        desiredState: 'unassigned',
        effectiveState: 'revoking',
      }),
    );
    expect(await sync.findByAssignmentId(assignmentId)).toEqual(
      expect.objectContaining({ retryCount: 0, lastError: null }),
    );
  }, 30_000);
});
