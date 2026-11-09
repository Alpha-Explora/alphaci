import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

import type { DatabaseService } from '../../src/kernel/db/database.service';
import type { OutboxRepository } from '../../src/kernel/events/outbox.repository';
import { AssignmentsRepository } from '../../src/modules/identity-access/hierarchy/infrastructure/assignments.repository';
import { RepositoriesRepository } from '../../src/modules/identity-access/hierarchy/infrastructure/repositories.repository';

/**
 * The two queries behind "moving a repository follows Project membership":
 * who is assigned to it, and the move itself inside a transaction. Seeds one
 * team with two Projects inside a transaction that is rolled back, with
 * foreign-key triggers off so no systems or workspaces are needed. Runs only
 * against the disposable Postgres of the integration runner (SUPABASE_DB_URL).
 */
const dbUrl = process.env['SUPABASE_DB_URL'];
const describeDatabase = dbUrl ? describe : describe.skip;

describeDatabase(
  'moving a repository: assignments and the move (postgres)',
  () => {
    const client = new Client({ connectionString: dbUrl });
    const database = {
      query: (sql: string, params?: unknown[]) => client.query(sql, params),
    } as unknown as DatabaseService;
    const assignments = new AssignmentsRepository(
      database,
      {} as OutboxRepository,
    );
    const repositories = new RepositoriesRepository(database);

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

    async function id(sql: string, params: unknown[]): Promise<string> {
      return (await client.query<{ id: string }>(sql, params)).rows[0]!.id;
    }

    async function seed() {
      const groupId = randomUUID();
      const user = (login: string, displayName: string | null) =>
        id(
          'INSERT INTO identity.app_users (login, github_user_id, display_name) VALUES ($1, $1, $2) RETURNING id',
          [`${login}-${randomUUID()}`, displayName],
        );
      const project = (name: string, group = groupId) =>
        id(
          `INSERT INTO hierarchy.delivery_projects (system_id, group_id, name, status)
         VALUES ($1, $2, $3, 'active') RETURNING id`,
          [randomUUID(), group, name],
        );
      const [ada, bob, cleo] = await Promise.all([
        user('ada', 'Ada Lovelace'),
        user('bob', null),
        user('cleo', 'Cleo'),
      ]);
      const source = await project('source');
      const target = await project('target');
      const elsewhere = await project('other-team', randomUUID());
      const repositoryId = await id(
        `INSERT INTO hierarchy.repositories (delivery_project_id, group_id, name, repo_full_name, created_by, status, origin)
       VALUES ($1, $2, 'api', 'acme/api', $3, 'active', 'created') RETURNING id`,
        [source, groupId, ada],
      );
      const assign = (userId: string, desired: string, effective: string) =>
        client.query(
          `INSERT INTO hierarchy.repository_assignments
           (repository_id, user_id, access_level, desired_state, effective_state, status, assigned_by)
         VALUES ($1, $2, 'write', $3, $4, 'active', $5)`,
          [repositoryId, userId, desired, effective, ada],
        );
      await assign(ada, 'assigned', 'active');
      await assign(bob, 'assigned', 'pending');
      await assign(cleo, 'unassigned', 'revoking');
      return { repositoryId, source, target, elsewhere, ada, bob, cleo };
    }

    it('lists the people still assigned, with a name to show, and not those being revoked', async () => {
      const { repositoryId, ada, bob } = await seed();

      const people =
        await assignments.listAssignedPeopleForRepository(repositoryId);

      expect(people.map((person) => person.userId)).toEqual([ada, bob]);
      expect(people[0]).toMatchObject({
        name: 'Ada Lovelace',
        assignmentId: expect.any(String),
      });
      // A person with no display name shows by their GitHub login.
      expect(people[1]?.name).toMatch(/^bob-/);
      expect(people[1]?.login).toBe(people[1]?.name);
    });

    it('lists nobody for a repository with no assignments', async () => {
      await expect(
        assignments.listAssignedPeopleForRepository(randomUUID()),
      ).resolves.toEqual([]);
    });

    it('moves the repository into another Project of the same team', async () => {
      const { repositoryId, source, target } = await seed();

      await expect(
        repositories.moveToDeliveryProjectWithClient(
          client,
          repositoryId,
          source,
          target,
        ),
      ).resolves.toBe(true);

      const row = await client.query<{ delivery_project_id: string }>(
        'SELECT delivery_project_id FROM hierarchy.repositories WHERE id = $1',
        [repositoryId],
      );
      expect(row.rows[0]?.delivery_project_id).toBe(target);
    });

    it('moves nothing when it already left the source, or the target is another team’s', async () => {
      const { repositoryId, source, target, elsewhere } = await seed();

      await expect(
        repositories.moveToDeliveryProjectWithClient(
          client,
          repositoryId,
          source,
          elsewhere,
        ),
      ).resolves.toBe(false);

      await repositories.moveToDeliveryProjectWithClient(
        client,
        repositoryId,
        source,
        target,
      );
      await expect(
        repositories.moveToDeliveryProjectWithClient(
          client,
          repositoryId,
          source,
          target,
        ),
      ).resolves.toBe(false);
    });
  },
);
