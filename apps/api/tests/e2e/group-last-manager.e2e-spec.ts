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
    const group = (
      await lead
        .post('/api/v1/groups')
        .send({ name: 'Last manager team' })
        .expect(201)
    ).body as { id: string };
    groupId = group.id;
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
    return id;
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

  it('records one audit event for each membership change when a request is retried', async () => {
    const developerId = await addMember('member', 'member');
    const project = (
      await lead
        .post(`/api/v1/groups/${groupId}/projects`)
        .send({ name: 'Membership retries' })
        .expect(201)
    ).body as { id: string };
    const add = () =>
      lead
        .post(`/api/v1/delivery-projects/${project.id}/members`)
        .send({ userId: developerId })
        .expect(201);
    const [first, retry] = await Promise.all([add(), add()]);
    expect(retry.body).toEqual(first.body);

    const memberPath = `/api/v1/groups/${groupId}/members/${await memberIdOf(developerId)}`;
    await lead.delete(memberPath).expect(200);
    await lead.delete(memberPath).expect(200);
    const events = await e2e.query<{ code: string }>(
      `SELECT payload->>'eventCode' AS code FROM platform.outbox_events
       WHERE payload->'metadata'->>'targetUserId' = $1
       ORDER BY code`,
      [developerId],
    );
    expect(events).toEqual([
      { code: 'hierarchy.delivery_project.member_added' },
      { code: 'hierarchy.group.member_removed' },
    ]);
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
