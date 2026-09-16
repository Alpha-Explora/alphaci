import { getProjectOptions } from "@/features/workflows";
import {
  addProjectDomain,
  createWorkflowUpdatePullRequest as requestWorkflowUpdatePullRequest,
  detachDeploymentTarget as requestDetachDeploymentTarget,
  disconnectProject,
  getProjectAuditEvents,
  getProjectCiRuns,
  getProjectDeployments,
  getProjectDomains,
  getProjectDrift,
  getProjectOverview,
  getProjectPreviews,
  getWorkflowSettings,
  previewWorkflowSettings as requestPreviewWorkflowSettings,
  removeProjectDomain,
  repairProjectDriftFinding,
  runProjectDriftDetection,
  syncDeploymentTarget as requestSyncDeploymentTarget,
  syncProjectSnapshot,
  updateDeploymentTarget as requestUpdateDeploymentTarget,
  verifyProjectDomain,
} from "../detail/data/projects-api";

import type {
  DeploymentTarget,
  DeploymentTargetSyncResponse,
  DetachDeploymentTargetResponse,
  DisconnectProjectResponse,
  ProjectAuditEventsResponse,
  ProjectCiRunsResponse,
  ProjectDeploymentsResponse,
  ProjectDriftRepairAction,
  ProjectDriftResponse,
  ProjectSyncSnapshotResponse,
  UpdateDeploymentTargetRequest,
  WorkflowSettings,
  WorkflowSettingsPreviewResponse,
  WorkflowUpdatePullRequestResponse,
} from "@/shared/api/contracts";
import type {
  AddCustomDomainRequest,
  CustomDomain,
  ProjectOverviewResponse,
  ProjectPreviewsResponse,
  RemoveCustomDomainResponse,
} from "../model/projects-types";

/* The only place in this domain that performs I/O. View-models call these;
 * views never do. */
export const projectsRepository = {
  overview(projectId: string): Promise<ProjectOverviewResponse> {
    return getProjectOverview(projectId);
  },

  /** One entry per branch, newest deployment each. */
  previews(projectId: string): Promise<ProjectPreviewsResponse> {
    return getProjectPreviews(projectId);
  },

  domains(projectId: string): Promise<CustomDomain[]> {
    return getProjectDomains(projectId);
  },

  addDomain(
    projectId: string,
    body: AddCustomDomainRequest,
  ): Promise<CustomDomain> {
    return addProjectDomain(projectId, body);
  },

  /** Re-asks the provider whether the hostname is ready. */
  verifyDomain(projectId: string, domainId: string): Promise<CustomDomain> {
    return verifyProjectDomain(projectId, domainId);
  },

  removeDomain(
    projectId: string,
    domainId: string,
  ): Promise<RemoveCustomDomainResponse> {
    return removeProjectDomain(projectId, domainId);
  },

  /** The org every new repository is provisioned into, for the External badge. */
  async enforcedOrg(): Promise<string | undefined> {
    return (await getProjectOptions()).enforcedOrg;
  },

  /**
   * Disconnects the project, optionally deleting the GitHub repository, the
   * live Render/Vercel resources and the SonarCloud project too.
   *
   * The repo name is echoed back as confirmation, which is what makes the
   * destructive GitHub branch deliberate rather than a checkbox away.
   */
  disconnect(
    projectId: string,
    options: {
      deleteGithubRepo: boolean;
      deleteProviderResources: boolean;
      deleteSonarProject: boolean;
    },
    repoFullName: string,
  ): Promise<DisconnectProjectResponse> {
    const body = {
      ...(options.deleteGithubRepo
        ? { deleteGithubRepo: true, confirmRepoName: repoFullName }
        : {}),
      ...(options.deleteProviderResources
        ? { deleteProviderResources: true }
        : {}),
      ...(options.deleteSonarProject ? { deleteSonarProject: true } : {}),
    };
    return disconnectProject(
      projectId,
      Object.keys(body).length > 0 ? body : undefined,
    );
  },

  workflowSettings(projectId: string): Promise<WorkflowSettings> {
    return getWorkflowSettings(projectId).then((response) => response.settings);
  },

  previewWorkflowSettings(
    projectId: string,
    settings: WorkflowSettings,
  ): Promise<WorkflowSettingsPreviewResponse> {
    return requestPreviewWorkflowSettings(projectId, settings);
  },

  createWorkflowUpdatePullRequest(
    projectId: string,
    settings: WorkflowSettings,
  ): Promise<WorkflowUpdatePullRequestResponse> {
    return requestWorkflowUpdatePullRequest(projectId, settings);
  },

  ciRuns(projectId: string): Promise<ProjectCiRunsResponse> {
    return getProjectCiRuns(projectId);
  },

  deployments(projectId: string): Promise<ProjectDeploymentsResponse> {
    return getProjectDeployments(projectId);
  },

  drift(projectId: string): Promise<ProjectDriftResponse> {
    return getProjectDrift(projectId);
  },

  runDrift(projectId: string): Promise<ProjectDriftResponse> {
    return runProjectDriftDetection(projectId);
  },

  repairDrift(
    projectId: string,
    findingId: string,
    action: ProjectDriftRepairAction,
  ) {
    return repairProjectDriftFinding(projectId, findingId, action);
  },

  audit(projectId: string): Promise<ProjectAuditEventsResponse> {
    return getProjectAuditEvents(projectId);
  },

  syncSnapshot(projectId: string): Promise<ProjectSyncSnapshotResponse> {
    return syncProjectSnapshot(projectId);
  },

  updateDeploymentTarget(
    projectId: string,
    targetId: string,
    payload: UpdateDeploymentTargetRequest,
  ): Promise<DeploymentTarget> {
    return requestUpdateDeploymentTarget(projectId, targetId, payload);
  },

  syncDeploymentTarget(
    projectId: string,
    targetId: string,
  ): Promise<DeploymentTargetSyncResponse> {
    return requestSyncDeploymentTarget(projectId, targetId);
  },

  detachDeploymentTarget(
    projectId: string,
    targetId: string,
    deleteProviderResource: boolean,
  ): Promise<DetachDeploymentTargetResponse> {
    return requestDetachDeploymentTarget(projectId, targetId, {
      deleteProviderResource,
    });
  },
};
