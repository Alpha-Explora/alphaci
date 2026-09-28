import { request } from "@/shared/api/request";

import type {
  DeploymentProviderSummary,
  EnvironmentDeployment,
  ProjectEnvironment,
  ProjectRelease,
} from "../model/environment-operations";

const projectPath = (projectId: string) =>
  `/projects/${encodeURIComponent(projectId)}`;

export function getProjectEnvironments(
  projectId: string,
): Promise<ProjectEnvironment[]> {
  return request<ProjectEnvironment[]>(`${projectPath(projectId)}/environments`);
}

export function getProjectReleases(
  projectId: string,
): Promise<ProjectRelease[]> {
  return request<ProjectRelease[]>(`${projectPath(projectId)}/releases`);
}

export async function getDeploymentProviders(): Promise<
  DeploymentProviderSummary[]
> {
  const response = await request<{ providers: DeploymentProviderSummary[] }>(
    "/deployment-providers",
  );
  return response.providers;
}

export function promoteRelease(
  projectId: string,
  environmentId: string,
  releaseId: string,
): Promise<EnvironmentDeployment> {
  return request<EnvironmentDeployment>(
    `${projectPath(projectId)}/environments/${encodeURIComponent(environmentId)}/promotions`,
    { method: "POST", body: JSON.stringify({ releaseId }) },
  );
}

/** Register an on-prem host; the response carries the only copy of its token. */
export function registerOnpremHost(
  projectId: string,
  environmentId: string,
  name: string,
): Promise<{ id: string; name: string; token: string }> {
  return request<{ id: string; name: string; token: string }>(
    `${projectPath(projectId)}/environments/${encodeURIComponent(environmentId)}/hosts`,
    { method: "POST", body: JSON.stringify({ name }) },
  );
}
