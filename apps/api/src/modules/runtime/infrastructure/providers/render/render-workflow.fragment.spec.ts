import {
  WorkflowFragmentRegistry,
  type EnvironmentDeployInput,
} from '#kernel/ports/workflow-fragment.port';

import { renderWorkflowFragment } from './render-workflow.fragment';

/**
 * What a Render deploy job is allowed to carry.
 *
 * Two failures live here. Actions rejects a `secrets:` entry the called
 * workflow does not declare, at startup, so the whole package stage failed to
 * run when the generator sent RENDER_*_TEST after the flow moved from `test` to
 * `dev`. And the deploy job used to be handed the platform's Render API key -
 * a credential Render issues per account, not per service - in every customer
 * repository.
 *
 * Both are answered by the same rule: a deploy job carries the project's own
 * AlphaCI token and the address to send it to, and nothing else.
 */
const registry = new WorkflowFragmentRegistry([renderWorkflowFragment]);

function releaseJob(branch: 'dev' | 'uat' | 'main' = 'uat'): {
  uses: string;
  with: Record<string, unknown>;
  secrets: Record<string, string>;
  needs: string[];
} {
  const result = registry.build(
    {
      slot: 'backend',
      provider: 'render',
      deploymentStrategy: 'render_image_pushed',
      imageName: 'alphaci-backend-uat-demo',
    },
    branch,
    { serviceName: 'svc', servicePath: '.', centralWorkflowRef: 'v1' },
  );

  const job = Object.values(result?.jobs ?? {}).find((candidate) =>
    (candidate as { uses?: string }).uses?.includes('release.yml'),
  );

  if (!job) throw new Error('release job was not emitted');
  return job as ReturnType<typeof releaseJob>;
}

describe('render deploy job', () => {
  it('releases through the platform rather than a host-specific workflow', () => {
    expect(releaseJob().uses).toContain('/release.yml@v1');
  });

  it('carries no hosting credential', () => {
    const secrets = releaseJob().secrets;

    expect(Object.keys(secrets).sort()).toEqual([
      'ALPHACI_API_URL',
      'ALPHACI_TOKEN',
    ]);
    // The regression that matters: an account-wide Render key must never be
    // written into a customer repository again.
    expect(JSON.stringify(secrets)).not.toMatch(/RENDER/i);
  });

  it('names the branch and commit from the context job, not the event', () => {
    // A workflow_run stage reads `main` from the git context whichever branch
    // was pushed, so a deploy that trusted it released the wrong branch.
    const job = releaseJob('dev');

    expect(job.with['branch']).toBe('dev');
    expect(job.with['commit-sha']).toBe(
      '${{ needs.pipeline-context.outputs.sha }}',
    );
    expect(job.with['slot']).toBe('backend');
  });

  it('releases the exact build, not whatever the branch tag points at now', () => {
    const job = releaseJob();

    expect(job.with['artifact']).toBe(
      '${{ needs.docker-backend-uat.outputs.image-repo }}:sha-${{ needs.pipeline-context.outputs.sha }}',
    );
    expect(job.needs).toContain('docker-backend-uat');
  });

  it('health-checks the path the generated service exposes', () => {
    expect(releaseJob().with['healthcheck-path']).toBe('/health');
  });
});

describe('render deploy job of an environment', () => {
  const environment = {
    id: 'env-qa',
    slug: 'qa',
    sourceBranch: 'release/qa',
    role: 'non_production' as const,
  };
  const input = (
    target: EnvironmentDeployInput['target'],
  ): EnvironmentDeployInput => ({
    environment,
    targetId: 'target-qa',
    ...(target ? { target } : {}),
    needs: ['sign'],
    if: 'true',
    commitSha: '${{ github.sha }}',
    artifact: '${{ needs.build.outputs.image }}@sha256:abc',
  });
  const context = {
    serviceName: 'orders-api',
    servicePath: '.',
    centralWorkflowRef: 'v1',
  };
  const jobFor = (target: EnvironmentDeployInput['target']) =>
    renderWorkflowFragment.environmentDeployJob!(input(target), context) as {
      uses: string;
      with: Record<string, unknown>;
      secrets: Record<string, string> | string;
    };

  describe('for a service the platform provisioned', () => {
    const managed = {
      slot: 'backend',
      ownershipMode: 'flowci_managed',
      deploymentStrategy: 'render_image_pushed',
    };

    it('releases through AlphaCI, naming the environment and the exact target', () => {
      const job = jobFor(managed);

      expect(job.uses).toContain('release.yml@v1');
      expect(job.with).toEqual({
        'system-name': 'orders-api',
        slot: 'backend',
        branch: 'release/qa',
        'commit-sha': '${{ github.sha }}',
        artifact: '${{ needs.build.outputs.image }}@sha256:abc',
        'healthcheck-path': '/health',
        'environment-id': 'env-qa',
        'environment-name': 'qa',
        'target-id': 'target-qa',
      });
    });

    it('carries only the AlphaCI token and address, no deploy hook and no hosting credential', () => {
      expect(jobFor(managed).secrets).toEqual({
        ALPHACI_TOKEN: '${{ secrets.ALPHACI_TOKEN }}',
        ALPHACI_API_URL: '${{ secrets.ALPHACI_API_URL }}',
      });
    });

    it('does not use render-deploy.yml, which needs a hook nothing can create', () => {
      expect(jobFor(managed).uses).not.toContain('render-deploy.yml');
    });
  });

  describe('for a service the customer owns', () => {
    it.each([
      [
        'a bring-your-own service',
        {
          slot: 'backend',
          ownershipMode: 'byo',
          deploymentStrategy: 'render_image_pushed',
        },
      ],
      [
        'a managed service that is not image-pushed',
        {
          slot: 'backend',
          ownershipMode: 'flowci_managed',
          deploymentStrategy: 'render_existing_service',
        },
      ],
      ['a target nothing is known about', undefined],
    ])('still deploys %s with render-deploy.yml', (_label, target) => {
      const job = jobFor(target);

      expect(job.uses).toContain('render-deploy.yml@v1');
      expect(job.secrets).toBe('inherit');
      expect(job.with).toMatchObject({
        'environment-id': 'env-qa',
        'target-id': 'target-qa',
      });
    });
  });
});
