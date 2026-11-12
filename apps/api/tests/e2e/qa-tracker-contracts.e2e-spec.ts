import type { z } from 'zod';

import { startApplication, type E2eApplication } from './support/application';
import {
  QA_TRACKER_CONTRACTS,
  ROUTE_CONTRACTS,
  type ContractRoute,
} from './support/contracts/routes';

/*
 * The QA release-tracker responses declared in @alphaci/api-contracts (team
 * to-dos, QA history, semantic coverage, the import preview, special access),
 * checked against what the running API sends.
 */

const exercised = new Set<ContractRoute>();

function expectStatus(status: number) {
  return (response: { status: number; body: unknown }): void => {
    if (response.status !== status) {
      throw new Error(
        `expected ${String(status)}, got ${String(response.status)}: ${JSON.stringify(response.body)}`,
      );
    }
  };
}

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

describe('QA release-tracker response contracts', () => {
  let e2e: E2eApplication;
  let agent: Awaited<ReturnType<E2eApplication['signIn']>>['agent'];
  let userId: string;
  let projectId: string;

  beforeAll(async () => {
    e2e = await startApplication();
    ({ agent, userId } = await e2e.signIn('admin'));

    const group = await agent
      .post('/api/v1/groups')
      .send({ name: 'QA tracker team' })
      .expect(expectStatus(201));
    // A system needs a GitHub team to create through the API; the rows are the same.
    const [system] = await e2e.query<{ id: string }>(
      `INSERT INTO hierarchy.systems (group_id, name, owner_id)
       VALUES ($1, 'QA tracker system', $2) RETURNING id`,
      [(group.body as { id: string }).id, userId],
    );
    if (!system) throw new Error('system was not created');
    const project = await agent
      .post(`/api/v1/systems/${system.id}/delivery-projects`)
      .send({ name: 'Checkout' })
      .expect(expectStatus(201));
    projectId = (project.body as { id: string }).id;

    // One Feature with one story, so coverage has an outcome to compare.
    await agent
      .post(`/api/v1/delivery-projects/${projectId}/requirements`)
      .send({
        kind: 'functional',
        name: 'Payments',
        items: [
          {
            title: 'Pay by card',
            acceptanceCriteria:
              'Given a cart\nWhen I pay by card\nThen the order is saved',
          },
        ],
      })
      .expect(expectStatus(201));
  });

  afterAll(async () => {
    await e2e.close();
  });

  it('team to-dos: add, list and tick', async () => {
    const base = `/api/v1/delivery-projects/${projectId}/todos`;
    const created = conforms(
      'POST /api/v1/delivery-projects/{deliveryProjectId}/todos',
      (
        await agent
          .post(base)
          .send({
            title: 'Rotate the staging secret',
            priority: 'high',
            dueDate: '2026-12-01',
          })
          .expect(expectStatus(201))
      ).body,
    );
    expect(created.status).toBe('open');

    const list = conforms(
      'GET /api/v1/delivery-projects/{deliveryProjectId}/todos',
      (await agent.get(base).expect(expectStatus(200))).body,
    );
    expect(list.todos.map((todo) => todo.id)).toContain(created.id);

    const ticked = conforms(
      'PATCH /api/v1/delivery-projects/{deliveryProjectId}/todos/{todoId}',
      (
        await agent
          .patch(`${base}/${created.id}`)
          .send({ expectedRowVersion: created.rowVersion, status: 'done' })
          .expect(expectStatus(200))
      ).body,
    );
    expect(ticked.status).toBe('done');
  });

  it('QA history and semantic coverage', async () => {
    conforms(
      'GET /api/v1/delivery-projects/{deliveryProjectId}/qa-history',
      (
        await agent
          .get(`/api/v1/delivery-projects/${projectId}/qa-history`)
          .expect(expectStatus(200))
      ).body,
    );

    const coverage = conforms(
      'GET /api/v1/delivery-projects/{deliveryProjectId}/semantic-coverage',
      (
        await agent
          .get(`/api/v1/delivery-projects/${projectId}/semantic-coverage`)
          .expect(expectStatus(200))
      ).body,
    );
    expect(coverage.summary.stories).toBe(1);
    expect(coverage.features[0]?.stories[0]?.status).toBe('untested');
  });

  it('the import preview reads a CSV file without storing it', async () => {
    const preview = conforms(
      'POST /api/v1/delivery-projects/{deliveryProjectId}/qa-import-preview',
      (
        await agent
          .post(`/api/v1/delivery-projects/${projectId}/qa-import-preview`)
          .attach(
            'file',
            Buffer.from(
              'Feature,Story,Criteria\nPayments,Pay by card,Then the order is saved\n',
            ),
            'stories.csv',
          )
          .expect(expectStatus(201))
      ).body,
    );
    expect(preview.sheets[0]?.headers).toEqual([
      'Feature',
      'Story',
      'Criteria',
    ]);
  });

  it('special access: an admin grants QA release', async () => {
    const [target] = await e2e.query<{ id: string }>(
      "INSERT INTO identity.app_users (login, github_user_id) VALUES ('qa-release-dev', 'qa-release-dev') RETURNING id",
    );
    if (!target) throw new Error('user was not created');
    const granted = conforms(
      'PATCH /api/v1/admin/users/{id}/special-access',
      (
        await agent
          .patch(`/api/v1/admin/users/${target.id}/special-access`)
          .send({ access: ['qa_release'] })
          .expect(expectStatus(200))
      ).body,
    );
    expect(granted.specialAccess).toEqual(['qa_release']);
  });

  it('exercises every route it declares a contract for', () => {
    expect([...exercised].sort()).toEqual(
      Object.keys(QA_TRACKER_CONTRACTS).sort(),
    );
  });
});
