import type { ProvisionedProjectsResponse, SetupProjectRequest, SetupProjectResponse } from "./contracts";
import { request } from "./request";

export async function setupProject(payload: SetupProjectRequest): Promise<SetupProjectResponse> {
  return request<SetupProjectResponse>("/projects/setup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getProjects(limit = 25): Promise<ProvisionedProjectsResponse> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return request<ProvisionedProjectsResponse>(`/projects?limit=${safeLimit}`);
}
