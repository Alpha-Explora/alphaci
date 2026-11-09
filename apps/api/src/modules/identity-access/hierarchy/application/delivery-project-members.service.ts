import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PoolClient } from 'pg';

import type { AppConfig } from '#kernel/config/app.config';
import { DatabaseService } from '#kernel/db/database.service';
import { AuditEventPublisher } from '#kernel/events/platform-event-publisher.js';
import {
  APP_ROLE_LOOKUP,
  type AppRoleLookup,
} from '#kernel/ports/app-role.port';
import type { PlatformAppRole } from '#kernel/ports/platform-admin.port';
import { canBeAssignedRepository } from '#kernel/rules/persona-access.rules';
import {
  HIERARCHY_EVENT_CODES,
  type DeliveryProjectMemberKind,
} from '../domain/hierarchy.types';
import { AssignmentsRepository } from '../infrastructure/assignments.repository';
import { DeliveryProjectMembersRepository } from '../infrastructure/delivery-project-members.repository';
import type { DeliveryProjectMemberRecord } from '../infrastructure/delivery-project-members.repository';
import { DeliveryProjectsRepository } from '../infrastructure/delivery-projects.repository';
import { GroupsRepository } from '../infrastructure/groups.repository';
import { RepositoriesRepository } from '../infrastructure/repositories.repository';
import type { AddDeliveryProjectMemberDto } from '../api/dto/add-delivery-project-member.dto';
import { GithubSyncService } from './github-sync.service';
import { HierarchyAccessService } from './hierarchy-access.service';

/** What the GitHub side of a membership change did, for the UI to report. */
export interface MemberGithubAccessOutcome {
  /** `stub` means no GitHub grant is made until live sync is switched on. */
  syncMode: 'live' | 'stub';
  /** Repositories a grant (add) or a revoke (remove) was queued for. */
  repositoriesQueued: number;
}

/** Someone who would lose GitHub Write on a repository by moving it. */
export interface MoveAccessPerson {
  assignmentId: string;
  userId: string;
  login: string | null;
  name: string | null;
}

export interface DeliveryProjectMemberChange {
  member: DeliveryProjectMemberRecord;
  githubAccess: MemberGithubAccessOutcome;
}

/** member -> developer, qa -> qa; leads/admins are never Project members. */
export function memberKindForRole(
  role: PlatformAppRole | undefined,
): DeliveryProjectMemberKind | null {
  if (role === 'member') return 'developer';
  if (role === 'qa') return 'qa';
  return null;
}

/**
 * Project membership and the GitHub write access it carries.
 *
 * Developers of a Project hold GitHub Write on every repository of it, through
 * the same per-repository assignment machinery a lead uses by hand. QA members
 * never produce an assignment: QA and leads act on GitHub through the ALPHACI
 * App and keep the org base (read) permission.
 */
@Injectable()
export class DeliveryProjectMembersService {
  private readonly logger = new Logger(DeliveryProjectMembersService.name);

  constructor(
    private readonly membersRepository: DeliveryProjectMembersRepository,
    private readonly deliveryProjectsRepository: DeliveryProjectsRepository,
    private readonly repositoriesRepository: RepositoriesRepository,
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly groupsRepository: GroupsRepository,
    private readonly githubSyncService: GithubSyncService,
    private readonly accessService: HierarchyAccessService,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly auditEventsService: AuditEventPublisher,
    // Required (not @Optional): the persona allow-list must never vanish.
    @Inject(APP_ROLE_LOOKUP)
    private readonly appRoleLookup: AppRoleLookup,
  ) {}

  async listMembers(
    deliveryProjectId: string,
    userId: string,
  ): Promise<{ items: DeliveryProjectMemberRecord[] }> {
    await this.accessService.assertDeliveryProjectManager(
      deliveryProjectId,
      userId,
    );
    return {
      items: await this.membersRepository.listActive(deliveryProjectId),
    };
  }

  async addMember(
    deliveryProjectId: string,
    actingUserId: string,
    dto: AddDeliveryProjectMemberDto,
  ): Promise<DeliveryProjectMemberChange> {
    const { groupId } = await this.accessService.assertDeliveryProjectManager(
      deliveryProjectId,
      actingUserId,
    );
    await this.assertProjectsOpenInTeam(groupId, [deliveryProjectId]);

    const membership = await this.groupsRepository.findActiveMembership(
      groupId,
      dto.userId,
    );
    if (!membership) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'PROJECT_MEMBER_NOT_IN_TEAM',
        message: "The person must be an active member of the Project's team.",
      });
    }
    const memberKind = await this.memberKindOrThrow(dto.userId);

    const live = this.isLive();
    const { member, queued } = await this.databaseService.withTransaction(
      async (client) => {
        const [joined] = await this.joinProjectsWithClient(client, {
          deliveryProjectIds: [deliveryProjectId],
          userId: dto.userId,
          memberKind,
          actingUserId,
        });
        if (!joined) throw new Error('Project membership was not written');
        return { member: joined.member, queued: joined.repositoriesQueued };
      },
    );

    await this.recordMembersAdded(
      groupId,
      actingUserId,
      dto.userId,
      memberKind,
      [{ deliveryProjectId, repositoriesQueued: queued }],
    );

    return { member, githubAccess: this.outcome(live, queued) };
  }

  /**
   * Checks, before anything is written, that a person joining the team can
   * also join these Projects: each is an active Project of this team, and
   * the person's role is one a Project takes. Returns the kind they join as.
   *
   * The caller has already passed the team-manager gate, which is the gate
   * every Project of the team uses (assertDeliveryProjectManager).
   */
  async prepareJoinOnTeamAdd(
    groupId: string,
    userId: string,
    deliveryProjectIds: readonly string[],
  ): Promise<DeliveryProjectMemberKind> {
    await this.assertProjectsOpenInTeam(groupId, deliveryProjectIds);
    return this.memberKindOrThrow(userId);
  }

  /**
   * Makes the person an active member of each Project and, for a Developer
   * while live sync is on, queues GitHub Write on every repository of it.
   * Runs in the caller's transaction, so a team add and its Project
   * memberships commit together. The caller validates first
   * (prepareJoinOnTeamAdd, or the checks in addMember).
   */
  async joinProjectsWithClient(
    client: Pick<PoolClient, 'query'>,
    input: {
      deliveryProjectIds: readonly string[];
      userId: string;
      memberKind: DeliveryProjectMemberKind;
      actingUserId: string;
    },
  ): Promise<
    Array<{
      deliveryProjectId: string;
      member: DeliveryProjectMemberRecord;
      repositoriesQueued: number;
    }>
  > {
    const live = this.isLive();
    const joined = [];
    for (const deliveryProjectId of input.deliveryProjectIds) {
      const member = await this.membersRepository.upsertActiveWithClient(
        client,
        {
          deliveryProjectId,
          userId: input.userId,
          memberKind: input.memberKind,
          addedBy: input.actingUserId,
        },
      );
      const repositoriesQueued =
        input.memberKind === 'developer' && live
          ? await this.grantDeveloperOnProjectRepositoriesWithClient(
              client,
              deliveryProjectId,
              input.userId,
              input.actingUserId,
            )
          : 0;
      joined.push({ deliveryProjectId, member, repositoriesQueued });
    }
    return joined;
  }

  /** One audit event per Project joined. Call after the transaction commits. */
  async recordMembersAdded(
    groupId: string,
    actingUserId: string,
    targetUserId: string,
    memberKind: DeliveryProjectMemberKind,
    joined: ReadonlyArray<{
      deliveryProjectId: string;
      repositoriesQueued: number;
    }>,
  ): Promise<void> {
    for (const { deliveryProjectId, repositoriesQueued } of joined) {
      await this.auditEventsService.recordProjectEvent({
        workspaceId: groupId,
        actorUserId: actingUserId,
        eventCode: HIERARCHY_EVENT_CODES.deliveryProjectMemberAdded,
        message: `Project member added (${memberKind})`,
        metadata: {
          deliveryProjectId,
          targetUserId,
          memberKind,
          repositoriesQueued,
        },
      });
    }
  }

  /** The GitHub side of joining Projects, for the UI to report. */
  githubAccessOutcome(repositoriesQueued: number): MemberGithubAccessOutcome {
    return this.outcome(this.isLive(), repositoriesQueued);
  }

  private async assertProjectsOpenInTeam(
    groupId: string,
    deliveryProjectIds: readonly string[],
  ): Promise<void> {
    for (const deliveryProjectId of deliveryProjectIds) {
      const project =
        await this.deliveryProjectsRepository.findById(deliveryProjectId);
      // Another team's Project reads as missing, as hierarchy reads do.
      if (project?.groupId !== groupId) {
        throw new NotFoundException('Delivery project not found');
      }
      if (project.status !== 'active') {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'PROJECT_ARCHIVED',
          message: `The Project "${project.name}" is archived and cannot take new members.`,
        });
      }
    }
  }

  private async memberKindOrThrow(
    userId: string,
  ): Promise<DeliveryProjectMemberKind> {
    const memberKind = memberKindForRole(
      await this.appRoleLookup.findAppRole(userId),
    );
    if (!memberKind) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'PROJECT_MEMBER_ROLE_NOT_ALLOWED',
        message:
          'Only Developers and the QA Team are added to a Project; leads and admins already see every Project of the team.',
      });
    }
    return memberKind;
  }

  /**
   * Removes the person from the Project and queues a revoke for the access it
   * gave them. A repository the person created themselves keeps its grant:
   * that is the creator rule, and it only ends when they leave the TEAM
   * (GroupsService.removeMember revokes every assignment in the team).
   */
  async removeMember(
    deliveryProjectId: string,
    actingUserId: string,
    targetUserId: string,
  ): Promise<DeliveryProjectMemberChange> {
    const { groupId } = await this.accessService.assertDeliveryProjectManager(
      deliveryProjectId,
      actingUserId,
    );
    const { member, queued } = await this.databaseService.withTransaction(
      async (client) => {
        const removed = await this.membersRepository.markRemovedWithClient(
          client,
          deliveryProjectId,
          targetUserId,
        );
        if (!removed) {
          throw new NotFoundException({
            statusCode: 404,
            error: 'Not Found',
            code: 'PROJECT_MEMBER_NOT_FOUND',
            message: 'That person is not a member of this Project.',
          });
        }
        let count = 0;
        if (removed.memberKind === 'developer') {
          const assignments =
            await this.assignmentsRepository.listAssignedForUserInDeliveryProjectWithClient(
              client,
              deliveryProjectId,
              targetUserId,
            );
          for (const assignment of assignments) {
            if (assignment.repositoryCreatedBy === targetUserId) continue;
            await this.githubSyncService.requestRevokeWithClient(
              client,
              assignment.assignmentId,
              actingUserId,
            );
            count += 1;
          }
        }
        return { member: removed, queued: count };
      },
    );

    await this.auditEventsService.recordProjectEvent({
      workspaceId: groupId,
      actorUserId: actingUserId,
      eventCode: HIERARCHY_EVENT_CODES.deliveryProjectMemberRemoved,
      message: `Project member removed (${member.memberKind})`,
      metadata: {
        deliveryProjectId,
        targetUserId,
        memberKind: member.memberKind,
        repositoriesQueued: queued,
      },
    });

    return { member, githubAccess: this.outcome(this.isLive(), queued) };
  }

  /**
   * Re-runs the grant fan-out for every active Developer of the Project, on
   * the repositories ALPHACI created (attached ones are skipped).
   * Idempotent: live assignments are skipped, failed or revoked ones are
   * reset. The way to backfill access after live sync is switched on.
   */
  async resyncDevelopers(
    deliveryProjectId: string,
    actingUserId: string,
  ): Promise<
    { items: DeliveryProjectMemberRecord[] } & MemberGithubAccessOutcome
  > {
    const { groupId } = await this.accessService.assertDeliveryProjectManager(
      deliveryProjectId,
      actingUserId,
    );
    if (!this.isLive()) {
      throw new ServiceUnavailableException(
        'Repository access is unavailable until live GitHub synchronization is enabled',
      );
    }
    const queued = await this.databaseService.withTransaction(
      async (client) => {
        const developerIds =
          await this.membersRepository.listActiveDeveloperUserIdsWithClient(
            client,
            deliveryProjectId,
          );
        let count = 0;
        for (const developerId of developerIds) {
          if (!(await this.canReceiveGrant(groupId, developerId))) continue;
          count += await this.grantDeveloperOnProjectRepositoriesWithClient(
            client,
            deliveryProjectId,
            developerId,
            actingUserId,
          );
        }
        return count;
      },
    );
    return {
      items: await this.membersRepository.listActive(deliveryProjectId),
      syncMode: 'live',
      repositoriesQueued: queued,
    };
  }

  /**
   * Who holds GitHub Write on a repository ALPHACI created through an
   * assignment, yet is neither its creator nor a Developer member of the
   * Project it is moving into. Those people got their access through the
   * Project the repository is leaving, so the move would leave it with someone
   * who belongs to neither Project. Empty while live sync is off, and for an
   * attached repository, whose access is only ever set by hand.
   */
  async listAccessLostOnMove(input: {
    repositoryId: string;
    createdBy: string | null;
    targetDeliveryProjectId: string;
  }): Promise<MoveAccessPerson[]> {
    if (!this.isLive()) return [];
    if (
      !(await this.repositoriesRepository.isCreatedByAlphaci(
        input.repositoryId,
      ))
    ) {
      return [];
    }
    const [assigned, targetMembers] = await Promise.all([
      this.assignmentsRepository.listAssignedPeopleForRepository(
        input.repositoryId,
      ),
      this.membersRepository.listActive(input.targetDeliveryProjectId),
    ]);
    const keeps = new Set(
      targetMembers
        .filter((member) => member.memberKind === 'developer')
        .map((member) => member.userId),
    );
    if (input.createdBy) keeps.add(input.createdBy);
    return assigned.filter((person) => !keeps.has(person.userId));
  }

  /**
   * Moves the repository and queues the revokes in one transaction, so a
   * failure leaves it where it was with everyone's access intact. Returns
   * false when someone else moved it first.
   */
  async moveRepositoryRevokingAccess(input: {
    repositoryId: string;
    fromDeliveryProjectId: string;
    toDeliveryProjectId: string;
    revoke: readonly MoveAccessPerson[];
    actingUserId: string;
  }): Promise<boolean> {
    return this.databaseService.withTransaction(async (client) => {
      const moved =
        await this.repositoriesRepository.moveToDeliveryProjectWithClient(
          client,
          input.repositoryId,
          input.fromDeliveryProjectId,
          input.toDeliveryProjectId,
        );
      if (!moved) return false;
      for (const person of input.revoke) {
        await this.githubSyncService.requestRevokeWithClient(
          client,
          person.assignmentId,
          input.actingUserId,
        );
      }
      return true;
    });
  }

  /**
   * A repository just landed in a Project (created, linked, or moved in):
   * grant its creator (when a Developer) and every active Developer member.
   *
   * Only for repositories ALPHACI created (hierarchy.repositories.origin =
   * 'created'); attached repositories and moves grant nothing.
   *
   * A system action: no manager check, because the caller already passed the
   * create/move gate. canBeAssignedRepository and team membership are still
   * enforced per person. Does nothing unless live sync is on (stub mode makes
   * no GitHub grants; `resyncDevelopers` backfills later). Returns the number
   * of assignments queued.
   */
  async grantForRepository(input: {
    repositoryId: string;
    deliveryProjectId: string;
    /** Who created the repository, when they should get Write on it. */
    creatorUserId?: string | null;
    assignedBy: string;
  }): Promise<number> {
    if (!this.isLive()) return 0;
    // Automatic grants only for a repository ALPHACI created. An attached
    // (pre-existing) repository never gets one, whatever calls this.
    if (
      !(await this.repositoriesRepository.isCreatedByAlphaci(
        input.repositoryId,
      ))
    ) {
      return 0;
    }
    const groupId =
      await this.deliveryProjectsRepository.findGroupIdForDeliveryProject(
        input.deliveryProjectId,
      );
    if (!groupId) return 0;

    const queued = await this.databaseService.withTransaction(
      async (client) => {
        const targets = new Set(
          await this.membersRepository.listActiveDeveloperUserIdsWithClient(
            client,
            input.deliveryProjectId,
          ),
        );
        if (input.creatorUserId) targets.add(input.creatorUserId);

        let count = 0;
        for (const userId of targets) {
          if (!(await this.canReceiveGrant(groupId, userId))) continue;
          const live =
            await this.assignmentsRepository.listLiveRepositoryIdsForUserWithClient(
              client,
              userId,
              [input.repositoryId],
            );
          if (live.has(input.repositoryId)) continue;
          await this.githubSyncService.createAssignmentAndRequestGrantWithClient(
            client,
            {
              repositoryId: input.repositoryId,
              userId,
              assignedBy: input.assignedBy,
            },
          );
          count += 1;
        }
        return count;
      },
    );

    if (queued > 0) {
      await this.auditEventsService.recordProjectEvent({
        workspaceId: groupId,
        actorUserId: input.assignedBy,
        eventCode: HIERARCHY_EVENT_CODES.assignmentRequested,
        message: 'Repository access requested for the Project members',
        metadata: {
          repositoryId: input.repositoryId,
          deliveryProjectId: input.deliveryProjectId,
          assignmentsQueued: queued,
        },
      });
    }
    return queued;
  }

  /** Best-effort wrapper for creation paths: a bookkeeping failure must not undo a provisioned repository. */
  async grantForNewRepositoryBestEffort(
    input: Parameters<DeliveryProjectMembersService['grantForRepository']>[0],
  ): Promise<void> {
    try {
      await this.grantForRepository(input);
    } catch (error) {
      this.logger.warn(
        `Could not queue Project member access for repository ${input.repositoryId}: ${
          error instanceof Error ? error.message : JSON.stringify(error)
        }. Run POST /delivery-projects/${input.deliveryProjectId}/members/sync to retry.`,
      );
    }
  }

  private async grantDeveloperOnProjectRepositoriesWithClient(
    client: Pick<PoolClient, 'query'>,
    deliveryProjectId: string,
    developerUserId: string,
    assignedBy: string,
  ): Promise<number> {
    const repositories =
      await this.repositoriesRepository.listActiveForGrantWithClient(
        client,
        deliveryProjectId,
      );
    const live =
      await this.assignmentsRepository.listLiveRepositoryIdsForUserWithClient(
        client,
        developerUserId,
        repositories.map((repository) => repository.id),
      );
    let count = 0;
    for (const repository of repositories) {
      if (live.has(repository.id)) continue;
      await this.githubSyncService.createAssignmentAndRequestGrantWithClient(
        client,
        { repositoryId: repository.id, userId: developerUserId, assignedBy },
      );
      count += 1;
    }
    return count;
  }

  /** Active team member whose global role may hold a repository assignment. */
  private async canReceiveGrant(
    groupId: string,
    userId: string,
  ): Promise<boolean> {
    const membership = await this.groupsRepository.findActiveMembership(
      groupId,
      userId,
    );
    if (!membership) return false;
    const role = await this.appRoleLookup.findAppRole(userId);
    return Boolean(role) && canBeAssignedRepository(role);
  }

  private isLive(): boolean {
    return (
      this.configService.getOrThrow<AppConfig>('app').hierarchy
        .githubSyncMode === 'live'
    );
  }

  private outcome(live: boolean, queued: number): MemberGithubAccessOutcome {
    return {
      syncMode: live ? 'live' : 'stub',
      repositoriesQueued: queued,
    };
  }
}
