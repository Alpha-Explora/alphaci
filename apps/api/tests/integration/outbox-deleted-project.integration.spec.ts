import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

import type { DatabaseService } from '../../src/kernel/db/database.service';
import { OutboxDispatcher } from '../../src/kernel/events/outbox-dispatcher';
import { OutboxRepository } from '../../src/kernel/events/outbox.repository';
import { OutboxRelayService } from '../../src/modules/platform-ops/application/outbox-relay.service';
import { AuditEventsService } from '../../src/modules/platform-ops/audit/application/audit-events.service';
import { AuditEventsRepository } from '../../src/modules/platform-ops/audit/infrastructure/audit-events.repository';
import { NotificationEventsService } from '../../src/modules/platform-ops/notifications/application/notification-events.service';
import { NotificationsRepository } from '../../src/modules/platform-ops/notifications/infrastructure/notifications.repository';

/**
 * Deleting a Project together with its GitHub repository queues a "repository
 * deleted" audit event and notification, then deletes the Project row. The
 * relay delivers after that, when the Project the events name is gone, so both
 * inserts hit their project_id foreign key. They must still be stored, without
 * the Project link, as ON DELETE SET NULL would have left them: the audit
 * entry used to be dropped silently and the notification quarantined.
 *
 * A random UUID stands in for the deleted Project: the foreign key sees the
 * same thing. Runs only against the disposable Postgres of the integration
 * runner (SUPABASE_DB_URL).
 */
const dbUrl = process.env['SUPABASE_DB_URL'];
const describeDatabase = dbUrl ? describe : describe.skip;

describeDatabase('outbox relay for a Project deleted before delivery', () => {
  const pool = new Pool({ connectionString: dbUrl });
  const database = {
    isEnabled: () => true,
    query: (sql: string, params?: unknown[]) => pool.query(sql, params),
    withTransaction: async <T>(fn: (client: PoolClient) => Promise<T>) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  } as unknown as DatabaseService;
  const capabilities = { deployment: () => ({ has: () => true }) } as never;
  const outbox = new OutboxRepository(database);
  const relay = new OutboxRelayService(
    outbox,
    new OutboxDispatcher(),
    new AuditEventsService(new AuditEventsRepository(database), capabilities),
    new NotificationEventsService(
      new NotificationsRepository(database),
      capabilities,
    ),
  );

  afterAll(() => pool.end());

  it('stores the audit entry and the notification without the Project link', async () => {
    const deletedProjectId = randomUUID();
    const message = `acme/app-${randomUUID()} was deleted from GitHub.`;
    const userId = (
      await pool.query<{ id: string }>(
        'INSERT INTO identity.app_users (login, github_user_id) VALUES ($1, $1) RETURNING id',
        [`deleted-project-${randomUUID()}`],
      )
    ).rows[0]!.id;

    await outbox.publishDurably({
      topic: 'platform.audit.recorded',
      aggregateType: 'audit_event',
      aggregateId: deletedProjectId,
      payload: {
        projectId: deletedProjectId,
        actorUserId: userId,
        eventCode: 'project_github_repo_deleted',
        message,
      },
    });
    await outbox.publishDurably({
      topic: 'platform.notification.requested',
      aggregateType: 'notification',
      aggregateId: deletedProjectId,
      payload: {
        userId,
        projectId: deletedProjectId,
        eventCode: 'project_github_repo_deleted',
        title: 'GitHub repository deleted',
        body: message,
      },
    });

    // One attempt each: the old behavior quarantined the notification here.
    process.env['OUTBOX_MAX_ATTEMPTS'] = '1';
    try {
      await relay.processPlatformEventsOnce();
    } finally {
      delete process.env['OUTBOX_MAX_ATTEMPTS'];
    }

    const events = await pool.query<{ topic: string; status: string }>(
      'SELECT topic, status FROM platform.outbox_events WHERE aggregate_id = $1 ORDER BY topic',
      [deletedProjectId],
    );
    expect(events.rows).toEqual([
      { topic: 'platform.audit.recorded', status: 'published' },
      { topic: 'platform.notification.requested', status: 'published' },
    ]);

    const audit = await pool.query<{ project_id: string | null }>(
      'SELECT project_id FROM audit.audit_events WHERE message = $1',
      [message],
    );
    expect(audit.rows).toEqual([{ project_id: null }]);

    const notifications = await pool.query<{ project_id: string | null }>(
      'SELECT project_id FROM notifications.notifications WHERE user_id = $1',
      [userId],
    );
    expect(notifications.rows).toEqual([{ project_id: null }]);
  }, 30_000);
});
