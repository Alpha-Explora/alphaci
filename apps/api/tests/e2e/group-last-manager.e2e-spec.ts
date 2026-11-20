import { randomUUID } from 'node:crypto';

import {
  startApplication,
  type E2eApplication,
  type SignedInAgent,
} from './support/application';

/**
 * A team always keeps someone who can manage it. Who can manage comes from
 * the app role (lead or admin), so that is what the last-manager guard
 * counts. Failure mode: the guard counted the stored team role, which grants
 * nothing; a lead set a Developer's stored role to "admin", removed
 * themselves, and left a team nobody could manage.
 */
describe('Last manager of a team', () => {
  let e2e: E2eApplication;
  let lead: SignedInAgent;
  let leadId: string;
  let groupId: string;

  beforeAll(async () => {
    e2e = await startApplication();
    ({ agent: lead, userId: leadId } = await e2e.signIn('lead'));
    groupId = (
      await lead
        .post('/api/v1/groups')
        .send({ name: 'Last manager team' })
        .expect(201)
    ).body.id as string;
  });

  afterAll(async () => {
    await e2e.close();
  });

  async function addMember(appRole: string, storedRole: string) {
    const id = randomUUID();
    await e2e.query(
      `INSERT INTO identity.app_users (id, login, github_user_id, app_role)
       VALUES ($1::uuid, $1::text, $1::text, $2)`,
      [id, appRole],
    );
    await e2e.query(
      `INSERT INTO orgs.workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [groupId, id, storedRole],
    );
  }

  async function memberIdOf(userId: string): Promise<string> {
    const members = (
      await lead.get(`/api/v1/groups/${groupId}/members`).expect(200)
    ).body as Array<{ id: string; userId: string }>;
    const member = members.find((row) => row.userId === userId);
    if (!member) throw new Error(`${userId} is not a member`);
    return member.id;
  }

  it('refuses to remove the only lead even when a Developer has a stored "admin" role', async () => {
    await addMember('member', 'admin');
    const response = await lead
      .delete(`/api/v1/groups/${groupId}/members/${await memberIdOf(leadId)}`)
      .expect(400);
    expect(response.body).toMatchObject({ code: 'GROUP_LAST_OWNER' });
  });

  it('removes a lead once another lead remains, whatever their stored role', async () => {
    await addMember('lead', 'member');
    await lead
      .delete(`/api/v1/groups/${groupId}/members/${await memberIdOf(leadId)}`)
      .expect(200);
  });

  it('has no route that sets a team role', async () => {
    const [row] = await e2e.query<{ id: string }>(
      'SELECT id FROM orgs.workspace_members WHERE workspace_id = $1 LIMIT 1',
      [groupId],
    );
    await lead
      .patch(`/api/v1/groups/${groupId}/members/${row!.id}`)
      .send({ role: 'admin' })
      .expect(404);
  });
});
