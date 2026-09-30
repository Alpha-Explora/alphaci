"use client";

import { useState } from "react";

import {
  DeploymentLogsConsole,
  type DeploymentLogFocus,
} from "@/features/projects/deployment-logs";
import { providerDisplayName, providerPublicUrl } from "../model/provider-urls";
import {
  canManageHosting,
  HOSTING_LEAD_ONLY_NOTE,
  canReinstallDeploymentSecrets,
  detachButtonLabel,
  hostingProviderLabel,
  logsToggleLabel,
  reinstallSecretsLabel,
  saveMetadataLabel,
  targetSyncLabel,
} from "../model/project-detail-tab-rules";
import { useDeploymentTargetsViewModel } from "../view-models/use-deployment-targets-view-model";
import type {
  DeploymentTarget,
  EnvEnvironment,
  UpdateDeploymentTargetRequest,
} from "@/features/projects";
import type { AppRole, DeploymentTargetActionsResponse } from "@/shared/api/contracts";

export function DeploymentTargetsList({
  appRole,
  logFocus = null,
  managementEnabled,
  onDetached,
  onTargetChanged,
  projectId,
  targets,
}: Readonly<{
  appRole?: AppRole;
  /** Open this target's logs on mount: the Overview card asked for them. */
  logFocus?: DeploymentLogFocus | null;
  managementEnabled: boolean;
  onDetached: (targetId: string) => void;
  onTargetChanged: (target: DeploymentTarget) => void;
  projectId: string;
  targets: DeploymentTarget[];
}>) {
  const vm = useDeploymentTargetsViewModel({
    projectId,
    targets,
    appRole,
    onDetached,
    onTargetChanged,
  });
  const [editingTarget, setEditingTarget] = useState<DeploymentTarget | null>(
    null,
  );
  const [editValues, setEditValues] = useState<UpdateDeploymentTargetRequest>(
    {},
  );
  const [detachConfirmTargetId, setDetachConfirmTargetId] = useState<
    string | null
  >(null);
  const [deleteProviderResourceConfirmId, setDeleteProviderResourceConfirmId] =
    useState<string | null>(null);
  const [activeLogTargetId, setActiveLogTargetId] = useState<string | null>(
    logFocus?.targetId ?? null,
  );

  if (!targets.length) {
    return <p className="env-empty-state">No deployment targets configured.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <TargetMessage message={vm.message} signInHref={vm.signInHref} />
      {targets.length > 0 && !canManageHosting(appRole) ? (
        <p className="env-empty-state" data-testid="hosting-lead-only-note">
          {HOSTING_LEAD_ONLY_NOTE}
        </p>
      ) : null}
      <div className="env-metadata-list" data-tour="deployment-targets">
        {targets.map((target) => (
          <DeploymentTargetCard
            key={target.id}
            target={target}
            projectId={projectId}
            appRole={appRole}
            managementEnabled={managementEnabled}
            vm={vm}
            isDetachConfirm={detachConfirmTargetId === target.id}
            isLogsOpen={activeLogTargetId === target.id}
            logFocus={logFocus?.targetId === target.id ? logFocus : null}
            deleteProviderResourceChecked={
              deleteProviderResourceConfirmId === target.id
            }
            onOpenEdit={() =>
              openEdit(target, setEditingTarget, setEditValues, vm.clearMessage)
            }
            onToggleLogs={() =>
              setActiveLogTargetId((current) =>
                current === target.id ? null : target.id,
              )
            }
            onDetachConfirmId={setDeleteProviderResourceConfirmId}
            onDetach={() =>
              void requestDetach(
                target,
                detachConfirmTargetId,
                deleteProviderResourceConfirmId,
                setDetachConfirmTargetId,
                setDeleteProviderResourceConfirmId,
                vm,
              )
            }
          />
        ))}
      </div>
      <DeploymentTargetEditor
        editingTarget={editingTarget}
        editValues={editValues}
        savingTargetId={vm.savingTargetId}
        onCancel={() => setEditingTarget(null)}
        onChange={setEditValues}
        onSave={() =>
          void saveEdit(editingTarget, editValues, vm.save, setEditingTarget)
        }
      />
    </div>
  );
}

function TargetMessage({
  message,
  signInHref,
}: Readonly<{ message: string | null; signInHref: string | null }>) {
  if (!message) return null;
  return (
    <p className="env-empty-state">
      {message}
      {signInHref ? (
        <>
          {" "}
          <a className="inline-link" href={signInHref}>
            Sign in again
          </a>
        </>
      ) : null}
    </p>
  );
}

function openEdit(
  target: DeploymentTarget,
  setEditingTarget: (target: DeploymentTarget) => void,
  setEditValues: (values: UpdateDeploymentTargetRequest) => void,
  clearMessage: () => void,
) {
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
  clearMessage();
}

async function saveEdit(
  editingTarget: DeploymentTarget | null,
  editValues: UpdateDeploymentTargetRequest,
  save: (
    targetId: string,
    values: UpdateDeploymentTargetRequest,
  ) => Promise<DeploymentTarget | null>,
  setEditingTarget: (target: DeploymentTarget | null) => void,
) {
  if (!editingTarget) return;
  const updated = await save(editingTarget.id, editValues);
  if (updated) setEditingTarget(null);
}

async function requestDetach(
  target: DeploymentTarget,
  detachConfirmTargetId: string | null,
  deleteProviderResourceConfirmId: string | null,
  setDetachConfirmTargetId: (id: string | null) => void,
  setDeleteProviderResourceConfirmId: (id: string | null) => void,
  vm: {
    detach: (
      target: DeploymentTarget,
      deleteProviderResource: boolean,
    ) => Promise<boolean>;
    setMessage: (message: string | null) => void;
  },
) {
  if (detachConfirmTargetId !== target.id) {
    setDetachConfirmTargetId(target.id);
    setDeleteProviderResourceConfirmId(null);
    vm.setMessage("Confirm detach to remove this target from ALPHACI only.");
    return;
  }

  const deleted = await vm.detach(
    target,
    deleteProviderResourceConfirmId === target.id,
  );
  if (deleted) {
    setDetachConfirmTargetId(null);
    setDeleteProviderResourceConfirmId(null);
  }
}

function DeploymentTargetCard({
  target,
  projectId,
  appRole,
  managementEnabled,
  vm,
  isDetachConfirm,
  isLogsOpen,
  logFocus,
  deleteProviderResourceChecked,
  onOpenEdit,
  onToggleLogs,
  onDetachConfirmId,
  onDetach,
}: Readonly<{
  target: DeploymentTarget;
  projectId: string;
  appRole?: AppRole;
  managementEnabled: boolean;
  vm: ReturnType<typeof useDeploymentTargetsViewModel>;
  isDetachConfirm: boolean;
  isLogsOpen: boolean;
  logFocus: DeploymentLogFocus | null;
  deleteProviderResourceChecked: boolean;
  onOpenEdit: () => void;
  onToggleLogs: () => void;
  onDetachConfirmId: (id: string | null) => void;
  onDetach: () => void;
}>) {
  return (
    <div>
      <div
        className={`env-metadata-row ${target.status}`}
        style={{ alignItems: "flex-start" }}
      >
        <DeploymentTargetMeta target={target} />
        <DeploymentTargetActions
          target={target}
          appRole={appRole}
          managementEnabled={managementEnabled}
          vm={vm}
          isDetachConfirm={isDetachConfirm}
          isLogsOpen={isLogsOpen}
          deleteProviderResourceChecked={deleteProviderResourceChecked}
          onOpenEdit={onOpenEdit}
          onToggleLogs={onToggleLogs}
          onDetachConfirmId={onDetachConfirmId}
          onDetach={onDetach}
        />
      </div>
      <TargetLogs
        isLogsOpen={isLogsOpen}
        logFocus={logFocus}
        projectId={projectId}
        target={target}
      />
    </div>
  );
}

/**
 * A target's log console. Opened from the Overview card it scopes to that
 * card's deploy and scrolls into view; opened here, it starts on the last hour.
 */
function TargetLogs({
  isLogsOpen,
  logFocus,
  projectId,
  target,
}: Readonly<{
  isLogsOpen: boolean;
  logFocus: DeploymentLogFocus | null;
  projectId: string;
  target: DeploymentTarget;
}>) {
  if (!isLogsOpen) return null;
  return (
    <DeploymentLogsConsole
      deployWindow={logFocus?.window ?? null}
      focusOnMount={logFocus !== null}
      projectId={projectId}
      providerLabel={providerDisplayName(target.provider)}
      targetId={target.id}
      targetName={target.providerProjectName}
    />
  );
}

function DeploymentTargetMeta({
  target,
}: Readonly<{ target: DeploymentTarget }>) {
  const publicUrl = providerPublicUrl(target);
  return (
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
        {target.buildCommand || "—"} · Start: {target.startCommand || "—"}
      </small>
      <RenderEnvName name={target.renderEnvironmentName} />
      <TargetPublicUrl href={publicUrl} />
      <small style={{ color: "var(--text-muted)" }}>
        ID: {target.providerProjectId}
      </small>
    </span>
  );
}

function RenderEnvName({ name }: Readonly<{ name?: string | null }>) {
  if (!name) return null;
  return (
    <small style={{ color: "var(--text-muted)" }}>Render env: {name}</small>
  );
}

function TargetPublicUrl({ href }: Readonly<{ href: string | null }>) {
  if (!href) return null;
  return (
    <small>
      <a href={href} rel="noreferrer noopener" target="_blank">
        {href}
      </a>
    </small>
  );
}

function DeploymentTargetActions({
  target,
  appRole,
  managementEnabled,
  vm,
  isDetachConfirm,
  isLogsOpen,
  deleteProviderResourceChecked,
  onOpenEdit,
  onToggleLogs,
  onDetachConfirmId,
  onDetach,
}: Readonly<{
  target: DeploymentTarget;
  appRole?: AppRole;
  managementEnabled: boolean;
  vm: ReturnType<typeof useDeploymentTargetsViewModel>;
  isDetachConfirm: boolean;
  isLogsOpen: boolean;
  deleteProviderResourceChecked: boolean;
  onOpenEdit: () => void;
  onToggleLogs: () => void;
  onDetachConfirmId: (id: string | null) => void;
  onDetach: () => void;
}>) {
  const canManage = canManageHosting(appRole);
  return (
    <div className="target-actions">
      <div className="target-actions-primary">
        {canManage ? (
          <button
            className="ghost-button target-action-btn"
            type="button"
            disabled={!managementEnabled}
            onClick={onOpenEdit}
          >
            Edit
          </button>
        ) : null}
        {canManage ? (
          <button
            className="ghost-button target-action-btn"
            type="button"
            disabled={!managementEnabled || vm.syncingTargetId === target.id}
            onClick={() => void vm.sync(target)}
          >
            {targetSyncLabel(vm.syncingTargetId === target.id)}
          </button>
        ) : null}
        <button
          className={`ghost-button target-action-btn${isLogsOpen ? " active" : ""}`}
          type="button"
          onClick={onToggleLogs}
        >
          {logsToggleLabel(isLogsOpen)}
        </button>
      </div>
      <ReinstallSecretsAction
        target={target}
        appRole={appRole}
        managementEnabled={managementEnabled}
        actions={vm.targetActions[target.id]}
        reinstalling={vm.reinstallingTargetId === target.id}
        onReinstall={() => void vm.reinstallSecrets(target)}
      />
      {canManage ? (
      <div className="target-actions-destructive">
        <DetachConfirmCheckbox
          checked={deleteProviderResourceChecked}
          visible={isDetachConfirm}
          target={target}
          onChange={onDetachConfirmId}
        />
        <button
          className={`ghost-button target-action-btn ${isDetachConfirm ? "target-action-btn--confirm" : "target-action-btn--detach"}`}
          type="button"
          disabled={!managementEnabled || vm.detachingTargetId === target.id}
          onClick={onDetach}
        >
          {detachButtonLabel(
            vm.detachingTargetId === target.id,
            isDetachConfirm,
          )}
        </button>
      </div>
      ) : null}
    </div>
  );
}

/**
 * Only a team lead/admin ever sees this, and only once the server's own
 * per-target descriptor says it is offered (e.g. not for a provider that has
 * no CI secrets to reinstall). Disabled-with-a-reason is not rendered here —
 * per the product call, an unavailable reinstall stays invisible rather than
 * adding noise to an already dense actions row.
 */
function ReinstallSecretsAction({
  target,
  appRole,
  managementEnabled,
  actions,
  reinstalling,
  onReinstall,
}: Readonly<{
  target: DeploymentTarget;
  appRole?: AppRole;
  managementEnabled: boolean;
  actions: DeploymentTargetActionsResponse | undefined;
  reinstalling: boolean;
  onReinstall: () => void;
}>) {
  // The server refuses it while target management is off, like Sync and Detach.
  if (!managementEnabled) return null;
  if (!canReinstallDeploymentSecrets(appRole)) return null;
  if (!actions?.actions.reinstallDeploymentSecrets.enabled) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.3rem",
        alignItems: "flex-start",
      }}
    >
      <button
        className="ghost-button target-action-btn"
        type="button"
        disabled={reinstalling}
        onClick={onReinstall}
        aria-describedby={`reinstall-secrets-hint-${target.id}`}
      >
        {reinstallSecretsLabel(reinstalling)}
      </button>
      <small
        id={`reinstall-secrets-hint-${target.id}`}
        style={{ color: "var(--text-muted)", maxWidth: "26rem" }}
      >
        Rewrites this target&apos;s GitHub Actions secrets, including the
        Vercel test bypass secret.
      </small>
    </div>
  );
}

function DetachConfirmCheckbox({
  checked,
  visible,
  target,
  onChange,
}: Readonly<{
  checked: boolean;
  visible: boolean;
  target: DeploymentTarget;
  onChange: (id: string | null) => void;
}>) {
  if (!visible) return null;
  return (
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
        checked={checked}
        onChange={(event) =>
          onChange(event.target.checked ? target.id : null)
        }
        style={{ marginTop: "0.15rem" }}
      />
      <span>
        Also delete the {target.provider} resource (
        {target.providerProjectName}). This cannot be undone.
      </span>
    </label>
  );
}

function DeploymentTargetEditor({
  editingTarget,
  editValues,
  savingTargetId,
  onCancel,
  onChange,
  onSave,
}: Readonly<{
  editingTarget: DeploymentTarget | null;
  editValues: UpdateDeploymentTargetRequest;
  savingTargetId: string | null;
  onCancel: () => void;
  onChange: (values: UpdateDeploymentTargetRequest) => void;
  onSave: () => void;
}>) {
  if (!editingTarget) return null;

  return (
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
              onChange({
                ...editValues,
                providerProjectName: event.target.value,
              })
            }
          />
        </label>
        <div className="deployment-target-editor__field deployment-target-editor__field--hosting">
          <span>Hosting</span>
          <strong>{hostingProviderLabel(editingTarget.provider)}</strong>
        </div>
        <label className="deployment-target-editor__field deployment-target-editor__field--branch">
          <span>Branch</span>
          <input
            aria-label="Target branch"
            value={editValues.branchName ?? ""}
            onChange={(event) =>
              onChange({ ...editValues, branchName: event.target.value })
            }
          />
        </label>
        <label className="deployment-target-editor__field deployment-target-editor__field--root">
          <span>Root directory</span>
          <input
            aria-label="Target root directory"
            value={editValues.rootDirectory ?? ""}
            onChange={(event) =>
              onChange({ ...editValues, rootDirectory: event.target.value })
            }
          />
        </label>
        <label className="deployment-target-editor__field deployment-target-editor__field--build">
          <span>Build command</span>
          <input
            aria-label="Target build command"
            value={editValues.buildCommand ?? ""}
            onChange={(event) =>
              onChange({ ...editValues, buildCommand: event.target.value })
            }
          />
        </label>
        <label className="deployment-target-editor__field deployment-target-editor__field--start">
          <span>Start command</span>
          <input
            aria-label="Target start command"
            value={editValues.startCommand ?? ""}
            onChange={(event) =>
              onChange({ ...editValues, startCommand: event.target.value })
            }
          />
        </label>
        <RenderEnvironmentField
          provider={editingTarget.provider}
          value={editValues.renderEnvironmentName ?? ""}
          onChange={(value) =>
            onChange({
              ...editValues,
              renderEnvironmentName: value,
            })
          }
        />
      </div>
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <button className="ghost-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={savingTargetId === editingTarget.id}
          onClick={onSave}
        >
          {saveMetadataLabel(savingTargetId === editingTarget.id)}
        </button>
      </div>
    </div>
  );
}

function RenderEnvironmentField({
  provider,
  value,
  onChange,
}: Readonly<{
  provider: DeploymentTarget["provider"];
  value: string;
  onChange: (value: EnvEnvironment | null) => void;
}>) {
  if (provider !== "render") return null;
  return (
    <label className="deployment-target-editor__field deployment-target-editor__field--environment">
      <span>Provider environment</span>
      <select
        aria-label="Target provider environment"
        value={value}
        onChange={(event) =>
          onChange((event.target.value || null) as EnvEnvironment | null)
        }
      >
        <option value="">Not configured</option>
        <option value="test">Test</option>
        <option value="uat">UAT</option>
        <option value="production">Production</option>
      </select>
    </label>
  );
}
