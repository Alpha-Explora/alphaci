import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { DatabaseService } from '../../src/kernel/db/database.service';
import { WorkspacesRepository } from '../../src/modules/identity-access/workspaces/infrastructure/workspaces.repository';

/*
 * Project-scoped workspace access (on-prem host assignment uses it) must end
 * when the person leaves the workspace. A removed member once kept it: they
 * could still put their project on the workspace's machine and deploy to it.
 */
describe('Workspace membership through a project', () => {
  const pool = new Pool({
    connectionString: process.env['E2E_APP_DATABASE_URL'],
  });
  const repository = new WorkspacesRepository({
    query: pool.query.bind(pool),
  } as unknown as DatabaseService);
  const ownerId = randomUUID(),
    memberId = randomUUID();
  let workspaceId: string, projectId: string;

  beforeAll(async () => {
    for (const id of [ownerId, memberId]) {
      await pool.query(
        'INSERT INTO identity.app_users(id,login,github_user_id) VALUES($1::uuid,$1::text,$1::text)',
        [id],
      );
    }
    workspaceId = (
      await pool.query<{ id: string }>(
        "INSERT INTO orgs.workspaces (owner_user_id, name, kind) VALUES ($1, 'E2E membership', 'team') RETURNING id",
        [ownerId],
      )
    ).rows[0]!.id;
    await pool.query(
      "INSERT INTO orgs.workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin'), ($1, $3, 'member')",
      [workspaceId, ownerId, memberId],
    );
    projectId = (
      await pool.query<{ id: string }>(
        `INSERT INTO projects.provisioned_projects(user_id,workspace_id,repo_full_name,template_id,service_name,workflow_path,status)
         VALUES($1,$2,$3,'fe-nextjs','web','.github/workflows/ci.yml','provisioned') RETURNING id`,
        [memberId, workspaceId, 'e2e/' + randomUUID()],
      )
    ).rows[0]!.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM projects.provisioned_projects WHERE id=$1', [
      projectId,
    ]);
    await pool.query(
      'DELETE FROM orgs.workspace_members WHERE workspace_id=$1',
      [workspaceId],
    );
    await pool.query('DELETE FROM orgs.workspaces WHERE id=$1', [workspaceId]);
    await pool.query('DELETE FROM identity.app_users WHERE id = ANY($1)', [
      [ownerId, memberId],
    ]);
    await pool.end();
  });

  it('finds an active member through their project', async () => {
    await expect(
      repository.findProjectMembership(projectId, memberId),
    ).resolves.toMatchObject({ workspaceId, userId: memberId });
  });

  it('no longer finds them once they are removed from the workspace', async () => {
    await pool.query(
      "UPDATE orgs.workspace_members SET member_status = 'removed' WHERE workspace_id = $1 AND user_id = $2",
      [workspaceId, memberId],
    );
    await expect(
      repository.findProjectMembership(projectId, memberId),
    ).resolves.toBeNull();
    await expect(
      repository.findMembership(workspaceId, memberId),
    ).resolves.toBeNull();
  });
});
