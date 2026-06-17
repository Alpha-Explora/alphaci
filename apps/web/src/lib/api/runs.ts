import type { RunsResponse } from "./contracts";
import { request } from "./request";

export async function getRuns(repoFullName?: string): Promise<RunsResponse> {
  const path = repoFullName
    ? `/ci/runs?repoFullName=${encodeURIComponent(repoFullName)}`
    : "/ci/runs";
  return request<RunsResponse>(path);
}
