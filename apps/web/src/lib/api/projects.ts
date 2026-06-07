import type {
  CreateProjectRequest,
  CreateProjectResponse,
  ProvisionedProjectsResponse,
  SetupProjectRequest,
  SetupProjectResponse,
} from "./contracts";
import { request } from "./request";

export async function setupProject(payload: SetupProjectRequest): Promise<SetupProjectResponse> {
  return request<SetupProjectResponse>("/projects/setup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createProject(payload: CreateProjectRequest): Promise<CreateProjectResponse> {
  return request<CreateProjectResponse>("/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getProjects(limit = 25): Promise<ProvisionedProjectsResponse> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return request<ProvisionedProjectsResponse>(`/projects?limit=${safeLimit}`);
}

export async function disconnectProject(id: string): Promise<void> {
  await request<{ ok: boolean }>(`/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function syncProjects(): Promise<{ orphaned: number; reachable: number; total: number }> {
  return request<{ orphaned: number; reachable: number; total: number }>('/projects/sync', {
    method: 'POST',
  });
}
