import type {
  CreateProjectRequest,
  CreateProjectResponse,
  DeploymentTarget,
  DeploymentTargetActionsResponse,
  DeploymentTargetSyncResponse,
  ProjectCiRun,
  ProjectCiRunRerunResponse,
  ProjectCiRunsResponse,
  ProjectDeploymentsResponse,
  ProjectDriftResponse,
  ProjectDriftRepairAction,
  ProjectDriftRepairResponse,
  ProjectAuditEventsResponse,
  ProjectOverviewResponse,
  ProjectSyncSnapshotResponse,
  ProvisionedProjectsResponse,
  SetupProjectRequest,
  SetupProjectResponse,
  UpdateDeploymentTargetRequest,
  WorkflowSettingsPreviewRequest,
  WorkflowSettingsPreviewResponse,
  WorkflowSettingsResponse,
  WorkflowUpdatePullRequestResponse,
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
): Promise<{ detached: true }> {
  return request<{ detached: true }>(
    `/projects/${encodeURIComponent(projectId)}/deployment-targets/${encodeURIComponent(targetId)}`,
    {
      method: "DELETE",
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
