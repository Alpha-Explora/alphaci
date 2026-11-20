import {
  startApplication,
  type E2eApplication,
  type SignedInAgent,
} from './support/application';

/**
 * A team's caller-named Projects are unique by trimmed, case-insensitive name
 * on every path, and enforcing that never stalls the API.
 *
 * Failure modes: four parallel creates of one name held all three pooled
 * connections (a session lock waited on each) so the lock holder could not
 * get one; every request then waited for the 10 s statement timeout and three
 * answered 500. Creating under a System and renaming skipped the rule.
 */
describe('Project name uniqueness', () => {
  let e2e: E2eApplication;
  let agent: SignedInAgent;
  let userId: string;
  let groupId: string;

  beforeAll(async () => {
    e2e = await startApplication();
    ({ agent, userId } = await e2e.signIn('lead'));
    const group = (
      await agent
        .post('/api/v1/groups')
        .send({ name: 'Uniqueness team' })
        .expect(201)
    ).body as { id: string };
    groupId = group.id;
  });

  afterAll(async () => {
    await e2e.close();
  });

  const createProject = (name: string) =>
    agent.post(`/api/v1/groups/${groupId}/projects`).send({ name });

  it('refuses blank names and writes against an archived group', async () => {
    await agent.post('/api/v1/groups').send({ name: '   ' }).expect(400);
    const group = `/api/v1/groups/${groupId}`;
    const archived = await agent.post(`${group}/archive`).expect(201);
    try {
      const repeated = await agent.post(`${group}/archive`).expect(201);
      expect(repeated.body).toMatchObject({
        archivedAt: (archived.body as { archivedAt: string }).archivedAt,
      });
      const renamed = await agent
        .patch(group)
        .send({ name: 'Renamed' })
        .expect(409);
      expect(renamed.body).toMatchObject({ code: 'GROUP_ARCHIVED' });
      const created = await createProject('Archived team project').expect(409);
      expect(created.body).toMatchObject({ code: 'GROUP_ARCHIVED' });
    } finally {
      await agent.post(`${group}/reopen`).expect(201);
    }
  });

  it('reopens archived Projects and protects the unique name on restore', async () => {
    const created = await createProject('Reusable').expect(201);
    const path = `/api/v1/delivery-projects/${(created.body as { id: string }).id}`;
    await agent.post(`${path}/archive`).expect(201);
    const replacement = await createProject('Reusable').expect(201);
    const refused = await agent.post(`${path}/reopen`).expect(409);
    expect(refused.body).toMatchObject({ code: 'PROJECT_NAME_TAKEN' });
    await agent
      .patch(
        `/api/v1/delivery-projects/${(replacement.body as { id: string }).id}`,
      )
      .send({ name: 'Replacement' })
      .expect(200);
    const reopened = await agent.post(`${path}/reopen`).expect(201);
    expect(reopened.body).toMatchObject({ status: 'active', archivedAt: null });
    await agent.post(`${path}/reopen`).expect(201);
  });

  it('answers parallel same-name creates with one 201 and 409s, promptly', async () => {
    const started = Date.now();
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => createProject('Parallel')),
    );
    const statuses = responses
      .map((response) => response.status)
      .sort((a, b) => a - b);

    expect(statuses).toEqual([201, 409, 409, 409]);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('creates different names in parallel without exhausting the pool', async () => {
    const started = Date.now();
    const responses = await Promise.all(
      ['One', 'Two', 'Three', 'Four', 'Five'].map((name) =>
        createProject(name),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([
      201, 201, 201, 201, 201,
    ]);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('applies the rule when creating under a System and when renaming', async () => {
    const [system] = await e2e.query<{ id: string }>(
      `INSERT INTO hierarchy.systems (group_id, name, owner_id)
       VALUES ($1, 'Uniqueness system', $2) RETURNING id`,
      [groupId, userId],
    );
    const underSystem = (name: string) =>
      agent
        .post(`/api/v1/systems/${system!.id}/delivery-projects`)
        .send({ name });

    await underSystem('  one ').expect(409);
    const fresh = (await underSystem('Six').expect(201)).body as {
      id: string;
    };

    await agent
      .patch(`/api/v1/delivery-projects/${fresh.id}`)
      .send({ name: 'TWO' })
      .expect(409);
    // Its own name in another case is not a clash.
    await agent
      .patch(`/api/v1/delivery-projects/${fresh.id}`)
      .send({ name: 'six' })
      .expect(200);
  });
});
