/**
 * Project members API: who belongs to a Project (delivery project) and the
 * GitHub access that membership carries. Lead/admin only on the server; a
 * 403/404 surfaces as ApiError with `.status`.
 *
 * Its own module rather than more functions in hierarchy-api.ts: existing
 * tests replace that module with jest.mock factories, and a new export there
 * would be missing from every one of them.
 */

import type {
  ProjectMemberChangeResponse,
  ProjectMembersResponse,
  ProjectMembersSyncResponse,
} from "@/features/groups/data/hierarchy-contracts";
import { request } from "@/shared/api/request";

const enc = encodeURIComponent;

function membersPath(deliveryProjectId: string): string {
  return `/delivery-projects/${enc(deliveryProjectId)}/members`;
}

export function getProjectMembers(
  deliveryProjectId: string,
): Promise<ProjectMembersResponse> {
  return request<ProjectMembersResponse>(membersPath(deliveryProjectId));
}

/** The kind (Developer / QA Team) comes from the person's app role, server-side. */
export function addProjectMember(
  deliveryProjectId: string,
  userId: string,
): Promise<ProjectMemberChangeResponse> {
  return request<ProjectMemberChangeResponse>(membersPath(deliveryProjectId), {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export function removeProjectMember(
  deliveryProjectId: string,
  memberUserId: string,
): Promise<ProjectMemberChangeResponse> {
  return request<ProjectMemberChangeResponse>(
    `${membersPath(deliveryProjectId)}/${enc(memberUserId)}`,
    { method: "DELETE" },
  );
}

/** Re-runs the Developers' GitHub grants. 503 while sync mode is stub. */
export function syncProjectMembers(
  deliveryProjectId: string,
): Promise<ProjectMembersSyncResponse> {
  return request<ProjectMembersSyncResponse>(
    `${membersPath(deliveryProjectId)}/sync`,
    { method: "POST" },
  );
}
