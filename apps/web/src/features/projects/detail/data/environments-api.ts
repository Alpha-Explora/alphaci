import { request } from "@/shared/api/request";

import type {
  CreateDeploymentTargetRequest,
  DeploymentTarget,
} from "@/shared/api/contracts";
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

/** Attach an on-prem Compose slot to a project environment. */
export function createOnpremEnvironmentTarget(
  projectId: string,
  input: { environmentId: string; slot: "backend" | "frontend" | "standalone"; name: string },
): Promise<DeploymentTarget> {
  const body: CreateDeploymentTargetRequest = {
    action: "create",
    environmentId: input.environmentId,
    slot: input.slot,
    ownershipMode: "byo",
    provider: "onprem-compose",
    providerProjectName: input.name,
  };
  return request<DeploymentTarget>(
    `${projectPath(projectId)}/deployment-targets`,
    { method: "POST", body: JSON.stringify(body) },
  );
}
