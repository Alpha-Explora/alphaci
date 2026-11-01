/**
 * Drift findings and their repair.
 *
 * GET /projects/:id/drift and POST /projects/:id/drift/run return
 * DeploymentDriftResponse. POST /projects/:id/drift/:findingId/repair takes
 * `{ action?: ProjectDriftRepairAction }` and returns ProjectDriftRepairResponse.
 */

export type DeploymentDriftSeverity = 'info' | 'warning' | 'error';
export type DeploymentDriftStatus = 'active' | 'resolved' | 'ignored';
export type DeploymentDriftSource = 'local_snapshot' | 'github_live';

export interface DeploymentDriftFinding {
  id: string;
  projectId: string;
  targetId: string | null;
  source: DeploymentDriftSource;
  severity: DeploymentDriftSeverity;
  code: string;
  message: string;
  details: Record<string, unknown>;
  status: DeploymentDriftStatus;
  detectedAt: string;
  resolvedAt: string | null;
}

export interface DeploymentDriftResponse {
  enabled: boolean;
  mode: 'local_snapshot';
  findings: DeploymentDriftFinding[];
}

export type ProjectDriftRepairAction =
  | 'regenerate_workflow_preview'
  | 'create_workflow_update_pr'
  | 'rotate_ci_token'
  | 'detach_target'
  | 'repair_branch_protection'
  | 'repair_ci_api_url'
  | 'mark_ignored';

export interface ProjectDriftRepairResponse {
  enabled: boolean;
  mode: 'local_safe';
  findingId: string;
  action: ProjectDriftRepairAction;
  status: 'completed' | 'disabled';
  message: string;
  result?: Record<string, unknown>;
}
