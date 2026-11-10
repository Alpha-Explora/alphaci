/**
 * Groups (the product's "Teams") and their members.
 *
 * GET /groups returns Group[] (the caller's groups; every group for a platform
 * admin). POST /groups, GET /groups/:groupId and PATCH /groups/:groupId return
 * one Group. GET /groups/:groupId/members returns GroupMember[].
 *
 * `role` on a Group is the CALLER's role in it. Every route above sends it,
 * the update, archive, reopen and transfer responses included: a client that
 * replaces its copy of the group with a response reads its permissions from it.
 */

/**
 * A member's tier in one group (`orgs.workspace_members.role`). The wire value
 * `admin` is the top tier, labelled "Lead". It is unrelated to the platform
 * admin tier and to the global AppRole of the same name.
 */
export type GroupRole = 'admin' | 'delegated_lead' | 'member' | 'viewer';

export type LifecycleStatus = 'active' | 'archived';

/** `invited` survives only on historical rows; members are added directly. */
export type MemberStatus = 'invited' | 'active' | 'removed';

/** A person's global persona (`identity.app_users.app_role`). */
export type MemberAppRole = 'admin' | 'lead' | 'qa' | 'member';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  businessUnit: string | null;
  status: LifecycleStatus;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt: string;
  role: GroupRole;
  /** Active members. */
  memberCount: number;
  /** Active systems. */
  systemCount: number;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: GroupRole;
  /** Null where the query does not select it. */
  appRole: MemberAppRole | null;
  memberStatus: MemberStatus;
  login: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  invitedBy: string | null;
  invitedAt: string | null;
  removedAt: string | null;
  removedBy: string | null;
  removalReason: string | null;
  createdAt: string;
}
