import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { WorkflowSettingsPreviewRequest } from '../../src/modules/projects/application/workflows/project-workflows.service';
import {
  startApplication,
  type E2eApplication,
  type SignedInAgent,
} from './support/application';
import { required } from './support/database';

/**
 * Request bodies are validated before a service reads them. Failure modes:
 * bodies typed as interfaces reached services unchecked, so `{"repo":123}` on
 * /ci/validate answered 500, and a workflow preview stored
 * `{"0":"y","1":"e","2":"s"}` for `checks` or put `../../..` in a generated
 * workflow. /ci/validate also answered 500 to the body the catalog's customer
 * templates send (`validate-subscription.yml`: only `repo`).
 */
describe('Request body validation', () => {
  let e2e: E2eApplication;
  let agent: SignedInAgent;
  let projectId: string;
  const repo = `e2e/${randomUUID()}`;
  let token: string;

  const flags = [
    'NOTIFICATIONS_ENABLED',
    'DRIFT_DETECTION_ENABLED',
    'DRIFT_REPAIR_ENABLED',
    'WORKFLOW_SETTINGS_PREVIEW_ENABLED',
  ];
  const previousFlags = flags.map((flag) => process.env[flag]);

  beforeAll(async () => {
    for (const flag of flags) process.env[flag] = 'true';
    e2e = await startApplication();
    let userId: string;
    ({ agent, userId } = await e2e.signIn('admin'));
    projectId = required(
      (
        await e2e.query<{ id: string }>(
          `INSERT INTO projects.provisioned_projects
             (user_id, repo_full_name, template_id, service_name, workflow_path, status)
           VALUES ($1, $2, 'fe-nextjs', 'web', '.github/workflows/ci.yml', 'provisioned')
           RETURNING id`,
          [userId, repo],
        )
      )[0],
    ).id;
    token = 'e2e_ci_' + randomBytes(16).toString('hex');
    await e2e.query(
      `INSERT INTO ci.project_ci_tokens (project_id, token_hash, token_prefix, status)
       VALUES ($1, $2, $3, 'active')`,
      [
        projectId,
        createHash('sha256').update(token).digest('hex'),
        token.slice(0, 10),
      ],
    );
  });

  afterAll(async () => {
    await e2e.close();
    flags.forEach((flag, index) => {
      const previous = previousFlags[index];
      if (previous === undefined) delete process.env[flag];
      else process.env[flag] = previous;
    });
  });

  const validate = (body: unknown) =>
    agent
      .post('/api/v1/ci/validate')
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);

  it('accepts the repo-only body customer templates send, as the access stage', async () => {
    const response = await validate({ repo }).expect(200);
    expect(response.body).toMatchObject({ authorized: true, stage: 'access' });
  });

  it('accepts the staged workflow body', async () => {
    await validate({
      repo,
      stage: 'quality',
      workflowRunId: '123',
      headSha: 'a'.repeat(40),
    }).expect(200);
  });

  it.each([[{ repo: 123 }], [{}], [{ repo, stage: { a: 1 } }]])(
    'refuses %j with 400',
    async (body) => {
      await validate(body).expect(400);
    },
  );

  it('accepts the workflow settings readback sent by the web app', async () => {
    const path = `/api/v1/projects/${projectId}/workflow-settings`;
    const read = await agent.get(path).expect(200);
    const { settings } = read.body as {
      settings: WorkflowSettingsPreviewRequest;
    };
    const checks = { ...settings.checks, lint: false };
    const preview = await agent
      .post(`${path}/preview`)
      .send({
        ...settings,
        serviceName: 'Customer Portal',
        checks,
        coverageThreshold: 101,
      })
      .expect(201);
    expect(preview.body).toMatchObject({
      settings: { projectId, serviceName: 'Customer Portal', checks },
    });
    const { validationWarnings } = preview.body as {
      validationWarnings: unknown;
    };
    expect(validationWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'coverageThreshold' }),
      ]),
    );
  });

  it.each([
    [{ checks: 'yes' }],
    [{ checks: [] }],
    [{ checks: { lint: 'yes' } }],
    [{ servicePath: '../../..' }],
    [{ serviceName: 'web\n x' }],
    [{ centralWorkflowRef: 'v1 ${{ secrets.X }}' }],
  ])('refuses workflow preview %j with 400', async (body) => {
    await agent
      .post(`/api/v1/projects/${projectId}/workflow-settings/preview`)
      .send(body)
      .expect(400);
  });

  it('refuses notification preferences of the wrong type', async () => {
    await agent
      .patch('/api/v1/notifications/preferences')
      .send({ inAppEnabled: 'nope' })
      .expect(400);
  });

  it('refuses an unknown feedback status', async () => {
    await agent
      .patch(`/api/v1/admin/feedback/${randomUUID()}`)
      .send({ status: 'bogus' })
      .expect(400);
  });

  it('keeps an ignored drift finding out of subsequent scans', async () => {
    await e2e.query(
      "UPDATE projects.provisioned_projects SET workflow_path = '' WHERE id = $1",
      [projectId],
    );
    const path = `/api/v1/projects/${projectId}/drift`;
    await agent.post(`${path}/run`).expect(201);
    const finding = required(
      (
        await e2e.query<{ id: string }>(
          `SELECT id FROM projects.project_sync_findings
         WHERE project_id = $1 AND code = 'workflow_files_missing' AND status = 'active'`,
          [projectId],
        )
      )[0],
    );
    await agent
      .post(`${path}/${finding.id}/repair`)
      .send({ action: 'mark_ignored' })
      .expect(201);
    await agent.post(`${path}/run`).expect(201);
    await expect(
      e2e.query(
        `SELECT id, status FROM projects.project_sync_findings
       WHERE project_id = $1 AND code = 'workflow_files_missing'`,
        [projectId],
      ),
    ).resolves.toEqual([{ id: finding.id, status: 'ignored' }]);
  });

  it('lets an admin disconnect another owner’s project and records the event', async () => {
    const other = `e2e-owner-${randomUUID()}`;
    const owner = required(
      (
        await e2e.query<{ id: string }>(
          'INSERT INTO identity.app_users (login, github_user_id) VALUES ($1, $1) RETURNING id',
          [other],
        )
      )[0],
    );
    const project = required(
      (
        await e2e.query<{ id: string }>(
          `INSERT INTO projects.provisioned_projects
         (user_id, repo_full_name, template_id, service_name, workflow_path, status)
       VALUES ($1, $2, 'fe-nextjs', 'web', '.github/workflows/ci.yml', 'provisioned')
       RETURNING id`,
          [owner.id, `e2e/${other}`],
        )
      )[0],
    );
    const response = await agent
      .delete(`/api/v1/projects/${project.id}`)
      .expect(200);
    expect(response.body).toMatchObject({ ok: true });
    await expect(
      e2e.query(
        `SELECT payload->>'eventCode' AS code FROM platform.outbox_events
       WHERE payload->'metadata'->>'projectId' = $1
         AND payload->>'eventCode' = 'project_disconnected'`,
        [project.id],
      ),
    ).resolves.toEqual([{ code: 'project_disconnected' }]);
  });
});
