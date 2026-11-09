import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { PlatformAppRole } from '#kernel/ports/platform-admin.port';
import type { DeliveryProjectMemberRecord } from '../infrastructure/delivery-project-members.repository';
import {
  DeliveryProjectMembersService,
  memberKindForRole,
} from './delivery-project-members.service';

const TX = { query: jest.fn() };

function member(
  overrides: Partial<DeliveryProjectMemberRecord> = {},
): DeliveryProjectMemberRecord {
  return {
    id: 'm-1',
    deliveryProjectId: 'dp-1',
    userId: 'dev-1',
    memberKind: 'developer',
    status: 'active',
    addedBy: 'lead-1',
    createdAt: '2026-10-08T00:00:00Z',
    updatedAt: '2026-10-08T00:00:00Z',
    login: 'dev-one',
    name: 'Dev One',
    avatarUrl: null,
    ...overrides,
  };
}

function setup({
  mode = 'live',
  roles = {},
  teamMembers = ['dev-1', 'qa-1', 'lead-2', 'creator-1', 'dev-2'],
  repos = [
    { id: 'repo-a', createdBy: 'creator-1' },
    { id: 'repo-b', createdBy: 'dev-1' },
  ],
  developerIds = ['dev-1', 'dev-2'],
} = {}) {
  const allRoles: Record<string, PlatformAppRole> = {
    'dev-1': 'member',
    'dev-2': 'member',
    'creator-1': 'member',
    'qa-1': 'qa',
    'lead-2': 'lead',
    'admin-2': 'admin',
    ...roles,
  };
  const membersRepository = {
    listActive: jest.fn().mockResolvedValue([member()]),
    listActiveDeveloperUserIdsWithClient: jest
      .fn()
      .mockResolvedValue(developerIds),
    upsertActiveWithClient: jest
      .fn()
      .mockImplementation(
        (
          _c: unknown,
          input: { userId: string; memberKind: 'developer' | 'qa' },
        ) =>
          Promise.resolve(
            member({ userId: input.userId, memberKind: input.memberKind }),
          ),
      ),
    markRemovedWithClient: jest
      .fn()
      .mockResolvedValue(member({ status: 'removed' })),
  };
  const deliveryProjectsRepository = {
    findById: jest.fn().mockResolvedValue({
      id: 'dp-1',
      groupId: 'group-1',
      name: 'Payments',
      status: 'active',
    }),
    findGroupIdForDeliveryProject: jest.fn().mockResolvedValue('group-1'),
  };
  const repositoriesRepository = {
    listActiveForGrantWithClient: jest.fn().mockResolvedValue(repos),
    isCreatedByAlphaci: jest.fn().mockResolvedValue(true),
    moveToDeliveryProjectWithClient: jest.fn().mockResolvedValue(true),
  };
  const assignmentsRepository = {
    listAssignedPeopleForRepository: jest.fn().mockResolvedValue([
      {
        assignmentId: 'asg-1',
        userId: 'dev-1',
        login: 'dev-one',
        name: 'Dev One',
      },
      {
        assignmentId: 'asg-2',
        userId: 'dev-2',
        login: 'dev-two',
        name: 'Dev Two',
      },
      {
        assignmentId: 'asg-3',
        userId: 'creator-1',
        login: 'maker',
        name: 'Maker',
      },
    ]),
    listLiveRepositoryIdsForUserWithClient: jest
      .fn()
      .mockResolvedValue(new Set<string>()),
    listAssignedForUserInDeliveryProjectWithClient: jest
      .fn()
      .mockResolvedValue([
        { assignmentId: 'asg-a', repositoryCreatedBy: 'creator-1' },
        { assignmentId: 'asg-b', repositoryCreatedBy: 'dev-1' },
      ]),
  };
  const groupsRepository = {
    findActiveMembership: jest
      .fn()
      .mockImplementation((_g: string, userId: string) =>
        Promise.resolve(teamMembers.includes(userId) ? { userId } : null),
      ),
  };
  const githubSyncService = {
    createAssignmentAndRequestGrantWithClient: jest
      .fn()
      .mockResolvedValue({ id: 'asg' }),
    requestRevokeWithClient: jest.fn().mockResolvedValue(undefined),
  };
  const accessService = {
    assertDeliveryProjectManager: jest
      .fn()
      .mockResolvedValue({ groupId: 'group-1', viaPlatformAdmin: false }),
  };
  const databaseService = {
    withTransaction: jest.fn(
      async (fn: (client: typeof TX) => Promise<unknown>) => fn(TX),
    ),
  };
  const configService = {
    getOrThrow: jest.fn().mockReturnValue({
      hierarchy: { githubSyncMode: mode },
    }),
  };
  const auditEventsService = { recordProjectEvent: jest.fn() };
  const appRoleLookup = {
    findAppRole: jest
      .fn()
      .mockImplementation((userId: string) =>
        Promise.resolve(allRoles[userId] as PlatformAppRole),
      ),
  };

  const service = new DeliveryProjectMembersService(
    membersRepository as never,
    deliveryProjectsRepository as never,
    repositoriesRepository as never,
    assignmentsRepository as never,
    groupsRepository as never,
    githubSyncService as never,
    accessService as never,
    databaseService as never,
    configService as never,
    auditEventsService as never,
    appRoleLookup,
  );
  return {
    service,
    membersRepository,
    deliveryProjectsRepository,
    repositoriesRepository,
    assignmentsRepository,
    groupsRepository,
    githubSyncService,
    accessService,
    databaseService,
    auditEventsService,
    appRoleLookup,
  };
}

describe('memberKindForRole', () => {
  it.each([
    ['member', 'developer'],
    ['qa', 'qa'],
    ['lead', null],
    ['admin', null],
    [undefined, null],
  ] as const)('%s -> %s', (role, kind) => {
    expect(memberKindForRole(role)).toBe(kind);
  });
});

describe('DeliveryProjectMembersService.listMembers', () => {
  it('is manager-only and lists the active members', async () => {
    const { service, accessService, membersRepository } = setup();
    await expect(service.listMembers('dp-1', 'lead-1')).resolves.toEqual({
      items: [expect.objectContaining({ userId: 'dev-1' })],
    });
    expect(accessService.assertDeliveryProjectManager).toHaveBeenCalledWith(
      'dp-1',
      'lead-1',
    );
    expect(membersRepository.listActive).toHaveBeenCalledWith('dp-1');
  });

  it('refuses a non-manager before reading members', async () => {
    const { service, accessService, membersRepository } = setup();
    accessService.assertDeliveryProjectManager.mockRejectedValue(
      new NotFoundException('Delivery project not found'),
    );
    await expect(service.listMembers('dp-1', 'dev-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(membersRepository.listActive).not.toHaveBeenCalled();
  });
});

describe('DeliveryProjectMembersService.addMember', () => {
  it('adds a Developer and queues a grant for every active repository', async () => {
    const {
      service,
      githubSyncService,
      membersRepository,
      auditEventsService,
    } = setup();
    const result = await service.addMember('dp-1', 'lead-1', {
      userId: 'dev-1',
    });

    expect(membersRepository.upsertActiveWithClient).toHaveBeenCalledWith(TX, {
      deliveryProjectId: 'dp-1',
      userId: 'dev-1',
      memberKind: 'developer',
      addedBy: 'lead-1',
    });
    expect(
      githubSyncService.createAssignmentAndRequestGrantWithClient,
    ).toHaveBeenCalledTimes(2);
    expect(
      githubSyncService.createAssignmentAndRequestGrantWithClient,
    ).toHaveBeenCalledWith(TX, {
      repositoryId: 'repo-a',
      userId: 'dev-1',
      assignedBy: 'lead-1',
    });
    expect(result).toMatchObject({
      member: { memberKind: 'developer' },
      githubAccess: { syncMode: 'live', repositoriesQueued: 2 },
    });
    expect(auditEventsService.recordProjectEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCode: 'hierarchy.delivery_project.member_added',
      }),
    );
  });

  it('does all of it in ONE transaction', async () => {
    const { service, databaseService } = setup();
    await service.addMember('dp-1', 'lead-1', { userId: 'dev-1' });
    expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
  });

  it('rolls the membership back when a grant cannot be queued', async () => {
    const { service, githubSyncService, auditEventsService } = setup();
    githubSyncService.createAssignmentAndRequestGrantWithClient.mockRejectedValue(
      new Error('outbox down'),
    );
    await expect(
      service.addMember('dp-1', 'lead-1', { userId: 'dev-1' }),
    ).rejects.toThrow('outbox down');
    expect(auditEventsService.recordProjectEvent).not.toHaveBeenCalled();
  });

  it('skips repositories that already carry a live assignment', async () => {
    const { service, githubSyncService, assignmentsRepository } = setup();
    assignmentsRepository.listLiveRepositoryIdsForUserWithClient.mockResolvedValue(
      new Set(['repo-a']),
    );
    const result = await service.addMember('dp-1', 'lead-1', {
      userId: 'dev-1',
    });
    expect(
      githubSyncService.createAssignmentAndRequestGrantWithClient,
    ).toHaveBeenCalledTimes(1);
    expect(result.githubAccess.repositoriesQueued).toBe(1);
  });

  it('adds QA with NO assignment and NO GitHub grant', async () => {
    const { service, githubSyncService, repositoriesRepository } = setup();
    const result = await service.addMember('dp-1', 'lead-1', {
      userId: 'qa-1',
    });
    expect(result.member.memberKind).toBe('qa');
    expect(
      githubSyncService.createAssignmentAndRequestGrantWithClient,
    ).not.toHaveBeenCalled();
    expect(
      repositoriesRepository.listActiveForGrantWithClient,
    ).not.toHaveBeenCalled();
    expect(result.githubAccess.repositoriesQueued).toBe(0);
  });

  it('records the member but makes no grant while sync mode is stub', async () => {
    const { service, githubSyncService, membersRepository } = setup({
      mode: 'stub',
    });
    const result = await service.addMember('dp-1', 'lead-1', {
      userId: 'dev-1',
    });
    expect(membersRepository.upsertActiveWithClient).toHaveBeenCalled();
    expect(
      githubSyncService.createAssignmentAndRequestGrantWithClient,
    ).not.toHaveBeenCalled();
    expect(result.githubAccess).toEqual({
      syncMode: 'stub',
      repositoriesQueued: 0,
    });
  });

  it.each([
    ['lead-2', 'lead'],
    ['admin-2', 'admin'],
  ])(
    'rejects a %s target (%s) with PROJECT_MEMBER_ROLE_NOT_ALLOWED',
    async (userId) => {
      const { service, membersRepository } = setup({
        teamMembers: ['lead-2', 'admin-2'],
      });
      await expect(
        service.addMember('dp-1', 'lead-1', { userId }),
      ).rejects.toMatchObject({
        response: { code: 'PROJECT_MEMBER_ROLE_NOT_ALLOWED' },
      });
      expect(membersRepository.upsertActiveWithClient).not.toHaveBeenCalled();
    },
  );

  it('rejects a person who is not an active member of the Project team', async () => {
    const { service } = setup({ teamMembers: [] });
    await expect(
      service.addMember('dp-1', 'lead-1', { userId: 'dev-1' }),
    ).rejects.toMatchObject({
      response: { code: 'PROJECT_MEMBER_NOT_IN_TEAM' },
    });
  });

  it('rejects an unresolved role (fails closed)', async () => {
    const { service, appRoleLookup } = setup();
    appRoleLookup.findAppRole.mockResolvedValue(undefined);
    await expect(
      service.addMember('dp-1', 'lead-1', { userId: 'dev-1' }),
    ).rejects.toMatchObject({
      response: { code: 'PROJECT_MEMBER_ROLE_NOT_ALLOWED' },
    });
  });

  it('refuses an archived Project', async () => {
    const { service, deliveryProjectsRepository } = setup();
    deliveryProjectsRepository.findById.mockResolvedValue({
      id: 'dp-1',
      groupId: 'group-1',
      name: 'Payments',
      status: 'archived',
    });
    await expect(
      service.addMember('dp-1', 'lead-1', { userId: 'dev-1' }),
    ).rejects.toMatchObject({ response: { code: 'PROJECT_ARCHIVED' } });
  });

  it('404s for an unknown Project and 403s for a non-manager before anything else', async () => {
    const { service, accessService, membersRepository } = setup();
    accessService.assertDeliveryProjectManager.mockRejectedValue(
      new BadRequestException('nope'),
    );
    await expect(
      service.addMember('dp-1', 'dev-9', { userId: 'dev-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(membersRepository.upsertActiveWithClient).not.toHaveBeenCalled();
  });
});

describe('DeliveryProjectMembersService.removeMember', () => {
  it('revokes the Developer assignments in the Project but keeps a repository they created', async () => {
    const { service, githubSyncService, auditEventsService } = setup();
    const result = await service.removeMember('dp-1', 'lead-1', 'dev-1');

    expect(githubSyncService.requestRevokeWithClient).toHaveBeenCalledTimes(1);
    expect(githubSyncService.requestRevokeWithClient).toHaveBeenCalledWith(
      TX,
      'asg-a',
      'lead-1',
    );
    expect(githubSyncService.requestRevokeWithClient).not.toHaveBeenCalledWith(
      TX,
      'asg-b',
      expect.anything(),
    );
    expect(result.githubAccess.repositoriesQueued).toBe(1);
    expect(auditEventsService.recordProjectEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCode: 'hierarchy.delivery_project.member_removed',
      }),
    );
  });

  it('removing a QA member revokes nothing', async () => {
    const { service, membersRepository, githubSyncService } = setup();
    membersRepository.markRemovedWithClient.mockResolvedValue(
      member({ userId: 'qa-1', memberKind: 'qa', status: 'removed' }),
    );
    await service.removeMember('dp-1', 'lead-1', 'qa-1');
    expect(githubSyncService.requestRevokeWithClient).not.toHaveBeenCalled();
  });

  it('revokes even when sync mode is stub (assignments from live must not linger)', async () => {
    const { service, githubSyncService } = setup({ mode: 'stub' });
    await service.removeMember('dp-1', 'lead-1', 'dev-1');
    expect(githubSyncService.requestRevokeWithClient).toHaveBeenCalledTimes(1);
  });

  it('404s PROJECT_MEMBER_NOT_FOUND for someone who is not an active member', async () => {
    const { service, membersRepository, githubSyncService } = setup();
    membersRepository.markRemovedWithClient.mockResolvedValue(null);
    await expect(
      service.removeMember('dp-1', 'lead-1', 'dev-9'),
    ).rejects.toMatchObject({ response: { code: 'PROJECT_MEMBER_NOT_FOUND' } });
    expect(githubSyncService.requestRevokeWithClient).not.toHaveBeenCalled();
  });

  it('is manager-only', async () => {
    const { service, accessService, membersRepository } = setup();
    accessService.assertDeliveryProjectManager.mockRejectedValue(
      new NotFoundException(),
    );
    await expect(
      service.removeMember('dp-1', 'dev-9', 'dev-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(membersRepository.markRemovedWithClient).not.toHaveBeenCalled();
  });
});

describe('DeliveryProjectMembersService.grantForRepository (a repository joined a Project)', () => {
  it('grants the creator (a Developer) and every Developer member', async () => {
    const { service, githubSyncService } = setup();
    const queued = await service.grantForRepository({
      repositoryId: 'repo-new',
      deliveryProjectId: 'dp-1',
      creatorUserId: 'creator-1',
      assignedBy: 'creator-1',
    });

    expect(queued).toBe(3);
    const granted =
      githubSyncService.createAssignmentAndRequestGrantWithClient.mock.calls.map(
        (call) => (call[1] as { userId: string }).userId,
      );
    expect(granted.sort()).toEqual(['creator-1', 'dev-1', 'dev-2']);
  });

  it('does not double-grant a creator who is also a member', async () => {
    const { service, githubSyncService } = setup();
    await service.grantForRepository({
      repositoryId: 'repo-new',
      deliveryProjectId: 'dp-1',
      creatorUserId: 'dev-1',
      assignedBy: 'dev-1',
    });
    expect(
      githubSyncService.createAssignmentAndRequestGrantWithClient,
    ).toHaveBeenCalledTimes(2);
  });

  it('skips a creator who is a lead or admin (they stay on the org base permission)', async () => {
    const { service, githubSyncService } = setup({
      developerIds: [],
      teamMembers: ['lead-2'],
    });
    const queued = await service.grantForRepository({
      repositoryId: 'repo-new',
      deliveryProjectId: 'dp-1',
      creatorUserId: 'lead-2',
      assignedBy: 'lead-2',
    });
    expect(queued).toBe(0);
    expect(
      githubSyncService.createAssignmentAndRequestGrantWithClient,
    ).not.toHaveBeenCalled();
  });

  it('QA members never receive an assignment on a new repository', async () => {
    const { service, githubSyncService, membersRepository } = setup({
      developerIds: [],
    });
    // The repository only ever asks for DEVELOPER member ids.
    await service.grantForRepository({
      repositoryId: 'repo-new',
      deliveryProjectId: 'dp-1',
      assignedBy: 'lead-1',
    });
    expect(
      membersRepository.listActiveDeveloperUserIdsWithClient,
    ).toHaveBeenCalled();
    expect(
      githubSyncService.createAssignmentAndRequestGrantWithClient,
    ).not.toHaveBeenCalled();
  });

  it('skips a member who has left the team since being added', async () => {
    const { service, githubSyncService } = setup({
      developerIds: ['dev-1', 'dev-2'],
      teamMembers: ['dev-2'],
    });
    await service.grantForRepository({
      repositoryId: 'repo-new',
      deliveryProjectId: 'dp-1',
      assignedBy: 'lead-1',
    });
    expect(
      githubSyncService.createAssignmentAndRequestGrantWithClient,
    ).toHaveBeenCalledTimes(1);
  });

  it('grants nobody on an ATTACHED repository, even for its creator and the Project Developers', async () => {
    const {
      service,
      githubSyncService,
      repositoriesRepository,
      databaseService,
    } = setup();
    repositoriesRepository.isCreatedByAlphaci.mockResolvedValue(false);
    await expect(
      service.grantForRepository({
        repositoryId: 'repo-attached',
        deliveryProjectId: 'dp-1',
        creatorUserId: 'creator-1',
        assignedBy: 'creator-1',
      }),
    ).resolves.toBe(0);
    expect(databaseService.withTransaction).not.toHaveBeenCalled();
    expect(
      githubSyncService.createAssignmentAndRequestGrantWithClient,
    ).not.toHaveBeenCalled();
  });

  it('does nothing while sync mode is stub', async () => {
    const { service, databaseService } = setup({ mode: 'stub' });
    await expect(
      service.grantForRepository({
        repositoryId: 'repo-new',
        deliveryProjectId: 'dp-1',
        creatorUserId: 'creator-1',
        assignedBy: 'creator-1',
      }),
    ).resolves.toBe(0);
    expect(databaseService.withTransaction).not.toHaveBeenCalled();
  });

  it('the best-effort wrapper swallows a failure so a provisioned repository is never undone', async () => {
    const { service, databaseService } = setup();
    databaseService.withTransaction.mockRejectedValue(new Error('db down'));
    await expect(
      service.grantForNewRepositoryBestEffort({
        repositoryId: 'repo-new',
        deliveryProjectId: 'dp-1',
        assignedBy: 'lead-1',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('DeliveryProjectMembersService.resyncDevelopers', () => {
  it('re-runs the fan-out for every active Developer (idempotent backfill)', async () => {
    const { service, githubSyncService } = setup();
    const result = await service.resyncDevelopers('dp-1', 'lead-1');
    // 2 developers x 2 repositories
    expect(
      githubSyncService.createAssignmentAndRequestGrantWithClient,
    ).toHaveBeenCalledTimes(4);
    expect(result).toMatchObject({ syncMode: 'live', repositoriesQueued: 4 });
  });

  it('is unavailable until live sync is on', async () => {
    const { service } = setup({ mode: 'stub' });
    await expect(
      service.resyncDevelopers('dp-1', 'lead-1'),
    ).rejects.toMatchObject({ status: 503 });
  });
});

describe('DeliveryProjectMembersService joining Projects with a team add', () => {
  it('returns the kind the person joins as when every Project is open in the team', async () => {
    const { service } = setup();
    await expect(
      service.prepareJoinOnTeamAdd('group-1', 'qa-1', ['dp-1']),
    ).resolves.toBe('qa');
  });

  it("refuses another team's Project as not found", async () => {
    const { service, deliveryProjectsRepository } = setup();
    deliveryProjectsRepository.findById.mockResolvedValue({
      id: 'dp-other',
      groupId: 'group-2',
      name: 'Other',
      status: 'active',
    });
    await expect(
      service.prepareJoinOnTeamAdd('group-1', 'dev-1', ['dp-other']),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses an archived Project by name', async () => {
    const { service, deliveryProjectsRepository } = setup();
    deliveryProjectsRepository.findById.mockResolvedValue({
      id: 'dp-1',
      groupId: 'group-1',
      name: 'Payments',
      status: 'archived',
    });
    await expect(
      service.prepareJoinOnTeamAdd('group-1', 'dev-1', ['dp-1']),
    ).rejects.toMatchObject({
      response: {
        code: 'PROJECT_ARCHIVED',
        message: expect.stringContaining('"Payments"'),
      },
    });
  });

  it('refuses a lead, who sees every Project without joining one', async () => {
    const { service } = setup();
    await expect(
      service.prepareJoinOnTeamAdd('group-1', 'lead-2', ['dp-1']),
    ).rejects.toMatchObject({
      response: { code: 'PROJECT_MEMBER_ROLE_NOT_ALLOWED' },
    });
  });

  it('queues GitHub Write on every repository of each Project for a Developer, in the given transaction', async () => {
    const { service, membersRepository, githubSyncService } = setup();
    const joined = await service.joinProjectsWithClient(TX, {
      deliveryProjectIds: ['dp-1', 'dp-2'],
      userId: 'dev-new',
      memberKind: 'developer',
      actingUserId: 'lead-1',
    });

    expect(joined.map((project) => project.repositoriesQueued)).toEqual([2, 2]);
    expect(membersRepository.upsertActiveWithClient).toHaveBeenCalledTimes(2);
    expect(
      githubSyncService.createAssignmentAndRequestGrantWithClient,
    ).toHaveBeenCalledWith(TX, {
      repositoryId: 'repo-a',
      userId: 'dev-new',
      assignedBy: 'lead-1',
    });
    expect(
      githubSyncService.createAssignmentAndRequestGrantWithClient,
    ).toHaveBeenCalledTimes(4);
  });

  it('queues no GitHub grant for QA, or while sync is stub', async () => {
    for (const [mode, memberKind] of [
      ['live', 'qa'],
      ['stub', 'developer'],
    ] as const) {
      const { service, membersRepository, githubSyncService } = setup({
        mode,
      });
      const joined = await service.joinProjectsWithClient(TX, {
        deliveryProjectIds: ['dp-1'],
        userId: 'person-1',
        memberKind,
        actingUserId: 'lead-1',
      });
      expect(joined[0]?.repositoriesQueued).toBe(0);
      expect(membersRepository.upsertActiveWithClient).toHaveBeenCalled();
      expect(
        githubSyncService.createAssignmentAndRequestGrantWithClient,
      ).not.toHaveBeenCalled();
    }
  });
});

describe('DeliveryProjectMembersService moving a repository', () => {
  const move = (createdBy: string | null = 'creator-1') => ({
    repositoryId: 'repo-a',
    createdBy,
    targetDeliveryProjectId: 'dp-2',
  });
  const developersOf = (...userIds: string[]) =>
    userIds.map((userId) =>
      member({ userId, memberKind: 'developer', deliveryProjectId: 'dp-2' }),
    );

  it('lists who holds Write but is neither the creator nor a Developer of the destination', async () => {
    const { service, membersRepository } = setup();
    membersRepository.listActive.mockResolvedValue(developersOf('dev-2'));

    await expect(service.listAccessLostOnMove(move())).resolves.toEqual([
      {
        assignmentId: 'asg-1',
        userId: 'dev-1',
        login: 'dev-one',
        name: 'Dev One',
      },
    ]);
    expect(membersRepository.listActive).toHaveBeenCalledWith('dp-2');
  });

  it('does not count a QA member of the destination as keeping a Developer', async () => {
    const { service, membersRepository } = setup();
    membersRepository.listActive.mockResolvedValue([
      member({ userId: 'dev-2', memberKind: 'qa', deliveryProjectId: 'dp-2' }),
    ]);

    const lost = await service.listAccessLostOnMove(move());

    expect(lost.map((person) => person.userId)).toEqual(['dev-1', 'dev-2']);
  });

  it('never lists the creator, even though they are not in the destination', async () => {
    const { service, membersRepository } = setup();
    membersRepository.listActive.mockResolvedValue([]);

    const lost = await service.listAccessLostOnMove(move('creator-1'));

    expect(lost.map((person) => person.userId)).not.toContain('creator-1');
  });

  it('lists nobody for an attached repository, whose access is only ever set by hand', async () => {
    const { service, repositoriesRepository, assignmentsRepository } = setup();
    repositoriesRepository.isCreatedByAlphaci.mockResolvedValue(false);

    await expect(service.listAccessLostOnMove(move())).resolves.toEqual([]);
    expect(
      assignmentsRepository.listAssignedPeopleForRepository,
    ).not.toHaveBeenCalled();
  });

  it('lists nobody while live sync is off, since no GitHub access is managed', async () => {
    const { service, assignmentsRepository } = setup({ mode: 'stub' });

    await expect(service.listAccessLostOnMove(move())).resolves.toEqual([]);
    expect(
      assignmentsRepository.listAssignedPeopleForRepository,
    ).not.toHaveBeenCalled();
  });

  it('moves and queues every revoke in one transaction', async () => {
    const {
      service,
      repositoriesRepository,
      githubSyncService,
      databaseService,
    } = setup();

    await expect(
      service.moveRepositoryRevokingAccess({
        repositoryId: 'repo-a',
        fromDeliveryProjectId: 'dp-1',
        toDeliveryProjectId: 'dp-2',
        revoke: [
          {
            assignmentId: 'asg-1',
            userId: 'dev-1',
            login: 'dev-one',
            name: null,
          },
          {
            assignmentId: 'asg-2',
            userId: 'dev-2',
            login: 'dev-two',
            name: null,
          },
        ],
        actingUserId: 'lead-1',
      }),
    ).resolves.toBe(true);

    expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
    expect(
      repositoriesRepository.moveToDeliveryProjectWithClient,
    ).toHaveBeenCalledWith(TX, 'repo-a', 'dp-1', 'dp-2');
    expect(githubSyncService.requestRevokeWithClient.mock.calls).toEqual([
      [TX, 'asg-1', 'lead-1'],
      [TX, 'asg-2', 'lead-1'],
    ]);
  });

  it('queues no revoke when someone else moved the repository first', async () => {
    const { service, repositoriesRepository, githubSyncService } = setup();
    repositoriesRepository.moveToDeliveryProjectWithClient.mockResolvedValue(
      false,
    );

    await expect(
      service.moveRepositoryRevokingAccess({
        repositoryId: 'repo-a',
        fromDeliveryProjectId: 'dp-1',
        toDeliveryProjectId: 'dp-2',
        revoke: [
          { assignmentId: 'asg-1', userId: 'dev-1', login: null, name: null },
        ],
        actingUserId: 'lead-1',
      }),
    ).resolves.toBe(false);
    expect(githubSyncService.requestRevokeWithClient).not.toHaveBeenCalled();
  });
});
