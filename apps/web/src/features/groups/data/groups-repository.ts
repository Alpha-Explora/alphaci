import {
  archiveGroup,
  getDeliveryProject,
  getDeliveryProjectRepositories,
  getGroup,
  getGroupActivity,
  getGroupMembers,
  getRepository,
  getRepositoryAccessStatus,
  getRepositoryAssignments,
  getSystem,
  getSystemDeliveryProjects,
  reopenGroup,
  updateGroup,
} from "@/features/groups/data/hierarchy-api";
import { getProjects } from "@/features/projects";

import type {
  DeliveryProject,
  GroupActivityQuery,
  GroupActivityResponse,
  GroupMember,
  GroupSummary,
  HierarchyRepository,
  HierarchySystem,
  ProvisionedProject,
  RepositoryAccessStatusResponse,
  RepositoryAssignment,
  UpdateGroupRequest,
} from "../model/groups-types";

/* The only place in this domain that performs I/O. View-models call these;
 * views never do.
 *
 * Domain-level rather than per-slice because every one of the seven group
 * surfaces begins by resolving the group itself — the skill sanctions
 * features/<domain>/data as the share point between actions. */

/* The systems surface called getProjects(undefined, …), which takes that
 * function's own default of 25 — not its 100 ceiling. Naming it here keeps the
 * page size the same as before the move. */
const PROJECTS_LIMIT = 25;

export const groupsRepository = {
  group(groupId: string): Promise<GroupSummary> {
    return getGroup(groupId);
  },

  updateGroup(
    groupId: string,
    payload: UpdateGroupRequest,
  ): Promise<GroupSummary> {
    return updateGroup(groupId, payload);
  },

  archiveGroup(groupId: string): Promise<GroupSummary> {
    return archiveGroup(groupId);
  },

  reopenGroup(groupId: string): Promise<GroupSummary> {
    return reopenGroup(groupId);
  },

  activity(
    groupId: string,
    query: GroupActivityQuery = {},
  ): Promise<GroupActivityResponse> {
    return getGroupActivity(groupId, query);
  },

  members(groupId: string): Promise<GroupMember[]> {
    return getGroupMembers(groupId);
  },

  system(systemId: string): Promise<HierarchySystem> {
    return getSystem(systemId);
  },

  systemDeliveryProjects(systemId: string): Promise<DeliveryProject[]> {
    return getSystemDeliveryProjects(systemId);
  },

  deliveryProject(deliveryProjectId: string): Promise<DeliveryProject> {
    return getDeliveryProject(deliveryProjectId);
  },

  deliveryProjectRepositories(
    deliveryProjectId: string,
  ): Promise<HierarchyRepository[]> {
    return getDeliveryProjectRepositories(deliveryProjectId);
  },

  repository(repositoryId: string): Promise<HierarchyRepository> {
    return getRepository(repositoryId);
  },

  repositoryAssignments(
    repositoryId: string,
  ): Promise<RepositoryAssignment[]> {
    return getRepositoryAssignments(repositoryId);
  },

  repositoryAccessStatus(
    repositoryId: string,
  ): Promise<RepositoryAccessStatusResponse> {
    return getRepositoryAccessStatus(repositoryId);
  },

  /** Provisioned projects for the group, scoped server-side. */
  groupProjects(groupId: string): Promise<ProvisionedProject[]> {
    return getProjects(PROJECTS_LIMIT, { workspaceId: groupId }).then(
      (res) => res.items,
    );
  },
};
