import type {
  CreateProjectRequest,
  CreateProjectResponse,
  DeploymentTarget,
  DeploymentTargetActionsResponse,
  DeploymentTargetSyncResponse,
  DetachDeploymentTargetRequest,
  DetachDeploymentTargetResponse,
  DisconnectProjectRequest,
  DisconnectProjectResponse,
  ProjectCiRun,
  ProjectCiRunRerunResponse,
  ProjectCiRunsResponse,
  AddCustomDomainRequest,
  CustomDomain,
  ProjectDeploymentsResponse,
  ProjectPreviewsResponse,
  RemoveCustomDomainResponse,
  ProjectDriftResponse,
  ProjectDriftRepairAction,
  ProjectDriftRepairResponse,
  ProjectAuditEventsResponse,
  ProjectOverviewResponse,
  ProjectSyncSnapshotResponse,
  ProvisionedProjectsResponse,
  ReinstallDeploymentSecretsResponse,
  SetupProjectRequest,
  SetupProjectResponse,
  UpdateDeploymentTargetRequest,
  WorkflowSettingsPreviewRequest,
  WorkflowSettingsPreviewResponse,
  WorkflowSettingsResponse,
  WorkflowUpdatePullRequestResponse,
} from "@/shared/api/contracts";
import { request } from "@/shared/api/request";

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

export async function getProjects(
  limit = 25,
  input?: { workspaceId?: string | null },
): Promise<ProvisionedProjectsResponse> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const params = new URLSearchParams({ limit: String(safeLimit) });
  if (input?.workspaceId) {
    params.set("workspaceId", input.workspaceId);
  }
  return request<ProvisionedProjectsResponse>(`/projects?${params.toString()}`);
}

export async function getProjectOverview(projectId: string): Promise<ProjectOverviewResponse> {
  return request<ProjectOverviewResponse>(`/projects/${encodeURIComponent(projectId)}/overview`);
}

export async function syncProjectSnapshot(projectId: string): Promise<ProjectSyncSnapshotResponse> {
  return request<ProjectSyncSnapshotResponse>(`/projects/${encodeURIComponent(projectId)}/sync`, {
    method: "POST",
  });
}

export async function getWorkflowSettings(projectId: string): Promise<WorkflowSettingsResponse> {
  return request<WorkflowSettingsResponse>(`/projects/${encodeURIComponent(projectId)}/workflow-settings`);
}

export async function previewWorkflowSettings(
  projectId: string,
  payload: WorkflowSettingsPreviewRequest,
): Promise<WorkflowSettingsPreviewResponse> {
  return request<WorkflowSettingsPreviewResponse>(
    `/projects/${encodeURIComponent(projectId)}/workflow-settings/preview`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function createWorkflowUpdatePullRequest(
  projectId: string,
  payload: WorkflowSettingsPreviewRequest,
): Promise<WorkflowUpdatePullRequestResponse> {
  return request<WorkflowUpdatePullRequestResponse>(
    `/projects/${encodeURIComponent(projectId)}/workflow-settings/pr`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function getProjectCiRuns(
  projectId: string,
): Promise<ProjectCiRunsResponse> {
  return request<ProjectCiRunsResponse>(
    `/projects/${encodeURIComponent(projectId)}/ci-runs`,
  );
}

export async function getProjectCiRun(
  projectId: string,
  runId: string,
): Promise<ProjectCiRun> {
  return request<ProjectCiRun>(
    `/projects/${encodeURIComponent(projectId)}/ci-runs/${encodeURIComponent(runId)}`,
  );
}

export async function rerunProjectCiRun(
  projectId: string,
  runId: string,
): Promise<ProjectCiRunRerunResponse> {
  return request<ProjectCiRunRerunResponse>(
    `/projects/${encodeURIComponent(projectId)}/ci-runs/${encodeURIComponent(runId)}/rerun`,
    {
      method: "POST",
    },
  );
}

export async function getProjectDeployments(
  projectId: string,
): Promise<ProjectDeploymentsResponse> {
  return request<ProjectDeploymentsResponse>(
    `/projects/${encodeURIComponent(projectId)}/deployments`,
  );
}

export async function getProjectDomains(
  projectId: string,
): Promise<CustomDomain[]> {
  return request<CustomDomain[]>(
    `/projects/${encodeURIComponent(projectId)}/domains`,
  );
}

export async function addProjectDomain(
  projectId: string,
  body: AddCustomDomainRequest,
): Promise<CustomDomain> {
  return request<CustomDomain>(
    `/projects/${encodeURIComponent(projectId)}/domains`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function verifyProjectDomain(
  projectId: string,
  domainId: string,
): Promise<CustomDomain> {
  return request<CustomDomain>(
    `/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domainId)}/verify`,
    { method: "POST" },
  );
}

export async function removeProjectDomain(
  projectId: string,
  domainId: string,
): Promise<RemoveCustomDomainResponse> {
  return request<RemoveCustomDomainResponse>(
    `/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domainId)}`,
    { method: "DELETE" },
  );
}

export async function getProjectPreviews(
  projectId: string,
): Promise<ProjectPreviewsResponse> {
  return request<ProjectPreviewsResponse>(
    `/projects/${encodeURIComponent(projectId)}/previews`,
  );
}

export async function getProjectDrift(
  projectId: string,
): Promise<ProjectDriftResponse> {
  return request<ProjectDriftResponse>(
    `/projects/${encodeURIComponent(projectId)}/drift`,
  );
}

export async function runProjectDriftDetection(
  projectId: string,
): Promise<ProjectDriftResponse> {
  return request<ProjectDriftResponse>(
    `/projects/${encodeURIComponent(projectId)}/drift/run`,
    {
      method: "POST",
    },
  );
}

export async function repairProjectDriftFinding(
  projectId: string,
  findingId: string,
  action: ProjectDriftRepairAction,
): Promise<ProjectDriftRepairResponse> {
  return request<ProjectDriftRepairResponse>(
    `/projects/${encodeURIComponent(projectId)}/drift/${encodeURIComponent(findingId)}/repair`,
    {
      method: "POST",
      body: JSON.stringify({ action }),
    },
  );
}

export async function getProjectAuditEvents(
  projectId: string,
): Promise<ProjectAuditEventsResponse> {
  return request<ProjectAuditEventsResponse>(
    `/projects/${encodeURIComponent(projectId)}/audit`,
  );
}

export async function updateDeploymentTarget(
  projectId: string,
  targetId: string,
  payload: UpdateDeploymentTargetRequest,
): Promise<DeploymentTarget> {
  return request<DeploymentTarget>(
    `/projects/${encodeURIComponent(projectId)}/deployment-targets/${encodeURIComponent(targetId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function syncDeploymentTarget(
  projectId: string,
  targetId: string,
): Promise<DeploymentTargetSyncResponse> {
  return request<DeploymentTargetSyncResponse>(
    `/projects/${encodeURIComponent(projectId)}/deployment-targets/${encodeURIComponent(targetId)}/sync`,
    {
      method: "POST",
    },
  );
}

export async function detachDeploymentTarget(
  projectId: string,
  targetId: string,
  payload?: DetachDeploymentTargetRequest,
): Promise<DetachDeploymentTargetResponse> {
  return request<DetachDeploymentTargetResponse>(
    `/projects/${encodeURIComponent(projectId)}/deployment-targets/${encodeURIComponent(targetId)}`,
    {
      method: "DELETE",
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    },
  );
}

export async function getDeploymentTargetActions(
  projectId: string,
  targetId: string,
): Promise<DeploymentTargetActionsResponse> {
  return request<DeploymentTargetActionsResponse>(
    `/projects/${encodeURIComponent(projectId)}/deployment-targets/${encodeURIComponent(targetId)}/actions`,
  );
}

/**
 * Rewrites this target's GitHub Actions secrets (and, where applicable,
 * variables) from the provider's current state. No body. Only offered when
 * `getDeploymentTargetActions` reports `reinstallDeploymentSecrets.enabled`.
 */
export async function reinstallDeploymentSecrets(
  projectId: string,
  targetId: string,
): Promise<ReinstallDeploymentSecretsResponse> {
  return request<ReinstallDeploymentSecretsResponse>(
    `/projects/${encodeURIComponent(projectId)}/deployment-targets/${encodeURIComponent(targetId)}/reinstall-secrets`,
    {
      method: "POST",
    },
  );
}

export async function disconnectProject(
  id: string,
  options?: DisconnectProjectRequest,
): Promise<DisconnectProjectResponse> {
  return request<DisconnectProjectResponse>(`/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    ...(options ? { body: JSON.stringify(options) } : {}),
  });
}

export async function syncProjects(): Promise<{ orphaned: number; reachable: number; total: number }> {
  return request<{ orphaned: number; reachable: number; total: number }>('/projects/sync', {
    method: 'POST',
  });
}
