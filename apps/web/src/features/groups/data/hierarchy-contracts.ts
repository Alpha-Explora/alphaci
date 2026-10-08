/**
 * Hierarchy & Access — shared FE contract types.
 *
 * SINGLE SOURCE OF TRUTH on the FE for the Groups / Systems / Delivery Projects /
 * Repositories / Assignments / Configuration surfaces. Every enum below is copied
 * VERBATIM from HIERARCHY_IMPLEMENTATION_PLAN.md §2.2 (case-sensitive). Do not add
 * FE-only synonym states — if the backend adds a value, mirror it here first.
 *
 * Field naming follows the codebase's established JSON convention (camelCase, ISO
 * 8601 timestamp strings, UUID id strings) — see WorkspaceMemberSummary in
 * contracts.ts. Request-body DTOs and the few response shapes the plan pins
 * (GroupActivityItem §2.8, configuration GET §2.7) match the plan exactly. Other
 * response shapes are inferred from the plan's DB columns using the same
 * convention and are documented as the shared FE↔BE assumption in docs/UI_LAYOUTS.md.
 */

import type {
  AppRole,
  DeploymentProvisioningRequest,
  DeploymentProvisioningResult,
  WorkspaceRole,
} from "@/shared/api/contracts";

/**
 * Create capability (systems, delivery projects, repositories) is governed by
 * the GLOBAL app_role assigned in the Admin Console — only 'admin'/'lead' may
 * create; 'member' is read-/assigned-only. This is intentionally NOT the
 * per-group membership tier (see isGroupManagerRole). Mirrors the backend
 * HierarchyAccessService.assertCanCreate* gate (2026-07-14).
 */
export function isGlobalCreatorRole(appRole: AppRole | null | undefined): boolean {
  return appRole === "admin" || appRole === "lead";
}

/* ── Role wire values + display labels (plan §2.1) ─────────────────────────── */

/**
 * The wire value is ALWAYS one of the existing 4-tier workspace roles. "Group" is
 * a product label over orgs.workspaces(kind='team'); the role enum is unchanged.
 */
// 'admin' | 'delegated_lead' | 'member' | 'viewer'
// NOTE (plan §2.1, confirmed 2026-07-14): the wire value 'admin' denotes the TOP
// membership tier here (product label "Lead"). It is unrelated to the separate
// identity.platform_admins 'admin'/'super_admin' tier — same string, different
// system. Do not conflate the two when reading/writing this type.
export type GroupRole = WorkspaceRole;

/**
 * Roles a lead may grant when adding someone — ownership only moves via
 * transfer, so 'admin' is never grantable.
 */
export type GrantableRole = Exclude<GroupRole, "admin">; // 'delegated_lead' | 'member' | 'viewer'

/**
 * Display-label mapping (plan §2.1). The UI must render these labels, never the
 * raw enum. Mirror of the constant the backend exports — kept in sync by hand
 * since this repo has no shared FE/BE types package.
 * `admin` here = top membership tier ("Lead"), NOT identity.platform_admins.
 */
export const GROUP_ROLE_LABELS: Record<GroupRole, string> = {
  admin: "Lead",
  delegated_lead: "Delegated lead",
  member: "Member",
  viewer: "Viewer",
};

/**
 * The role a team roster shows for a member. Roles come from the global app
 * role, not from anything chosen on the roster, so this derives the label the
 * way the backend derives the team role: lead/admin -> Lead, qa -> QA Team,
 * member -> Developer. A row that carries no app role falls back to its stored
 * team-role label.
 */
export function memberRoleLabel(member: {
  role: GroupRole;
  appRole?: AppRole | null;
}): string {
  switch (member.appRole) {
    case "admin":
    case "lead":
      return "Lead";
    case "qa":
      return "QA Team";
    case "member":
      return "Developer";
    default:
      return GROUP_ROLE_LABELS[member.role];
  }
}

/** Ranks (plan §2.1) — used only for sorting/derived UI, never sent on the wire. */
export const GROUP_ROLE_RANK: Record<GroupRole, number> = {
  admin: 4,
  delegated_lead: 3,
  member: 2,
  viewer: 1,
};

/**
 * Manager tier (top tier 'admin' aka "Lead" | 'delegated_lead') may create/manage;
 * member|viewer are read-only.
 */
export function isGroupManagerRole(role: GroupRole | null | undefined): boolean {
  return role === "admin" || role === "delegated_lead";
}

/* ── Enum strings — copied verbatim from plan §2.2 ─────────────────────────── */

export type GroupStatus = "active" | "archived";
/**
 * 'invited' is retained only for historical rows — members are added directly,
 * so nothing produces it now.
 */
export type GroupMemberStatus = "invited" | "active" | "removed";

export type SystemStatus = "active" | "archived";
export type DeliveryProjectStatus = "active" | "archived";
export type RepositoryStatus = "pending" | "active" | "archived";

export type AssignmentDesiredState = "assigned" | "unassigned";
export type AssignmentEffectiveState =
  | "unknown"
  | "pending"
  | "active"
  | "revoking"
  | "revoked"
  | "failed";
/** Denormalized convenience field the UI badges bind to (plan §1.6). */
export type AssignmentStatus = "pending" | "active" | "revoked" | "failed";

export type GithubSyncState =
  | "pending"
  | "syncing"
  | "verified"
  | "failed"
  | "drift_detected";

export type ConfigurationEnvironmentScope = "non_production" | "production";
export type ConfigurationType = "variable" | "secret";
export type ConfigurationAction = "create" | "update" | "delete";
export type ConfigurationApprovalState =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected";
export type ConfigurationGithubSyncState = "pending" | "synced" | "failed";

/** Activity feed target/link discriminators (plan §2.8). */
export type GroupActivityTargetType =
  | "group"
  | "system"
  | "delivery_project"
  | "repository"
  | "assignment"
  | "configuration";
export type GroupActivityType =
  | "assignment"
  | "configuration"
  | "membership"
  | "github";
export type GroupActivityGithubLinkType =
  | "commit"
  | "pull_request"
  | "workflow_run"
  | "deployment";

/* ── Groups (plan §2.4) ────────────────────────────────────────────────────── */

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  businessUnit: string | null;
  status: GroupStatus;
  /** The CALLER's role in this group — drives role-conditional rendering. */
  role: GroupRole;
  /** Caller's own membership lifecycle state. */
  memberStatus: GroupMemberStatus;
  memberCount: number;
  systemCount: number;
  createdAt: string;
  archivedAt: string | null;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  businessUnit?: string;
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  businessUnit?: string;
}

export interface TransferGroupRequest {
  newManagerUserId: string;
}

export interface InternalUserDirectoryEntry {
  /** Null when this GitHub org member has never signed into AlphaCI. */
  id: string | null;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  /** True only when the org member has an AlphaCI account and can be invited. */
  hasAccount: boolean;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: GroupRole;
  memberStatus: GroupMemberStatus;
  login: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  /** The member's global app role, when the backend reports it. */
  appRole?: AppRole | null;
  invitedBy: string | null;
  invitedAt: string | null;
  removedAt: string | null;
  removedBy: string | null;
  removalReason: string | null;
  createdAt: string;
}

export interface AddGroupMemberRequest {
  userId: string;
  /** Defaults to 'member'. 'admin' is not grantable — ownership moves via transfer. */
  role?: GrantableRole;
}

/* ── Systems & Delivery Projects (plan §2.5) ───────────────────────────────── */

export interface HierarchySystem {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  status: SystemStatus;
  deliveryProjectCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSystemRequest {
  name: string;
  description?: string;
}

export interface UpdateSystemRequest {
  name?: string;
  description?: string;
}

export interface DeliveryProject {
  id: string;
  systemId: string;
  groupId: string;
  name: string;
  description: string | null;
  status: DeliveryProjectStatus;
  repositoryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeliveryProjectRequest {
  name: string;
  description?: string;
}

export interface UpdateDeliveryProjectRequest {
  name?: string;
  description?: string;
}

/* ── Repositories & Assignments (plan §2.6) ────────────────────────────────── */

export interface HierarchyRepository {
  id: string;
  deliveryProjectId: string;
  name: string;
  status: RepositoryStatus;
  visibility: "private";
  /** null until the paired provisioned_projects row is created/linked (plan §1.5). */
  provisionedProjectId: string | null;
  repoFullName: string | null;
  htmlUrl: string | null;
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * "Add repository" inside a Project (POST /delivery-projects/:id/repositories).
 * The same setup the create wizard runs for one repository, so `projectTypeId`
 * (a stack from GET /catalog/project-options) is required. An omitted
 * `deploymentProvisioning` means the managed defaults: frontend stacks on
 * Vercel, backend stacks on Render.
 */
export interface CreateRepositoryRequest {
  name: string;
  projectTypeId: string;
  /** The UI sends 'private'; the backend also accepts 'public', as the wizard does. */
  visibility?: "private" | "public";
  workflowRecipeId?: string;
  serviceName?: string;
  repoShape?: "standalone" | "mono" | "monorepo";
  servicePath?: string;
  nodeVersion?: string;
  coverageThreshold?: number;
  tests?: Partial<Record<string, boolean>>;
  outputFileName?: string;
  deploymentProvisioning?: DeploymentProvisioningRequest;
}

/** What the hosting step of "Add repository" did. `skipped` = none requested. */
export type RepositoryHostingOutcome = "provisioned" | "partial" | "failed" | "skipped";

export interface RepositoryHostingFailure {
  slot: string;
  provider: string;
  reason: string;
}

/** The repository row plus how its setup went. A hosting failure does not fail the create. */
export interface CreatedRepositoryResponse extends HierarchyRepository {
  provisioning: {
    projectId: string;
    repoFullName: string;
    repoUrl: string;
    workflowPath: string;
    branchesCreated: string[];
    hosting: {
      outcome: RepositoryHostingOutcome;
      failures: RepositoryHostingFailure[];
    };
    deploymentProvisioning?: DeploymentProvisioningResult;
  };
}

/* ── Project members (delivery-project membership + its GitHub access) ────── */

/** Derived server-side from the app role: member -> developer, qa -> qa. */
export type DeliveryProjectMemberKind = "developer" | "qa";

export interface DeliveryProjectMember {
  id: string;
  deliveryProjectId: string;
  userId: string;
  memberKind: DeliveryProjectMemberKind;
  status: "active" | "removed";
  addedBy: string | null;
  createdAt: string;
  updatedAt: string;
  login: string | null;
  name: string | null;
  avatarUrl: string | null;
}

/** The GitHub side of a membership change. `stub`: nothing is granted yet. */
export interface ProjectMemberGithubAccess {
  syncMode: "live" | "stub";
  /** Repositories a grant (add) or a revoke (remove) was queued for. */
  repositoriesQueued: number;
}

export interface ProjectMembersResponse {
  items: DeliveryProjectMember[];
}

export interface ProjectMemberChangeResponse {
  member: DeliveryProjectMember;
  githubAccess: ProjectMemberGithubAccess;
}

export interface ProjectMembersSyncResponse {
  items: DeliveryProjectMember[];
  syncMode: "live";
  repositoriesQueued: number;
}

export interface UpdateRepositoryRequest {
  name?: string;
}

export interface RepositoryAssignment {
  id: string;
  repositoryId: string;
  userId: string;
  login: string | null;
  name: string | null;
  avatarUrl: string | null;
  desiredState: AssignmentDesiredState;
  effectiveState: AssignmentEffectiveState;
  status: AssignmentStatus;
  accessLevel: "write";
  assignedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssignmentRequest {
  userId: string;
  /** Defaults to 'write' — the only level the plan defines this session. */
  accessLevel?: "write";
}

/**
 * One github_access_sync row per assignment (plan §2.6 access-status).
 * `isHighPriorityFailure` is derived per plan §1.6:
 * sync_state='failed' AND desired_state='unassigned' (a failed REVOCATION).
 */
export interface RepositoryAccessStatus {
  assignmentId: string;
  repositoryId: string;
  userId: string;
  login: string | null;
  name: string | null;
  desiredState: AssignmentDesiredState;
  effectiveState: AssignmentEffectiveState;
  status: AssignmentStatus;
  syncState: GithubSyncState;
  githubTeamSlug: string | null;
  lastError: string | null;
  retryCount: number;
  lastSyncedAt: string | null;
  isHighPriorityFailure: boolean;
}

export interface RepositoryAccessStatusResponse {
  items: RepositoryAccessStatus[];
}

/* ── Configuration broker (plan §2.7) ──────────────────────────────────────── */

/** Names + metadata only — never a value (mirrors env-vars listEnvMetadata). */
export interface ConfigurationItemMetadata {
  name: string;
  environmentScope: ConfigurationEnvironmentScope;
  updatedAt: string;
}

export interface RepositoryConfigurationResponse {
  variables: ConfigurationItemMetadata[];
  secrets: ConfigurationItemMetadata[];
}

export interface PutConfigurationValueRequest {
  value: string;
  environmentScope: ConfigurationEnvironmentScope;
}

export interface ConfigurationWriteResponse {
  name: string;
  configurationType: ConfigurationType;
  environmentScope: ConfigurationEnvironmentScope;
  action: ConfigurationAction;
  githubSyncState: ConfigurationGithubSyncState;
  updatedAt: string;
  /** NEVER contains the written value. */
}

/* ── Developer surface (plan §2.6 /me/*) ───────────────────────────────────── */

export interface MyAssignedRepository {
  assignmentId: string;
  repositoryId: string;
  repositoryName: string;
  repoFullName: string | null;
  htmlUrl: string | null;
  deliveryProjectId: string | null;
  deliveryProjectName: string | null;
  systemId: string | null;
  systemName: string | null;
  groupId: string | null;
  groupName: string | null;
  status: AssignmentStatus;
  effectiveState: AssignmentEffectiveState;
  accessLevel: "write";
  updatedAt: string;
}

export interface MyAssignedRepositoriesResponse {
  items: MyAssignedRepository[];
}

export interface MyGroupsResponse {
  items: GroupSummary[];
}

/* ── Activity feed (plan §2.8 — item shape VERBATIM) ───────────────────────── */

export interface GroupActivityGithubLink {
  type: GroupActivityGithubLinkType;
  url: string;
}

export interface GroupActivityItem {
  id: string;
  eventCode: string;
  message: string;
  actorUserId: string | null;
  actorLabel: string;
  targetType: GroupActivityTargetType;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  githubLink?: GroupActivityGithubLink;
}

/** Query params for GET /groups/:groupId/activity (plan §2.8). */
export interface GroupActivityQuery {
  memberId?: string;
  systemId?: string;
  deliveryProjectId?: string;
  repositoryId?: string;
  activityType?: GroupActivityType;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  cursor?: string;
  limit?: number;
}

export interface GroupActivityResponse {
  items: GroupActivityItem[];
  nextCursor: string | null;
}

/* ── Capability gate (plan §3.2) ───────────────────────────────────────────── */

export type HierarchyGithubSyncMode = "stub" | "live";

export interface HierarchyCapability {
  enabled: boolean;
  githubSyncMode: HierarchyGithubSyncMode;
}
