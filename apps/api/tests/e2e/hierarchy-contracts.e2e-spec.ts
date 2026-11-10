import type { z } from 'zod';

import { startApplication, type E2eApplication } from './support/application';
import {
  HIERARCHY_CONTRACTS,
  ROUTE_CONTRACTS,
  type ContractRoute,
} from './support/contracts/routes';

/*
 * The hierarchy responses declared in @alphaci/api-contracts, checked against
 * what the running API sends. The web app types its reads from the same
 * declarations, so a field the API stops sending, renames or adds fails here.
 */

const exercised = new Set<ContractRoute>();

/** supertest's own message omits the body; the body says why a request failed. */
function expectStatus(status: number) {
  return (response: { status: number; body: unknown }): void => {
    if (response.status !== status) {
      throw new Error(
        `expected ${String(status)}, got ${String(response.status)}: ${JSON.stringify(response.body)}`,
      );
    }
  };
}

/** The body of `route`, checked against the contract declared for it. */
function conforms<Route extends ContractRoute>(
  route: Route,
  body: unknown,
): z.output<(typeof ROUTE_CONTRACTS)[Route]> {
  exercised.add(route);
  const result = ROUTE_CONTRACTS[route].safeParse(body);
  if (!result.success) {
    throw new Error(
      `${route}\n${JSON.stringify(result.error.issues, null, 2)}\nin ${JSON.stringify(body)}`,
    );
  }
  return result.data as z.output<(typeof ROUTE_CONTRACTS)[Route]>;
}

describe('hierarchy response contracts', () => {
  let e2e: E2eApplication;
  let agent: Awaited<ReturnType<E2eApplication['signIn']>>['agent'];
  let userId: string;

  beforeAll(async () => {
    e2e = await startApplication();
    ({ agent, userId } = await e2e.signIn('admin'));
  });

  afterAll(async () => {
    await e2e.close();
  });

  it('groups: create, list, read, update, archive, reopen and members', async () => {
    const created = await agent
      .post('/api/v1/groups')
      .send({ name: 'Contract team', description: 'd', businessUnit: 'bu' })
      .expect(expectStatus(201));
    const group = conforms('POST /api/v1/groups', created.body);

    const list = await agent.get('/api/v1/groups').expect(expectStatus(200));
    expect(
      conforms('GET /api/v1/groups', list.body).map((item) => item.id),
    ).toContain(group.id);

    const read = await agent
      .get(`/api/v1/groups/${group.id}`)
      .expect(expectStatus(200));
    conforms('GET /api/v1/groups/{groupId}', read.body);

    // Each response replaces the client's copy of the group, so each one has
    // to say what the caller may do with it, not just the read routes.
    const updated = await agent
      .patch(`/api/v1/groups/${group.id}`)
      .send({ description: 'changed' })
      .expect(expectStatus(200));
    expect(
      conforms('PATCH /api/v1/groups/{groupId}', updated.body).description,
    ).toBe('changed');

    const archived = await agent
      .post(`/api/v1/groups/${group.id}/archive`)
      .expect(expectStatus(201));
    expect(
      conforms('POST /api/v1/groups/{groupId}/archive', archived.body).status,
    ).toBe('archived');

    const reopened = await agent
      .post(`/api/v1/groups/${group.id}/reopen`)
      .expect(expectStatus(201));
    expect(
      conforms('POST /api/v1/groups/{groupId}/reopen', reopened.body).status,
    ).toBe('active');

    const members = await agent
      .get(`/api/v1/groups/${group.id}/members`)
      .expect(expectStatus(200));
    expect(
      conforms('GET /api/v1/groups/{groupId}/members', members.body),
    ).not.toHaveLength(0);
  });

  it('projects: create under a system, read, update, list and archive', async () => {
    const group = conforms(
      'POST /api/v1/groups',
      (
        await agent
          .post('/api/v1/groups')
          .send({ name: 'Contract projects team' })
          .expect(expectStatus(201))
      ).body,
    );
    // Creating a system opens a GitHub team with the caller's token, which a
    // sign-in through the loopback flow does not have; the rows are the same.
    const [system] = await e2e.query<{ id: string }>(
      `INSERT INTO hierarchy.systems (group_id, name, owner_id)
       VALUES ($1, 'Contract system', $2) RETURNING id`,
      [group.id, userId],
    );
    if (!system) throw new Error('system was not created');

    const created = await agent
      .post(`/api/v1/systems/${system.id}/delivery-projects`)
      .send({ name: 'Contract project', description: 'd' })
      .expect(expectStatus(201));
    const project = conforms(
      'POST /api/v1/systems/{systemId}/delivery-projects',
      created.body,
    );

    conforms(
      'GET /api/v1/delivery-projects/{deliveryProjectId}',
      (
        await agent
          .get(`/api/v1/delivery-projects/${project.id}`)
          .expect(expectStatus(200))
      ).body,
    );

    const updated = await agent
      .patch(`/api/v1/delivery-projects/${project.id}`)
      .send({ description: 'changed' })
      .expect(expectStatus(200));
    expect(
      conforms(
        'PATCH /api/v1/delivery-projects/{deliveryProjectId}',
        updated.body,
      ).description,
    ).toBe('changed');

    const listed = await agent
      .get(`/api/v1/systems/${system.id}/delivery-projects`)
      .expect(expectStatus(200));
    expect(
      conforms(
        'GET /api/v1/systems/{systemId}/delivery-projects',
        listed.body,
      ).map((item) => item.id),
    ).toContain(project.id);

    const archived = await agent
      .post(`/api/v1/delivery-projects/${project.id}/archive`)
      .expect(expectStatus(201));
    expect(
      conforms(
        'POST /api/v1/delivery-projects/{deliveryProjectId}/archive',
        archived.body,
      ).status,
    ).toBe('archived');
  });

  it('exercises every route it declares a contract for', () => {
    expect([...exercised].sort()).toEqual(
      Object.keys(HIERARCHY_CONTRACTS).sort(),
    );
  });
});
