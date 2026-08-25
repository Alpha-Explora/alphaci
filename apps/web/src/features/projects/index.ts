/* Domain barrel — project model and data contracts only.
 *
 * Route-facing UI lives in an action slice (`projects/detail`). Keeping this
 * barrel data-only lets other features consume project operations without
 * pulling the detail view back into their dependency graph.
 */
export type { ProjectOverviewResponse, ProvisionedProject } from "./model/projects-types";
export type { ProjectStatus } from "./model/projects-types";
export * from "./detail/data/projects-api";
export * from "./detail/data/project-workspace-api";
export * from "./detail/data/usage-api";
export { projectsRepository } from "./data/projects-repository";
export type {
  DeploymentTarget,
  EnvEnvironment,
  /* A lane is production-or-preview, distinct from the Render environment name
   * — see the header of shared/api/contracts. The env panel needs both. */
  EnvLane,
  EnvProvider,
  EnvTargetSlot,
  EnvVarScope,
  EnvVarMetadata,
  ProjectAuditEventsResponse,
  ProjectCiRunsResponse,
  ProjectDeploymentsResponse,
  ProjectDriftRepairAction,
  ProjectDriftResponse,
  ProjectOverviewResponse as ApiProjectOverviewResponse,
  ProjectSyncSnapshotResponse,
  RenderRuntime,
  UpdateDeploymentTargetRequest,
  UsageLimitItem,
  ValidateEnvVarsResponse,
  WorkflowFileMetadata,
  WorkflowSettings,
  WorkflowSettingsPreviewResponse,
  WorkflowUpdatePullRequestResponse,
} from "@/shared/api/contracts";
