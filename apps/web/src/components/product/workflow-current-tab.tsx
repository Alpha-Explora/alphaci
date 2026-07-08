"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { useCapabilities } from "@/hooks/use-capabilities";
import {
  createWorkflowUpdatePullRequest,
  detachDeploymentTarget,
  getProjectCiRuns,
  getProjectDeployments,
  getProjectDrift,
  getProjectAuditEvents,
  getProjectOverview,
  getWorkflowSettings,
  previewWorkflowSettings,
  repairProjectDriftFinding,
  runProjectDriftDetection,
  syncDeploymentTarget,
  syncProjectSnapshot,
  updateDeploymentTarget,
} from "@/lib/api/projects";
import type {
  CreateProjectResult,
  DeploymentTarget,
  EnvEnvironment,
  EnvTargetSlot,
  EnvVarMetadata,
  ProjectOverviewResponse,
  ProjectCiRunsResponse,
  ProjectDeploymentsResponse,
  ProjectDriftResponse,
  ProjectDriftRepairAction,
  ProjectAuditEventsResponse,
  UpdateDeploymentTargetRequest,
  WorkflowSettings,
  WorkflowSettingsPreviewResponse,
  WorkflowUpdatePullRequestResponse,
  ProvisionedProject,
  WorkflowFileMetadata,
  WorkflowHistoryItem,
} from "@/lib/api/contracts";
import {
  providerConsoleUrl,
  providerDashboardUrl,
} from "@/lib/hosting/provider-urls";
import { ProjectEnvPanel } from "./project-env-panel";
import { DeploymentProvisioningSummary } from "./setup-result-panel";
import { FlowExplainer } from "./flow-explainer";
import { HelpTip } from "./help-tip";

import { formatDate, toSourcePath } from "./workflow-builder-utils";

interface WorkflowCurrentTabProps {
  history: WorkflowHistoryItem[];
  latestResult: CreateProjectResult | null;
  loadingHistory: boolean;
  loadingProjects: boolean;
  onCopyYaml: (yaml: string) => void;
  onDownloadYaml: (yaml: string, fileName: string) => void;
  onOpenSetup: () => void;
  projects: ProvisionedProject[];
}

type SubTab = "projects" | "history";
type ProjectDetailTab =
  | "overview"
  | "workflow"
  | "runs"
  | "hosting"
  | "environment"
  | "activity"
  | "audit"
  | "settings";

const PROJECT_DETAIL_TABS: Array<{ id: ProjectDetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "workflow", label: "Workflow" },
  { id: "runs", label: "Runs" },
  { id: "hosting", label: "Hosting" },
  { id: "environment", label: "Environment" },
  { id: "activity", label: "Activity" },
  { id: "audit", label: "Audit" },
  { id: "settings", label: "Settings" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 280, damping: 22 },
  },
};

function selectedChecks(project: ProvisionedProject): string {
  const options = project.projectOptions ?? {};
  const enabled = Object.entries(options)
    .filter(([, value]) => value === true)
    .map(([key]) => key);
  return enabled.length ? enabled.join(", ") : "None";
}

function statusVariant(status: string): string {
  if (status === "provisioned") return "provisioned";
  if (status === "provisioning" || status === "pending") return "provisioning";
  return "failed";
}

function WorkflowStageList({
  files,
}: Readonly<{ files?: WorkflowFileMetadata[] | null }>) {
  if (!files?.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <p
        style={{
          fontSize: "0.78rem",
          color: "var(--text-secondary)",
          margin: 0,
          fontWeight: 700,
        }}
      >
        {files.length} gated workflow stages
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {files.map((file) => (
          <div
            key={file.path}
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "baseline",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "0.76rem",
                color: "var(--text-primary)",
                fontWeight: 700,
              }}
            >
              {file.name}
            </span>
            <code
              style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                wordBreak: "break-all",
              }}
            >
              {file.path}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}

function allowedSlotForProvider(provider: DeploymentTarget["provider"]) {
  return provider === "vercel" ? "frontend" : "backend";
}

function DeploymentTargetsList({
  managementEnabled,
  onDetached,
  onTargetChanged,
  projectId,
  targets,
}: Readonly<{
  managementEnabled: boolean;
  onDetached: (targetId: string) => void;
  onTargetChanged: (target: DeploymentTarget) => void;
  projectId: string;
  targets: DeploymentTarget[];
}>) {
  const [editingTarget, setEditingTarget] = useState<DeploymentTarget | null>(
    null,
  );
  const [editValues, setEditValues] = useState<UpdateDeploymentTargetRequest>(
    {},
  );
  const [savingTargetId, setSavingTargetId] = useState<string | null>(null);
  const [syncingTargetId, setSyncingTargetId] = useState<string | null>(null);
  const [detachConfirmTargetId, setDetachConfirmTargetId] = useState<
    string | null
  >(null);
  const [detachingTargetId, setDetachingTargetId] = useState<string | null>(
    null,
  );
  const [targetMessage, setTargetMessage] = useState<string | null>(null);

  if (!targets.length) {
    return <p className="env-empty-state">No deployment targets configured.</p>;
  }

  const openEdit = (target: DeploymentTarget) => {
    setEditingTarget(target);
    setEditValues({
      slot: target.slot,
      providerProjectName: target.providerProjectName,
      branchName: target.branchName,
      rootDirectory: target.rootDirectory ?? "",
      buildCommand: target.buildCommand ?? "",
      startCommand: target.startCommand ?? "",
      renderEnvironmentName: target.renderEnvironmentName ?? null,
    });
    setTargetMessage(null);
  };

  const updateEditValue = <K extends keyof UpdateDeploymentTargetRequest>(
    key: K,
    value: UpdateDeploymentTargetRequest[K],
  ) => {
    setEditValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const saveEdit = async () => {
    if (!editingTarget) return;
    setSavingTargetId(editingTarget.id);
    setTargetMessage(null);
    try {
      const updatedTarget = await updateDeploymentTarget(
        projectId,
        editingTarget.id,
        {
          ...editValues,
          rootDirectory: editValues.rootDirectory?.trim() || null,
          buildCommand: editValues.buildCommand?.trim() || null,
          startCommand: editValues.startCommand?.trim() || null,
        },
      );
      onTargetChanged(updatedTarget);
      setEditingTarget(null);
      setTargetMessage("Target metadata updated.");
    } catch {
      setTargetMessage("Unable to update target metadata.");
    } finally {
      setSavingTargetId(null);
    }
  };

  const runSync = async (target: DeploymentTarget) => {
    setSyncingTargetId(target.id);
    setTargetMessage(null);
    try {
      const response = await syncDeploymentTarget(projectId, target.id);
      onTargetChanged(response.target);
      setTargetMessage(
        response.findings.length
          ? `Local metadata sync completed with ${response.findings.length} finding${response.findings.length === 1 ? "" : "s"}.`
          : "Local metadata sync completed.",
      );
    } catch {
      setTargetMessage("Unable to sync target metadata.");
    } finally {
      setSyncingTargetId(null);
    }
  };

  const detachTarget = async (target: DeploymentTarget) => {
    if (detachConfirmTargetId !== target.id) {
      setDetachConfirmTargetId(target.id);
      setTargetMessage(
        "Confirm detach to remove this target from ALPHACI only.",
      );
      return;
    }

    setDetachingTargetId(target.id);
    setTargetMessage(null);
    try {
      await detachDeploymentTarget(projectId, target.id);
      onDetached(target.id);
      setDetachConfirmTargetId(null);
      setTargetMessage(
        "Target detached from ALPHACI. Provider resource was not deleted.",
      );
    } catch {
      setTargetMessage("Unable to detach deployment target.");
    } finally {
      setDetachingTargetId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {targetMessage ? (
        <p className="env-empty-state">{targetMessage}</p>
      ) : null}
      <div className="env-metadata-list" data-tour="deployment-targets">
        {targets.map((target) => {
          const dashboardUrl = providerDashboardUrl(target);
          const consoleUrl = providerConsoleUrl(target);
          const isDetachConfirm = detachConfirmTargetId === target.id;
          return (
            <div
              key={target.id}
              className={`env-metadata-row ${target.status}`}
              style={{ alignItems: "flex-start" }}
            >
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.2rem",
                }}
              >
                <strong>{target.providerProjectName}</strong>
                <small>
                  {target.provider} · {target.slot} · {target.branchName}
                </small>
                <small style={{ color: "var(--text-muted)" }}>
                  Root: {target.rootDirectory || "."} · Build:{" "}
                  {target.buildCommand || "—"} · Start:{" "}
                  {target.startCommand || "—"}
                </small>
                {target.renderEnvironmentName ? (
                  <small style={{ color: "var(--text-muted)" }}>
                    Render env: {target.renderEnvironmentName}
                  </small>
                ) : null}
                <small style={{ color: "var(--text-muted)" }}>
                  ID: {target.providerProjectId}
                </small>
              </span>

              {/* Hierarchical action cluster */}
              <div className="target-actions">
                {/* Primary: Edit + Sync */}
                <div className="target-actions-primary">
                  <button
                    className="ghost-button target-action-btn"
                    type="button"
                    disabled={!managementEnabled}
                    onClick={() => openEdit(target)}
                  >
                    Edit
                  </button>
                  <button
                    className="ghost-button target-action-btn"
                    type="button"
                    disabled={
                      !managementEnabled || syncingTargetId === target.id
                    }
                    onClick={() => void runSync(target)}
                  >
                    {syncingTargetId === target.id ? "Syncing…" : "Sync"}
                  </button>
                </div>

                {/* Secondary: external provider dashboard */}
                {dashboardUrl ? (
                  <div className="target-actions-secondary">
                    <a
                      className="ghost-button target-action-btn"
                      href={dashboardUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Provider dashboard ↗
                    </a>
                    {consoleUrl ? (
                      <a
                        className="ghost-button target-action-btn"
                        href={consoleUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Live console ↗
                      </a>
                    ) : null}
                  </div>
                ) : null}

                {/* Coming soon hint — replaces a full disabled button */}
                <span
                  className="target-upcoming-hint"
                  title="Provider activation will be available in the next phase"
                >
                  Provider activation — coming soon
                </span>

                {/* Destructive: Detach — visually separated */}
                <div className="target-actions-destructive">
                  <button
                    className={`ghost-button target-action-btn ${isDetachConfirm ? "target-action-btn--confirm" : "target-action-btn--detach"}`}
                    type="button"
                    disabled={
                      !managementEnabled || detachingTargetId === target.id
                    }
                    onClick={() => void detachTarget(target)}
                  >
                    {detachingTargetId === target.id
                      ? "Detaching…"
                      : isDetachConfirm
                        ? "Confirm detach"
                        : "Detach"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {editingTarget ? (
        <div
          className="env-card"
          data-testid="target-edit-drawer"
          style={{ gap: "0.85rem" }}
        >
          <div>
            <h4 style={{ margin: 0 }}>Edit deployment target</h4>
            <p className="env-empty-state" style={{ margin: "0.25rem 0 0" }}>
              Metadata edits only. Provider resources and secrets are unchanged.
            </p>
          </div>
          <div className="env-form-grid">
            <label>
              Display name
              <input
                aria-label="Target display name"
                value={editValues.providerProjectName ?? ""}
                onChange={(event) =>
                  updateEditValue("providerProjectName", event.target.value)
                }
              />
            </label>
            <label>
              Slot
              <select
                aria-label="Target slot"
                value={
                  editValues.slot ??
                  allowedSlotForProvider(editingTarget.provider)
                }
                onChange={(event) =>
                  updateEditValue("slot", event.target.value as EnvTargetSlot)
                }
              >
                {editingTarget.provider === "render" ? (
                  <option value="backend">Backend</option>
                ) : (
                  <option value="frontend">Frontend</option>
                )}
              </select>
            </label>
            <label>
              Branch
              <input
                aria-label="Target branch"
                value={editValues.branchName ?? ""}
                onChange={(event) =>
                  updateEditValue("branchName", event.target.value)
                }
              />
            </label>
            <label>
              Root directory
              <input
                aria-label="Target root directory"
                value={editValues.rootDirectory ?? ""}
                onChange={(event) =>
                  updateEditValue("rootDirectory", event.target.value)
                }
              />
            </label>
            <label>
              Build command
              <input
                aria-label="Target build command"
                value={editValues.buildCommand ?? ""}
                onChange={(event) =>
                  updateEditValue("buildCommand", event.target.value)
                }
              />
            </label>
            <label>
              Start command
              <input
                aria-label="Target start command"
                value={editValues.startCommand ?? ""}
                onChange={(event) =>
                  updateEditValue("startCommand", event.target.value)
                }
              />
            </label>
            {editingTarget.provider === "render" ? (
              <label>
                Provider environment
                <select
                  aria-label="Target provider environment"
                  value={editValues.renderEnvironmentName ?? ""}
                  onChange={(event) =>
                    updateEditValue(
                      "renderEnvironmentName",
                      event.target.value as EnvEnvironment,
                    )
                  }
                >
                  <option value="">Not configured</option>
                  <option value="test">Test</option>
                  <option value="uat">UAT</option>
                  <option value="production">Production</option>
                </select>
              </label>
            ) : null}
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <button
              className="ghost-button"
              type="button"
              onClick={() => setEditingTarget(null)}
            >
              Cancel
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={savingTargetId === editingTarget.id}
              onClick={() => void saveEdit()}
            >
              {savingTargetId === editingTarget.id
                ? "Saving..."
                : "Save metadata"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EnvMetadataList({
  metadata,
}: Readonly<{ metadata: EnvVarMetadata[] }>) {
  if (!metadata.length) {
    return <p className="env-empty-state">No variables provisioned yet.</p>;
  }

  return (
    <div className="env-metadata-list">
      {metadata.map((item) => (
        <div key={item.id} className={`env-metadata-row ${item.status}`}>
          <span>{item.key}</span>
          <span>
            {item.environment} - {item.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function CiRunsList({
  response,
}: Readonly<{ response: ProjectCiRunsResponse | null }>) {
  if (!response) {
    return <p className="env-empty-state">Loading CI runs...</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {!response.liveGithubEnabled ? (
        <p className="env-empty-state" style={{ margin: 0 }}>
          Live GitHub run sync is not enabled
        </p>
      ) : null}
      {response.runs.length ? (
        <div className="env-metadata-list">
          {response.runs.map((run) => (
            <div
              key={run.id}
              className={`env-metadata-row ${run.conclusion === "failure" ? "failed" : "provisioned"}`}
            >
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.2rem",
                }}
              >
                <strong>{run.workflowName}</strong>
                <small>
                  {run.stage} - {run.branch} - {run.status}
                  {run.conclusion ? ` - ${run.conclusion}` : ""}
                </small>
                <small>
                  Commit {run.commitSha ?? "not available"} - Actor {run.actor}
                </small>
                <small>
                  {formatDate(run.createdAt)} - {formatDate(run.updatedAt)}
                </small>
              </span>
              <span
                style={{
                  display: "flex",
                  gap: "0.4rem",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <a
                  className="ghost-button"
                  href={run.htmlUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  GitHub run
                </a>
                {run.canRerun ? (
                  <button className="ghost-button" type="button">
                    Rerun
                  </button>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="env-empty-state">No CI runs tracked yet.</p>
      )}
    </div>
  );
}

function DeploymentHistoryList({
  response,
}: Readonly<{ response: ProjectDeploymentsResponse | null }>) {
  if (!response) {
    return <p className="env-empty-state">Loading deployment history...</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {!response.liveProvidersEnabled ? (
        <p className="env-empty-state" style={{ margin: 0 }}>
          Live deployment sync is not enabled
        </p>
      ) : null}
      {response.deployments.length ? (
        <div className="env-metadata-list">
          {response.deployments.map((deployment) => (
            <div
              key={deployment.id}
              className={`env-metadata-row ${
                deployment.status === "failed" ? "failed" : "provisioned"
              }`}
              style={{ alignItems: "flex-start" }}
            >
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.2rem",
                }}
              >
                <strong>{deployment.targetName}</strong>
                <small>
                  {deployment.provider} -{" "}
                  {deployment.environment ?? "environment not tracked"} -{" "}
                  {deployment.status}
                </small>
                <small>
                  Branch {deployment.branch ?? "not available"} - Commit{" "}
                  {deployment.commitSha ?? "not available"}
                </small>
                <small>
                  Created {formatDate(deployment.createdAt)} - Ready{" "}
                  {deployment.readyAt
                    ? formatDate(deployment.readyAt)
                    : "not ready"}
                </small>
              </span>
              <span
                style={{
                  display: "flex",
                  gap: "0.4rem",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <a
                  className="ghost-button"
                  href={deployment.providerUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Provider deployment
                </a>
                <a
                  className="ghost-button"
                  href={deployment.consoleUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Live console
                </a>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="env-empty-state">No deployment history tracked yet.</p>
      )}
    </div>
  );
}

function DriftFindingsPanel({
  onRun,
  onRepair,
  repairEnabled,
  response,
  running,
  workflowUpdatePrEnabled,
}: Readonly<{
  onRun: () => void;
  onRepair: (
    findingId: string,
    action: ProjectDriftRepairAction,
  ) => Promise<string>;
  repairEnabled: boolean;
  response: ProjectDriftResponse | null;
  running: boolean;
  workflowUpdatePrEnabled: boolean;
}>) {
  const [pendingRepair, setPendingRepair] = useState<{
    findingId: string;
    action: ProjectDriftRepairAction;
  } | null>(null);
  const [repairingFindingId, setRepairingFindingId] = useState<string | null>(
    null,
  );
  const [repairMessage, setRepairMessage] = useState<string | null>(null);

  if (!response) {
    return <p className="env-empty-state">Loading drift findings...</p>;
  }

  const actionForCode = (code: string): ProjectDriftRepairAction | null => {
    if (code === "ci_token_missing" || code === "ci_token_revoked")
      return "rotate_ci_token";
    if (code === "deployment_target_metadata_missing") return "detach_target";
    if (
      code === "workflow_files_missing" ||
      code === "central_workflow_ref_outdated"
    ) {
      return workflowUpdatePrEnabled
        ? "create_workflow_update_pr"
        : "regenerate_workflow_preview";
    }
    return null;
  };
  const labelForAction = (action: ProjectDriftRepairAction) => {
    if (action === "rotate_ci_token") return "Rotate CI token";
    if (action === "detach_target") return "Detach target";
    if (action === "regenerate_workflow_preview") return "Preview workflow";
    if (action === "create_workflow_update_pr") return "Create update PR";
    return "Ignore finding";
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "0.75rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h4 style={{ margin: 0, fontSize: "0.95rem" }}>Health findings</h4>
          <p className="env-empty-state" style={{ margin: "0.25rem 0 0" }}>
            Local snapshot
          </p>
        </div>
        <button
          className="ghost-button"
          type="button"
          disabled={running}
          onClick={onRun}
          style={{
            minHeight: "2rem",
            padding: "0.35rem 0.85rem",
            fontSize: "0.78rem",
          }}
        >
          {running ? "Checking..." : "Run drift check"}
        </button>
      </div>
      {repairMessage ? (
        <p className="env-empty-state" style={{ margin: 0 }}>
          {repairMessage}
        </p>
      ) : null}

      {response.findings.length ? (
        <div className="env-metadata-list">
          {response.findings.map((finding) => {
            const action = actionForCode(finding.code);
            const isConfirming =
              pendingRepair?.findingId === finding.id &&
              pendingRepair.action === action;
            return (
              <div
                key={finding.id}
                className={`env-metadata-row ${finding.severity === "error" ? "failed" : "provisioned"}`}
                style={{ alignItems: "flex-start" }}
              >
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.2rem",
                  }}
                >
                  <strong>{finding.code}</strong>
                  <small>
                    {finding.severity} - {finding.source} -{" "}
                    {formatDate(finding.detectedAt)}
                  </small>
                  <small>{finding.message}</small>
                </span>
                {repairEnabled && action ? (
                  <button
                    className="ghost-button"
                    type="button"
                    disabled={repairingFindingId === finding.id}
                    onClick={() => {
                      if (!isConfirming) {
                        setPendingRepair({ findingId: finding.id, action });
                        setRepairMessage(
                          "Confirm repair to run this local-safe action.",
                        );
                        return;
                      }
                      setRepairingFindingId(finding.id);
                      void onRepair(finding.id, action)
                        .then((message) => {
                          setRepairMessage(
                            `${message}. Run drift check again to refresh findings.`,
                          );
                          setPendingRepair(null);
                        })
                        .catch(() => {
                          setRepairMessage("Unable to run repair action.");
                        })
                        .finally(() => setRepairingFindingId(null));
                    }}
                    style={{
                      minHeight: "2rem",
                      padding: "0.35rem 0.7rem",
                      fontSize: "0.76rem",
                    }}
                  >
                    {repairingFindingId === finding.id
                      ? "Repairing..."
                      : isConfirming
                        ? "Confirm repair"
                        : labelForAction(action)}
                  </button>
                ) : action ? (
                  <button
                    className="ghost-button"
                    type="button"
                    disabled
                    title="Repair actions coming in the next phase"
                    style={{
                      minHeight: "2rem",
                      padding: "0.35rem 0.7rem",
                      fontSize: "0.76rem",
                    }}
                  >
                    Repair actions coming in the next phase
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="env-empty-state">No active drift findings.</p>
      )}
    </div>
  );
}

export function WorkflowCurrentTab({
  history,
  latestResult,
  loadingHistory,
  loadingProjects,
  onCopyYaml,
  onDownloadYaml,
  onOpenSetup,
  projects,
}: Readonly<WorkflowCurrentTabProps>) {
  const [subTab, setSubTab] = useState<SubTab>("projects");
  const [projectDetailTab, setProjectDetailTab] =
    useState<ProjectDetailTab>("overview");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [projectOverview, setProjectOverview] =
    useState<ProjectOverviewResponse | null>(null);
  const [projectOverviewError, setProjectOverviewError] = useState<{
    projectId: string;
    message: string;
  } | null>(null);
  const {
    envProvisioningEnabled,
    ciRunTrackingEnabled,
    deploymentHistoryEnabled,
    driftDetectionEnabled,
    driftRepairEnabled,
    projectTargetManagementEnabled,
    projectSyncSnapshotsEnabled,
    workflowSettingsPreviewEnabled,
    workflowUpdatePrEnabled,
  } = useCapabilities();
  const [syncingProjectId, setSyncingProjectId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [workflowSettings, setWorkflowSettings] =
    useState<WorkflowSettings | null>(null);
  const [workflowSettingsProjectId, setWorkflowSettingsProjectId] = useState<
    string | null
  >(null);
  const [workflowSettingsError, setWorkflowSettingsError] = useState<
    string | null
  >(null);
  const [workflowPreview, setWorkflowPreview] =
    useState<WorkflowSettingsPreviewResponse | null>(null);
  const [workflowUpdatePr, setWorkflowUpdatePr] =
    useState<WorkflowUpdatePullRequestResponse | null>(null);
  const [workflowUpdatePrError, setWorkflowUpdatePrError] = useState<
    string | null
  >(null);
  const [creatingWorkflowPr, setCreatingWorkflowPr] = useState(false);
  const [previewingWorkflow, setPreviewingWorkflow] = useState(false);
  const [ciRunsResponse, setCiRunsResponse] =
    useState<ProjectCiRunsResponse | null>(null);
  const [ciRunsProjectId, setCiRunsProjectId] = useState<string | null>(null);
  const [ciRunsError, setCiRunsError] = useState<string | null>(null);
  const [deploymentsResponse, setDeploymentsResponse] =
    useState<ProjectDeploymentsResponse | null>(null);
  const [deploymentsProjectId, setDeploymentsProjectId] = useState<
    string | null
  >(null);
  const [deploymentsError, setDeploymentsError] = useState<string | null>(null);
  const [driftResponse, setDriftResponse] =
    useState<ProjectDriftResponse | null>(null);
  const [driftProjectId, setDriftProjectId] = useState<string | null>(null);
  const [driftError, setDriftError] = useState<string | null>(null);
  const [runningDriftCheck, setRunningDriftCheck] = useState(false);
  const [auditResponse, setAuditResponse] =
    useState<ProjectAuditEventsResponse | null>(null);
  const [auditProjectId, setAuditProjectId] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const selectedProject = useMemo(() => {
    return (
      projects.find((project) => project.id === selectedProjectId) ??
      projects[0] ??
      null
    );
  }, [projects, selectedProjectId]);
  const selectedOverview =
    selectedProject && projectOverview?.project.id === selectedProject.id
      ? projectOverview
      : null;
  const selectedOverviewError =
    selectedProject && projectOverviewError?.projectId === selectedProject.id
      ? projectOverviewError.message
      : null;
  const loadingProjectOverview = Boolean(
    selectedProject && !selectedOverview && !selectedOverviewError,
  );
  const selectedWorkflowFiles =
    selectedOverview?.workflow.files ?? selectedProject?.workflowFiles ?? [];
  const deploymentTargets = selectedOverview?.deploymentTargets.items ?? [];
  const envMetadata = selectedOverview?.environment.items ?? [];
  const syncSnapshot = selectedOverview?.syncSnapshot ?? null;
  const syncAvailable =
    projectSyncSnapshotsEnabled &&
    selectedOverview?.capabilities.syncSnapshots === true &&
    syncSnapshot?.enabled === true;

  const handleTargetChanged = (target: DeploymentTarget) => {
    if (!selectedProject) return;
    setProjectOverview((current) => {
      if (!current || current.project.id !== selectedProject.id) return current;
      const items = current.deploymentTargets.items.map((item) =>
        item.id === target.id ? target : item,
      );
      return {
        ...current,
        deploymentTargets: {
          ...current.deploymentTargets,
          items,
        },
      };
    });
  };

  const handleTargetCreated = (target: DeploymentTarget) => {
    if (!selectedProject) return;
    setProjectOverview((current) => {
      if (!current || current.project.id !== selectedProject.id) return current;
      const exists = current.deploymentTargets.items.some(
        (item) => item.id === target.id,
      );
      const items = exists
        ? current.deploymentTargets.items.map((item) =>
            item.id === target.id ? target : item,
          )
        : [target, ...current.deploymentTargets.items];
      return {
        ...current,
        deploymentTargets: {
          ...current.deploymentTargets,
          items,
          count: items.length,
        },
      };
    });
  };

  const handleTargetDetached = (targetId: string) => {
    if (!selectedProject) return;
    setProjectOverview((current) => {
      if (!current || current.project.id !== selectedProject.id) return current;
      const items = current.deploymentTargets.items.filter(
        (item) => item.id !== targetId,
      );
      return {
        ...current,
        deploymentTargets: {
          ...current.deploymentTargets,
          items,
          count: items.length,
        },
      };
    });
  };

  useEffect(() => {
    if (!selectedProject) {
      return;
    }

    let active = true;
    void getProjectOverview(selectedProject.id)
      .then((overview) => {
        if (active) {
          setProjectOverview(overview);
          setProjectOverviewError(null);
        }
      })
      .catch(() => {
        if (active) {
          setProjectOverviewError({
            projectId: selectedProject.id,
            message: "Unable to load project overview.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [selectedProject]);

  useEffect(() => {
    if (
      !selectedProject ||
      projectDetailTab !== "workflow" ||
      !workflowSettingsPreviewEnabled
    ) {
      return;
    }

    if (workflowSettingsProjectId === selectedProject.id && workflowSettings) {
      return;
    }

    let active = true;
    void getWorkflowSettings(selectedProject.id)
      .then((response) => {
        if (active) {
          setWorkflowSettings(response.settings);
          setWorkflowSettingsProjectId(selectedProject.id);
          setWorkflowSettingsError(null);
          setWorkflowPreview(null);
          setWorkflowUpdatePr(null);
          setWorkflowUpdatePrError(null);
        }
      })
      .catch(() => {
        if (active) {
          setWorkflowSettingsError("Unable to load workflow settings.");
        }
      });

    return () => {
      active = false;
    };
  }, [
    projectDetailTab,
    selectedProject,
    workflowSettings,
    workflowSettingsPreviewEnabled,
    workflowSettingsProjectId,
  ]);

  useEffect(() => {
    if (!selectedProject || projectDetailTab !== "audit") {
      return;
    }
    if (auditProjectId === selectedProject.id && auditResponse) {
      return;
    }

    let active = true;
    setAuditResponse(null);
    setAuditError(null);
    void getProjectAuditEvents(selectedProject.id)
      .then((response) => {
        if (active) {
          setAuditResponse(response);
          setAuditProjectId(selectedProject.id);
        }
      })
      .catch(() => {
        if (active) {
          setAuditError("Unable to load audit events.");
        }
      });

    return () => {
      active = false;
    };
  }, [auditProjectId, auditResponse, projectDetailTab, selectedProject]);

  useEffect(() => {
    if (
      !selectedProject ||
      projectDetailTab !== "overview" ||
      !driftDetectionEnabled ||
      selectedOverview?.capabilities.driftDetection !== true
    ) {
      return;
    }

    if (driftProjectId === selectedProject.id && driftResponse) {
      return;
    }

    let active = true;
    setDriftResponse(null);
    setDriftError(null);
    void getProjectDrift(selectedProject.id)
      .then((response) => {
        if (active) {
          setDriftResponse(response);
          setDriftProjectId(selectedProject.id);
        }
      })
      .catch(() => {
        if (active) {
          setDriftError("Unable to load drift findings.");
        }
      });

    return () => {
      active = false;
    };
  }, [
    driftDetectionEnabled,
    driftProjectId,
    driftResponse,
    projectDetailTab,
    selectedOverview,
    selectedProject,
  ]);

  useEffect(() => {
    if (
      !selectedProject ||
      projectDetailTab !== "hosting" ||
      !deploymentHistoryEnabled ||
      selectedOverview?.capabilities.deploymentHistory !== true
    ) {
      return;
    }

    if (deploymentsProjectId === selectedProject.id && deploymentsResponse) {
      return;
    }

    let active = true;
    setDeploymentsResponse(null);
    setDeploymentsError(null);
    void getProjectDeployments(selectedProject.id)
      .then((response) => {
        if (active) {
          setDeploymentsResponse(response);
          setDeploymentsProjectId(selectedProject.id);
        }
      })
      .catch(() => {
        if (active) {
          setDeploymentsError("Unable to load deployment history.");
        }
      });

    return () => {
      active = false;
    };
  }, [
    deploymentHistoryEnabled,
    deploymentsProjectId,
    deploymentsResponse,
    projectDetailTab,
    selectedOverview,
    selectedProject,
  ]);

  useEffect(() => {
    if (
      !selectedProject ||
      projectDetailTab !== "runs" ||
      !ciRunTrackingEnabled ||
      selectedOverview?.capabilities.ciRunTracking !== true
    ) {
      return;
    }

    if (ciRunsProjectId === selectedProject.id && ciRunsResponse) {
      return;
    }

    let active = true;
    setCiRunsResponse(null);
    setCiRunsError(null);
    void getProjectCiRuns(selectedProject.id)
      .then((response) => {
        if (active) {
          setCiRunsResponse(response);
          setCiRunsProjectId(selectedProject.id);
        }
      })
      .catch(() => {
        if (active) {
          setCiRunsError("Unable to load CI runs.");
        }
      });

    return () => {
      active = false;
    };
  }, [
    ciRunTrackingEnabled,
    ciRunsProjectId,
    ciRunsResponse,
    projectDetailTab,
    selectedOverview,
    selectedProject,
  ]);

  async function handleProjectSync() {
    if (!selectedProject || !syncAvailable) {
      return;
    }

    setSyncingProjectId(selectedProject.id);
    setSyncMessage(null);
    try {
      const result = await syncProjectSnapshot(selectedProject.id);
      setProjectOverview(result.overview);
    } catch {
      setSyncMessage("Unable to create local snapshot right now.");
    } finally {
      setSyncingProjectId(null);
    }
  }

  async function handleRunDriftDetection() {
    if (!selectedProject) {
      return;
    }

    setRunningDriftCheck(true);
    setDriftError(null);
    try {
      const response = await runProjectDriftDetection(selectedProject.id);
      setDriftResponse(response);
      setDriftProjectId(selectedProject.id);
    } catch {
      setDriftError("Unable to run drift detection.");
    } finally {
      setRunningDriftCheck(false);
    }
  }

  async function handleRepairDriftFinding(
    findingId: string,
    action: ProjectDriftRepairAction,
  ): Promise<string> {
    if (!selectedProject) {
      throw new Error("Project is not selected.");
    }

    const response = await repairProjectDriftFinding(
      selectedProject.id,
      findingId,
      action,
    );
    return response.message;
  }

  async function handleWorkflowPreview() {
    if (!selectedProject || !workflowSettings) {
      return;
    }

    setPreviewingWorkflow(true);
    setWorkflowSettingsError(null);
    try {
      const result = await previewWorkflowSettings(
        selectedProject.id,
        workflowSettings,
      );
      setWorkflowPreview(result);
      setWorkflowSettings(result.settings);
      setWorkflowUpdatePr(null);
      setWorkflowUpdatePrError(null);
    } catch {
      setWorkflowSettingsError("Unable to preview workflow settings.");
    } finally {
      setPreviewingWorkflow(false);
    }
  }

  async function handleCreateWorkflowPr() {
    if (!selectedProject || !workflowSettings || !workflowPreview) {
      return;
    }

    setCreatingWorkflowPr(true);
    setWorkflowUpdatePrError(null);
    try {
      const result = await createWorkflowUpdatePullRequest(
        selectedProject.id,
        workflowSettings,
      );
      setWorkflowUpdatePr(result);
    } catch {
      setWorkflowUpdatePrError("Unable to create workflow update PR.");
    } finally {
      setCreatingWorkflowPr(false);
    }
  }

  return (
    <motion.section
      className="tab-content-panel"
      id="workflow-panel-current"
      role="tabpanel"
      aria-labelledby="workflow-tab-current"
      tabIndex={0}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: "transparent",
        border: "none",
        boxShadow: "none",
        padding: 0,
      }}
    >
      {/* ── Latest result banner ──────────────────────────────────── */}
      {latestResult ? (
        <div className="latest-result-banner glass-panel">
          <div className="latest-result-banner__header">
            <span className="latest-result-banner__dot" aria-hidden="true" />
            <p className="eyebrow latest-result-banner__eyebrow">
              Project Created Successfully
            </p>
            <span className="latest-result-banner__sep" aria-hidden="true">
              ·
            </span>
            <span className="latest-result-banner__repo">
              {latestResult.repoFullName}
            </span>
          </div>

          <div className="result-branches latest-result-banner__chips">
            <span className="branch-chip">{latestResult.status}</span>
            <span className="branch-chip">{latestResult.projectTypeId}</span>
            <span className="branch-chip">{latestResult.workflowRecipeId}</span>
            {latestResult.branchesCreated.map((branch) => (
              <span key={branch} className="branch-chip branch-chip--mono">
                {branch}
              </span>
            ))}
          </div>

          <p className="latest-result-banner__meta">
            Workflow file:{" "}
            <strong className="latest-result-banner__filename">
              {latestResult.outputFileName}
            </strong>
            {latestResult.githubCommitUrl ? (
              <a
                href={latestResult.githubCommitUrl}
                target="_blank"
                rel="noreferrer"
                className="latest-result-banner__commit-link"
              >
                commit:{" "}
                <span className="latest-result-banner__sha">
                  {latestResult.githubCommitSha.slice(0, 10)}
                </span>
              </a>
            ) : (
              <code className="latest-result-banner__sha-plain">
                {latestResult.githubCommitSha.slice(0, 10)}
              </code>
            )}
          </p>

          <WorkflowStageList files={latestResult.workflowFiles} />
          <DeploymentProvisioningSummary
            result={latestResult.deploymentProvisioning}
          />

          <div className="latest-result-banner__actions">
            <a
              className="latest-result-banner__action-btn latest-result-banner__action-btn--primary"
              href={latestResult.repoUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Repository
            </a>
            <a
              className="latest-result-banner__action-btn"
              href={`${latestResult.repoUrl}/actions`}
              target="_blank"
              rel="noreferrer"
            >
              Open Actions
            </a>
            <a
              className="latest-result-banner__action-btn"
              href={`${latestResult.repoUrl}/blob/main/${latestResult.workflowPath}`}
              target="_blank"
              rel="noreferrer"
            >
              View Workflow File
            </a>
          </div>

          <p className="latest-result-banner__footer">
            Workflow committed to{" "}
            <code className="file-path-label">{latestResult.workflowPath}</code>{" "}
            on <code className="file-path-label">main</code>. Push to{" "}
            <code className="file-path-label">test</code> to trigger your first
            CI run.
          </p>
        </div>
      ) : null}

      {/* ── Sub-tab bar ───────────────────────────────────────────── */}
      <div
        className="current-subtab-bar"
        role="tablist"
        aria-label="Current tab sections"
        data-tour="subtab-bar"
      >
        {(["projects", "history"] as SubTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`subtab-${tab}`}
            aria-controls={`subtab-panel-${tab}`}
            aria-selected={subTab === tab}
            onClick={() => setSubTab(tab)}
            className={`current-subtab-btn${subTab === tab ? " active" : ""}`}
          >
            {subTab === tab && (
              <motion.span
                layoutId="current-subtab-indicator"
                className="current-subtab-indicator"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                aria-hidden="true"
              />
            )}
            <span style={{ position: "relative", zIndex: 1 }}>
              {tab === "projects" ? "Projects" : "History"}
            </span>
            {tab === "projects" && !loadingProjects && projects.length > 0 && (
              <span className="current-subtab-count">{projects.length}</span>
            )}
            {tab === "history" && !loadingHistory && history.length > 0 && (
              <span className="current-subtab-count">{history.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Projects panel ───────────────────────────────────────── */}
      {subTab === "projects" && (
        <div
          id="subtab-panel-projects"
          role="tabpanel"
          aria-labelledby="subtab-projects"
        >
          {loadingProjects ? (
            <div className="repo-grid">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="skeleton-card glass-panel"
                  style={{
                    minHeight: "12rem",
                    background: "rgba(15, 23, 42, 0.3)",
                    animation: "state-pulse 1.5s infinite",
                  }}
                />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div
              className="glass-panel"
              style={{
                padding: "2.5rem 1.5rem",
                textAlign: "center",
                background: "rgba(15, 23, 42, 0.3)",
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
                alignItems: "center",
              }}
            >
              <div>
                <p
                  style={{
                    color: "var(--text-primary)",
                    margin: "0 0 0.5rem",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                  }}
                >
                  No provisioned projects yet.
                </p>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    margin: 0,
                    fontSize: "0.85rem",
                    maxWidth: "32rem",
                  }}
                >
                  When you create one, ALPHACI provisions the repository
                  and commits a workflow that runs through the gated stages
                  below on every change. A read-only demo project normally
                  appears here too — open the{" "}
                  <Link href="/guide" className="inline-link">
                    guide
                  </Link>{" "}
                  to see how it all fits together.
                </p>
              </div>
              <div
                style={{
                  width: "100%",
                  maxWidth: "32rem",
                  padding: "1rem",
                  borderRadius: "var(--radius-card)",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--border-soft)",
                }}
              >
                <FlowExplainer variant="compact" />
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={onOpenSetup}
                style={{
                  padding: "0.6rem 1.4rem",
                  fontSize: "0.88rem",
                  minHeight: "2.5rem",
                }}
              >
                Create your first project
              </button>
            </div>
          ) : selectedProject ? (
            <motion.div
              className="project-workspace"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              <aside
                className="project-list"
                aria-label="Provisioned projects"
                data-tour="projects-list"
              >
                <div className="project-list-header">
                  <span>Projects</span>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={onOpenSetup}
                  >
                    New
                  </button>
                </div>
                {projects.map((project) => {
                  const isSelected = selectedProject.id === project.id;
                  return (
                    <button
                      key={project.id}
                      className={`project-list-item${isSelected ? " selected" : ""}`}
                      data-project-id={project.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedProjectId(project.id);
                        setProjectDetailTab("overview");
                      }}
                    >
                      <span className="project-list-title">
                        {project.repoFullName.split("/")[1] ??
                          project.repoFullName}
                      </span>
                      <span className="project-list-meta">
                        {project.serviceName}
                      </span>
                      <span className="project-list-badges">
                        {project.isExample ? (
                          <span className="project-demo-badge">Demo</span>
                        ) : null}
                        <span
                          className={`project-status-badge ${statusVariant(project.status)}`}
                        >
                          {project.status}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </aside>

              <motion.article
                key={selectedProject.id}
                variants={cardVariants}
                className="project-detail-panel"
              >
                <div className="project-detail-header">
                  <div>
                    <h3>{selectedProject.repoFullName}</h3>
                    <p>{selectedProject.serviceName}</p>
                  </div>
                  <span className="project-detail-header-badges">
                    {selectedProject.isExample ? (
                      <span className="project-demo-badge">
                        Demo · read-only
                      </span>
                    ) : null}
                    <span
                      className={`project-status-badge ${statusVariant(selectedProject.status)}`}
                    >
                      {selectedProject.status}
                    </span>
                  </span>
                </div>

                {selectedProject.isExample ? (
                  <p className="project-demo-note">
                    This is a read-only demo project ALPHACI seeds for
                    every account. It shows how a provisioned project looks end
                    to end — the gated stages, promotion flow, and deploys
                    explained in the{" "}
                    <Link href="/guide#branch-strategy" className="inline-link">
                      guide
                    </Link>{" "}
                    — but it is not connected to a real GitHub repository.
                    Create your own project to run a live pipeline.
                  </p>
                ) : null}

                <div className="project-detail-actions">
                  <Link
                    className="ghost-button"
                    href={`/projects/${encodeURIComponent(selectedProject.id)}`}
                  >
                    Project page
                  </Link>
                  {selectedProject.repoUrl ? (
                    <>
                      <a
                        className="ghost-button"
                        href={selectedProject.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Repo
                      </a>
                      <a
                        className="ghost-button"
                        href={`${selectedProject.repoUrl}/actions`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Actions
                      </a>
                    </>
                  ) : null}
                  {selectedProject.githubCommitUrl ? (
                    <a
                      className="ghost-button"
                      href={selectedProject.githubCommitUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Commit
                    </a>
                  ) : null}
                  {envProvisioningEnabled &&
                  selectedProject.status === "provisioned" &&
                  !selectedProject.isExample ? (
                    <button
                      className="ghost-button env-action-button"
                      type="button"
                      onClick={() => {
                        setProjectDetailTab("environment");
                      }}
                    >
                      Environment Variables
                    </button>
                  ) : null}
                </div>

                <div
                  className="project-inner-tabs"
                  role="tablist"
                  aria-label="Project detail sections"
                  data-tour="project-detail-tabs"
                >
                  {PROJECT_DETAIL_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={projectDetailTab === tab.id}
                      className={`project-inner-tab${projectDetailTab === tab.id ? " active" : ""}`}
                      onClick={() => setProjectDetailTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {loadingProjectOverview ? (
                  <p className="env-empty-state">Loading project overview...</p>
                ) : null}
                {selectedOverviewError ? (
                  <p className="error-text" style={{ margin: 0 }}>
                    {selectedOverviewError}
                  </p>
                ) : null}

                {projectDetailTab === "overview" ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    <dl className="project-detail-grid">
                      <div>
                        <dt>Workflow</dt>
                        <dd>
                          {selectedOverview?.workflow.path ??
                            selectedProject.workflowPath}
                        </dd>
                      </div>
                      <div>
                        <dt>Checks</dt>
                        <dd>{selectedChecks(selectedProject)}</dd>
                      </div>
                      {selectedProject.githubCommitSha ? (
                        <div>
                          <dt>Commit</dt>
                          <dd>
                            {selectedProject.githubCommitSha.slice(0, 10)}
                          </dd>
                        </div>
                      ) : null}
                      <div>
                        <dt>Stages</dt>
                        <dd>
                          {selectedWorkflowFiles.length
                            ? `${selectedWorkflowFiles.length} gated workflow stages`
                            : "Not configured"}
                        </dd>
                      </div>
                      <div>
                        <dt>CI token</dt>
                        <dd>
                          {selectedOverview?.ciAuth.status ?? "Not loaded"}
                        </dd>
                      </div>
                      <div>
                        <dt>Targets</dt>
                        <dd>
                          {selectedOverview
                            ? selectedOverview.deploymentTargets.count
                            : "Not loaded"}
                        </dd>
                      </div>
                    </dl>

                    {syncSnapshot ? (
                      <div
                        className="env-metadata-row provisioned"
                        style={{ alignItems: "center" }}
                      >
                        <span>
                          <strong>Local snapshot</strong>
                          <br />
                          {syncSnapshot.latest
                            ? `${syncSnapshot.latest.status} - ${syncSnapshot.latest.findings.length} finding${syncSnapshot.latest.findings.length === 1 ? "" : "s"} - ${formatDate(syncSnapshot.latest.completedAt)}`
                            : "Not synced yet"}
                        </span>
                        {syncAvailable ? (
                          <button
                            className="ghost-button target-action-btn"
                            type="button"
                            disabled={syncingProjectId === selectedProject.id}
                            onClick={handleProjectSync}
                          >
                            {syncingProjectId === selectedProject.id
                              ? "Syncing…"
                              : "Sync now"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {syncMessage ? (
                      <p className="error-text" style={{ margin: 0 }}>
                        {syncMessage}
                      </p>
                    ) : null}

                    {selectedProject.failureReason ? (
                      <p className="error-text" style={{ margin: 0 }}>
                        {selectedProject.failureReason}
                      </p>
                    ) : null}

                    {selectedOverview?.health.checks.length ? (
                      <div
                        className="env-metadata-list"
                        data-tour="sync-health"
                      >
                        {selectedOverview.health.checks.map((check) => (
                          <div
                            key={check.key}
                            className={`env-metadata-row ${check.status === "error" ? "failed" : "provisioned"}`}
                          >
                            <span>{check.label}</span>
                            <span>{check.message}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {driftDetectionEnabled &&
                    selectedOverview?.capabilities.driftDetection ? (
                      driftError ? (
                        <p className="error-text" style={{ margin: 0 }}>
                          {driftError}
                        </p>
                      ) : (
                        <DriftFindingsPanel
                          onRun={() => void handleRunDriftDetection()}
                          onRepair={handleRepairDriftFinding}
                          repairEnabled={driftRepairEnabled}
                          response={driftResponse}
                          running={runningDriftCheck}
                          workflowUpdatePrEnabled={workflowUpdatePrEnabled}
                        />
                      )
                    ) : null}
                  </div>
                ) : null}

                {projectDetailTab === "workflow" ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.85rem",
                    }}
                  >
                    {workflowSettingsPreviewEnabled &&
                    selectedOverview?.capabilities.workflowSettings ? (
                      <div
                        className="glass-panel"
                        style={{
                          padding: "1rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.85rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "0.75rem",
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <h4 style={{ margin: 0, fontSize: "0.95rem" }}>
                              Workflow settings
                            </h4>
                            <p
                              style={{
                                margin: "0.25rem 0 0",
                                color: "var(--text-secondary)",
                                fontSize: "0.78rem",
                              }}
                            >
                              Preview only
                            </p>
                          </div>
                          <button
                            className="ghost-button"
                            type="button"
                            disabled={!workflowSettings || previewingWorkflow}
                            onClick={handleWorkflowPreview}
                            style={{
                              minHeight: "2rem",
                              padding: "0.35rem 0.85rem",
                              fontSize: "0.78rem",
                            }}
                          >
                            {previewingWorkflow ? "Previewing..." : "Preview"}
                          </button>
                        </div>

                        {workflowSettings ? (
                          <div className="project-detail-grid">
                            <label>
                              <dt>Node version</dt>
                              <input
                                aria-label="Node version"
                                value={workflowSettings.nodeVersion}
                                onChange={(event) => {
                                  setWorkflowSettings({
                                    ...workflowSettings,
                                    nodeVersion: event.target.value,
                                  });
                                }}
                              />
                            </label>
                            <label>
                              <dt>
                                Coverage threshold
                                <HelpTip text="The minimum percentage of code that unit tests must exercise. Pipeline runs fail the Quality stage if coverage drops below this number." />
                              </dt>
                              <input
                                aria-label="Coverage threshold"
                                type="number"
                                min={0}
                                max={100}
                                value={workflowSettings.coverageThreshold}
                                onChange={(event) => {
                                  setWorkflowSettings({
                                    ...workflowSettings,
                                    coverageThreshold: Number(
                                      event.target.value,
                                    ),
                                  });
                                }}
                              />
                            </label>
                            <label>
                              <dt>
                                Service path
                                <HelpTip text="The folder inside the repository where this service's code lives. Used to scope which files trigger this workflow and where build commands run." />
                              </dt>
                              <input
                                aria-label="Service path"
                                value={workflowSettings.servicePath}
                                onChange={(event) => {
                                  setWorkflowSettings({
                                    ...workflowSettings,
                                    servicePath: event.target.value,
                                  });
                                }}
                              />
                            </label>
                            <label>
                              <dt>
                                Central workflow ref
                                <HelpTip text="The branch or tag of ImplementSprint/central-workflow that this project's pipeline is pinned to. It supplies the reusable gated-stage logic — Access, Quality, Package — that every generated workflow calls into." />
                              </dt>
                              <input
                                aria-label="Central workflow ref"
                                value={workflowSettings.centralWorkflowRef}
                                onChange={(event) => {
                                  setWorkflowSettings({
                                    ...workflowSettings,
                                    centralWorkflowRef: event.target.value,
                                  });
                                }}
                              />
                            </label>
                            <label>
                              <dt>Workflow recipe</dt>
                              <input
                                aria-label="Workflow recipe"
                                value={workflowSettings.workflowRecipeId ?? ""}
                                onChange={(event) => {
                                  setWorkflowSettings({
                                    ...workflowSettings,
                                    workflowRecipeId:
                                      event.target.value || null,
                                  });
                                }}
                              />
                            </label>
                            <label>
                              <dt>Package manager</dt>
                              <select
                                aria-label="Package manager"
                                value={workflowSettings.packageManager}
                                disabled
                              >
                                <option value="npm">npm</option>
                              </select>
                            </label>
                            <label>
                              <dt>Lint</dt>
                              <input
                                aria-label="Lint"
                                type="checkbox"
                                checked={workflowSettings.checks.lint}
                                onChange={(event) => {
                                  setWorkflowSettings({
                                    ...workflowSettings,
                                    checks: {
                                      ...workflowSettings.checks,
                                      lint: event.target.checked,
                                    },
                                  });
                                }}
                              />
                            </label>
                            <label>
                              <dt>Unit tests</dt>
                              <input
                                aria-label="Unit tests"
                                type="checkbox"
                                checked={workflowSettings.checks.unit}
                                onChange={(event) => {
                                  setWorkflowSettings({
                                    ...workflowSettings,
                                    checks: {
                                      ...workflowSettings.checks,
                                      unit: event.target.checked,
                                    },
                                  });
                                }}
                              />
                            </label>
                            <label>
                              <dt>Build</dt>
                              <input
                                aria-label="Build"
                                type="checkbox"
                                checked={workflowSettings.checks.build}
                                onChange={(event) => {
                                  setWorkflowSettings({
                                    ...workflowSettings,
                                    checks: {
                                      ...workflowSettings.checks,
                                      build: event.target.checked,
                                    },
                                  });
                                }}
                              />
                            </label>
                            <label>
                              <dt>Security</dt>
                              <input
                                aria-label="Security"
                                type="checkbox"
                                checked={workflowSettings.checks.security}
                                onChange={(event) => {
                                  setWorkflowSettings({
                                    ...workflowSettings,
                                    checks: {
                                      ...workflowSettings.checks,
                                      security: event.target.checked,
                                    },
                                  });
                                }}
                              />
                            </label>
                          </div>
                        ) : (
                          <p className="env-empty-state">
                            Loading workflow settings...
                          </p>
                        )}

                        <div>
                          <h4
                            style={{
                              margin: "0 0 0.5rem",
                              fontSize: "0.85rem",
                            }}
                          >
                            Deploy target mappings
                          </h4>
                          {deploymentTargets.length ? (
                            <div className="env-metadata-list">
                              {deploymentTargets.map((target) => (
                                <div
                                  key={target.id}
                                  className="env-metadata-row provisioned"
                                >
                                  <span>{target.slot}</span>
                                  <span>
                                    {target.providerProjectName} /{" "}
                                    {target.branchName}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="env-empty-state">
                              No deployment target mappings.
                            </p>
                          )}
                        </div>

                        {workflowSettingsError ? (
                          <p className="error-text" style={{ margin: 0 }}>
                            {workflowSettingsError}
                          </p>
                        ) : null}

                        {workflowPreview?.validationWarnings.length ? (
                          <div className="env-metadata-list">
                            {workflowPreview.validationWarnings.map(
                              (warning) => (
                                <div
                                  key={`${warning.field}-${warning.message}`}
                                  className="env-metadata-row failed"
                                >
                                  <span>{warning.field}</span>
                                  <span>{warning.message}</span>
                                </div>
                              ),
                            )}
                          </div>
                        ) : null}

                        {workflowPreview ? (
                          <>
                            <div className="env-metadata-list">
                              {workflowPreview.diffSummary.map((item) => (
                                <div
                                  key={item.path}
                                  className="env-metadata-row provisioned"
                                >
                                  <span>{item.path}</span>
                                  <span
                                    className={
                                      item.status === "changed"
                                        ? "dash-badge-violet"
                                        : "branch-chip"
                                    }
                                  >
                                    {item.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {workflowUpdatePrEnabled ? (
                              <div
                                style={{
                                  display: "flex",
                                  gap: "0.75rem",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                }}
                              >
                                <button
                                  className="primary-button"
                                  type="button"
                                  disabled={creatingWorkflowPr}
                                  onClick={handleCreateWorkflowPr}
                                  style={{
                                    minHeight: "2rem",
                                    padding: "0.35rem 0.85rem",
                                    fontSize: "0.78rem",
                                  }}
                                >
                                  {creatingWorkflowPr
                                    ? "Creating..."
                                    : "Create update PR"}
                                </button>
                                {workflowUpdatePr ? (
                                  <a
                                    className="ghost-button"
                                    href={workflowUpdatePr.pullRequestUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      minHeight: "2rem",
                                      padding: "0.35rem 0.85rem",
                                      fontSize: "0.78rem",
                                    }}
                                  >
                                    {workflowUpdatePr.pullRequestUrl}
                                  </a>
                                ) : null}
                              </div>
                            ) : null}
                            {workflowUpdatePrError ? (
                              <p className="error-text" style={{ margin: 0 }}>
                                {workflowUpdatePrError}
                              </p>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    {selectedWorkflowFiles.length ? (
                      <WorkflowStageList files={selectedWorkflowFiles} />
                    ) : (
                      <p className="env-empty-state">
                        No workflow file metadata is tracked yet.
                      </p>
                    )}
                  </div>
                ) : null}

                {projectDetailTab === "runs" ? (
                  ciRunTrackingEnabled &&
                  selectedOverview?.capabilities.ciRunTracking ? (
                    ciRunsError ? (
                      <p className="error-text" style={{ margin: 0 }}>
                        {ciRunsError}
                      </p>
                    ) : (
                      <CiRunsList response={ciRunsResponse} />
                    )
                  ) : (
                    <p className="env-empty-state">
                      CI run tracking is not enabled.
                    </p>
                  )
                ) : null}

                {projectDetailTab === "hosting" ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    {envProvisioningEnabled &&
                    selectedProject.status === "provisioned" ? (
                      <ProjectEnvPanel
                        onTargetCreated={handleTargetCreated}
                        project={selectedProject}
                        section="hosting"
                      />
                    ) : (
                      <p className="env-empty-state">
                        Hosting service provisioning is not enabled.
                      </p>
                    )}
                    {deploymentHistoryEnabled &&
                    selectedOverview?.capabilities.deploymentHistory ? (
                      deploymentsError ? (
                        <p className="error-text" style={{ margin: 0 }}>
                          {deploymentsError}
                        </p>
                      ) : (
                        <DeploymentHistoryList response={deploymentsResponse} />
                      )
                    ) : (
                      <p className="env-empty-state">
                        Deployment history is not enabled.
                      </p>
                    )}
                    <DeploymentTargetsList
                      managementEnabled={projectTargetManagementEnabled}
                      onDetached={handleTargetDetached}
                      onTargetChanged={handleTargetChanged}
                      projectId={selectedProject.id}
                      targets={deploymentTargets}
                    />
                  </div>
                ) : null}

                {projectDetailTab === "environment" ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    {envProvisioningEnabled &&
                    selectedProject.status === "provisioned" ? (
                      <ProjectEnvPanel
                        project={selectedProject}
                        section="variables"
                      />
                    ) : (
                      <EnvMetadataList metadata={envMetadata} />
                    )}
                  </div>
                ) : null}

                {projectDetailTab === "activity" ? (
                  <div className="env-metadata-list">
                    {selectedProject.githubCommitUrl ? (
                      <div className="env-metadata-row provisioned">
                        <span>Latest workflow commit</span>
                        <span>
                          {selectedProject.githubCommitSha?.slice(0, 10) ??
                            "Unknown"}
                        </span>
                      </div>
                    ) : null}
                    {syncSnapshot?.latest ? (
                      <div className="env-metadata-row provisioned">
                        <span>Last local snapshot</span>
                        <span>
                          {formatDate(syncSnapshot.latest.completedAt)}
                        </span>
                      </div>
                    ) : null}
                    {!selectedProject.githubCommitUrl &&
                    !syncSnapshot?.latest ? (
                      <p className="env-empty-state">No activity events yet.</p>
                    ) : null}
                  </div>
                ) : null}

                {projectDetailTab === "audit" ? (
                  auditError ? (
                    <p className="error-text" style={{ margin: 0 }}>
                      {auditError}
                    </p>
                  ) : auditResponse?.items.length ? (
                    <div className="env-metadata-list">
                      {auditResponse.items.map((event) => (
                        <div
                          key={event.id}
                          className="env-metadata-row provisioned"
                        >
                          <span>{event.eventCode}</span>
                          <span>{event.message}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="env-empty-state">No audit events yet.</p>
                  )
                ) : null}

                {projectDetailTab === "settings" ? (
                  <dl className="project-detail-grid">
                    <div>
                      <dt>Project ID</dt>
                      <dd>{selectedProject.id}</dd>
                    </div>
                    <div>
                      <dt>Repository</dt>
                      <dd>{selectedProject.repoFullName}</dd>
                    </div>
                    <div>
                      <dt>Project type</dt>
                      <dd>
                        {selectedProject.projectTypeId ?? "Not configured"}
                      </dd>
                    </div>
                    <div>
                      <dt>Workflow recipe</dt>
                      <dd>
                        {selectedProject.workflowRecipeId ?? "Not configured"}
                      </dd>
                    </div>
                    <div>
                      <dt>Visibility</dt>
                      <dd>{selectedProject.visibility ?? "Not configured"}</dd>
                    </div>
                    <div>
                      <dt>Repo shape</dt>
                      <dd>{selectedProject.repoShape ?? "Not configured"}</dd>
                    </div>
                  </dl>
                ) : null}
              </motion.article>
            </motion.div>
          ) : null}
        </div>
      )}

      {/* ── History panel ─────────────────────────────────────────── */}
      {subTab === "history" && (
        <div
          id="subtab-panel-history"
          role="tabpanel"
          aria-labelledby="subtab-history"
        >
          {loadingHistory ? (
            <div className="repo-grid">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="skeleton-card glass-panel"
                  style={{
                    minHeight: "10rem",
                    background: "rgba(15, 23, 42, 0.3)",
                    animation: "state-pulse 1.5s infinite",
                  }}
                />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div
              className="glass-panel"
              style={{
                padding: "3rem 1.5rem",
                textAlign: "center",
                background: "rgba(15, 23, 42, 0.3)",
              }}
            >
              <p
                style={{
                  color: "var(--text-secondary)",
                  margin: "0 0 1.25rem",
                  fontSize: "0.88rem",
                }}
              >
                No generated workflow history yet.
              </p>
              <button
                className="primary-button"
                type="button"
                onClick={onOpenSetup}
                style={{
                  padding: "0.6rem 1.4rem",
                  fontSize: "0.88rem",
                  minHeight: "2.5rem",
                }}
              >
                Generate your first workflow
              </button>
            </div>
          ) : (
            <motion.div
              className="repo-grid"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {history.map((entry) => (
                <motion.article
                  key={entry.id}
                  variants={cardVariants}
                  className="repo-card glass-panel hud-glow-card"
                  style={{
                    background: "rgba(15, 23, 42, 0.45)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: "1.25rem",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.85rem",
                    transition: "all 0.25s ease",
                  }}
                  whileHover={{
                    y: -3,
                    borderColor: "rgba(56, 189, 248, 0.3)",
                    boxShadow:
                      "var(--shadow-card), 0 0 24px rgba(56, 189, 248, 0.05)",
                  }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.style.setProperty(
                      "--gx",
                      String((e.clientX - rect.left) / rect.width),
                    );
                    e.currentTarget.style.setProperty(
                      "--gy",
                      String((e.clientY - rect.top) / rect.height),
                    );
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.removeProperty("--gx");
                    e.currentTarget.style.removeProperty("--gy");
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                      gap: "0.5rem",
                    }}
                  >
                    <h3
                      style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}
                    >
                      {entry.templateName}
                    </h3>
                    <p
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                        margin: 0,
                      }}
                    >
                      {formatDate(entry.createdAt)}
                    </p>
                  </div>

                  {/* Meta tags: stack + file name */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.35rem",
                    }}
                  >
                    {entry.stack && (
                      <span
                        className="template-stack-badge"
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "4px",
                          background: "rgba(56, 189, 248, 0.1)",
                          color: "var(--brand)",
                          border: "1px solid rgba(56, 189, 248, 0.15)",
                        }}
                      >
                        {entry.stack}
                      </span>
                    )}
                    <span
                      className="project-card-tag"
                      style={{
                        fontSize: "0.68rem",
                        padding: "0.15rem 0.45rem",
                        borderRadius: "4px",
                        background: "rgba(255, 255, 255, 0.04)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-soft)",
                        fontFamily: "ui-monospace, monospace",
                      }}
                    >
                      {entry.outputFileName}
                    </span>
                  </div>

                  {/* Key-value row */}
                  <dl
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: "0.45rem 1rem",
                      background: "rgba(0,0,0,0.15)",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "0.78rem",
                      margin: "0.1rem 0",
                    }}
                  >
                    <dt style={{ color: "var(--text-muted)" }}>Service</dt>
                    <dd
                      style={{ color: "var(--text-primary)", fontWeight: 600 }}
                    >
                      {entry.serviceName}
                    </dd>

                    {entry.sourceWorkflowFile && (
                      <>
                        <dt style={{ color: "var(--text-muted)" }}>Source</dt>
                        <dd
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "ui-monospace, monospace",
                            fontSize: "0.72rem",
                            wordBreak: "break-all",
                          }}
                        >
                          {toSourcePath(entry.sourceWorkflowFile)}
                        </dd>
                      </>
                    )}
                  </dl>

                  {/* Actions */}
                  <div
                    style={{
                      display: "flex",
                      gap: "0.35rem",
                      marginTop: "auto",
                      borderTop: "1px solid var(--border-soft)",
                      paddingTop: "0.75rem",
                    }}
                  >
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => onCopyYaml(entry.yaml)}
                      style={{
                        padding: "0.4rem 0.8rem",
                        fontSize: "0.78rem",
                        minHeight: "2rem",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Copy YAML
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() =>
                        onDownloadYaml(entry.yaml, entry.outputFileName)
                      }
                      style={{
                        padding: "0.4rem 0.8rem",
                        fontSize: "0.78rem",
                        minHeight: "2rem",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Download
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={onOpenSetup}
                      style={{
                        marginLeft: "auto",
                        padding: "0.4rem 0.8rem",
                        fontSize: "0.78rem",
                        minHeight: "2rem",
                        borderRadius: "6px",
                        border: "1px solid rgba(56, 189, 248, 0.2)",
                        color: "var(--brand)",
                        background: "rgba(56, 189, 248, 0.04)",
                      }}
                    >
                      New
                    </button>
                  </div>

                  {/* YAML preview */}
                  <details style={{ marginTop: "0.25rem" }}>
                    <summary
                      style={{
                        cursor: "pointer",
                        color: "var(--brand)",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        outline: "none",
                        userSelect: "none",
                      }}
                    >
                      Preview YAML config
                    </summary>
                    <pre
                      style={{
                        marginTop: "0.5rem",
                        padding: "0.75rem",
                        background: "rgba(0, 0, 0, 0.35)",
                        border: "1px solid var(--border-soft)",
                        borderRadius: "6px",
                        fontFamily: "ui-monospace, monospace",
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                        overflowX: "auto",
                        maxHeight: "150px",
                      }}
                    >
                      {entry.yaml}
                    </pre>
                  </details>
                </motion.article>
              ))}
            </motion.div>
          )}
        </div>
      )}
    </motion.section>
  );
}
