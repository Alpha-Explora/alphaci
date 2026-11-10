import {
  vercelCiSecretNames,
  type EnvironmentDeployInput,
} from '#kernel/ports/workflow-fragment.port';

import { vercelWorkflowFragment } from './vercel-workflow.fragment';

const context = {
  serviceName: 'orders-ui',
  servicePath: '.',
  centralWorkflowRef: 'v1',
};

const input = (slug: string): EnvironmentDeployInput => ({
  environment: {
    id: 'env-' + slug,
    slug,
    sourceBranch: 'dev',
    role: 'non_production',
  },
  targetId: 'target-' + slug,
  needs: ['sign'],
  if: 'true',
  commitSha: '${{ github.sha }}',
  artifact: undefined,
});

type Job = {
  uses: string;
  with: Record<string, unknown>;
  secrets: Record<string, string> | string;
};
const jobFor = (slug: string) =>
  vercelWorkflowFragment.environmentDeployJob!(input(slug), context) as Job;

describe('the Vercel deploy job of an environment', () => {
  it('maps the environment’s own secrets onto the names vercel-deploy.yml requires', () => {
    const job = jobFor('qa');

    expect(job.uses).toContain('vercel-deploy.yml@v1');
    expect(job.secrets).toEqual({
      VERCEL_TOKEN: '${{ secrets.VERCEL_FRONTEND_QA_TOKEN }}',
      VERCEL_ORG_ID: '${{ secrets.VERCEL_FRONTEND_QA_ORG_ID }}',
      VERCEL_PROJECT_ID: '${{ secrets.VERCEL_FRONTEND_QA_PROJECT_ID }}',
      GH_PR_TOKEN:
        "${{ secrets.GH_PR_TOKEN != '' && secrets.GH_PR_TOKEN || github.token }}",
    });
  });

  it('does not inherit: inheriting passes the repository names, which the workflow does not read', () => {
    expect(jobFor('qa').secrets).not.toBe('inherit');
  });

  it('gives two environments different Vercel projects', () => {
    const dev = jobFor('dev').secrets as Record<string, string>;
    const qa = jobFor('qa').secrets as Record<string, string>;

    expect(dev['VERCEL_PROJECT_ID']).not.toBe(qa['VERCEL_PROJECT_ID']);
    expect(dev['VERCEL_TOKEN']).not.toBe(qa['VERCEL_TOKEN']);
  });

  it('reads the names the installer writes, because both come from one function', () => {
    const names = vercelCiSecretNames('frontend', 'qa');
    const secrets = jobFor('qa').secrets as Record<string, string>;

    expect(secrets['VERCEL_TOKEN']).toBe('${{ secrets.' + names.token + ' }}');
    expect(secrets['VERCEL_PROJECT_ID']).toBe(
      '${{ secrets.' + names.projectId + ' }}',
    );
  });

  it('still identifies the environment and target to the workflow', () => {
    expect(jobFor('qa').with).toMatchObject({
      'environment-id': 'env-qa',
      'environment-name': 'qa',
      'target-id': 'target-qa',
    });
  });
});

describe('the Vercel deploy job of the branch pipeline', () => {
  it('keeps the slot-only secret names it always had', () => {
    const [target] = vercelWorkflowFragment.expandTargets!(
      { slot: 'frontend', provider: 'vercel' },
      {},
    );

    expect(target?.secretNames).toEqual({
      token: 'VERCEL_FRONTEND_TOKEN',
      orgId: 'VERCEL_FRONTEND_ORG_ID',
      projectId: 'VERCEL_FRONTEND_PROJECT_ID',
    });
  });
});
