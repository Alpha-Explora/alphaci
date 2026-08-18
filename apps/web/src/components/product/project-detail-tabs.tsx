"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { ServiceLogsConsole } from "@/components/product/service-logs-console";
import { useCapabilities } from "@/hooks/use-capabilities";
import { getCentralWorkflowTags } from "@/lib/api/catalog";
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
  DeploymentTarget,
  EnvEnvironment,
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
} from "@/lib/api/contracts";
import { ProjectEnvPanel } from "./project-env-panel";
import { HelpTip } from "./help-tip";

import { formatDate } from "./workflow-builder-utils";

/**
 * ProjectDetailTabs — the tabbed project detail (Overview / Workflow / Runs /
 * Hosting / Environment / Audit / Settings), extracted from the old split-pane
 * Current Projects view so the full project page (/projects/[id]) can render
 * it. Self-contained: fetches the overview and per-tab data for `project`.
 */
interface ProjectDetailTabsProps {
  project: ProvisionedProject;
}

type ProjectDetailTab =
  | "overview"
  | "workflow"
  | "runs"
  | "hosting"
  | "environment"
  | "audit"
  | "settings";

const PROJECT_DETAIL_TABS: Array<{ id: ProjectDetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "workflow", label: "Workflow" },
  { id: "runs", label: "Runs" },
  { id: "hosting", label: "Hosting" },
  { id: "environment", label: "Environment" },
  { id: "audit", label: "Audit" },
  { id: "settings", label: "Settings" },
];

// Mirrors the coverage presets offered on repository creation (see
// workflow-setup-tab.tsx) so editing an existing project's threshold isn't a
// different, freer-form experience than setting it up in the first place.
const COVERAGE_THRESHOLD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "0", label: "None (0%)" },
  { value: "60", label: "Basic (60%)" },
  { value: "80", label: "Standard (80%)" },
  { value: "90", label: "Strict (90%)" },
  { value: "100", label: "Full (100%)" },
];

const WORKFLOW_CHECK_OPTIONS: Array<{
  key: keyof WorkflowSettings["checks"];
  label: string;
}> = [
  { key: "lint", label: "Lint" },
  { key: "unit", label: "Unit tests" },
  { key: "build", label: "Build" },
  { key: "security", label: "Security" },
];

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

export function WorkflowStageList({
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
  const [deleteProviderResourceConfirmId, setDeleteProviderResourceConfirmId] =
    useState<string | null>(null);
  const [detachingTargetId, setDetachingTargetId] = useState<string | null>(
    null,
  );
  const [targetMessage, setTargetMessage] = useState<string | null>(null);
  const [activeLogTargetId, setActiveLogTargetId] = useState<string | null>(
    null,
  );

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
      const findingCount = response.findings.length;
      if (response.mode === "provider_live") {
        setTargetMessage(
          findingCount
            ? `Live status check completed with ${findingCount} finding${findingCount === 1 ? "" : "s"}.`
            : "Live status check completed.",
        );
      } else {
        const liveCheckFailed = response.findings.some(
          (finding) => finding.code === "provider_live_check_failed",
        );
        const suffix = liveCheckFailed ? " (live check unavailable)" : "";
        setTargetMessage(
          findingCount
            ? `Local metadata sync completed with ${findingCount} finding${findingCount === 1 ? "" : "s"}.${suffix}`
            : `Local metadata sync completed.${suffix}`,
        );
      }
    } catch {
      setTargetMessage("Unable to sync target metadata.");
    } finally {
      setSyncingTargetId(null);
    }
  };

  const detachTarget = async (target: DeploymentTarget) => {
    if (detachConfirmTargetId !== target.id) {
      setDetachConfirmTargetId(target.id);
      // Reset any leftover checkbox state from a previously-abandoned confirm
      // (e.g. switching from one target's detach confirm to another's)
      // so this target's confirm always opens with the checkbox unchecked.
      setDeleteProviderResourceConfirmId(null);
      setTargetMessage(
        "Confirm detach to remove this target from ALPHACI only.",
      );
      return;
    }

    const deleteProviderResource = deleteProviderResourceConfirmId === target.id;
    setDetachingTargetId(target.id);
    setTargetMessage(null);
    try {
      const response = await detachDeploymentTarget(projectId, target.id, {
        deleteProviderResource,
      });
      onDetached(target.id);
      setDetachConfirmTargetId(null);
      setDeleteProviderResourceConfirmId(null);
      if (response.providerResourceDeleted) {
        setTargetMessage(
          `Target detached from ALPHACI and the ${target.provider} resource was deleted.`,
        );
      } else if (response.providerDeleteError) {
        setTargetMessage(
          `Target detached from ALPHACI, but the ${target.provider} resource could not be deleted automatically (${response.providerDeleteError}). Delete it manually from the provider dashboard${target.dashboardUrl ? ` (${target.dashboardUrl})` : ""}.`,
        );
      } else {
        setTargetMessage(
          "Target detached from ALPHACI. Provider resource was not deleted.",
        );
      }
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
          const isDetachConfirm = detachConfirmTargetId === target.id;
          const isLogsOpen = activeLogTargetId === target.id;
          return (
            <div key={target.id}>
              <div
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
                  {/* Primary: Edit + Sync + Logs */}
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
                    <button
                      className={`ghost-button target-action-btn${isLogsOpen ? " active" : ""}`}
                      type="button"
                      onClick={() =>
                        setActiveLogTargetId((current) =>
                          current === target.id ? null : target.id,
                        )
                      }
                    >
                      {isLogsOpen ? "Hide Logs" : "Logs"}
                    </button>
                  </div>

                  {/* Destructive: Detach — visually separated */}
                  <div className="target-actions-destructive">
                    {isDetachConfirm ? (
                      <label
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.4rem",
                          fontSize: "0.76rem",
                          color: "var(--text-muted)",
                          maxWidth: "22rem",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={deleteProviderResourceConfirmId === target.id}
                          onChange={(event) =>
                            setDeleteProviderResourceConfirmId(
                              event.target.checked ? target.id : null,
                            )
                          }
                          style={{ marginTop: "0.15rem" }}
                        />
                        <span>
                          Also delete the {target.provider} resource (
                          {target.providerProjectName}). This cannot be undone.
                        </span>
                      </label>
                    ) : null}
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
              {isLogsOpen ? (
                <ServiceLogsConsole projectId={projectId} target={target} />
              ) : null}
            </div>
          );
        })}
      </div>
      {editingTarget ? (
        <div
          className="env-card deployment-target-editor"
          data-testid="target-edit-drawer"
          style={{ gap: "0.85rem" }}
        >
          <div>
            <h4 style={{ margin: 0 }}>Edit deployment target</h4>
            <p className="env-empty-state" style={{ margin: "0.25rem 0 0" }}>
              Metadata edits only. Provider resources and secrets are unchanged.
            </p>
          </div>
          <div className="deployment-target-editor__grid">
            <label className="deployment-target-editor__field deployment-target-editor__field--name">
              <span>Display name</span>
              <input
                aria-label="Target display name"
                value={editValues.providerProjectName ?? ""}
                onChange={(event) =>
                  updateEditValue("providerProjectName", event.target.value)
                }
              />
            </label>
            <div className="deployment-target-editor__field deployment-target-editor__field--hosting">
              <span>Hosting</span>
              <strong>
                {editingTarget.provider === "render"
                  ? "Render backend"
                  : "Vercel frontend"}
              </strong>
            </div>
            <label className="deployment-target-editor__field deployment-target-editor__field--branch">
              <span>Branch</span>
              <input
                aria-label="Target branch"
                value={editValues.branchName ?? ""}
                onChange={(event) =>
                  updateEditValue("branchName", event.target.value)
                }
              />
            </label>
            <label className="deployment-target-editor__field deployment-target-editor__field--root">
              <span>Root directory</span>
              <input
                aria-label="Target root directory"
                value={editValues.rootDirectory ?? ""}
                onChange={(event) =>
                  updateEditValue("rootDirectory", event.target.value)
                }
              />
            </label>
            <label className="deployment-target-editor__field deployment-target-editor__field--build">
              <span>Build command</span>
              <input
                aria-label="Target build command"
                value={editValues.buildCommand ?? ""}
                onChange={(event) =>
                  updateEditValue("buildCommand", event.target.value)
                }
              />
            </label>
            <label className="deployment-target-editor__field deployment-target-editor__field--start">
              <span>Start command</span>
              <input
                aria-label="Target start command"
                value={editValues.startCommand ?? ""}
                onChange={(event) =>
                  updateEditValue("startCommand", event.target.value)
                }
              />
            </label>
            {editingTarget.provider === "render" ? (
              <label className="deployment-target-editor__field deployment-target-editor__field--environment">
                <span>Provider environment</span>
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
      {response.liveGithubEnabled && response.mode === "local_mock" ? (
        <p className="env-empty-state" style={{ margin: 0 }}>
          Live sync is enabled, but no GitHub Actions integration is
          connected yet — the runs below are simulated, not live.
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
      {response.liveProvidersEnabled && response.mode === "local_mock" ? (
        <p className="env-empty-state" style={{ margin: 0 }}>
          Live sync is enabled, but no provider integration is connected
          yet — the deployments below are simulated, not live.
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

export function ProjectDetailTabs({
  project,
}: Readonly<ProjectDetailTabsProps>) {
  const [projectDetailTab, setProjectDetailTab] =
    useState<ProjectDetailTab>("overview");
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
  const [centralWorkflowTags, setCentralWorkflowTags] = useState<
    string[] | null
  >(null);
  const [centralWorkflowTagsError, setCentralWorkflowTagsError] = useState<
    string | null
  >(null);
  // The detail always targets the single project this component was given.
  const selectedProject = project;
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
    if (
      projectDetailTab !== "workflow" ||
      centralWorkflowTags ||
      centralWorkflowTagsError
    ) {
      return;
    }

    let active = true;
    void getCentralWorkflowTags()
      .then((response) => {
        if (active) {
          setCentralWorkflowTags(response.tags);
        }
      })
      .catch(() => {
        if (active) {
          setCentralWorkflowTagsError("Unable to load available workflow refs.");
        }
      });

    return () => {
      active = false;
    };
  }, [projectDetailTab, centralWorkflowTags, centralWorkflowTagsError]);

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
    <section className="project-detail-panel" aria-label="Project detail">
                <div className="project-detail-header">
                  <div>
                    <h3>{selectedProject.repoFullName}</h3>
                    <p>{selectedProject.serviceName}</p>
                  </div>
                  <span className="project-detail-header-badges">
                    <span
                      className={`project-status-badge ${statusVariant(selectedProject.status)}`}
                    >
                      {selectedProject.status}
                    </span>
                  </span>
                </div>

                <div className="project-detail-actions">
                  {selectedProject.repoUrl ? (
                    <>
                      <a
                        className="ghost-button"
                        href={selectedProject.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Repo <span aria-hidden="true">↗</span>
                      </a>
                      <a
                        className="ghost-button"
                        href={`${selectedProject.repoUrl}/actions`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Actions <span aria-hidden="true">↗</span>
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
                      Commit <span aria-hidden="true">↗</span>
                    </a>
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

                {/* Keyed on the sub-tab so only this content fades in on
                    switch — the project list rail is a sibling outside this
                    wrapper and never re-animates when you change tabs. */}
                <motion.div
                  key={projectDetailTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                >
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

                    {/* Developer access.

                        Assignments are keyed on hierarchy.repositories, not on
                        this provisioned project, so the panel lives on the
                        group route. This row is the only path to it — without
                        it the assignment feature is built but unreachable.
                        Rendered only when BOTH ids resolve; a project in a
                        personal workspace has no assignment surface at all. */}
                    {selectedOverview?.hierarchyRepositoryId &&
                    selectedProject.workspaceId ? (
                      <div
                        className="env-metadata-row provisioned"
                        style={{ alignItems: "center" }}
                      >
                        <span>
                          <strong>Developer access</strong>
                          <br />
                          Grant or revoke this repository for members of the
                          team that owns it.
                        </span>
                        <Link
                          className="ghost-button target-action-btn"
                          href={`/groups/${encodeURIComponent(selectedProject.workspaceId)}/repositories/${encodeURIComponent(selectedOverview.hierarchyRepositoryId)}`}
                        >
                          Manage access
                        </Link>
                      </div>
                    ) : null}

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
                              <select
                                aria-label="Node version"
                                value={workflowSettings.nodeVersion}
                                disabled
                              >
                                <option value={workflowSettings.nodeVersion}>
                                  {workflowSettings.nodeVersion}
                                </option>
                              </select>
                            </label>
                            <label>
                              <dt>
                                Coverage threshold
                                <HelpTip text="The minimum percentage of code that unit tests must exercise. Pipeline runs fail the Quality stage if coverage drops below this number." />
                              </dt>
                              <select
                                aria-label="Coverage threshold"
                                value={String(workflowSettings.coverageThreshold)}
                                onChange={(event) => {
                                  setWorkflowSettings({
                                    ...workflowSettings,
                                    coverageThreshold: Number(
                                      event.target.value,
                                    ),
                                  });
                                }}
                              >
                                {!COVERAGE_THRESHOLD_OPTIONS.some(
                                  (option) =>
                                    option.value ===
                                    String(workflowSettings.coverageThreshold),
                                ) ? (
                                  <option
                                    value={String(
                                      workflowSettings.coverageThreshold,
                                    )}
                                  >
                                    {workflowSettings.coverageThreshold}%
                                    (current)
                                  </option>
                                ) : null}
                                {COVERAGE_THRESHOLD_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
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
                                <HelpTip text="The tag of cicd-external-project/cicd-workflow that this project's pipeline is pinned to. It supplies the reusable gated-stage logic — Access, Quality, Package — that every generated workflow calls into. Options are the real tags published on that repo." />
                              </dt>
                              <select
                                aria-label="Central workflow ref"
                                value={workflowSettings.centralWorkflowRef}
                                disabled={!centralWorkflowTags}
                                onChange={(event) => {
                                  setWorkflowSettings({
                                    ...workflowSettings,
                                    centralWorkflowRef: event.target.value,
                                  });
                                }}
                              >
                                {centralWorkflowTags ? (
                                  <>
                                    {!centralWorkflowTags.includes(
                                      workflowSettings.centralWorkflowRef,
                                    ) ? (
                                      <option
                                        value={
                                          workflowSettings.centralWorkflowRef
                                        }
                                      >
                                        {workflowSettings.centralWorkflowRef}{" "}
                                        (current)
                                      </option>
                                    ) : null}
                                    {centralWorkflowTags.map((tag) => (
                                      <option key={tag} value={tag}>
                                        {tag}
                                      </option>
                                    ))}
                                  </>
                                ) : (
                                  <option value={workflowSettings.centralWorkflowRef}>
                                    {centralWorkflowTagsError
                                      ? workflowSettings.centralWorkflowRef
                                      : "Loading tags..."}
                                  </option>
                                )}
                              </select>
                              {centralWorkflowTagsError ? (
                                <p
                                  className="error-text"
                                  style={{
                                    margin: "0.3rem 0 0",
                                    fontSize: "0.72rem",
                                  }}
                                >
                                  {centralWorkflowTagsError}
                                </p>
                              ) : null}
                            </label>
                          </div>
                        ) : (
                          <p className="env-empty-state">
                            Loading workflow settings...
                          </p>
                        )}

                        {workflowSettings ? (
                          <div>
                            <span
                              className="input-label"
                              style={{
                                display: "block",
                                marginBottom: "0.5rem",
                              }}
                            >
                              Workflow checks
                            </span>
                            <div
                              className="enhancement-chips"
                              aria-label="Workflow checks"
                              role="group"
                              style={{ gap: "0.5rem", flexWrap: "wrap" }}
                            >
                              {WORKFLOW_CHECK_OPTIONS.map((check) => (
                                <motion.label
                                  key={check.key}
                                  className={`enhancement-chip-label-premium${workflowSettings.checks[check.key] ? " enhancement-chip-label--active" : ""}`}
                                  htmlFor={`workflow-check-${check.key}`}
                                  whileTap={{ scale: 0.95 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 20,
                                  }}
                                >
                                  <input
                                    id={`workflow-check-${check.key}`}
                                    type="checkbox"
                                    checked={workflowSettings.checks[check.key]}
                                    onChange={(event) => {
                                      setWorkflowSettings({
                                        ...workflowSettings,
                                        checks: {
                                          ...workflowSettings.checks,
                                          [check.key]: event.target.checked,
                                        },
                                      });
                                    }}
                                  />
                                  <span
                                    className="enhancement-chip-dot"
                                    aria-hidden="true"
                                  />
                                  {check.label}
                                </motion.label>
                              ))}
                            </div>
                          </div>
                        ) : null}

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
                    selectedProject.status === "provisioned" &&
                    deploymentTargets.length === 0 ? (
                      <ProjectEnvPanel
                        onTargetCreated={handleTargetCreated}
                        project={selectedProject}
                        section="hosting"
                      />
                    ) : !envProvisioningEnabled &&
                      deploymentTargets.length === 0 ? (
                      <p className="env-empty-state">
                        Hosting service provisioning is not enabled.
                      </p>
                    ) : null}
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
                </motion.div>
    </section>
  );
}
