import type { Group, GroupMember } from '@alphaci/api-contracts';
import { ConflictException, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { DatabaseService, type SqlExecutor } from '#kernel/db/database.service';
import type {
  GroupRole,
  LifecycleStatus,
  MemberStatus,
} from '../domain/hierarchy.types';

/**
 * A group as a query leaves it. `role` (the caller's) is only there when the
 * query joins the caller; the services add it before anything is sent, and
 * send a `Group`, which @alphaci/api-contracts defines.
 */
export type GroupRecord = Omit<Group, 'role'> & { role?: GroupRole };

/** The wire shape of a group member; defined once in @alphaci/api-contracts. */
export type GroupMemberRecord = GroupMember;

function archivedGroupConflict(): ConflictException {
  return new ConflictException({
    code: 'GROUP_ARCHIVED',
    message: 'Reopen this group before making changes.',
  });
}

/** Holds the group's lifecycle state steady until the dependent write commits. */
export async function requireActiveGroup(
  client: SqlExecutor,
  groupId: string,
): Promise<void> {
  const result = await client.query<{ status: LifecycleStatus }>(
    "SELECT status FROM orgs.workspaces WHERE id = $1 AND kind = 'team' FOR SHARE",
    [groupId],
  );
  if (result.rows[0]?.status === 'archived') throw archivedGroupConflict();
}

export interface ActiveMembership {
  workspaceId: string;
  userId: string;
  role: GroupRole;
  memberId: string;
}

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  business_unit: string | null;
  status: LifecycleStatus;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  role?: GroupRole;
}

export type MemberAppRole = 'admin' | 'lead' | 'qa' | 'member';

interface MemberRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: GroupRole;
  app_role?: MemberAppRole | null;
  member_status: MemberStatus;
  login: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  invited_by: string | null;
  invited_at: string | null;
  removed_at: string | null;
  removed_by: string | null;
  removal_reason: string | null;
  created_at: string;
}

@Injectable()
export class GroupsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createGroup(input: {
    name: string;
    description?: string | null;
    businessUnit?: string | null;
    creatorUserId: string;
  }): Promise<GroupRecord> {
    return this.databaseService.withClient(async (client) => {
      await client.query('BEGIN');
      try {
        const result = await client.query<GroupRow>(
          `
            INSERT INTO orgs.workspaces (owner_user_id, name, kind, description, business_unit, status)
            VALUES ($1, $2, 'team', $3, $4, 'active')
            RETURNING id, name, description, business_unit, status, archived_at, archived_by, created_at;
          `,
          [
            input.creatorUserId,
            input.name,
            input.description ?? null,
            input.businessUnit ?? null,
          ],
        );
        const row = result.rows[0];
        if (!row) {
          throw new Error('Group insert did not return a row');
        }
        await client.query(
          `
            INSERT INTO orgs.workspace_members (workspace_id, user_id, role, member_status)
            VALUES ($1, $2, 'admin', 'active');
          `,
          [row.id, input.creatorUserId],
        );
        await client.query('COMMIT');
        return this.toGroup(row, { memberCount: 1, systemCount: 0 });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  /**
   * Moves the team's ownership (orgs.workspaces.owner_user_id) to an active
   * member. What a person may do in the team comes from their app role, not
   * from a stored team role, so nothing else changes. False when the target
   * is not an active member.
   */
  async transferOwner(
    groupId: string,
    newOwnerUserId: string,
  ): Promise<boolean> {
    const result = await this.databaseService.query(
      `
        UPDATE orgs.workspaces AS workspace
        SET owner_user_id = $2, updated_at = NOW()
        WHERE workspace.id = $1
          AND workspace.kind = 'team'
          AND EXISTS (
            SELECT 1 FROM orgs.workspace_members AS member
            WHERE member.workspace_id = $1
              AND member.user_id = $2
              AND member.member_status = 'active'
          );
      `,
      [groupId, newOwnerUserId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listForUser(userId: string): Promise<Group[]> {
    const result = await this.databaseService.query<GroupRow>(
      `
        SELECT
          workspace.id, workspace.name, workspace.description, workspace.business_unit,
          workspace.status, workspace.archived_at, workspace.archived_by, workspace.created_at,
          CASE WHEN app_user.app_role IN ('admin', 'lead') THEN 'admin' ELSE 'member' END AS role
        FROM orgs.workspace_members AS member
        JOIN orgs.workspaces AS workspace ON workspace.id = member.workspace_id
        JOIN identity.app_users AS app_user ON app_user.id = member.user_id
        WHERE member.user_id = $1
          AND member.member_status = 'active'
          AND workspace.kind = 'team'
        ORDER BY workspace.created_at ASC;
      `,
      [userId],
    );
    const counts = await this.getCountsForGroups(
      result.rows.map((row) => row.id),
    );
    return result.rows.map((row) =>
      this.toGroupForCaller(row, counts.get(row.id)),
    );
  }

  async listAllGroups(): Promise<Group[]> {
    const result = await this.databaseService.query<GroupRow>(
      `
        SELECT id, name, description, business_unit, status, archived_at, archived_by, created_at,
          'admin'::text AS role
        FROM orgs.workspaces
        WHERE kind = 'team'
        ORDER BY created_at DESC;
      `,
    );
    const counts = await this.getCountsForGroups(
      result.rows.map((row) => row.id),
    );
    return result.rows.map((row) =>
      this.toGroupForCaller(row, counts.get(row.id)),
    );
  }

  async findGroupById(groupId: string): Promise<GroupRecord | null> {
    const result = await this.databaseService.query<GroupRow>(
      `
        SELECT id, name, description, business_unit, status, archived_at, archived_by, created_at
        FROM orgs.workspaces
        WHERE id = $1 AND kind = 'team';
      `,
      [groupId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const counts = await this.getCountsForGroups([row.id]);
    return this.toGroup(row, counts.get(row.id));
  }

  /**
   * Active-member / active-system counts for the "at a glance" chips on
   * GroupSummary (current hierarchy summary contract) — batched by group id to stay N+1-free
   * when called from listForUser.
   */
  private async getCountsForGroups(
    groupIds: string[],
  ): Promise<Map<string, { memberCount: number; systemCount: number }>> {
    if (groupIds.length === 0) return new Map();
    const result = await this.databaseService.query<{
      group_id: string;
      member_count: number;
      system_count: number;
    }>(
      `
        SELECT
          workspace.id AS group_id,
          (SELECT count(*)::int FROM orgs.workspace_members m
             JOIN identity.app_users u ON u.id = m.user_id
             WHERE m.workspace_id = workspace.id AND m.member_status = 'active'
               AND u.archived_at IS NULL) AS member_count,
          (SELECT count(*)::int FROM hierarchy.systems s
             WHERE s.group_id = workspace.id AND s.status = 'active') AS system_count
        FROM orgs.workspaces AS workspace
        WHERE workspace.id = ANY($1::uuid[]);
      `,
      [groupIds],
    );
    return new Map(
      result.rows.map((row) => [
        row.group_id,
        { memberCount: row.member_count, systemCount: row.system_count },
      ]),
    );
  }

  /** Active membership only — the choke point every group-scoped authz check uses. */
  async findActiveMembership(
    groupId: string,
    userId: string,
  ): Promise<ActiveMembership | null> {
    const result = await this.databaseService.query<{
      id: string;
      workspace_id: string;
      user_id: string;
      role: GroupRole;
    }>(
      `
        SELECT
          member.id, member.workspace_id, member.user_id,
          -- Effective group role is derived from the user's GLOBAL app_role
          -- (single source of truth) — 'admin'/'lead' act as group managers,
          -- every other role ('qa', 'member') does not. Allow-list, never exclusion:
          -- a new app_role value must not fall into the manager branch.
          -- The stored member.role is no longer authoritative.
          CASE WHEN app_user.app_role IN ('admin', 'lead') THEN 'admin' ELSE 'member' END AS role
        FROM orgs.workspace_members AS member
        JOIN orgs.workspaces AS workspace ON workspace.id = member.workspace_id
        JOIN identity.app_users AS app_user ON app_user.id = member.user_id
        WHERE member.workspace_id = $1
          AND member.user_id = $2
          AND member.member_status = 'active'
          AND app_user.archived_at IS NULL
          AND workspace.kind = 'team';
      `,
      [groupId, userId],
    );
    const row = result.rows[0];
    return row
      ? {
          workspaceId: row.workspace_id,
          userId: row.user_id,
          role: row.role,
          memberId: row.id,
        }
      : null;
  }

  async updateGroup(
    groupId: string,
    input: {
      name?: string;
      description?: string | null;
      businessUnit?: string | null;
    },
  ): Promise<GroupRecord | null> {
    const result = await this.databaseService.query<GroupRow>(
      `
        UPDATE orgs.workspaces
        SET
          name = COALESCE($2, name),
          description = CASE WHEN $3::boolean THEN $4 ELSE description END,
          business_unit = CASE WHEN $5::boolean THEN $6 ELSE business_unit END,
          updated_at = NOW()
        WHERE id = $1 AND kind = 'team' AND status = 'active'
        RETURNING id, name, description, business_unit, status, archived_at, archived_by, created_at;
      `,
      [
        groupId,
        input.name ?? null,
        input.description !== undefined,
        input.description ?? null,
        input.businessUnit !== undefined,
        input.businessUnit ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      const group = await this.findGroupById(groupId);
      if (group?.status === 'archived') throw archivedGroupConflict();
      return null;
    }
    const counts = await this.getCountsForGroups([row.id]);
    return this.toGroup(row, counts.get(row.id));
  }

  async setArchiveStatus(
    groupId: string,
    status: LifecycleStatus,
    actingUserId: string,
  ): Promise<GroupRecord | null> {
    const result = await this.databaseService.query<GroupRow>(
      `
        UPDATE orgs.workspaces
        SET
          status = $2,
          archived_at = CASE WHEN $2 = 'archived' THEN COALESCE(archived_at, NOW()) ELSE NULL END,
          archived_by = CASE WHEN $2 = 'archived' THEN COALESCE(archived_by, $3::uuid) ELSE NULL END,
          updated_at = NOW()
        WHERE id = $1 AND kind = 'team'
        RETURNING id, name, description, business_unit, status, archived_at, archived_by, created_at;
      `,
      [groupId, status, actingUserId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const counts = await this.getCountsForGroups([row.id]);
    return this.toGroup(row, counts.get(row.id));
  }

  async listMembers(groupId: string): Promise<GroupMemberRecord[]> {
    const result = await this.databaseService.query<MemberRow>(
      `
        SELECT
          member.id, member.workspace_id, member.user_id,
          CASE WHEN user_profile.app_role IN ('admin', 'lead') THEN 'admin' ELSE 'member' END AS role,
          user_profile.app_role,
          member.member_status,
          member.invited_by, member.invited_at, member.removed_at, member.removed_by, member.removal_reason,
          member.created_at,
          user_profile.login, user_profile.display_name, user_profile.email, user_profile.avatar_url
        FROM orgs.workspace_members AS member
        JOIN identity.app_users AS user_profile ON user_profile.id = member.user_id
        WHERE member.workspace_id = $1 AND user_profile.archived_at IS NULL
        ORDER BY
          CASE member.member_status WHEN 'active' THEN 1 WHEN 'invited' THEN 2 ELSE 3 END,
          CASE WHEN user_profile.app_role IN ('admin', 'lead') THEN 1 ELSE 2 END,
          lower(user_profile.login) ASC;
      `,
      [groupId],
    );
    return result.rows.map((row) => this.toMember(row));
  }

  async findMemberById(
    groupId: string,
    memberId: string,
  ): Promise<GroupMemberRecord | null> {
    const result = await this.databaseService.query<MemberRow>(
      `
        SELECT
          member.id, member.workspace_id, member.user_id, member.role, member.member_status,
          member.invited_by, member.invited_at, member.removed_at, member.removed_by, member.removal_reason,
          member.created_at,
          user_profile.login, user_profile.display_name, user_profile.email, user_profile.avatar_url
        FROM orgs.workspace_members AS member
        JOIN identity.app_users AS user_profile ON user_profile.id = member.user_id
        WHERE member.workspace_id = $1 AND member.id = $2;
      `,
      [groupId, memberId],
    );
    const row = result.rows[0];
    return row ? this.toMember(row) : null;
  }

  /** Offboarding — recorded event, not a hard delete (member-management contract). */
  async markMemberRemoved(
    groupId: string,
    memberId: string,
    removedBy: string,
    reason?: string | null,
  ): Promise<GroupMemberRecord | null> {
    await this.databaseService.query(
      `
        UPDATE orgs.workspace_members
        SET member_status = 'removed', removed_at = NOW(), removed_by = $3, removal_reason = $4
        WHERE workspace_id = $1 AND id = $2;
      `,
      [groupId, memberId, removedBy, reason ?? null],
    );
    return this.findMemberById(groupId, memberId);
  }

  /**
   * Race-free "keep at least one manager" guard for member removal (hierarchy
   * ownership contract "must keep at least one owner"). A manager is an
   * active member whose app role is lead or admin and whose account is not
   * archived: the same rule findActiveMembership authorizes with, so the
   * guard and the permission checks can never disagree. Every active member
   * row of the team is locked first, so two concurrent removals cannot both
   * read "two managers left" and leave none.
   */
  async removeMemberGuarded(
    groupId: string,
    memberId: string,
    removedBy: string,
    reason?: string | null,
  ): Promise<{ member: GroupMemberRecord | null; blockedLastOwner: boolean }> {
    return this.databaseService.withTransaction((client) =>
      this.removeMemberGuardedWithClient(
        client,
        groupId,
        memberId,
        removedBy,
        reason,
      ),
    );
  }

  /**
   * Removes a member against a caller-owned transaction. The caller can use
   * the same transaction to enqueue the member's assignment revokes, so a
   * partial offboarding cannot commit without its durable follow-up work.
   */
  async removeMemberGuardedWithClient(
    client: Pick<PoolClient, 'query'>,
    groupId: string,
    memberId: string,
    removedBy: string,
    reason?: string | null,
  ): Promise<{
    member: GroupMemberRecord | null;
    blockedLastOwner: boolean;
    alreadyRemoved?: true;
  }> {
    await client.query(
      `
        SELECT id FROM orgs.workspace_members
        WHERE workspace_id = $1 AND member_status = 'active'
        FOR UPDATE;
      `,
      [groupId],
    );

    const targetResult = await client.query<MemberRow>(
      `
        SELECT
          member.id, member.workspace_id, member.user_id, member.role, member.member_status,
          member.invited_by, member.invited_at, member.removed_at, member.removed_by, member.removal_reason,
          member.created_at,
          user_profile.login, user_profile.display_name, user_profile.email, user_profile.avatar_url,
          user_profile.app_role
        FROM orgs.workspace_members AS member
        JOIN identity.app_users AS user_profile ON user_profile.id = member.user_id
        WHERE member.workspace_id = $1 AND member.id = $2
        FOR UPDATE OF member;
      `,
      [groupId, memberId],
    );
    const target = targetResult.rows[0];
    if (!target) {
      return { member: null, blockedLastOwner: false };
    }
    if (target.member_status === 'removed') {
      return {
        member: this.toMember(target),
        blockedLastOwner: false,
        alreadyRemoved: true,
      };
    }

    const targetManages =
      target.member_status === 'active' &&
      (target.app_role === 'admin' || target.app_role === 'lead');
    if (targetManages) {
      const countResult = await client.query<{ count: number }>(
        `
          SELECT count(*)::int AS count
          FROM orgs.workspace_members AS member
          JOIN identity.app_users AS app_user ON app_user.id = member.user_id
          WHERE member.workspace_id = $1
            AND member.member_status = 'active'
            AND app_user.app_role IN ('admin', 'lead')
            AND app_user.archived_at IS NULL;
        `,
        [groupId],
      );
      const ownerCount = Number(countResult.rows[0]?.count ?? 0);
      if (ownerCount <= 1) {
        return { member: this.toMember(target), blockedLastOwner: true };
      }
    }

    await client.query(
      `
        UPDATE orgs.workspace_members
        SET member_status = 'removed', removed_at = NOW(), removed_by = $3, removal_reason = $4
        WHERE workspace_id = $1 AND id = $2;
      `,
      [groupId, memberId, removedBy, reason ?? null],
    );

    return {
      member: this.toMember({ ...target, member_status: 'removed' }),
      blockedLastOwner: false,
    };
  }

  /**
   * Grants membership immediately — there is no invitation and no pending
   * state. Upserting on (workspace_id, user_id) makes re-adding a previously
   * removed member a reinstatement rather than a unique violation.
   *
   * invited_by / invited_at keep their column names (renaming them would be a
   * migration for no behavioural gain) but now record who added the member and
   * when.
   */
  async addMemberDirect(
    groupId: string,
    userId: string,
    addedBy: string,
    onAdded?: (
      client: PoolClient,
      context: { groupName: string; actorLogin: string | null },
    ) => Promise<void>,
  ): Promise<boolean> {
    return this.databaseService.withTransaction(async (client) => {
      await requireActiveGroup(client, groupId);
      const added = await client.query<{ id: string }>(
        `
        INSERT INTO orgs.workspace_members (workspace_id, user_id, role, member_status, invited_by, invited_at)
        VALUES ($1, $2, 'member', 'active', $3, NOW())
        ON CONFLICT (workspace_id, user_id)
        DO UPDATE SET role = 'member', member_status = 'active',
          invited_by = EXCLUDED.invited_by, invited_at = EXCLUDED.invited_at,
          removed_at = NULL, removed_by = NULL, removal_reason = NULL
        WHERE workspace_members.member_status <> 'active'
        RETURNING id;
      `,
        [groupId, userId, addedBy],
      );
      if (!added.rows[0]) return false;
      if (onAdded) {
        const context = await client.query<{
          name: string;
          login: string | null;
        }>(
          `SELECT w.name, u.login FROM orgs.workspaces w
         LEFT JOIN identity.app_users u ON u.id = $2 WHERE w.id = $1`,
          [groupId, addedBy],
        );
        const row = context.rows[0];
        if (!row) throw new Error('Added member workspace was not found');
        await onAdded(client, { groupName: row.name, actorLogin: row.login });
      }
      return true;
    });
  }

  /** A listing query selects the caller's role; one that did not is a bug. */
  private toGroupForCaller(
    row: GroupRow,
    counts?: { memberCount: number; systemCount: number },
  ): Group {
    if (!row.role) throw new Error('Group listing did not select a role');
    return { ...this.toGroup(row, counts), role: row.role };
  }

  private toGroup(
    row: GroupRow,
    counts?: { memberCount: number; systemCount: number },
  ): GroupRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      businessUnit: row.business_unit,
      status: row.status,
      archivedAt: row.archived_at,
      archivedBy: row.archived_by,
      createdAt: row.created_at,
      memberCount: counts?.memberCount ?? 0,
      systemCount: counts?.systemCount ?? 0,
      ...(row.role ? { role: row.role } : {}),
    };
  }

  private toMember(row: MemberRow): GroupMemberRecord {
    return {
      id: row.id,
      groupId: row.workspace_id,
      userId: row.user_id,
      role: row.role,
      appRole: row.app_role ?? null,
      memberStatus: row.member_status,
      login: row.login,
      name: row.display_name ?? row.login,
      email: row.email,
      avatarUrl: row.avatar_url,
      invitedBy: row.invited_by ?? null,
      invitedAt: row.invited_at,
      removedAt: row.removed_at,
      removedBy: row.removed_by ?? null,
      removalReason: row.removal_reason ?? null,
      createdAt: row.created_at,
    };
  }

  /**
   * Hard-deletes a Group (team workspace). FK cascades remove its members,
   * invitations, systems, delivery projects and hierarchy repositories; any
   * provisioned_projects rows survive with workspace_id set to NULL (ON DELETE
   * SET NULL), i.e. their GitHub repos are detached to "individual", never
   * destroyed. Returns false when no such team workspace existed.
   */
  async deleteGroup(groupId: string): Promise<boolean> {
    const result = await this.databaseService.query(
      `DELETE FROM orgs.workspaces WHERE id = $1 AND kind = 'team';`,
      [groupId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
