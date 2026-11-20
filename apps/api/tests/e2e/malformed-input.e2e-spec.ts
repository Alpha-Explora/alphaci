import {
  startApplication,
  type E2eApplication,
  type SignedInAgent,
} from './support/application';

/**
 * A malformed value in a request is the caller's mistake: 400, never 500.
 * Failure mode: routes passed path ids, cursors and body values straight to
 * SQL, and Postgres' "invalid input syntax" surfaced as Internal Server Error.
 */
describe('Malformed request values', () => {
  let e2e: E2eApplication;
  let agent: SignedInAgent;
  let groupId: string;

  beforeAll(async () => {
    e2e = await startApplication();
    ({ agent } = await e2e.signIn('lead'));
    groupId = (
      await agent
        .post('/api/v1/groups')
        .send({ name: 'Malformed team' })
        .expect(201)
    ).body.id as string;
  });

  afterAll(async () => {
    await e2e.close();
  });

  it.each([
    ['GET', '/api/v1/groups/not-a-uuid'],
    ['GET', '/api/v1/delivery-projects/not-a-uuid'],
    ['GET', '/api/v1/requirements/not-a-uuid'],
    ['GET', '/api/v1/projects/not-a-uuid/overview'],
    ['GET', '/api/v1/projects/not-a-uuid/releases'],
    ['POST', '/api/v1/notifications/not-a-uuid/read'],
  ])('%s %s answers 4xx', async (method, path) => {
    const response =
      method === 'GET'
        ? await agent.get(path)
        : await agent.post(path).send({});
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });

  it('answers a garbage activity cursor with 400', async () => {
    const response = await agent.get(
      `/api/v1/groups/${groupId}/activity?cursor=garbage`,
    );
    expect(response.status).toBe(400);
  });

  it('answers a malformed member id in a body with 400', async () => {
    const response = await agent
      .post(`/api/v1/groups/${groupId}/members`)
      .send({ userId: 'not-a-uuid' });
    expect(response.status).toBe(400);
  });
});
