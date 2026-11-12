import { Logger } from '@nestjs/common';

import { ProjectProvisioningSupport } from './project-provisioning.support';

/*
 * The workflow files and the provider resources are produced by two different
 * steps from one request, and only the first has to succeed for a project to be
 * reported as provisioned. A React project came out of that with three Vercel
 * deploy jobs committed and zero deployment targets stored - and said nothing.
 *
 * The warning is the whole fix, so it is the thing worth a test: without it the
 * mismatch is discovered much later, in another repository, as a credential
 * error that names none of this.
 */
describe('ProjectProvisioningSupport, deploy jobs with no target', () => {
  const request = {
    enabled: true,
    targets: [
      { slot: 'frontend', provider: 'vercel', ownershipMode: 'flowci_managed' },
    ],
  };

  const makeSupport = (provisionForProject: jest.Mock) =>
    new ProjectProvisioningSupport({
      catalogService: {} as never,
      githubService: {} as never,
      projectsRepository: {} as never,
      ciService: {} as never,
      projectDeploymentProvisioningService: { provisionForProject } as never,
      deploymentProvisioningDefaults: undefined,
      configService: undefined,
      usageQuotaService: undefined,
      auditEventsService: undefined,
      workspacesService: undefined,
      notificationEventPublisher: undefined,
      auditEventPublisher: undefined,
      hierarchyProjectLinkService: undefined,
      workflowFilePusher: undefined,
      workflowFragmentRegistry: undefined,
      requirementsReadiness: undefined,
    });

  const invoke = (support: ProjectProvisioningSupport) =>
    support.provisionDeploymentTargets({
      projectId: 'project-1',
      userId: 'user-1',
      repoFullName: 'acme/storefront',
      githubAccessToken: 'token',
      request: request as never,
      slots: ['frontend'],
    });

  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('names the provider, the repository and the consequence', async () => {
    const support = makeSupport(
      jest.fn().mockResolvedValue({
        status: 'failed',
        targets: [
          {
            slot: 'frontend',
            provider: 'vercel',
            status: 'failed',
            errorSummary: 'Vercel token is empty',
          },
        ],
      }),
    );

    await invoke(support);

    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain('vercel/frontend');
    expect(message).toContain('Vercel token is empty');
    expect(message).toContain('acme/storefront');
    // The consequence, not just the fact. "provisioning failed" sends nobody
    // to the repository that now carries unusable deploy jobs.
    expect(message).toContain('deploy jobs');
  });

  it('also warns when provisioning throws', async () => {
    const support = makeSupport(
      jest.fn().mockRejectedValue(new Error('Vercel API unreachable')),
    );

    const result = await invoke(support);

    expect(result.status).toBe('failed');
    // Two warnings: the caught error, then the stranded deploy jobs. The second
    // is the one that says what it means for the repository.
    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.some((message) => message.includes('deploy jobs'))).toBe(
      true,
    );
  });

  it('stays quiet when every target was created', async () => {
    const support = makeSupport(
      jest.fn().mockResolvedValue({
        status: 'completed',
        targets: [{ slot: 'frontend', provider: 'vercel', status: 'created' }],
      }),
    );

    await invoke(support);

    expect(warn).not.toHaveBeenCalled();
  });
});

describe('ProjectProvisioningSupport.notifyProjectCreated', () => {
  const build = (
    overrides: {
      teamIds?: string[] | Error;
      record?: jest.Mock;
      audit?: { recordProjectEvent: jest.Mock };
      withNotifications?: boolean;
    } = {},
  ) => {
    const record = overrides.record ?? jest.fn().mockResolvedValue(undefined);
    const teamIds = overrides.teamIds ?? [];
    const listWorkspaceLeadAndDeveloperIds =
      teamIds instanceof Error
        ? jest.fn().mockRejectedValue(teamIds)
        : jest.fn().mockResolvedValue(teamIds);
    const support = new ProjectProvisioningSupport({
      catalogService: {} as never,
      githubService: {} as never,
      projectsRepository: { listWorkspaceLeadAndDeveloperIds } as never,
      ciService: {} as never,
      projectDeploymentProvisioningService: {} as never,
      deploymentProvisioningDefaults: undefined,
      configService: undefined,
      usageQuotaService: undefined,
      auditEventsService: undefined,
      workspacesService: undefined,
      notificationEventPublisher:
        overrides.withNotifications === false
          ? undefined
          : ({ record } as never),
      auditEventPublisher: (overrides.audit ?? {
        recordProjectEvent: jest.fn(),
      }) as never,
      hierarchyProjectLinkService: undefined,
      workflowFilePusher: undefined,
      workflowFragmentRegistry: undefined,
      requirementsReadiness: undefined,
    });
    return { support, record, listWorkspaceLeadAndDeveloperIds };
  };

  const input = {
    workspaceId: 'ws-1',
    creatorUserId: 'creator',
    creatorLogin: 'tone',
    projectId: 'project-1',
    repoFullName: 'org/orders',
  };

  const recipients = (record: jest.Mock) =>
    record.mock.calls.map(([call]) => (call as { userId: string }).userId);

  it('notifies leads, developers and the creator once each with the specified copy', async () => {
    const { support, record } = build({ teamIds: ['lead-1', 'dev-1'] });

    await support.notifyProjectCreated(input);

    expect([...recipients(record)].sort()).toEqual([
      'creator',
      'dev-1',
      'lead-1',
    ]);
    expect(record).toHaveBeenCalledWith({
      userId: 'lead-1',
      projectId: 'project-1',
      eventCode: 'project_created',
      title: 'New project created: org/orders',
      body: '@tone created project org/orders. It is now tracked and ready for development.',
    });
  });

  it('never notifies a creator who is also a lead twice', async () => {
    const { support, record } = build({ teamIds: ['creator', 'dev-1'] });

    await support.notifyProjectCreated(input);

    expect(recipients(record).filter((id) => id === 'creator')).toHaveLength(1);
    expect(record).toHaveBeenCalledTimes(2);
  });

  it('still notifies the creator when there is no workspace to fan out to', async () => {
    const { support, record, listWorkspaceLeadAndDeveloperIds } = build();

    await support.notifyProjectCreated({ ...input, workspaceId: null });

    expect(listWorkspaceLeadAndDeveloperIds).not.toHaveBeenCalled();
    expect(recipients(record)).toEqual(['creator']);
  });

  it('records the audit row exactly once', async () => {
    const audit = { recordProjectEvent: jest.fn() };
    const { support } = build({ audit, teamIds: ['lead-1'] });

    await support.notifyProjectCreated(input);

    expect(audit.recordProjectEvent).toHaveBeenCalledTimes(1);
    expect(audit.recordProjectEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'creator',
        projectId: 'project-1',
        eventCode: 'project_created',
      }),
    );
  });

  it('does not throw into provisioning when the recipient lookup fails', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const { support, record } = build({ teamIds: new Error('db down') });

    await expect(support.notifyProjectCreated(input)).resolves.toBeUndefined();

    expect(record).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not throw when a notification sink rejects', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const { support } = build({
      record: jest.fn().mockRejectedValue(new Error('boom')),
    });

    await expect(support.notifyProjectCreated(input)).resolves.toBeUndefined();
    warn.mockRestore();
  });

  it('is a no-op for notifications when no sink is wired', async () => {
    const { support, listWorkspaceLeadAndDeveloperIds } = build({
      withNotifications: false,
    });

    await expect(support.notifyProjectCreated(input)).resolves.toBeUndefined();
    expect(listWorkspaceLeadAndDeveloperIds).not.toHaveBeenCalled();
  });
});

describe('ProjectProvisioningSupport.protectPipelineBranches', () => {
  /** A personal account by default: no team, so no CODEOWNERS and no ruleset. */
  const personalAccountOwners = () => ({
    ensurePipelineOwnersTeam: jest.fn().mockResolvedValue({
      status: 'unavailable',
      error: 'acme is a personal account, which has no teams',
    }),
    ensurePipelineOwnersRuleset: jest.fn(),
    putFileContent: jest.fn(),
    fastForwardBranch: jest.fn(),
  });

  const make = (
    ensure: jest.Mock,
    publisher: { recordProjectEvent: jest.Mock } | undefined,
    owners: Record<string, jest.Mock> = personalAccountOwners(),
    adminLogins: string[] = ['lloydlim1'],
  ) =>
    new ProjectProvisioningSupport({
      catalogService: {} as never,
      githubService: {
        ensurePullRequestProtection: ensure,
        ...owners,
      } as never,
      projectsRepository: {
        listAdminGithubLogins: jest.fn().mockResolvedValue(adminLogins),
      } as never,
      ciService: {} as never,
      projectDeploymentProvisioningService: {} as never,
      deploymentProvisioningDefaults: undefined,
      configService: {
        get: () => ({ github: { appId: '123456' } }),
      } as never,
      usageQuotaService: undefined,
      auditEventsService: undefined,
      workspacesService: undefined,
      notificationEventPublisher: undefined,
      auditEventPublisher: publisher as never,
      hierarchyProjectLinkService: undefined,
      workflowFilePusher: undefined,
      workflowFragmentRegistry: undefined,
      requirementsReadiness: undefined,
    });

  const input = {
    token: 'tok',
    owner: 'acme',
    repo: 'storefront',
    userId: 'user-1',
    projectId: 'project-1',
    workspaceId: 'team-1',
  };

  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('requires a pull request on dev, uat and main, seeding the env-guard check, and records it', async () => {
    const ensure = jest.fn().mockResolvedValue({ status: 'applied' });
    const publisher = { recordProjectEvent: jest.fn() };

    await make(ensure, publisher).protectPipelineBranches(input);

    expect(ensure.mock.calls).toEqual(
      ['dev', 'uat', 'main'].map((branch) => [
        'tok',
        'acme',
        'storefront',
        branch,
        { seedStatusChecks: ['env-guard'] },
      ]),
    );
    expect(publisher.recordProjectEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCode: 'project_branch_protection_applied',
        projectId: 'project-1',
        workspaceId: 'team-1',
        actorUserId: 'user-1',
        metadata: expect.objectContaining({
          repoFullName: 'acme/storefront',
        }),
      }),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('never fails provisioning: a refusal or a throw logs a warning and records project_branch_protection_failed', async () => {
    const ensure = jest
      .fn()
      .mockResolvedValueOnce({ status: 'applied' })
      .mockResolvedValueOnce({ status: 'failed', error: 'HTTP 403 on uat' })
      .mockRejectedValueOnce(new Error('network down'));
    const publisher = { recordProjectEvent: jest.fn() };

    await expect(
      make(ensure, publisher).protectPipelineBranches(input),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('uat (HTTP 403 on uat); main (network down)'),
    );
    expect(publisher.recordProjectEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCode: 'project_branch_protection_failed',
        message: 'Branch protection could not be applied to uat, main',
      }),
    );
  });

  it('still works when no audit sink is wired', async () => {
    const ensure = jest.fn().mockResolvedValue({ status: 'missing' });

    await expect(
      make(ensure, undefined).protectPipelineBranches(input),
    ).resolves.toBeUndefined();
  });

  describe('pipeline owners', () => {
    const organizationOwners = () => {
      const order: string[] = [];
      const owners = {
        ensurePipelineOwnersTeam: jest.fn().mockImplementation(() => {
          order.push('team');
          return Promise.resolve({
            status: 'applied',
            teamSlug: 'alphaci-pipeline-owners',
            members: ['lloydlim1'],
            notOrgMembers: [],
          });
        }),
        putFileContent: jest
          .fn()
          .mockImplementation(
            (
              _t: string,
              _o: string,
              _r: string,
              _p: string,
              _c: string,
              branch: string,
            ) => {
              order.push(`codeowners:${branch}`);
              return Promise.resolve({
                commitSha: 'sha-main',
                commitUrl: null,
              });
            },
          ),
        fastForwardBranch: jest
          .fn()
          .mockImplementation(
            (_t: string, _o: string, _r: string, branch: string) => {
              order.push(`fast-forward:${branch}`);
              return Promise.resolve(true);
            },
          ),
        ensurePipelineOwnersRuleset: jest.fn().mockImplementation(() => {
          order.push('ruleset');
          return Promise.resolve({ status: 'applied' });
        }),
      };
      return { owners, order };
    };

    it('writes the team and CODEOWNERS before protection, and the ruleset after it', async () => {
      const { owners, order } = organizationOwners();
      const ensure = jest
        .fn()
        .mockImplementation(
          (_t: string, _o: string, _r: string, branch: string) => {
            order.push(`protect:${branch}`);
            return Promise.resolve({ status: 'applied' });
          },
        );
      const publisher = { recordProjectEvent: jest.fn() };

      await make(ensure, publisher, owners).protectPipelineBranches(input);

      // CODEOWNERS is committed once on main; dev and uat move to that commit.
      expect(order).toEqual([
        'team',
        'codeowners:main',
        'fast-forward:dev',
        'fast-forward:uat',
        'protect:dev',
        'protect:uat',
        'protect:main',
        'ruleset',
      ]);
      expect(owners.ensurePipelineOwnersTeam).toHaveBeenCalledWith(
        'tok',
        'acme',
        'storefront',
        ['lloydlim1'],
      );
      expect(owners.putFileContent).toHaveBeenCalledWith(
        'tok',
        'acme',
        'storefront',
        '.github/CODEOWNERS',
        expect.stringContaining(
          '/.github/workflows/ @acme/alphaci-pipeline-owners',
        ),
        'main',
        'ci: add ALPHACI CODEOWNERS',
      );
      expect(owners.fastForwardBranch).toHaveBeenCalledWith(
        'tok',
        'acme',
        'storefront',
        'dev',
        'sha-main',
      );
      expect(owners.ensurePipelineOwnersRuleset).toHaveBeenCalledWith(
        'tok',
        'acme',
        'storefront',
        { branches: ['dev', 'uat', 'main'], bypassAppId: 123456 },
      );
      expect(publisher.recordProjectEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventCode: 'project_pipeline_owners_applied',
          message: 'Workflow changes now need a pipeline owner review',
        }),
      );
    });

    it('commits on a branch that cannot be fast-forwarded', async () => {
      const { owners } = organizationOwners();
      owners.fastForwardBranch.mockResolvedValue(false);
      const ensure = jest.fn().mockResolvedValue({ status: 'applied' });

      await make(ensure, undefined, owners).protectPipelineBranches(input);

      expect(
        owners.putFileContent.mock.calls.map((call: unknown[]) => call[5]),
      ).toEqual(['main', 'dev', 'uat']);
    });

    it('writes no CODEOWNERS and no ruleset for a personal account', async () => {
      const owners = personalAccountOwners();
      const publisher = { recordProjectEvent: jest.fn() };

      await make(
        jest.fn().mockResolvedValue({ status: 'applied' }),
        publisher,
        owners,
      ).protectPipelineBranches(input);

      expect(owners.putFileContent).not.toHaveBeenCalled();
      expect(owners.ensurePipelineOwnersRuleset).not.toHaveBeenCalled();
      expect(publisher.recordProjectEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventCode: 'project_pipeline_owners_applied',
          message: expect.stringContaining('not review-gated') as string,
        }),
      );
    });

    it('never fails provisioning when the pipeline-owners step throws', async () => {
      const owners = {
        ...personalAccountOwners(),
        ensurePipelineOwnersTeam: jest
          .fn()
          .mockRejectedValue(new Error('network down')),
      };
      const ensure = jest.fn().mockResolvedValue({ status: 'applied' });

      await expect(
        make(ensure, undefined, owners).protectPipelineBranches(input),
      ).resolves.toBeUndefined();
      expect(ensure).toHaveBeenCalledTimes(3);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Pipeline owners could not be prepared'),
      );
    });

    it('records project_pipeline_owners_failed when the ruleset is refused', async () => {
      const { owners } = organizationOwners();
      owners.ensurePipelineOwnersRuleset.mockResolvedValue({
        status: 'failed',
        error: 'HTTP 403 writing the ruleset',
      });
      const publisher = { recordProjectEvent: jest.fn() };

      await make(
        jest.fn().mockResolvedValue({ status: 'applied' }),
        publisher,
        owners,
      ).protectPipelineBranches(input);

      expect(publisher.recordProjectEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventCode: 'project_pipeline_owners_failed',
          message: expect.stringContaining(
            'ruleset: HTTP 403 writing the ruleset',
          ) as string,
        }),
      );
    });
  });
});
