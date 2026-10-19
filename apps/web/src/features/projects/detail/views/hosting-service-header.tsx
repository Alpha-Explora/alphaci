"use client";

import { useState } from "react";

import {
  DeploymentLogsConsole,
  type DeploymentLogFocus,
} from "@/features/projects/deployment-logs";
import type {
  DeploymentTarget,
  UpdateDeploymentTargetRequest,
} from "@/features/projects";
import type { AppRole } from "@/shared/api/contracts";
import {
  serviceMeta,
  targetStatusPill,
} from "../model/hosting-environment-rules";
import {
  canManageHosting,
  canReinstallDeploymentSecrets,
  detachButtonLabel,
  HOSTING_LEAD_ONLY_NOTE,
  logsToggleLabel,
  reinstallSecretsLabel,
  targetSyncLabel,
} from "../model/project-detail-tab-rules";
import { providerDisplayName } from "../model/provider-urls";
import type { DeploymentTargetsViewModel } from "../view-models/use-deployment-targets-view-model";
import { DeploymentTargetEditor } from "./deployment-target-editor";
import { HostingMenu, type HostingMenuItem } from "./hosting-menu";
import { HostingPill, ProviderMark } from "./hosting-status";

/** With two or more services: which one the tab shows. */
export function HostingServiceSelector({
  targets,
  selectedId,
  onSelect,
}: Readonly<{
  targets: ReadonlyArray<DeploymentTarget>;
  selectedId: string;
  onSelect: (targetId: string) => void;
}>) {
  if (targets.length < 2) return null;
  return (
    <div className="hosting-services" role="group" aria-label="Hosting services">
      {targets.map((target) => (
        <button
          key={target.id}
          type="button"
          className="hosting-services__option"
          aria-pressed={target.id === selectedId}
          onClick={() => onSelect(target.id)}
        >
          <span className="hosting-services__provider">{providerDisplayName(target.provider)}</span>
          {target.providerProjectName}
        </button>
      ))}
    </div>
  );
}

interface ServiceHeaderProps {
  target: DeploymentTarget;
  projectId: string;
  appRole?: AppRole;
  managementEnabled: boolean;
  vm: DeploymentTargetsViewModel;
  /** Open this service's logs at mount: the Overview card asked for them. */
  logFocus: DeploymentLogFocus | null;
  /** The tab's single provider notice, or null. */
  notice: string | null;
  onRetry: () => void;
}

/**
 * One service: its identity and status, its build settings in one line, Logs
 * and Sync, and a "⋯" menu for the rest (Edit build settings, Reinstall
 * deployment secrets, Open in <provider>, Detach). Editing and detaching open
 * inline under the header, the log console too. Mutations follow
 * `canManageHosting` exactly as the service cards did; the parent keys this
 * by target, so switching services resets what is open.
 */
export function HostingServiceHeader(props: Readonly<ServiceHeaderProps>) {
  const { target, appRole, managementEnabled, vm } = props;
  const [editValues, setEditValues] = useState<UpdateDeploymentTargetRequest | null>(null);
  const [detachConfirm, setDetachConfirm] = useState(false);
  const [deleteProviderResource, setDeleteProviderResource] = useState(false);
  const [logsOpen, setLogsOpen] = useState(props.logFocus?.targetId === target.id);
  const canManage = canManageHosting(appRole);

  function openEdit() {
    setEditValues(editValuesFor(target));
    vm.clearMessage();
  }

  async function saveEdit() {
    if (!editValues) return;
    const updated = await vm.save(target.id, editValues);
    if (updated) setEditValues(null);
  }

  async function requestDetach() {
    if (!detachConfirm) {
      setDetachConfirm(true);
      setDeleteProviderResource(false);
      vm.setMessage("Confirm detach to remove this target from ALPHACI only.");
      return;
    }
    const detached = await vm.detach(target, deleteProviderResource);
    if (detached) {
      setDetachConfirm(false);
      setDeleteProviderResource(false);
    }
  }

  function cancelDetach() {
    setDetachConfirm(false);
    setDeleteProviderResource(false);
    vm.clearMessage();
  }

  const items = serviceMenuItems({
    target,
    appRole,
    managementEnabled,
    vm,
    onEdit: openEdit,
    onDetach: () => void requestDetach(),
  });

  return (
    <section className="hosting-card hosting-service" aria-label={`${target.providerProjectName} service`}>
      <div className="hosting-service__top">
        <ServiceIdentity target={target} />
        <div className="hosting-service__actions">
          <button
            type="button"
            className="hosting-btn"
            aria-expanded={logsOpen}
            onClick={() => setLogsOpen((open) => !open)}
          >
            {logsToggleLabel(logsOpen)}
          </button>
          {canManage ? (
            <button
              type="button"
              className="hosting-btn"
              disabled={!managementEnabled || vm.syncingTargetId === target.id}
              onClick={() => void vm.sync(target)}
            >
              {targetSyncLabel(vm.syncingTargetId === target.id)}
            </button>
          ) : null}
          <HostingMenu label={`More actions for ${target.providerProjectName}`} items={items} />
        </div>
      </div>
      <ServiceMetaLine target={target} />
      <ProviderNotice notice={props.notice} onRetry={props.onRetry} />
      <TargetMessage message={vm.message} signInHref={vm.signInHref} />
      {canManage ? null : (
        <p className="hosting-quiet" data-testid="hosting-lead-only-note">
          {HOSTING_LEAD_ONLY_NOTE}
        </p>
      )}
      <DetachConfirm
        visible={detachConfirm}
        target={target}
        checked={deleteProviderResource}
        detaching={vm.detachingTargetId === target.id}
        disabled={!managementEnabled}
        onCheckedChange={setDeleteProviderResource}
        onConfirm={() => void requestDetach()}
        onCancel={cancelDetach}
      />
      <DeploymentTargetEditor
        editingTarget={editValues ? target : null}
        editValues={editValues ?? {}}
        savingTargetId={vm.savingTargetId}
        onCancel={() => setEditValues(null)}
        onChange={setEditValues}
        onSave={() => void saveEdit()}
      />
      <TargetLogs open={logsOpen} logFocus={props.logFocus} projectId={props.projectId} target={target} />
    </section>
  );
}

function editValuesFor(target: DeploymentTarget): UpdateDeploymentTargetRequest {
  return {
    slot: target.slot,
    providerProjectName: target.providerProjectName,
    branchName: target.branchName,
    rootDirectory: target.rootDirectory ?? "",
    buildCommand: target.buildCommand ?? "",
    startCommand: target.startCommand ?? "",
    renderEnvironmentName: target.renderEnvironmentName ?? null,
  };
}

interface MenuInput {
  target: DeploymentTarget;
  appRole?: AppRole;
  managementEnabled: boolean;
  vm: DeploymentTargetsViewModel;
  onEdit: () => void;
  onDetach: () => void;
}

function editItem(input: MenuInput): HostingMenuItem[] {
  if (!canManageHosting(input.appRole)) return [];
  return [{ label: "Edit build settings", disabled: !input.managementEnabled, onSelect: input.onEdit }];
}

/**
 * Only a Developer or admin, only while target management is on, and only
 * once the server's own per-target descriptor offers it. An unavailable
 * reinstall stays invisible rather than adding a disabled entry.
 */
function reinstallItem(input: MenuInput): HostingMenuItem[] {
  const { target, vm } = input;
  if (!input.managementEnabled || !canReinstallDeploymentSecrets(input.appRole)) return [];
  if (!vm.targetActions[target.id]?.actions.reinstallDeploymentSecrets.enabled) return [];
  const reinstalling = vm.reinstallingTargetId === target.id;
  return [
    {
      label: reinstallSecretsLabel(reinstalling),
      hint: "Rewrites this target's GitHub Actions secrets, including the Vercel test bypass secret.",
      disabled: reinstalling,
      onSelect: () => void vm.reinstallSecrets(target),
    },
  ];
}

function detachItem(input: MenuInput): HostingMenuItem[] {
  if (!canManageHosting(input.appRole)) return [];
  const detaching = input.vm.detachingTargetId === input.target.id;
  return [
    {
      label: "Detach",
      hint: "Removes the service from ALPHACI; you confirm first.",
      destructive: true,
      disabled: !input.managementEnabled || detaching,
      onSelect: input.onDetach,
    },
  ];
}

function serviceMenuItems(input: MenuInput): HostingMenuItem[] {
  // No "Open in Vercel/Render": the provider dashboards are ALPHACI's own
  // accounts, and people work in ALPHACI and on their deployed sites only.
  return [...editItem(input), ...reinstallItem(input), ...detachItem(input)];
}

function ServiceIdentity({ target }: Readonly<{ target: DeploymentTarget }>) {
  const pill = targetStatusPill(target.status);
  return (
    <div className="hosting-service__identity">
      <ProviderMark provider={target.provider} />
      <h3 className="hosting-service__name">{target.providerProjectName}</h3>
      <HostingPill tone={pill.tone} label={pill.label} />
    </div>
  );
}

function ServiceMetaLine({ target }: Readonly<{ target: DeploymentTarget }>) {
  const meta = serviceMeta(target);
  // A pushed image has no build or directory on the host; saying one would be wrong.
  if (!meta.builds) return <p className="hosting-service__meta">{meta.summary}</p>;
  return (
    <p className="hosting-service__meta">
      {meta.summary} ·{" "}
      {meta.buildCommand ? (
        <>
          <code className="hosting-mono">{meta.buildCommand}</code> in{" "}
        </>
      ) : (
        "default build in "
      )}
      <code className="hosting-mono">{meta.rootDirectory}</code>
    </p>
  );
}

/** The tab's one provider notice: amber, with Retry. */
function ProviderNotice({ notice, onRetry }: Readonly<{ notice: string | null; onRetry: () => void }>) {
  if (!notice) return null;
  return (
    <div className="hosting-notice" role="status">
      <span>{notice}</span>
      <button type="button" className="hosting-btn" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function TargetMessage({
  message,
  signInHref,
}: Readonly<{ message: string | null; signInHref: string | null }>) {
  if (!message) return null;
  return (
    <p className="hosting-quiet" role="status">
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

function DetachConfirm({
  visible,
  target,
  checked,
  detaching,
  disabled,
  onCheckedChange,
  onConfirm,
  onCancel,
}: Readonly<{
  visible: boolean;
  target: DeploymentTarget;
  checked: boolean;
  detaching: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  if (!visible) return null;
  return (
    <div className="hosting-confirm">
      <label className="hosting-confirm__check">
        <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} />
        <span>
          Also delete the {target.provider} resource ({target.providerProjectName}). This cannot be undone.
        </span>
      </label>
      <div className="hosting-confirm__actions">
        <button type="button" className="hosting-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="hosting-btn hosting-btn--danger"
          disabled={disabled || detaching}
          onClick={onConfirm}
        >
          {detachButtonLabel(detaching, true)}
        </button>
      </div>
    </div>
  );
}

/**
 * The service's log console. Opened from the Overview card it scopes to that
 * card's deploy and scrolls into view; opened here, it starts on the last hour.
 */
function TargetLogs({
  open,
  logFocus,
  projectId,
  target,
}: Readonly<{
  open: boolean;
  logFocus: DeploymentLogFocus | null;
  projectId: string;
  target: DeploymentTarget;
}>) {
  if (!open) return null;
  const focus = logFocus?.targetId === target.id ? logFocus : null;
  return (
    <DeploymentLogsConsole
      deployWindow={focus?.window ?? null}
      focusOnMount={focus !== null}
      projectId={projectId}
      providerLabel={providerDisplayName(target.provider)}
      targetId={target.id}
      targetName={target.providerProjectName}
    />
  );
}
