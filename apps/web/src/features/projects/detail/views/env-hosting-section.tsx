"use client";

import type {
  DeploymentTarget,
  EnvProvider,
  RenderRuntime,
  UsageLimitItem,
} from "@/features/projects";
import type { EnvOwnershipMode, ProviderConnection } from "@/shared/api/contracts";
import {
  RENDER_RUNTIME_OPTIONS,
  USAGE_LABELS,
  canSaveEnvTarget,
} from "../model/env-panel-rules";

export function EnvHostingSection({
  activeProviderConnectionId,
  branchName,
  buildCommand,
  hosting,
  matchingConnections,
  message,
  onSaveTarget,
  ownershipMode,
  projectName,
  provider,
  providerProjectId,
  providerProjectName,
  renderRuntime,
  resourceUsageItems,
  rootDirectory,
  saving,
  setBranchName,
  setBuildCommand,
  setProjectName,
  setProviderConnectionId,
  setProviderProjectId,
  setProviderProjectName,
  setRenderRuntime,
  setRootDirectory,
  setStartCommand,
  setTargetAction,
  startCommand,
  targetAction,
  targets,
}: Readonly<{
  activeProviderConnectionId: string;
  branchName: string;
  buildCommand: string;
  hosting: { label: string; provider: EnvProvider };
  matchingConnections: ProviderConnection[];
  message: string | null;
  onSaveTarget: () => void;
  ownershipMode: EnvOwnershipMode;
  projectName: string;
  provider: EnvProvider;
  providerProjectId: string;
  providerProjectName: string;
  renderRuntime: RenderRuntime;
  resourceUsageItems: UsageLimitItem[];
  rootDirectory: string;
  saving: boolean;
  setBranchName: (value: string) => void;
  setBuildCommand: (value: string) => void;
  setProjectName: (value: string) => void;
  setProviderConnectionId: (value: string) => void;
  setProviderProjectId: (value: string) => void;
  setProviderProjectName: (value: string) => void;
  setRenderRuntime: (value: RenderRuntime) => void;
  setRootDirectory: (value: string) => void;
  setStartCommand: (value: string) => void;
  setTargetAction: (value: "create" | "register_existing") => void;
  startCommand: string;
  targetAction: "create" | "register_existing";
  targets: DeploymentTarget[];
}>) {
  return (
    <section className="env-provisioning-section env-provisioning-section--hosting">
      <div className="env-section-header">
        <h4>{hosting.label} service</h4>
        {message ? <span>{message}</span> : null}
      </div>

      {targets.length === 0 ? (
        <EnvHostingForm
          activeProviderConnectionId={activeProviderConnectionId}
          branchName={branchName}
          buildCommand={buildCommand}
          hosting={hosting}
          matchingConnections={matchingConnections}
          onSaveTarget={onSaveTarget}
          ownershipMode={ownershipMode}
          projectName={projectName}
          provider={provider}
          providerProjectId={providerProjectId}
          providerProjectName={providerProjectName}
          renderRuntime={renderRuntime}
          rootDirectory={rootDirectory}
          saving={saving}
          setBranchName={setBranchName}
          setBuildCommand={setBuildCommand}
          setProjectName={setProjectName}
          setProviderConnectionId={setProviderConnectionId}
          setProviderProjectId={setProviderProjectId}
          setProviderProjectName={setProviderProjectName}
          setRenderRuntime={setRenderRuntime}
          setRootDirectory={setRootDirectory}
          setStartCommand={setStartCommand}
          setTargetAction={setTargetAction}
          startCommand={startCommand}
          targetAction={targetAction}
        />
      ) : (
        <div className="hosting-service-locked" role="status">
          <strong>{targets[0]?.providerProjectName || hosting.label}</strong>
          <span>
            This repository uses one fixed {hosting.label} service. Its settings
            and status are shown below.
          </span>
        </div>
      )}

      <EnvUsageList items={resourceUsageItems} />
    </section>
  );
}

function EnvHostingForm({
  activeProviderConnectionId,
  branchName,
  buildCommand,
  hosting,
  matchingConnections,
  onSaveTarget,
  ownershipMode,
  projectName,
  provider,
  providerProjectId,
  providerProjectName,
  renderRuntime,
  rootDirectory,
  saving,
  setBranchName,
  setBuildCommand,
  setProjectName,
  setProviderConnectionId,
  setProviderProjectId,
  setProviderProjectName,
  setRenderRuntime,
  setRootDirectory,
  setStartCommand,
  setTargetAction,
  startCommand,
  targetAction,
}: Readonly<{
  activeProviderConnectionId: string;
  branchName: string;
  buildCommand: string;
  hosting: { label: string };
  matchingConnections: ProviderConnection[];
  onSaveTarget: () => void;
  ownershipMode: EnvOwnershipMode;
  projectName: string;
  provider: EnvProvider;
  providerProjectId: string;
  providerProjectName: string;
  renderRuntime: RenderRuntime;
  rootDirectory: string;
  saving: boolean;
  setBranchName: (value: string) => void;
  setBuildCommand: (value: string) => void;
  setProjectName: (value: string) => void;
  setProviderConnectionId: (value: string) => void;
  setProviderProjectId: (value: string) => void;
  setProviderProjectName: (value: string) => void;
  setRenderRuntime: (value: RenderRuntime) => void;
  setRootDirectory: (value: string) => void;
  setStartCommand: (value: string) => void;
  setTargetAction: (value: "create" | "register_existing") => void;
  startCommand: string;
  targetAction: "create" | "register_existing";
}>) {
  const canSave = canSaveEnvTarget({
    saving,
    branchName,
    targetAction,
    projectName,
    providerProjectId,
    providerProjectName,
    ownershipMode,
    activeProviderConnectionId,
  });

  return (
    <div className="env-target-grid">
      <select
        aria-label="Target action"
        value={targetAction}
        onChange={(event) =>
          setTargetAction(event.target.value as "create" | "register_existing")
        }
      >
        <option value="create">Create new target</option>
        <option value="register_existing">Use existing target</option>
      </select>
      <div className="env-target-grid__field env-target-grid__field--wide">
        <span>Hosting provider</span>
        <span className="env-static-field">{hosting.label}</span>
      </div>
      <div className="env-target-grid__field">
        <span>Ownership</span>
        <span className="env-static-field">
          {ownershipMode === "byo"
            ? "Bring your own provider"
            : "Managed by the organization"}
        </span>
      </div>
      {ownershipMode === "byo" ? (
        <EnvConnectionSelect
          activeProviderConnectionId={activeProviderConnectionId}
          matchingConnections={matchingConnections}
          provider={provider}
          setProviderConnectionId={setProviderConnectionId}
        />
      ) : null}
      {targetAction === "create" ? (
        <EnvCreateFields
          buildCommand={buildCommand}
          projectName={projectName}
          provider={provider}
          renderRuntime={renderRuntime}
          rootDirectory={rootDirectory}
          setBuildCommand={setBuildCommand}
          setProjectName={setProjectName}
          setRenderRuntime={setRenderRuntime}
          setRootDirectory={setRootDirectory}
          setStartCommand={setStartCommand}
          startCommand={startCommand}
        />
      ) : (
        <EnvRegisterFields
          providerProjectId={providerProjectId}
          providerProjectName={providerProjectName}
          setProviderProjectId={setProviderProjectId}
          setProviderProjectName={setProviderProjectName}
        />
      )}
      <input
        value={branchName}
        onChange={(event) => setBranchName(event.target.value)}
        placeholder="Branch"
      />
      <button
        className="ghost-button"
        data-testid="save-target"
        disabled={!canSave}
        type="button"
        onClick={onSaveTarget}
      >
        {targetAction === "create" ? "Create target" : "Register target"}
      </button>
    </div>
  );
}

function EnvConnectionSelect({
  activeProviderConnectionId,
  matchingConnections,
  provider,
  setProviderConnectionId,
}: Readonly<{
  activeProviderConnectionId: string;
  matchingConnections: ProviderConnection[];
  provider: EnvProvider;
  setProviderConnectionId: (value: string) => void;
}>) {
  return (
    <select
      aria-label="Provider connection"
      value={activeProviderConnectionId}
      onChange={(event) => setProviderConnectionId(event.target.value)}
      disabled={!matchingConnections.length}
    >
      {matchingConnections.length ? (
        matchingConnections.map((connection) => (
          <option key={connection.id} value={connection.id}>
            {connection.label} - {connection.tokenLastFour}
          </option>
        ))
      ) : (
        <option value="">No saved {provider} connection</option>
      )}
    </select>
  );
}

function EnvCreateFields({
  buildCommand,
  projectName,
  provider,
  renderRuntime,
  rootDirectory,
  setBuildCommand,
  setProjectName,
  setRenderRuntime,
  setRootDirectory,
  setStartCommand,
  startCommand,
}: Readonly<{
  buildCommand: string;
  projectName: string;
  provider: EnvProvider;
  renderRuntime: RenderRuntime;
  rootDirectory: string;
  setBuildCommand: (value: string) => void;
  setProjectName: (value: string) => void;
  setRenderRuntime: (value: RenderRuntime) => void;
  setRootDirectory: (value: string) => void;
  setStartCommand: (value: string) => void;
  startCommand: string;
}>) {
  return (
    <>
      <input
        value={projectName}
        onChange={(event) => setProjectName(event.target.value)}
        placeholder="Provider project name"
      />
      <input
        value={rootDirectory}
        onChange={(event) => setRootDirectory(event.target.value)}
        placeholder="Root directory"
      />
      <input
        value={buildCommand}
        onChange={(event) => setBuildCommand(event.target.value)}
        placeholder="Build command"
      />
      {provider === "render" ? (
        <>
          <select
            aria-label="Render runtime"
            value={renderRuntime}
            onChange={(event) =>
              setRenderRuntime(event.target.value as RenderRuntime)
            }
          >
            {RENDER_RUNTIME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={startCommand}
            onChange={(event) => setStartCommand(event.target.value)}
            placeholder="Start command"
          />
        </>
      ) : null}
    </>
  );
}

function EnvRegisterFields({
  providerProjectId,
  providerProjectName,
  setProviderProjectId,
  setProviderProjectName,
}: Readonly<{
  providerProjectId: string;
  providerProjectName: string;
  setProviderProjectId: (value: string) => void;
  setProviderProjectName: (value: string) => void;
}>) {
  return (
    <>
      <input
        value={providerProjectId}
        onChange={(event) => setProviderProjectId(event.target.value)}
        placeholder="Provider project ID"
      />
      <input
        value={providerProjectName}
        onChange={(event) => setProviderProjectName(event.target.value)}
        placeholder="Provider project name"
      />
    </>
  );
}

function EnvUsageList({ items }: Readonly<{ items: UsageLimitItem[] }>) {
  if (!items.length) return null;
  return (
    <div className="env-metadata-list" aria-label="Resource usage">
      {items.map((item) => (
        <div key={item.code} className="env-metadata-row provisioned">
          <span>{USAGE_LABELS[item.code] ?? item.code.replaceAll("_", " ")}</span>
          <span>
            {item.current} / {item.limit}
          </span>
        </div>
      ))}
    </div>
  );
}
