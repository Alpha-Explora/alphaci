/**
 * Hierarchy & Access API client.
 *
 * Every path is relative to the `api/v1` prefix the `request()` helper already
 * applies, and matches HIERARCHY_IMPLEMENTATION_PLAN.md §2.4–§2.8 EXACTLY. All
 * calls go through the shared `request()` helper (credentials: include, no-store)
 * — never call fetch directly. 403/404 surface as ApiError with `.status`, which
 * the UI maps to Forbidden / Not-found states (plan §2.0).
 */

import type {
  CreateAssignmentRequest,
  CreateDeliveryProjectRequest,
  CreateGroupRequest,
  CreateInvitationRequest,
  CreateRepositoryRequest,
  CreateSystemRequest,
  DeliveryProject,
  GroupActivityQuery,
  GroupActivityResponse,
  GroupInvitation,
  GroupMember,
  GroupSummary,
  HierarchyRepository,
  HierarchySystem,
  InternalUserDirectoryEntry,
  MyAssignedRepositoriesResponse,
  MyGroupsResponse,
  PutConfigurationValueRequest,
  ConfigurationWriteResponse,
  RepositoryAccessStatusResponse,
  RepositoryAssignment,
  RepositoryConfigurationResponse,
  TransferGroupRequest,
  UpdateDeliveryProjectRequest,
  UpdateGroupRequest,
  UpdateMemberRoleRequest,
  UpdateRepositoryRequest,
  UpdateSystemRequest,
  ConfigurationType,
} from "./hierarchy-contracts";
import { request } from "./request";

const enc = encodeURIComponent;

/* ── Groups, members, invitations (plan §2.4) ──────────────────────────────── */

export function createGroup(payload: CreateGroupRequest): Promise<GroupSummary> {
  return request<GroupSummary>("/groups", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getGroups(): Promise<GroupSummary[]> {
  return request<GroupSummary[]>("/groups");
}

export function getGroup(groupId: string): Promise<GroupSummary> {
  return request<GroupSummary>(`/groups/${enc(groupId)}`);
}

export function updateGroup(
  groupId: string,
  payload: UpdateGroupRequest,
): Promise<GroupSummary> {
  return request<GroupSummary>(`/groups/${enc(groupId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function archiveGroup(groupId: string): Promise<GroupSummary> {
  return request<GroupSummary>(`/groups/${enc(groupId)}/archive`, {
    method: "POST",
  });
}

export function reopenGroup(groupId: string): Promise<GroupSummary> {
  return request<GroupSummary>(`/groups/${enc(groupId)}/reopen`, {
    method: "POST",
  });
}

export function transferGroup(
  groupId: string,
  payload: TransferGroupRequest,
): Promise<GroupSummary> {
  return request<GroupSummary>(`/groups/${enc(groupId)}/transfer`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  return request<GroupMember[]>(`/groups/${enc(groupId)}/members`);
}

export function searchEligibleGroupUsers(
  groupId: string,
  search: string,
): Promise<InternalUserDirectoryEntry[]> {
  const query = new URLSearchParams({ search });
  return request<InternalUserDirectoryEntry[]>(
    `/groups/${enc(groupId)}/eligible-users?${query.toString()}`,
  );
}

export function createGroupInvitation(
  groupId: string,
  payload: CreateInvitationRequest,
): Promise<GroupInvitation> {
  return request<GroupInvitation>(`/groups/${enc(groupId)}/invitations`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getGroupInvitations(
  groupId: string,
): Promise<GroupInvitation[]> {
  return request<GroupInvitation[]>(`/groups/${enc(groupId)}/invitations`);
}

export function acceptGroupInvitation(
  invitationId: string,
): Promise<GroupInvitation> {
  return request<GroupInvitation>(
    `/groups/invitations/${enc(invitationId)}/accept`,
    { method: "POST" },
  );
}

export function declineGroupInvitation(
  invitationId: string,
): Promise<GroupInvitation> {
  return request<GroupInvitation>(
    `/groups/invitations/${enc(invitationId)}/decline`,
    { method: "POST" },
  );
}

export function revokeGroupInvitation(
  groupId: string,
  invitationId: string,
): Promise<{ id: string; revoked: true }> {
  return request<{ id: string; revoked: true }>(
    `/groups/${enc(groupId)}/invitations/${enc(invitationId)}`,
    { method: "DELETE" },
  );
}

export function updateGroupMemberRole(
  groupId: string,
  memberId: string,
  payload: UpdateMemberRoleRequest,
): Promise<GroupMember> {
  return request<GroupMember>(
    `/groups/${enc(groupId)}/members/${enc(memberId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}

export function removeGroupMember(
  groupId: string,
  memberId: string,
): Promise<{ id: string; removed: true }> {
  return request<{ id: string; removed: true }>(
    `/groups/${enc(groupId)}/members/${enc(memberId)}`,
    { method: "DELETE" },
  );
}

export function getGroupActivity(
  groupId: string,
  query: GroupActivityQuery = {},
): Promise<GroupActivityResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return request<GroupActivityResponse>(
    `/groups/${enc(groupId)}/activity${qs ? `?${qs}` : ""}`,
  );
}

/* ── Systems & delivery projects (plan §2.5) ───────────────────────────────── */

export function createSystem(
  groupId: string,
  payload: CreateSystemRequest,
): Promise<HierarchySystem> {
  return request<HierarchySystem>(`/groups/${enc(groupId)}/systems`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getGroupSystems(groupId: string): Promise<HierarchySystem[]> {
  return request<HierarchySystem[]>(`/groups/${enc(groupId)}/systems`);
}

export function getSystem(systemId: string): Promise<HierarchySystem> {
  return request<HierarchySystem>(`/systems/${enc(systemId)}`);
}

export function updateSystem(
  systemId: string,
  payload: UpdateSystemRequest,
): Promise<HierarchySystem> {
  return request<HierarchySystem>(`/systems/${enc(systemId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function archiveSystem(systemId: string): Promise<HierarchySystem> {
  return request<HierarchySystem>(`/systems/${enc(systemId)}/archive`, {
    method: "POST",
  });
}

export function createDeliveryProject(
  systemId: string,
  payload: CreateDeliveryProjectRequest,
): Promise<DeliveryProject> {
  return request<DeliveryProject>(
    `/systems/${enc(systemId)}/delivery-projects`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function getSystemDeliveryProjects(
  systemId: string,
): Promise<DeliveryProject[]> {
  return request<DeliveryProject[]>(
    `/systems/${enc(systemId)}/delivery-projects`,
  );
}

export function getDeliveryProject(
  deliveryProjectId: string,
): Promise<DeliveryProject> {
  return request<DeliveryProject>(
    `/delivery-projects/${enc(deliveryProjectId)}`,
  );
}

export function updateDeliveryProject(
  deliveryProjectId: string,
  payload: UpdateDeliveryProjectRequest,
): Promise<DeliveryProject> {
  return request<DeliveryProject>(
    `/delivery-projects/${enc(deliveryProjectId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}

export function archiveDeliveryProject(
  deliveryProjectId: string,
): Promise<DeliveryProject> {
  return request<DeliveryProject>(
    `/delivery-projects/${enc(deliveryProjectId)}/archive`,
    { method: "POST" },
  );
}

/* ── Repositories & assignments (plan §2.6) ────────────────────────────────── */

export function createRepository(
  deliveryProjectId: string,
  payload: CreateRepositoryRequest,
): Promise<HierarchyRepository> {
  return request<HierarchyRepository>(
    `/delivery-projects/${enc(deliveryProjectId)}/repositories`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function getDeliveryProjectRepositories(
  deliveryProjectId: string,
): Promise<HierarchyRepository[]> {
  return request<HierarchyRepository[]>(
    `/delivery-projects/${enc(deliveryProjectId)}/repositories`,
  );
}

export function getRepository(
  repositoryId: string,
): Promise<HierarchyRepository> {
  return request<HierarchyRepository>(`/repositories/${enc(repositoryId)}`);
}

export function updateRepository(
  repositoryId: string,
  payload: UpdateRepositoryRequest,
): Promise<HierarchyRepository> {
  return request<HierarchyRepository>(`/repositories/${enc(repositoryId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function archiveRepository(
  repositoryId: string,
): Promise<HierarchyRepository> {
  return request<HierarchyRepository>(
    `/repositories/${enc(repositoryId)}/archive`,
    { method: "POST" },
  );
}

export function createRepositoryAssignment(
  repositoryId: string,
  payload: CreateAssignmentRequest,
): Promise<RepositoryAssignment> {
  return request<RepositoryAssignment>(
    `/repositories/${enc(repositoryId)}/assignments`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function getRepositoryAssignments(
  repositoryId: string,
): Promise<RepositoryAssignment[]> {
  return request<RepositoryAssignment[]>(
    `/repositories/${enc(repositoryId)}/assignments`,
  );
}

export function removeRepositoryAssignment(
  repositoryId: string,
  assignmentId: string,
): Promise<RepositoryAssignment> {
  return request<RepositoryAssignment>(
    `/repositories/${enc(repositoryId)}/assignments/${enc(assignmentId)}`,
    { method: "DELETE" },
  );
}

export function reconcileRepositoryAssignment(
  repositoryId: string,
  assignmentId: string,
): Promise<RepositoryAssignment> {
  return request<RepositoryAssignment>(
    `/repositories/${enc(repositoryId)}/assignments/${enc(assignmentId)}/reconcile`,
    { method: "POST" },
  );
}

export function getRepositoryAccessStatus(
  repositoryId: string,
): Promise<RepositoryAccessStatusResponse> {
  return request<RepositoryAccessStatusResponse>(
    `/repositories/${enc(repositoryId)}/access-status`,
  );
}

/* ── Configuration broker (plan §2.7) ──────────────────────────────────────── */

export function getRepositoryConfiguration(
  repositoryId: string,
): Promise<RepositoryConfigurationResponse> {
  return request<RepositoryConfigurationResponse>(
    `/repositories/${enc(repositoryId)}/configuration`,
  );
}

export function putConfigurationVariable(
  repositoryId: string,
  variableName: string,
  payload: PutConfigurationValueRequest,
): Promise<ConfigurationWriteResponse> {
  return request<ConfigurationWriteResponse>(
    `/repositories/${enc(repositoryId)}/configuration/variables/${enc(variableName)}`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

export function putConfigurationSecret(
  repositoryId: string,
  secretName: string,
  payload: PutConfigurationValueRequest,
): Promise<ConfigurationWriteResponse> {
  return request<ConfigurationWriteResponse>(
    `/repositories/${enc(repositoryId)}/configuration/secrets/${enc(secretName)}`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

export function deleteConfigurationEntry(
  repositoryId: string,
  configurationType: ConfigurationType,
  name: string,
): Promise<{ deleted: true; name: string }> {
  return request<{ deleted: true; name: string }>(
    `/repositories/${enc(repositoryId)}/configuration/${enc(configurationType)}/${enc(name)}`,
    { method: "DELETE" },
  );
}

/* ── Developer surface (plan §2.6 /me/*) ───────────────────────────────────── */

export function getMyGroups(): Promise<MyGroupsResponse> {
  return request<MyGroupsResponse>("/me/groups");
}

export function getMyAssignedRepositories(): Promise<MyAssignedRepositoriesResponse> {
  return request<MyAssignedRepositoriesResponse>("/me/assigned-repositories");
}
