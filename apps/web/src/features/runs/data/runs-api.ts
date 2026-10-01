import type { RunsResponse } from "@/shared/api/contracts";
import { request } from "@/shared/api/request";

export interface GetRunsOptions {
  /** Narrow to the runs of the projects the caller can see in this team. */
  workspaceId?: string | null;
}

export async function getRuns(
  repoFullName?: string,
  options: GetRunsOptions = {},
): Promise<RunsResponse> {
  const params = new URLSearchParams();
  if (repoFullName) params.set("repoFullName", repoFullName);
  if (options.workspaceId) params.set("workspaceId", options.workspaceId);
  const query = params.toString();
  return request<RunsResponse>(query ? `/ci/runs?${query}` : "/ci/runs");
}
