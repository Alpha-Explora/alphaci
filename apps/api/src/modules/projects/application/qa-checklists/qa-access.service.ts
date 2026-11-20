import { Inject, Injectable } from '@nestjs/common';
import {
  DELIVERY_PROJECT_OVERVIEW_QUERY,
  type DeliveryProjectOverviewQuery,
} from '#kernel/ports/delivery-project-overview.port';
import {
  PROJECT_LINK_PORT,
  type ProjectLinkPort,
} from '#kernel/ports/project-link.port';

import {
  ProjectsRepository,
  type ProvisionedProjectRow,
} from '../../infrastructure/projects.repository';
import { canManageRequirements } from '#kernel/rules/persona-access.rules';
import type { PlatformAppRole } from '#kernel/ports/platform-admin.port';
import {
  actingQaRole,
  type SpecialAccess,
} from '#kernel/rules/special-access.rules';

/**
 * Authorization for the QA checklists slice, built entirely on top of
 * ProjectsRepository's existing, already-tested predicates rather than new
 * SQL. This deliberately does NOT use WorkspaceAccessService.assertWorkspaceRole
 * or ProjectsRepository.findByIdAndUser(..., allowedRoles) — both of those
 * read orgs.workspace_members.role (the per-workspace title: admin /
 * delegated_lead / member), which is unrelated to identity.app_users.app_role
 * (the global persona added in Slice 1: admin | lead | qa | member). A
 * workspace's "Lead" for QA-checklist purposes is a global app_role of 'lead'
 * (or 'admin'), scoped down to workspaces they are actually a member of.
 *
 * Contract this enforces (see the controller for where each is applied):
 *   - non-member of the workspace -> 404 (canAccessWorkspace false)
 *   - member but not lead/admin, attempting a write -> 403 (canManage false)
 */
@Injectable()
export class QaAccessService {
  constructor(
    private readonly projectsRepository: ProjectsRepository,
    @Inject(DELIVERY_PROJECT_OVERVIEW_QUERY)
    private readonly overview: DeliveryProjectOverviewQuery,
    @Inject(PROJECT_LINK_PORT)
    private readonly projectLink: ProjectLinkPort,
  ) {}

  /**
   * True for an active member of the workspace, or any global admin. This is
   * the visibility gate: false means the workspace does not exist "for this
   * user", which the caller turns into a 404, not a 403 — a caller who isn't
   * in the workspace should not learn anything about it, including whether
   * checklists exist there.
   */
  async canAccessWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<boolean> {
    return this.projectsRepository.canCreateInWorkspace(userId, workspaceId);
  }

  async canAccessProject(
    userId: string,
    workspaceId: string,
    projectId: string | null,
  ): Promise<boolean> {
    if (!(await this.canAccessWorkspace(userId, workspaceId))) return false;
    if (!projectId || (await this.canManage(userId))) return true;
    return (await this.listMemberProjectIds(userId, [projectId])).has(
      projectId,
    );
  }

  async listMemberProjectIds(
    userId: string,
    projectIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    if (!projectIds.length) return new Set();
    const facts = await this.overview.getOverviewFacts(projectIds, userId);
    return new Set(projectIds.filter((id) => facts.get(id)?.viewerKind));
  }

  async filterProjectRecipients(
    workspaceId: string,
    projectId: string,
    userIds: readonly (string | null)[],
  ): Promise<string[]> {
    const eligible = await Promise.all(
      userIds.map(async (id) =>
        id && (await this.canAccessProject(id, workspaceId, projectId))
          ? id
          : null,
      ),
    );
    return eligible.filter((id) => id !== null);
  }

  /**
   * True for a global admin or lead (canManageRequirements). This is the
   * write gate - independent of who may create repositories. Callers must
   * check canAccessWorkspace() first so a non-member gets 404 rather than a
   * 403 that would leak "this workspace exists, you're just not allowed."
   */
  async canManage(userId: string): Promise<boolean> {
    return canManageRequirements(
      await this.projectsRepository.findAppRole(userId),
    );
  }

  /**
   * Project-level visibility — "anyone who can see the project" — reusing
   * ProjectsRepository's default (no allowedRoles) visibility predicate.
   * Returns the project's workspace_id when visible, or null when the
   * project does not exist or is not visible to this user (both map to 404).
   */
  async findVisibleProjectWorkspace(
    projectId: string,
    userId: string,
  ): Promise<{ workspaceId: string | null } | null> {
    const project = await this.projectsRepository.findByIdAndUser(
      projectId,
      userId,
    );
    if (!project) {
      return null;
    }
    return { workspaceId: project.workspace_id ?? null };
  }

  /**
   * The full project row, when visible to this user (same default-visibility
   * predicate as findVisibleProjectWorkspace above, one query). Used by the
   * QA verification-runs slice (Slice 3), which — unlike the checklists
   * slice above — is entirely project-scoped and needs more than just the
   * workspace id off the row: repo_full_name for commit resolution, and
   * user_id (the owner) alongside workspace_id for notification recipients.
   * Kept here rather than duplicated in qa-runs so there is exactly one
   * "is this project visible to this caller" query path.
   */
  async findVisibleProject(
    projectId: string,
    userId: string,
  ): Promise<ProvisionedProjectRow | null> {
    const project = await this.projectsRepository.findByIdAndUser(
      projectId,
      userId,
    );
    if (!project) return null;
    const folder = await this.projectLink.getProjectFolder(projectId);
    if (
      folder &&
      !(await this.canAccessProject(
        userId,
        folder.groupId,
        folder.deliveryProjectId,
      ))
    ) {
      return null;
    }
    return project;
  }

  /**
   * The caller's effective global persona (admin | lead | qa | member),
   * platform_admins override included. This is the QA verification-runs
   * slice's entire role model — unlike canManage() above (admin/lead only,
   * built for the checklists slice), qa-runs' permission matrix also grants
   * some actions to 'qa' and 'member', so callers need the raw role rather
   * than a single collapsed boolean.
   */
  async findAppRole(userId: string): Promise<PlatformAppRole> {
    return this.projectsRepository.findAppRole(userId);
  }

  /** Admin-granted extras (qa_release, deployment_override). */
  async findSpecialAccess(userId: string): Promise<SpecialAccess[]> {
    return this.projectsRepository.findSpecialAccess(userId);
  }

  /**
   * The persona for QA-track checks: a Developer holding qa_release acts as
   * QA (see actingQaRole). Use it for starting runs, verifying, recording
   * test results, signing off, dispatching automation and evidence; keep
   * findAppRole for Developer-track and Product owner checks.
   */
  async findQaRole(userId: string): Promise<PlatformAppRole> {
    const [role, special] = await Promise.all([
      this.projectsRepository.findAppRole(userId),
      this.projectsRepository.findSpecialAccess(userId),
    ]);
    return actingQaRole(role, special);
  }

  /** The owning user of a provisioned project - a notification recipient. */
  async findProjectOwnerId(projectId: string): Promise<string | null> {
    return this.projectsRepository.findOwnerId(projectId);
  }

  /** Active workspace members whose global persona is 'lead' — notification recipients. */
  async listWorkspaceLeadIds(workspaceId: string): Promise<string[]> {
    return this.projectsRepository.listWorkspaceLeadIds(workspaceId);
  }

  /** Active workspace members whose persona is 'lead' or 'member' (developer). */
  async listWorkspaceLeadAndDeveloperIds(
    workspaceId: string,
    deliveryProjectId: string,
  ): Promise<string[]> {
    const members = await this.listEligibleProjectMembers(
      workspaceId,
      deliveryProjectId,
    );
    return members
      .filter(({ role }) => role === 'lead' || role === 'member')
      .map(({ id }) => id);
  }

  async listWorkspaceQaIds(
    workspaceId: string,
    deliveryProjectId: string,
  ): Promise<string[]> {
    const members = await this.listEligibleProjectMembers(
      workspaceId,
      deliveryProjectId,
    );
    return members.filter(({ role }) => role === 'qa').map(({ id }) => id);
  }

  async listWorkspaceMembers(
    workspaceId: string,
    deliveryProjectId: string,
  ): Promise<Array<{ id: string; login: string | null }>> {
    const members = await this.listEligibleProjectMembers(
      workspaceId,
      deliveryProjectId,
    );
    return members.map(({ id, login }) => ({ id, login }));
  }

  private async listEligibleProjectMembers(
    workspaceId: string,
    deliveryProjectId: string,
  ) {
    const [members, projectMemberIds] = await Promise.all([
      this.projectsRepository.listWorkspaceMembers(workspaceId),
      this.overview.listActiveMemberIds(deliveryProjectId),
    ]);
    const projectMembers = new Set(projectMemberIds);
    return members.filter(
      ({ id, role }) =>
        role === 'lead' || role === 'admin' || projectMembers.has(id),
    );
  }
}
