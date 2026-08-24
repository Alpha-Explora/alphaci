import type { RunsResponse } from "@/shared/api/contracts";
import { request } from "@/shared/api/request";

export async function getRuns(repoFullName?: string): Promise<RunsResponse> {
  const path = repoFullName
    ? `/ci/runs?repoFullName=${encodeURIComponent(repoFullName)}`
    : "/ci/runs";
  return request<RunsResponse>(path);
}
