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

  it('enforces the requirement description limit on create and update', async () => {
    const description = 'x'.repeat(4000);
    const path = `/api/v1/delivery-projects/${projectId}/requirements`;
    await agent
      .post(path)
      .send({
        kind: 'functional',
        name: 'Too long',
        description: description + 'x',
      })
      .expect(400);
    const created = await agent
      .post(path)
      .send({
        kind: 'functional',
        name: 'At the limit',
        description,
      })
      .expect(201);
    expect(created.body).toMatchObject({ description });
    const { id, version } = created.body as { id: string; version: number };
    await agent
      .patch(`/api/v1/requirements/${id}`)
      .send({
        expectedVersion: version,
        description: description + 'x',
      })
      .expect(400);
  });

  it('keeps a source item that an open Project run still needs', async () => {
    const [source] = await e2e.query<{ requirementId: string; itemId: string }>(
      `SELECT requirement.id AS "requirementId", item.id AS "itemId"
         FROM projects.qa_checklists AS requirement
         JOIN projects.qa_checklist_items AS item ON item.checklist_id = requirement.id
        WHERE requirement.delivery_project_id = $1 AND item.title = 'Pay by card'`,
      [projectId],
    );
    if (!source) throw new Error('Expected the fixture story');
    const [snapshot] = await e2e.query<{ run_id: string }>(
      `WITH run AS (
         INSERT INTO projects.qa_verification_runs
           (scope, delivery_project_id, heads_fingerprint, checklist_id,
            checklist_version, checklist_name, branch, commit_source, created_by,
            created_by_login, iteration_id)
         SELECT 'project', delivery_project_id, $2, id, version, name, 'uat',
                'branch_head', $3, 'qa', iteration_id
           FROM projects.qa_checklists WHERE id = $1
         RETURNING id
       )
       INSERT INTO projects.qa_run_items
         (run_id, source_item_id, position, title, target_persona, verification_type)
       SELECT id, $4, 0, 'Pay by card', 'all', 'manual' FROM run
       RETURNING run_id`,
      [source.requirementId, 'a'.repeat(64), userId, source.itemId],
    );
    if (!snapshot) throw new Error('Expected the fixture run');
    try {
      const response = await agent
        .delete(
          `/api/v1/requirements/${source.requirementId}/items/${source.itemId}`,
        )
        .expect(409);
      expect(response.body).toMatchObject({
        code: 'REQUIREMENT_ITEM_IN_OPEN_RUN',
      });
    } finally {
      await e2e.query(
        'DELETE FROM projects.qa_verification_runs WHERE id = $1',
        [snapshot.run_id],
      );
    }
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

  it('rejects duplicate stories and simultaneous identical open to-dos', async () => {
    const requirements = `/api/v1/delivery-projects/${projectId}/requirements`;
    const rejected = await agent
      .post(requirements)
      .send({
        kind: 'functional',
        name: 'Duplicate on create',
        items: [{ title: 'Confirm order' }, { title: ' confirm ORDER ' }],
      })
      .expect(409);
    expect(rejected.body).toMatchObject({ code: 'QA_STORY_DUPLICATE' });

    const feature = (
      await agent
        .post(requirements)
        .send({
          kind: 'functional',
          name: 'Concurrent stories',
        })
        .expect(201)
    ).body as { id: string };
    const story = () =>
      agent
        .post(`/api/v1/requirements/${feature.id}/items`)
        .send({ title: 'Confirm order' });
    const responses = await Promise.all([story(), story()]);
    expect(
      responses
        .map((response) => response.status)
        .sort((left, right) => left - right),
    ).toEqual([201, 409]);
    expect(
      responses.find((response) => response.status === 409)?.body,
    ).toMatchObject({ code: 'QA_STORY_DUPLICATE' });
    await e2e.query('DELETE FROM projects.qa_checklists WHERE id = $1', [
      feature.id,
    ]);

    const todo = () =>
      agent
        .post(`/api/v1/delivery-projects/${projectId}/todos`)
        .send({ title: 'Check the delivery' });
    const todos = await Promise.all([todo(), todo()]);
    expect(
      todos
        .map((response) => response.status)
        .sort((left, right) => left - right),
    ).toEqual([201, 409]);
    expect(
      todos.find((response) => response.status === 409)?.body,
    ).toMatchObject({ code: 'PROJECT_TODO_DUPLICATE' });
  });

  it('requires active Project membership for QA and to-dos and a different verifier', async () => {
    const requirements = `/api/v1/delivery-projects/${projectId}/requirements`;
    const todos = `/api/v1/delivery-projects/${projectId}/todos`;
    const [source] = await e2e.query<{
      requirement_id: string;
      item_id: string;
      row_version: number;
    }>(
      `SELECT requirement.id AS requirement_id, item.id AS item_id, item.row_version
       FROM projects.qa_checklists requirement
       JOIN projects.qa_checklist_items item ON item.checklist_id = requirement.id
       WHERE requirement.delivery_project_id = $1 AND item.title = 'Pay by card'`,
      [projectId],
    );
    if (!source) throw new Error('Expected fixture story');
    await e2e.query(
      "UPDATE identity.app_users SET app_role='member', special_access=ARRAY['qa_release'] WHERE id=$1",
      [userId],
    );
    try {
      expect(
        (await agent.get(`/api/v1/delivery-projects/${projectId}`).expect(200))
          .body,
      ).toMatchObject({ canAccessQa: false });
      await agent.get(requirements).expect(404);
      await agent
        .get(`/api/v1/requirements/${source.requirement_id}`)
        .expect(404);
      await agent.get(todos).expect(404);
      await agent.post(todos).send({ title: 'Out of scope' }).expect(404);

      await e2e.query(
        "INSERT INTO hierarchy.delivery_project_members (delivery_project_id, user_id, member_kind, status) VALUES ($1,$2,'developer','active')",
        [projectId, userId],
      );
      await agent.get(requirements).expect(200);
      expect(
        (await agent.get(`/api/v1/delivery-projects/${projectId}`).expect(200))
          .body,
      ).toMatchObject({ canAccessQa: true });
      await agent.get(todos).expect(200);
      await agent
        .patch(
          `/api/v1/requirements/${source.requirement_id}/items/${source.item_id}/progress`,
        )
        .send({ progress: 'done', expectedRowVersion: source.row_version })
        .expect(200);

      const [snapshot] = await e2e.query<{
        run_id: string;
        id: string;
        row_version: number;
      }>(
        `WITH run AS (
           INSERT INTO projects.qa_verification_runs
             (scope, delivery_project_id, heads_fingerprint, checklist_id,
              checklist_version, checklist_name, branch, commit_source, created_by,
              created_by_login, iteration_id)
           SELECT 'project', delivery_project_id, $2, id, version, name, 'uat',
                  'branch_head', $3, 'qa', iteration_id
           FROM projects.qa_checklists WHERE id = $1
           RETURNING id
         )
         INSERT INTO projects.qa_run_items
           (run_id, source_item_id, position, title, target_persona, verification_type)
         SELECT id, $4, 0, 'Pay by card', 'all', 'manual' FROM run
         RETURNING run_id, id, row_version`,
        [source.requirement_id, 'b'.repeat(64), userId, source.item_id],
      );
      if (!snapshot) throw new Error('Expected fixture run');
      const result = await agent
        .patch(
          `/api/v1/delivery-projects/${projectId}/qa-runs/${snapshot.run_id}/items/${snapshot.id}`,
        )
        .send({ status: 'passed', expectedRowVersion: snapshot.row_version })
        .expect(403);
      expect(result.body).toMatchObject({ code: 'QA_SELF_VERIFICATION' });
      expect(
        await e2e.query(
          'SELECT status FROM projects.qa_run_items WHERE id=$1',
          [snapshot.id],
        ),
      ).toEqual([{ status: 'pending' }]);
      const [otherDeveloper] = await e2e.query<{ id: string }>(
        "INSERT INTO identity.app_users (login, github_user_id) VALUES ('other-verification-dev', 'other-verification-dev') RETURNING id",
      );
      if (!otherDeveloper) throw new Error('Expected another developer');
      await e2e.query(
        'UPDATE projects.qa_checklist_items SET progress_by=$1 WHERE id=$2',
        [otherDeveloper.id, source.item_id],
      );
      await agent
        .patch(
          `/api/v1/delivery-projects/${projectId}/qa-runs/${snapshot.run_id}/items/${snapshot.id}`,
        )
        .send({ status: 'passed', expectedRowVersion: snapshot.row_version })
        .expect(200);
      expect(
        await e2e.query(
          'SELECT status FROM projects.qa_run_items WHERE id=$1',
          [snapshot.id],
        ),
      ).toEqual([{ status: 'passed' }]);
      await e2e.query(
        "UPDATE hierarchy.delivery_project_members SET status='removed' WHERE delivery_project_id=$1 AND user_id=$2",
        [projectId, userId],
      );
      await agent.get(todos).expect(404);
      await e2e.query(
        "UPDATE identity.app_users SET app_role='qa' WHERE id=$1",
        [userId],
      );
      await agent.get(requirements).expect(404);
      await e2e.query(
        "UPDATE identity.app_users SET app_role='lead' WHERE id=$1",
        [userId],
      );
      await agent.get(requirements).expect(200);
      await agent.get(todos).expect(200);
    } finally {
      await e2e.query(
        "UPDATE identity.app_users SET app_role='admin', special_access='{}' WHERE id=$1",
        [userId],
      );
    }
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
