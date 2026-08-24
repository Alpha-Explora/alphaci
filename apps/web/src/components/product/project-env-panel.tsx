"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { useCapabilities } from "@/hooks/use-capabilities";
import { useProjectEnvProvisioning } from "@/hooks/use-project-env-provisioning";
import type {
  EnvLane,
  EnvVarScope,
  EnvProvider,
  DeploymentTarget,
  RenderRuntime,
  EnvTargetSlot,
  EnvVarMetadata,
  ProvisionedProject,
  UsageLimitItem,
  ValidateEnvVarsResponse,
} from "@/lib/api/contracts";
import { getMyUsage } from "@/lib/api/usage";
import {
  cleanUserMessage,
  formatApiError,
  formatQuotaStatus,
} from "./workflow-builder-utils";

const ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]{1,127}$/;

const USAGE_LABELS: Record<string, string> = {
  projects: "Projects",
  managed_render_services: "Archived managed Render services",
  managed_vercel_projects: "Archived managed Vercel projects",
  deployment_targets: "Deployment targets",
  env_keys: "Env keys",
  workflow_prs: "Workflow update PRs",
};

const RENDER_RUNTIME_OPTIONS: Array<{ value: RenderRuntime; label: string }> = [
  { value: "docker", label: "Dockerfile" },
  { value: "node", label: "Node.js / Bun" },
  { value: "python", label: "Python" },
  { value: "ruby", label: "Ruby" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "elixir", label: "Elixir" },
];

function hostingForProject(project: ProvisionedProject): {
  provider: EnvProvider;
  slot: EnvTargetSlot;
  label: string;
} {
  // A repository owns one hosting service. Infer its fixed provider instead
  // of allowing a frontend repository to be configured as a Render service.
  const identity = [project.projectTypeId, project.serviceName, project.repoFullName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const isFrontend = /next|react|vue|angular|svelte|frontend|[-_]fe\b/.test(identity);

  return isFrontend
    ? { provider: "vercel", slot: "frontend", label: "Vercel frontend" }
    : { provider: "render", slot: "backend", label: "Render backend" };
}

function formatRenderRuntime(
  value: RenderRuntime | string | null | undefined,
): string {
  if (!value) return "Not configured";
  if (value === "node") return "Node.js / Bun";
  if (value === "docker") return "Dockerfile";
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

interface EnvRow {
  key: string;
  value: string;
}

interface ProjectEnvPanelProps {
  project: ProvisionedProject;
  onTargetCreated?: (target: DeploymentTarget) => void;
  section?: "all" | "hosting" | "variables";
}

function targetOptionLabel(target: {
  providerProjectName: string;
  provider: EnvProvider;
  slot: EnvTargetSlot;
  branchName: string;
  renderRuntime?: RenderRuntime | string | null;
}): string {
  const provider = target.provider === "render" ? "Render" : "Vercel";
  const branch = activeBranch(target.branchName);
  const runtime =
    target.provider === "render" && target.renderRuntime
      ? ` - ${formatRenderRuntime(target.renderRuntime)}`
      : "";
  return `${target.providerProjectName} - ${provider} ${target.slot} - ${branch}${runtime}`;
}

function activeBranch(branchName: string | null | undefined): string {
  return branchName === "main" ? "main" : "uat";
}

/**
 * Label for a lane/branch pair.
 *
 * Replaces activeEnvironment, which rewrote 'test' to 'uat' on the way to the
 * screen. That rewrite existed because test and uat both wrote to one Vercel
 * record, so showing both would have shown the same values twice — the lane
 * model removes the collision instead of hiding it.
 */
function scopeLabel(scope: { lane: EnvLane; gitBranch: string | null }): string {
  return scope.lane === "production" ? "production" : `preview: ${scope.gitBranch}`;
}

/** Stable value for the scope filter select. */
function scopeFilterValue(scope: {
  lane: EnvLane;
  gitBranch: string | null;
}): string {
  return scope.lane === "production" ? "production" : `preview:${scope.gitBranch}`;
}

export function ProjectEnvPanel({
  onTargetCreated,
  project,
  section = "all",
}: Readonly<ProjectEnvPanelProps>) {
  const {
    addTarget,
    loading,
    metadata,
    providerConnections,
    provision,
    removeMetadata,
    saving,
    targets,
    validateEnvText,
  } = useProjectEnvProvisioning(project.id, project.status === "provisioned");
  const [targetId, setTargetId] = useState("");
  const [targetAction, setTargetAction] = useState<
    "create" | "register_existing"
  >("create");
  // The deployment advertises a single ownership mode via /capabilities; the
  // panel must conform to it rather than choose one locally. 'flowci_managed'
  // deployments centralize hosting on the organization's Render/Vercel
  // accounts, so no provider connection is required (or shown).
  const { deploymentOwnershipMode: ownershipMode } = useCapabilities();
  const hosting = useMemo(() => hostingForProject(project), [project]);
  const provider = hosting.provider;
  const slot = hosting.slot;
  const [lane, setLane] = useState<EnvLane>("preview");
  // The branch a preview-lane write applies to. Defaults below to whichever
  // branch the selected target tracks, which is the one the reader is looking
  // at; it stays editable because a preview can exist for any branch.
  const [previewBranch, setPreviewBranch] = useState("");
  const [projectName, setProjectName] = useState(`${project.serviceName}-uat`);
  const [providerProjectId, setProviderProjectId] = useState("");
  const [providerProjectName, setProviderProjectName] = useState(
    project.serviceName,
  );
  const [providerConnectionId, setProviderConnectionId] = useState("");
  const [branchName, setBranchName] = useState("uat");
  const [rootDirectory, setRootDirectory] = useState(".");
  const [buildCommand, setBuildCommand] = useState("npm ci && npm run build");
  const [startCommand, setStartCommand] = useState("npm run start:prod");
  const [renderRuntime, setRenderRuntime] = useState<RenderRuntime>("docker");
  const [rows, setRows] = useState<EnvRow[]>([{ key: "", value: "" }]);
  const [message, setMessage] = useState<string | null>(null);
  const [bulkEnvText, setBulkEnvText] = useState("");
  const [isAddingVariable, setIsAddingVariable] = useState(false);
  const [isBulkEnvDialogOpen, setIsBulkEnvDialogOpen] = useState(false);
  const [bulkValidation, setBulkValidation] =
    useState<ValidateEnvVarsResponse | null>(null);
  const [filterTargetId, setFilterTargetId] = useState("all");
  // A scope filter value, not an enum: the set of branches is open-ended, so
  // the options are derived from what is provisioned (see presentScopes).
  const [filterEnvironment, setFilterEnvironment] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<
    "all" | EnvVarMetadata["status"]
  >("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [usageItems, setUsageItems] = useState<UsageLimitItem[]>([]);

  const activeTargetId = targetId || targets[0]?.id || "";
  const activeTarget = targets.find((target) => target.id === activeTargetId);

  /** Branches to offer for a preview write: the ones targets already track. */
  const knownBranches = useMemo(
    () =>
      [
        ...new Set(
          targets
            .map((target) => target.branchName)
            .filter((branch): branch is string => Boolean(branch)),
        ),
      ].sort(),
    [targets],
  );

  /**
   * The scope a write will land on.
   *
   * An untouched branch field means "the branch this target tracks" rather
   * than an error, so switching target moves the default with it instead of
   * making the reader retype what is already on screen.
   */
  const activeScope = useMemo<EnvVarScope>(() => {
    if (lane === "production") {
      return { lane: "production", gitBranch: null };
    }
    const branch = previewBranch.trim() || activeTarget?.branchName || "";
    return { lane: "preview", gitBranch: branch || null };
  }, [activeTarget?.branchName, lane, previewBranch]);

  /** Scopes that actually have variables, for the filter select. */
  const presentScopes = useMemo(() => {
    const byValue = new Map<string, { value: string; label: string }>();
    for (const item of metadata) {
      byValue.set(scopeFilterValue(item), {
        value: scopeFilterValue(item),
        label: scopeLabel(item),
      });
    }
    return [...byValue.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [metadata]);

  const matchingConnections = providerConnections.filter(
    (connection) => connection.provider === provider,
  );
  const activeProviderConnectionId =
    providerConnectionId || matchingConnections[0]?.id || "";
  const envKeyQuota = useMemo(
    () => usageItems.find((item) => item.code === "env_keys") ?? null,
    [usageItems],
  );
  const envKeyQuotaReached = Boolean(
    envKeyQuota &&
    envKeyQuota.limit > 0 &&
    envKeyQuota.current >= envKeyQuota.limit,
  );
  const resourceUsageItems = useMemo(
    () => usageItems.filter((item) => item.limit > 0),
    [usageItems],
  );
  const invalid = useMemo(() => {
    const keys = new Set<string>();
    for (const row of rows) {
      if (
        !ENV_KEY_PATTERN.test(row.key) ||
        row.value === "" ||
        keys.has(row.key)
      )
        return true;
      keys.add(row.key);
    }
    return rows.length === 0;
  }, [rows]);
  const filteredMetadata = useMemo(() => {
    return metadata.filter((item) => {
      if (
        filterTargetId !== "all" &&
        item.deploymentTargetId !== filterTargetId
      )
        return false;
      if (
        filterEnvironment !== "all" &&
        scopeFilterValue(item) !== filterEnvironment
      )
        return false;
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      return true;
    });
  }, [filterEnvironment, filterStatus, filterTargetId, metadata]);
  const showHosting = section !== "variables";
  const showVariables = section !== "hosting";

  useEffect(() => {
    let cancelled = false;
    void getMyUsage()
      .then((usage) => {
        if (!cancelled && usage.enabled) {
          setUsageItems(usage.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUsageItems([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveTarget() {
    setMessage(null);
    const targetPayload = {
      action: targetAction,
      slot,
      ownershipMode,
      provider,
      branchName,
      ...(ownershipMode === "byo"
        ? { providerConnectionId: activeProviderConnectionId }
        : {}),
      ...(targetAction === "create"
        ? {
            projectName,
            rootDirectory,
            buildCommand,
            ...(provider === "render" && startCommand ? { startCommand } : {}),
            ...(provider === "render"
              ? {
                  renderRuntime,
                  renderServiceType: "web_service" as const,
                  renderInstanceType: "free",
                }
              : {}),
          }
        : {
            providerProjectId,
            providerProjectName,
          }),
    } as const;
    try {
      const target = await addTarget(targetPayload);
      setTargetId(target.id);
      onTargetCreated?.(target);
      setMessage(
        targetAction === "create"
          ? "Deployment target created."
          : "Deployment target registered.",
      );
    } catch (error) {
      setMessage(formatApiError(error, "Deployment target setup failed"));
    }
  }

  async function handleProvision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    try {
      await provision({
        deploymentTargetId: activeTargetId,
        ...activeScope,
        vars: rows,
      });
      setRows([{ key: "", value: "" }]);
      setIsAddingVariable(false);
      setMessage("Environment variables provisioned.");
    } catch (error) {
      setMessage(
        formatApiError(error, "Environment variable provisioning failed"),
      );
    }
  }

  async function handleBulkValidate() {
    if (!activeTargetId) return;
    setMessage(null);
    try {
      const result = await validateEnvText({
        deploymentTargetId: activeTargetId,
        ...activeScope,
        text: bulkEnvText,
      });
      setBulkValidation(result);
      setBulkEnvText("");
      setMessage(
        `Parsed ${result.keyCount} env ${result.keyCount === 1 ? "line" : "lines"}. Values were cleared.`,
      );
    } catch (error) {
      setMessage(
        formatApiError(error, "Environment variable validation failed"),
      );
    }
  }

  function useParsedKeys() {
    if (!bulkValidation?.keys.length) return;
    setRows(bulkValidation.keys.map((key) => ({ key, value: "" })));
    setIsAddingVariable(true);
    setIsBulkEnvDialogOpen(false);
  }

  async function handleDeleteMetadata(item: EnvVarMetadata) {
    if (confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      setMessage(
        "Confirm delete to remove this key from the provider and ALPHACI metadata.",
      );
      return;
    }

    setMessage(null);
    try {
      await removeMetadata(item.id);
      setConfirmDeleteId(null);
      setMessage(`${item.key} deleted.`);
    } catch (error) {
      setMessage(formatApiError(error, "Environment variable delete failed"));
    }
  }

  function startReProvision(item: EnvVarMetadata) {
    setTargetId(item.deploymentTargetId);
    setLane(item.lane);
    setPreviewBranch(item.gitBranch ?? "");
    setRows([{ key: item.key, value: "" }]);
    setIsAddingVariable(true);
    setMessage(`Re-enter the value for ${item.key} before provisioning.`);
  }

  return (
    <div className="env-provisioning-panel">
      {showHosting ? (
      <section className="env-provisioning-section env-provisioning-section--hosting">
        <div className="env-section-header">
          <h4>{hosting.label} service</h4>
          {message ? <span>{message}</span> : null}
        </div>

        {targets.length === 0 ? (
        <div className="env-target-grid">
          <select
            aria-label="Target action"
            value={targetAction}
            onChange={(event) =>
              setTargetAction(
                event.target.value as "create" | "register_existing",
              )
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
          ) : null}
          {targetAction === "create" ? (
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
          ) : (
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
          )}
          <input
            value={branchName}
            onChange={(event) => setBranchName(event.target.value)}
            placeholder="Branch"
          />
          <button
            className="ghost-button"
            data-testid="save-target"
            disabled={
              saving ||
              !branchName ||
              (targetAction === "create" && !projectName) ||
              (targetAction === "register_existing" &&
                (!providerProjectId || !providerProjectName)) ||
              (ownershipMode === "byo" && !activeProviderConnectionId)
            }
            type="button"
            onClick={() => void handleSaveTarget()}
          >
            {targetAction === "create" ? "Create target" : "Register target"}
          </button>
        </div>
        ) : (
          <div className="hosting-service-locked" role="status">
            <strong>{targets[0]?.providerProjectName || hosting.label}</strong>
            <span>
              This repository uses one fixed {hosting.label} service. Its
              settings and status are shown below.
            </span>
          </div>
        )}

        {resourceUsageItems.length ? (
          <div className="env-metadata-list" aria-label="Resource usage">
            {resourceUsageItems.map((item) => (
              <div key={item.code} className="env-metadata-row provisioned">
                <span>
                  {USAGE_LABELS[item.code] ?? item.code.replaceAll("_", " ")}
                </span>
                <span>
                  {item.current} / {item.limit}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </section>
      ) : null}

      {showVariables && isAddingVariable ? (
      <form
        className="env-provisioning-section env-variables-form"
        onSubmit={handleProvision}
      >
        <div className="env-section-header">
          <div>
            <h4>Add variables</h4>
            <p className="helper-text" style={{ margin: "0.25rem 0 0" }}>
              Add values to the selected hosting service and environment.
            </p>
          </div>
        </div>

        {targets.length ? (
          <div className="env-target-grid__field env-target-grid__field--wide">
            <span>Branch target</span>
            <div className="env-segmented-actions" role="group">
              {targets.map((target) => (
                <button
                  key={target.id}
                  className={
                    activeTargetId === target.id
                      ? "primary-button"
                      : "ghost-button"
                  }
                  type="button"
                  onClick={() => setTargetId(target.id)}
                >
                  {target.provider === "render" ? "Render" : "Vercel"}{" "}
                  {activeBranch(target.branchName)}
                </button>
              ))}
            </div>
            {activeTarget ? (
              <span className="helper-text env-target-grid__note">
                {targetOptionLabel(activeTarget)}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="env-empty-state">
            Add a hosting service before provisioning branch variables.
          </p>
        )}

        <div className="env-variable-workspace">
          <section className="env-variable-editor" aria-label="Variable editor">
            <div className="env-variable-subheader">
              <div>
                <strong>Variables</strong>
                <span>
                  {lane === "production"
                    ? "These values apply to the production branch."
                    : "These values apply to this branch only."}
                </span>
              </div>
              <div className="env-environment-tabs" aria-label="Deployment lane">
                {(["production", "preview"] as EnvLane[]).map((value) => (
                  <button
                    key={value}
                    className={
                      lane === value ? "primary-button" : "ghost-button"
                    }
                    type="button"
                    onClick={() => setLane(value)}
                  >
                    {value === "production" ? "Production" : "Branch"}
                  </button>
                ))}
              </div>
            </div>

            {lane === "preview" ? (
              <label className="env-branch-field">
                <span>Branch</span>
                <input
                  list="env-known-branches"
                  onChange={(event) => setPreviewBranch(event.target.value)}
                  placeholder="feature/checkout"
                  value={previewBranch}
                />
                <datalist id="env-known-branches">
                  {knownBranches.map((branch) => (
                    <option key={branch} value={branch} />
                  ))}
                </datalist>
              </label>
            ) : null}

            <div className="env-variable-column-labels" aria-hidden="true">
              <span>Key</span>
              <span>Secret value</span>
            </div>
            <div className="env-variable-rows">
              {rows.map((row, index) => (
                <div key={index} className="env-var-row">
                  <input
                    aria-label={`Variable key ${index + 1}`}
                    value={row.key}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                key: event.target.value.toUpperCase(),
                              }
                            : item,
                        ),
                      )
                    }
                    placeholder="DATABASE_URL"
                  />
                  <input
                    aria-label={`Variable value ${index + 1}`}
                    value={row.value}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, value: event.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder="Value"
                    type="password"
                    autoComplete="off"
                  />
                  <button
                    className="env-var-row__remove"
                    aria-label={`Remove variable row ${index + 1}`}
                    title="Remove variable"
                    type="button"
                    onClick={() =>
                      setRows((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {envKeyQuota ? (
              <div className="env-empty-state" role="status">
                Env key quota: {formatQuotaStatus(envKeyQuota)}
              </div>
            ) : null}

            <div className="env-form-actions">
              <button
                className="ghost-button"
                type="button"
                onClick={() => setIsAddingVariable(false)}
              >
                Cancel
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setIsBulkEnvDialogOpen(true)}
              >
                Paste a .env file
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() =>
                  setRows((current) => [...current, { key: "", value: "" }])
                }
              >
                Add row
              </button>
              <button
                className="primary-button"
                disabled={
                  saving ||
                  loading ||
                  !activeTargetId ||
                  invalid ||
                  envKeyQuotaReached
                }
                type="submit"
              >
                Provision
              </button>
            </div>
          </section>

          {isBulkEnvDialogOpen ? (
          <section
            className="env-bulk-editor env-bulk-editor--dialog"
            aria-label="Paste a .env file"
            aria-modal="true"
            role="dialog"
          >
            <div className="env-variable-subheader">
              <div>
                <strong>Paste a .env file</strong>
                <span>Validate keys before adding them to the form.</span>
              </div>
            </div>
            <textarea
              aria-label="Bulk env text"
              value={bulkEnvText}
              onChange={(event) => setBulkEnvText(event.target.value)}
              placeholder={"DATABASE_URL=...\nAPI_KEY=..."}
              rows={6}
            />
            <button
              className="ghost-button env-bulk-editor__validate"
              disabled={
                saving ||
                loading ||
                !activeTargetId ||
                bulkEnvText.trim() === ""
              }
              type="button"
              onClick={() => void handleBulkValidate()}
            >
              Validate .env
            </button>

            <button
              className="ghost-button"
              type="button"
              onClick={() => setIsBulkEnvDialogOpen(false)}
            >
              Close
            </button>

            {bulkValidation ? (
              <div className="env-bulk-validation">
                <span>
                  <strong>Parsed keys</strong>
                  <br />
                  {bulkValidation.keys.length
                    ? bulkValidation.keys.join(", ")
                    : "No valid keys"}
                  {bulkValidation.duplicates.length
                    ? ` - duplicates: ${bulkValidation.duplicates.join(", ")}`
                    : ""}
                  {bulkValidation.invalidKeys.length
                    ? ` - invalid: ${bulkValidation.invalidKeys.join(", ")}`
                    : ""}
                </span>
                <button
                  className="ghost-button"
                  disabled={!bulkValidation.keys.length}
                  type="button"
                  onClick={useParsedKeys}
                >
                  Use parsed keys
                </button>
              </div>
            ) : null}
          </section>
          ) : null}
        </div>
      </form>
      ) : null}

      {showVariables ? (
      <section className="env-provisioning-section env-provisioned-variables">
        <div className="env-section-header">
          <h4>Provisioned variables</h4>
          <div className="env-provisioned-variables__actions">
            <button
              className="ghost-button"
              type="button"
              onClick={() => setIsAddingVariable(true)}
            >
              Add variable
            </button>
          </div>
        </div>
        {metadata.length ? (
          <div className="env-target-grid env-metadata-filters">
            <select
              aria-label="Filter target"
              value={filterTargetId}
              onChange={(event) => setFilterTargetId(event.target.value)}
            >
              <option value="all">All targets</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {targetOptionLabel(target)}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter environment"
              value={filterEnvironment}
              onChange={(event) => setFilterEnvironment(event.target.value)}
            >
              <option value="all">All environments</option>
              {/* Built from what is actually provisioned: the set of branches is
                  open-ended, so a hardcoded list would go stale. */}
              {presentScopes.map((scope) => (
                <option key={scope.value} value={scope.value}>
                  {scope.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter status"
              value={filterStatus}
              onChange={(event) =>
                setFilterStatus(
                  event.target.value as "all" | EnvVarMetadata["status"],
                )
              }
            >
              <option value="all">All statuses</option>
              <option value="provisioned">provisioned</option>
              <option value="failed">failed</option>
            </select>
          </div>
        ) : null}
        {filteredMetadata.length ? (
          <div className="env-metadata-list">
            {filteredMetadata.map((item) => (
              <div key={item.id} className={`env-metadata-row ${item.status}`}>
                <span>{item.key}</span>
                <span>
                  {scopeLabel(item)} - {item.status}
                  {item.errorSummary
                    ? ` - ${cleanUserMessage(item.errorSummary)}`
                    : ""}
                </span>
                <span className="env-metadata-actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => startReProvision(item)}
                  >
                    Re-provision
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => void handleDeleteMetadata(item)}
                  >
                    {confirmDeleteId === item.id ? "Confirm delete" : "Delete"}
                  </button>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="env-empty-state">No variables provisioned yet.</p>
        )}
      </section>
      ) : null}
    </div>
  );
}
