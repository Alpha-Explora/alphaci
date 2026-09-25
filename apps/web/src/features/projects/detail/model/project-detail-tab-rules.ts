import type {
  AppRole,
  DeploymentTarget,
  DeploymentTargetSyncResponse,
  DetachDeploymentTargetResponse,
  EnvVarMetadata,
  ProjectDriftRepairAction,
  ProjectOverviewResponse,
  ProvisionedProject,
  WorkflowFileMetadata,
  WorkflowSettings,
} from "@/shared/api/contracts";

export type ProjectDetailTab =
  | "overview"
  | "code"
  | "pulls"
  | "checklists"
  | "runs"
  | "workflow"
  | "hosting"
  | "environment"
  | "qa"
  | "audit"
  | "settings";

/** Every tab, in strip order. */
export const PROJECT_DETAIL_TABS: ReadonlyArray<ProjectDetailTab> = [
  "overview",
  "code",
  "pulls",
  "checklists",
  "runs",
  "workflow",
  "hosting",
  "environment",
  "qa",
  "audit",
  "settings",
];

/** The tabs that exist only with the QA checklists capability. */
const QA_TABS: ReadonlySet<ProjectDetailTab> = new Set(["checklists", "qa"]);

/**
 * The tabs this viewer gets, in strip order.
 *
 * Checklists and QA Studio are capability-gated: they exist only when the
 * backend reports `qaChecklistsEnabled`, and only for a session with a known
 * app role — every role can read checklists and runs (what each role may
 * change is decided per item by the server), but a session the backend has
 * not assigned a role to has nothing to read them as. Every other tab is
 * unconditional, exactly as before this rule existed.
 */
export function visibleProjectDetailTabs(
  appRole: AppRole | null | undefined,
  flags: Readonly<{ qaChecklistsEnabled: boolean }>,
): ProjectDetailTab[] {
  const qaVisible = flags.qaChecklistsEnabled && Boolean(appRole);
  return PROJECT_DETAIL_TABS.filter((tab) => qaVisible || !QA_TABS.has(tab));
}

/**
 * The tab a deep link asks for: `/projects/:id#qa` opens QA Studio. Unknown or
 * empty hashes give null (start on Overview). Visibility is still decided by
 * `resolveVisibleTab`, so a link can never reveal a gated tab.
 */
export function tabFromHash(hash: string | null | undefined): ProjectDetailTab | null {
  const id = (hash ?? "").replace(/^#/, "");
  return (PROJECT_DETAIL_TABS as ReadonlyArray<string>).includes(id) ? (id as ProjectDetailTab) : null;
}

/** The selected tab, or Overview when the selection is not (or no longer) visible. */
export function resolveVisibleTab(
  tab: ProjectDetailTab,
  visible: ReadonlyArray<ProjectDetailTab>,
): ProjectDetailTab {
  return visible.includes(tab) ? tab : "overview";
}

export const COVERAGE_THRESHOLD_OPTIONS: Array<{ value: string; label: string }> =
  [
    { value: "0", label: "None (0%)" },
    { value: "60", label: "Basic (60%)" },
    { value: "80", label: "Standard (80%)" },
    { value: "90", label: "Strict (90%)" },
    { value: "100", label: "Full (100%)" },
  ];

export const WORKFLOW_CHECK_OPTIONS: Array<{
  key: keyof WorkflowSettings["checks"];
  label: string;
}> = [
  { key: "lint", label: "Lint" },
  { key: "unit", label: "Unit tests" },
  { key: "build", label: "Build" },
  { key: "security", label: "Security" },
];

export function selectedChecksLabel(project: ProvisionedProject): string {
  const options = project.projectOptions ?? {};
  const enabled = Object.entries(options)
    .filter(isEnabledProjectOption)
    .map(([key]) => key);
  return enabled.length ? enabled.join(", ") : "None";
}

function isEnabledProjectOption(entry: [string, unknown]): boolean {
  return entry[1] === true;
}

export function projectQueryStatus(
  hasData: boolean,
  error: string | null,
): "loading" | "ready" | "error" {
  if (hasData) return "ready";
  if (error) return "error";
  return "loading";
}

export function configuredOrNot(value: string | null | undefined): string {
  return value ?? "Not configured";
}

export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed;
}

export function overviewCapabilityFlags(
  overview: ProjectOverviewResponse | null | undefined,
): {
  workflowSettings: boolean | undefined;
  ciRunTracking: boolean | undefined;
  deploymentHistory: boolean | undefined;
  driftDetection: boolean | undefined;
  syncSnapshots: boolean | undefined;
} {
  const caps = overview?.capabilities;
  return {
    workflowSettings: caps?.workflowSettings,
    ciRunTracking: caps?.ciRunTracking,
    deploymentHistory: caps?.deploymentHistory,
    driftDetection: caps?.driftDetection,
    syncSnapshots: caps?.syncSnapshots,
  };
}

export function overviewTabData(
  overview: ProjectOverviewResponse | null | undefined,
  workflowFilesFallback: WorkflowFileMetadata[] | null | undefined,
): {
  workflowFiles: WorkflowFileMetadata[];
  deploymentTargets: DeploymentTarget[];
  envMetadata: EnvVarMetadata[];
  syncSnapshot: ProjectOverviewResponse["syncSnapshot"] | null;
  snapshotEnabled: boolean;
} {
  const files = overview?.workflow.files ?? workflowFilesFallback;
  return {
    workflowFiles: files ?? [],
    deploymentTargets: overview?.deploymentTargets.items ?? [],
    envMetadata: overview?.environment.items ?? [],
    syncSnapshot: overview?.syncSnapshot ?? null,
    snapshotEnabled: overviewSnapshotEnabled(overview),
  };
}

function overviewSnapshotEnabled(
  overview: ProjectOverviewResponse | null | undefined,
): boolean {
  return overview?.syncSnapshot?.enabled === true;
}

export function isSyncAvailable(input: {
  projectSyncSnapshotsEnabled: boolean;
  overviewSyncSnapshots: boolean | undefined;
  snapshotEnabled: boolean | undefined;
}): boolean {
  return (
    input.projectSyncSnapshotsEnabled &&
    input.overviewSyncSnapshots === true &&
    input.snapshotEnabled === true
  );
}

export function isDriftQueryEnabled(input: {
  tab: ProjectDetailTab;
  driftDetectionEnabled: boolean;
  overviewDriftDetection: boolean | undefined;
}): boolean {
  return (
    input.tab === "overview" &&
    input.driftDetectionEnabled &&
    input.overviewDriftDetection === true
  );
}

export function isCiRunsQueryEnabled(input: {
  tab: ProjectDetailTab;
  ciRunTrackingEnabled: boolean;
  overviewCiRunTracking: boolean | undefined;
}): boolean {
  return (
    input.tab === "runs" &&
    input.ciRunTrackingEnabled &&
    input.overviewCiRunTracking === true
  );
}

export function isDeploymentsQueryEnabled(input: {
  tab: ProjectDetailTab;
  deploymentHistoryEnabled: boolean;
  overviewDeploymentHistory: boolean | undefined;
}): boolean {
  return (
    input.tab === "hosting" &&
    input.deploymentHistoryEnabled &&
    input.overviewDeploymentHistory === true
  );
}

export function isWorkflowSettingsQueryEnabled(input: {
  tab: ProjectDetailTab;
  workflowSettingsPreviewEnabled: boolean;
  overviewWorkflowSettings: boolean | undefined;
}): boolean {
  return (
    input.tab === "workflow" &&
    input.workflowSettingsPreviewEnabled &&
    input.overviewWorkflowSettings === true
  );
}

export function isAuditQueryEnabled(tab: ProjectDetailTab): boolean {
  return tab === "audit";
}

export function snapshotFindingLabel(count: number): string {
  return `${count} finding${count === 1 ? "" : "s"}`;
}

export function stagesLabel(count: number): string {
  if (!count) return "Not configured";
  return `${count} gated workflow stages`;
}

export function ciAuthLabel(status: string | undefined): string {
  return status ?? "Not loaded";
}

export function targetsCountLabel(count: number | undefined): string {
  if (count === undefined) return "Not loaded";
  return String(count);
}

export function hostingProviderLabel(provider: string): string {
  if (provider === "render") return "Render backend";
  return "Vercel frontend";
}

export function envMetadataLaneLabel(item: EnvVarMetadata): string {
  if (item.lane === "production") return "production";
  return `preview: ${item.gitBranch}`;
}

export function ciRunRowClass(conclusion: string | null): string {
  if (conclusion === "failure") return "failed";
  return "provisioned";
}

export function deploymentRowClass(status: string): string {
  if (status === "failed") return "failed";
  return "provisioned";
}

export function healthCheckRowClass(status: string): string {
  if (status === "error") return "failed";
  return "provisioned";
}

export function driftFindingRowClass(severity: string): string {
  if (severity === "error") return "failed";
  return "provisioned";
}

export function previewDiffBadgeClass(status: string): string {
  if (status === "changed") return "dash-badge-violet";
  return "branch-chip";
}

export function coverageHasPreset(threshold: number): boolean {
  const value = String(threshold);
  return COVERAGE_THRESHOLD_OPTIONS.some((option) => option.value === value);
}

export function centralRefIsListed(tags: string[], ref: string): boolean {
  return tags.includes(ref);
}

export function syncNowLabel(syncing: boolean): string {
  if (syncing) return "Syncing…";
  return "Sync now";
}

export function targetSyncLabel(syncing: boolean): string {
  if (syncing) return "Syncing…";
  return "Sync";
}

export function logsToggleLabel(open: boolean): string {
  if (open) return "Hide Logs";
  return "Logs";
}

export function detachButtonLabel(detaching: boolean, confirming: boolean): string {
  if (detaching) return "Detaching…";
  if (confirming) return "Confirm detach";
  return "Detach";
}

export function saveMetadataLabel(saving: boolean): string {
  if (saving) return "Saving...";
  return "Save metadata";
}

export function previewWorkflowLabel(previewing: boolean): string {
  if (previewing) return "Previewing...";
  return "Preview";
}

export function createUpdatePrLabel(creating: boolean): string {
  if (creating) return "Creating...";
  return "Create update PR";
}

export function driftCheckLabel(running: boolean): string {
  if (running) return "Checking...";
  return "Run drift check";
}

export function driftRepairButtonLabel(input: {
  repairing: boolean;
  confirming: boolean;
  action: ProjectDriftRepairAction;
}): string {
  if (input.repairing) return "Repairing...";
  if (input.confirming) return "Confirm repair";
  return driftRepairActionLabel(input.action);
}

export function targetSyncMessage(response: DeploymentTargetSyncResponse): string {
  const findingCount = response.findings.length;
  if (response.mode === "provider_live") {
    return liveSyncMessage(findingCount);
  }
  return localSyncMessage(findingCount, liveCheckUnavailable(response));
}

function liveSyncMessage(findingCount: number): string {
  if (findingCount) {
    return `Live status check completed with ${snapshotFindingLabel(findingCount)}.`;
  }
  return "Live status check completed.";
}

function localSyncMessage(findingCount: number, liveCheckFailed: boolean): string {
  const suffix = liveCheckFailed ? " (live check unavailable)" : "";
  if (findingCount) {
    return `Local metadata sync completed with ${snapshotFindingLabel(findingCount)}.${suffix}`;
  }
  return `Local metadata sync completed.${suffix}`;
}

function liveCheckUnavailable(response: DeploymentTargetSyncResponse): boolean {
  return response.findings.some(
    (finding) => finding.code === "provider_live_check_failed",
  );
}

export function targetDetachMessage(
  response: DetachDeploymentTargetResponse,
  target: DeploymentTarget,
): string {
  if (response.providerResourceDeleted) {
    return `Target detached from ALPHACI and the ${target.provider} resource was deleted.`;
  }
  if (response.providerDeleteError) {
    return detachProviderErrorMessage(response.providerDeleteError, target);
  }
  return "Target detached from ALPHACI. Provider resource was not deleted.";
}

function detachProviderErrorMessage(
  providerDeleteError: string,
  target: DeploymentTarget,
): string {
  const dashboard = target.dashboardUrl ? ` (${target.dashboardUrl})` : "";
  return `Target detached from ALPHACI, but the ${target.provider} resource could not be deleted automatically (${providerDeleteError}). Delete it manually from the provider dashboard${dashboard}.`;
}

export function driftRepairActionForCode(
  code: string,
  workflowUpdatePrEnabled: boolean,
): ProjectDriftRepairAction | null {
  if (code === "ci_token_missing" || code === "ci_token_revoked") {
    return "rotate_ci_token";
  }
  if (code === "deployment_target_metadata_missing") {
    return "detach_target";
  }
  if (
    code === "workflow_files_missing" ||
    code === "central_workflow_ref_outdated"
  ) {
    return workflowPrOrPreview(workflowUpdatePrEnabled);
  }
  return null;
}

function workflowPrOrPreview(
  workflowUpdatePrEnabled: boolean,
): ProjectDriftRepairAction {
  if (workflowUpdatePrEnabled) return "create_workflow_update_pr";
  return "regenerate_workflow_preview";
}

export function driftRepairActionLabel(action: ProjectDriftRepairAction): string {
  if (action === "rotate_ci_token") return "Rotate CI token";
  if (action === "detach_target") return "Detach target";
  if (action === "regenerate_workflow_preview") return "Preview workflow";
  if (action === "create_workflow_update_pr") return "Create update PR";
  return "Ignore finding";
}

export function replaceDeploymentTarget(
  overview: ProjectOverviewResponse,
  target: DeploymentTarget,
): ProjectOverviewResponse {
  const items = overview.deploymentTargets.items.map((item) =>
    item.id === target.id ? target : item,
  );
  return {
    ...overview,
    deploymentTargets: {
      ...overview.deploymentTargets,
      items,
    },
  };
}

export function upsertDeploymentTarget(
  overview: ProjectOverviewResponse,
  target: DeploymentTarget,
): ProjectOverviewResponse {
  const exists = overview.deploymentTargets.items.some(
    (item) => item.id === target.id,
  );
  const items = exists
    ? overview.deploymentTargets.items.map((item) =>
        item.id === target.id ? target : item,
      )
    : [target, ...overview.deploymentTargets.items];
  return {
    ...overview,
    deploymentTargets: {
      ...overview.deploymentTargets,
      items,
      count: items.length,
    },
  };
}

export function removeDeploymentTarget(
  overview: ProjectOverviewResponse,
  targetId: string,
): ProjectOverviewResponse {
  const items = overview.deploymentTargets.items.filter(
    (item) => item.id !== targetId,
  );
  return {
    ...overview,
    deploymentTargets: {
      ...overview.deploymentTargets,
      items,
      count: items.length,
    },
  };
}

export function applyTargetChange(
  current: ProjectOverviewResponse | null,
  projectId: string,
  target: DeploymentTarget,
): ProjectOverviewResponse | null {
  if (!current || current.project.id !== projectId) return current;
  return replaceDeploymentTarget(current, target);
}

export function applyTargetCreated(
  current: ProjectOverviewResponse | null,
  projectId: string,
  target: DeploymentTarget,
): ProjectOverviewResponse | null {
  if (!current || current.project.id !== projectId) return current;
  return upsertDeploymentTarget(current, target);
}

export function applyTargetDetached(
  current: ProjectOverviewResponse | null,
  projectId: string,
  targetId: string,
): ProjectOverviewResponse | null {
  if (!current || current.project.id !== projectId) return current;
  return removeDeploymentTarget(current, targetId);
}
