import { createHash, randomUUID } from 'node:crypto';

import {
  startApplication,
  type E2eApplication,
  type SignedInAgent,
} from './support/application';
import { required } from './support/database';

type RunsBody = {
  runs: Array<{
    repoFullName: string;
    overallStatus: string;
    stages: Array<{ stage: string; status: string }>;
  }>;
};

/**
 * The Runs view for a project with its own environments. Their pipelines end
 * at the package stage, so waiting for a verify report made every run of a
 * healthy pipeline show as failed. Failure modes: an environments run marked
 * failed because verify never reported; the same missing report no longer
 * failing a legacy pipeline, which does have a verify stage.
 */
describe('Runs for projects with environments', () => {
  let e2e: E2eApplication;
  let agent: SignedInAgent;
  let userId: string;

  beforeAll(async () => {
    e2e = await startApplication();
    ({ agent, userId } = await e2e.signIn());
  });

  afterAll(async () => {
    await e2e.close();
  });

  async function pipelineRun(repo: string, withEnvironments: boolean) {
    const [project] = await e2e.query<{ id: string }>(
      `INSERT INTO projects.provisioned_projects
         (user_id, repo_full_name, template_id, service_name, workflow_path, status)
       VALUES ($1, $2, 'node-api', 'api', '.github/workflows/ci.yml', 'provisioned')
       RETURNING id`,
      [userId, repo],
    );
    if (withEnvironments) {
      await e2e.query(
        `INSERT INTO projects.project_environments
           (project_id, slug, display_name, position, source_branch, role, auto_deploy)
         VALUES ($1, 'main', 'main', 0, 'main', 'production', true)`,
        [required(project).id],
      );
    }
    // Reported a day ago, so a stage that never arrives has stalled by now.
    for (const [index, stage] of ['access', 'quality', 'package'].entries()) {
      await e2e.query(
        `INSERT INTO workflow.ci_run_reports
           (user_id, repo_full_name, branch, commit_sha, run_id, stage, status, project_id, created_at, updated_at)
         VALUES ($1, $2, 'uat', $3, $4, $5, 'success', $6,
                 now() - interval '1 day', now() - interval '1 day')`,
        [
          userId,
          repo,
          'a'.repeat(40),
          1000 + index,
          stage,
          required(project).id,
        ],
      );
    }
    const response = await agent
      .get('/api/v1/ci/runs')
      .query({ repoFullName: repo })
      .expect(200);
    return required((response.body as RunsBody).runs[0]);
  }

  it('shows a successful environments pipeline as successful, without a verify stage', async () => {
    const run = await pipelineRun('e2e-org/with-environments', true);
    expect(run.overallStatus).toBe('success');
    expect(run.stages.map(({ stage }) => stage)).toEqual([
      'access',
      'quality',
      'package',
    ]);
  });

  it('still fails a legacy pipeline whose verify report never arrived', async () => {
    const run = await pipelineRun('e2e-org/legacy', false);
    expect(run.overallStatus).toBe('failure');
    expect(run.stages.find(({ stage }) => stage === 'verify')?.status).toBe(
      'stalled',
    );
  });

  it('keeps CI reports tied to their original Project after a reconnect', async () => {
    const repo = 'e2e-org/reconnected';
    const commit = 'c'.repeat(40);
    const runId = 7031;

    async function connect(repoName: string) {
      const [project] = await e2e.query<{ id: string }>(
        `INSERT INTO projects.provisioned_projects
           (user_id, repo_full_name, template_id, service_name, workflow_path, status)
         VALUES ($1, $2, 'node-api', 'api', '.github/workflows/ci.yml', 'provisioned')
         RETURNING id`,
        [userId, repoName],
      );
      const id = required(project).id;
      const token = randomUUID();
      await e2e.query(
        `INSERT INTO ci.project_ci_tokens (project_id, token_hash, token_prefix, status)
         VALUES ($1, $2, $3, 'active')`,
        [
          id,
          createHash('sha256').update(token).digest('hex'),
          token.slice(0, 10),
        ],
      );
      return { id, token, repoName };
    }

    const report = (
      connection: Awaited<ReturnType<typeof connect>>,
      id: number,
      conclusion: string,
    ) =>
      agent
        .post('/api/v1/ci/report')
        .set('Authorization', `Bearer ${connection.token}`)
        .send({
          repoFullName: connection.repoName,
          branch: 'uat',
          commitSha: commit,
          runId: id,
          stage: 'quality',
          conclusion,
          results: {},
        });
    const runs = () =>
      agent.get('/api/v1/ci/runs').query({ repoFullName: repo });

    const original = await connect(repo);
    await report(original, runId, 'failure').expect(200);
    expect(((await runs().expect(200)).body as RunsBody).runs).toHaveLength(1);
    await e2e.query('DELETE FROM projects.provisioned_projects WHERE id = $1', [
      original.id,
    ]);
    const reconnected = await connect('e2e-org/Reconnected');

    await report(reconnected, runId, 'success').expect(200);
    expect((await runs().expect(200)).body).toEqual({ runs: [] });
    await agent
      .get('/api/v1/ci/runs/report')
      .query({ repoFullName: repo, branch: 'uat', commitSha: commit })
      .expect(404);
    expect(
      await e2e.query(
        'SELECT project_id, status FROM workflow.ci_run_reports WHERE lower(repo_full_name) = $1',
        [repo],
      ),
    ).toEqual([{ project_id: original.id, status: 'failure' }]);

    await report(reconnected, runId + 1, 'success').expect(200);
    expect(((await runs().expect(200)).body as RunsBody).runs).toHaveLength(1);
  });
});
