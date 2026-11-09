import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import type {
  AuditEventPublisher,
  NotificationEventPublisher,
} from '#kernel/events/platform-event-publisher';
import type { MemberDirectoryService } from '#modules/identity-access/directory/index.js';
import type { GroupsRepository } from '../infrastructure/groups.repository';
import type { DeliveryProjectMembersService } from './delivery-project-members.service';
import { GroupMembersService } from './group-members.service';
import type { HierarchyAccessService } from './hierarchy-access.service';

describe('GroupMembersService.addMember', () => {
  const lead = { userId: 'lead-id', githubToken: 'gho_lead' };
  let groupsRepository: jest.Mocked<GroupsRepository>;
  let accessService: jest.Mocked<HierarchyAccessService>;
  let directory: jest.Mocked<MemberDirectoryService>;
  let service: GroupMembersService;
  let notifications: { recordInTransaction: jest.Mock };
  let projectMembers: {
    prepareJoinOnTeamAdd: jest.Mock;
    joinProjectsWithClient: jest.Mock;
    recordMembersAdded: jest.Mock;
    githubAccessOutcome: jest.Mock;
  };

  beforeEach(() => {
    notifications = {
      recordInTransaction: jest.fn().mockResolvedValue(undefined),
    };
    groupsRepository = {
      findActiveMembership: jest.fn().mockResolvedValue(null),
      addMemberDirect: jest.fn().mockResolvedValue(true),
      listMembers: jest
        .fn()
        .mockResolvedValue([{ userId: 'ramos-id', login: 'bpramos-ae' }]),
    } as unknown as jest.Mocked<GroupsRepository>;
    accessService = {
      assertGroupManagerOrPlatformAdmin: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<HierarchyAccessService>;
    directory = {
      assertEligible: jest
        .fn()
        .mockResolvedValue({ id: 'ramos-id', login: 'bpramos-ae' }),
    } as unknown as jest.Mocked<MemberDirectoryService>;
    projectMembers = {
      prepareJoinOnTeamAdd: jest.fn().mockResolvedValue('developer'),
      joinProjectsWithClient: jest.fn().mockResolvedValue([
        { deliveryProjectId: 'dp-1', member: {}, repositoriesQueued: 2 },
        { deliveryProjectId: 'dp-2', member: {}, repositoriesQueued: 1 },
      ]),
      recordMembersAdded: jest.fn().mockResolvedValue(undefined),
      githubAccessOutcome: jest.fn((repositoriesQueued: number) => ({
        syncMode: 'live',
        repositoriesQueued,
      })),
    };
    service = new GroupMembersService(
      groupsRepository,
      accessService,
      {
        recordProjectEvent: jest.fn(),
      } as unknown as AuditEventPublisher,
      directory,
      notifications as unknown as NotificationEventPublisher,
      projectMembers as unknown as DeliveryProjectMembersService,
    );
  });

  it('adds a directory member as a Member', async () => {
    await expect(
      service.addMember('group-1', lead, { userId: 'ramos-id' }),
    ).resolves.toMatchObject({ login: 'bpramos-ae' });

    expect(directory.assertEligible).toHaveBeenCalledWith(lead, 'ramos-id');
    expect(groupsRepository.addMemberDirect).toHaveBeenCalledWith(
      'group-1',
      'ramos-id',
      'member',
      'lead-id',
      expect.any(Function),
    );
  });

  it('writes nothing for someone outside the directory', async () => {
    directory.assertEligible.mockRejectedValue(
      new NotFoundException('outsider is not a member of the org.'),
    );

    await expect(
      service.addMember('group-1', lead, { userId: 'outsider-id' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(groupsRepository.addMemberDirect).not.toHaveBeenCalled();
  });

  it('checks the lead before reading the directory', async () => {
    accessService.assertGroupManagerOrPlatformAdmin.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.addMember('group-1', lead, { userId: 'ramos-id' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(directory.assertEligible).not.toHaveBeenCalled();
  });

  it('addresses the membership notification to the added member in the transaction', async () => {
    const client = { query: jest.fn() };
    groupsRepository.addMemberDirect.mockImplementation(
      async (_g, _u, _r, _a, onAdded) => {
        await onAdded!(client as never, {
          groupName: 'Team A',
          actorLogin: 'lead',
        });
        return true;
      },
    );
    await service.addMember('group-1', lead, { userId: 'ramos-id' });
    expect(notifications.recordInTransaction).toHaveBeenCalledWith(client, {
      userId: 'ramos-id',
      workspaceId: 'group-1',
      eventCode: 'hierarchy.group.member_added',
      title: 'You were added to Team A',
      body: '@lead added you as a Member.',
    });
  });

  describe('with Projects picked', () => {
    const client = { query: jest.fn() };
    beforeEach(() => {
      groupsRepository.addMemberDirect.mockImplementation(
        async (_g, _u, _r, _a, onAdded) => {
          await onAdded!(client as never, {
            groupName: 'Team A',
            actorLogin: 'lead',
          });
          return true;
        },
      );
    });

    it('joins the Projects in the team-add transaction and reports the GitHub grants queued', async () => {
      const added = await service.addMember('group-1', lead, {
        userId: 'ramos-id',
        deliveryProjectIds: ['dp-1', 'dp-2'],
      });

      expect(projectMembers.prepareJoinOnTeamAdd).toHaveBeenCalledWith(
        'group-1',
        'ramos-id',
        ['dp-1', 'dp-2'],
      );
      expect(projectMembers.joinProjectsWithClient).toHaveBeenCalledWith(
        client,
        {
          deliveryProjectIds: ['dp-1', 'dp-2'],
          userId: 'ramos-id',
          memberKind: 'developer',
          actingUserId: 'lead-id',
        },
      );
      expect(projectMembers.recordMembersAdded).toHaveBeenCalledWith(
        'group-1',
        'lead-id',
        'ramos-id',
        'developer',
        [
          expect.objectContaining({ deliveryProjectId: 'dp-1' }),
          expect.objectContaining({ deliveryProjectId: 'dp-2' }),
        ],
      );
      expect(added).toMatchObject({
        login: 'bpramos-ae',
        projectAccess: {
          deliveryProjectIds: ['dp-1', 'dp-2'],
          memberKind: 'developer',
          syncMode: 'live',
          repositoriesQueued: 3,
        },
      });
    });

    it('adds nobody when a picked Project cannot be joined', async () => {
      projectMembers.prepareJoinOnTeamAdd.mockRejectedValue(
        new BadRequestException({ code: 'PROJECT_ARCHIVED' }),
      );

      await expect(
        service.addMember('group-1', lead, {
          userId: 'ramos-id',
          deliveryProjectIds: ['dp-archived'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(groupsRepository.addMemberDirect).not.toHaveBeenCalled();
      expect(projectMembers.joinProjectsWithClient).not.toHaveBeenCalled();
    });

    it('fails the whole add when joining a Project fails inside the transaction', async () => {
      projectMembers.joinProjectsWithClient.mockRejectedValue(
        new Error('db down'),
      );

      await expect(
        service.addMember('group-1', lead, {
          userId: 'ramos-id',
          deliveryProjectIds: ['dp-1'],
        }),
      ).rejects.toThrow('db down');
      expect(projectMembers.recordMembersAdded).not.toHaveBeenCalled();
    });

    it('touches no Project when none was picked', async () => {
      const added = await service.addMember('group-1', lead, {
        userId: 'ramos-id',
        deliveryProjectIds: [],
      });

      expect(projectMembers.prepareJoinOnTeamAdd).not.toHaveBeenCalled();
      expect(projectMembers.joinProjectsWithClient).not.toHaveBeenCalled();
      expect(added).not.toHaveProperty('projectAccess');
    });
  });
});
