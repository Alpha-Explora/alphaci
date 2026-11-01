import type {
  WorkspaceMemberSummary,
  WorkspacesMeResponse,
} from "@/shared/api/contracts";
import { request } from "@/shared/api/request";

/*
 * Read-only. Adding, re-roling and removing members goes through the team
 * roster on /teams (the /groups/:id/members routes); the /workspaces/:id/members
 * write routes are being retired on the backend, so nothing here calls them.
 */

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
