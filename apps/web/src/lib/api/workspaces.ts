import type { WorkspacesMeResponse } from "./contracts";
import { request } from "./request";

export async function getMyWorkspaces(): Promise<WorkspacesMeResponse> {
  return request<WorkspacesMeResponse>("/workspaces/me");
}
