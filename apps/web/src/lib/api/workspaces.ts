import type {
  AddWorkspaceMemberRequest,
  UpdateWorkspaceMemberRoleRequest,
  WorkspaceMemberSummary,
  WorkspacesMeResponse,
} from "./contracts";
import { request } from "./request";

export async function getMyWorkspaces(): Promise<WorkspacesMeResponse> {
  return request<WorkspacesMeResponse>("/workspaces/me");
}

export async function getWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMemberSummary[]> {
  return request<WorkspaceMemberSummary[]>(
    `/workspaces/${encodeURIComponent(workspaceId)}/members`,
  );
}

export async function addWorkspaceMember(
  workspaceId: string,
  payload: AddWorkspaceMemberRequest,
): Promise<WorkspaceMemberSummary> {
  return request<WorkspaceMemberSummary>(
    `/workspaces/${encodeURIComponent(workspaceId)}/members`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  memberId: string,
  payload: UpdateWorkspaceMemberRoleRequest,
): Promise<WorkspaceMemberSummary> {
  return request<WorkspaceMemberSummary>(
    `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(memberId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function removeWorkspaceMember(
  workspaceId: string,
  memberId: string,
): Promise<{ id: string; removed: true }> {
  return request<{ id: string; removed: true }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(memberId)}`,
    { method: "DELETE" },
  );
}
