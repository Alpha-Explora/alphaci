"use client";

import { FormEvent, useMemo, useState } from "react";

import { useProjectEnvProvisioning } from "@/hooks/use-project-env-provisioning";
import type {
  EnvEnvironment,
  EnvOwnershipMode,
  EnvProvider,
  EnvTargetSlot,
  EnvVarMetadata,
  ProvisionedProject,
  ValidateEnvVarsResponse,
} from "@/lib/api/contracts";
import { cleanUserMessage, formatApiError } from "./workflow-builder-utils";

const ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]{1,127}$/;

interface EnvRow {
  key: string;
  value: string;
}

export function ProjectEnvPanel({ project }: Readonly<{ project: ProvisionedProject }>) {
  const { addTarget, loading, metadata, providerConnections, provision, removeMetadata, saving, targets, validateEnvText } =
    useProjectEnvProvisioning(project.id, project.status === "provisioned");
  const [targetId, setTargetId] = useState("");
  const [targetAction, setTargetAction] = useState<"create" | "register_existing">("create");
  const [ownershipMode, setOwnershipMode] = useState<EnvOwnershipMode>("flowci_managed");
  const [provider, setProvider] = useState<EnvProvider>("render");
  const [slot, setSlot] = useState<EnvTargetSlot>("backend");
  const [environment, setEnvironment] = useState<EnvEnvironment>("test");
  const [projectName, setProjectName] = useState(`${project.serviceName}-test`);
  const [providerProjectId, setProviderProjectId] = useState("");
  const [providerProjectName, setProviderProjectName] = useState(project.serviceName);
  const [providerConnectionId, setProviderConnectionId] = useState("");
  const [branchName, setBranchName] = useState("test");
  const [rootDirectory, setRootDirectory] = useState(".");
  const [buildCommand, setBuildCommand] = useState("npm ci && npm run build");
  const [startCommand, setStartCommand] = useState("npm run start:prod");
  const [rows, setRows] = useState<EnvRow[]>([{ key: "", value: "" }]);
  const [message, setMessage] = useState<string | null>(null);
  const [bulkEnvText, setBulkEnvText] = useState("");
  const [bulkValidation, setBulkValidation] = useState<ValidateEnvVarsResponse | null>(null);
  const [filterTargetId, setFilterTargetId] = useState("all");
  const [filterEnvironment, setFilterEnvironment] = useState<"all" | EnvEnvironment>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | EnvVarMetadata["status"]>("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeTargetId = targetId || targets[0]?.id || "";
  const matchingConnections = providerConnections.filter((connection) => connection.provider === provider);
  const activeProviderConnectionId = providerConnectionId || matchingConnections[0]?.id || "";
  const invalid = useMemo(() => {
    const keys = new Set<string>();
    for (const row of rows) {
      if (!ENV_KEY_PATTERN.test(row.key) || row.value === "" || keys.has(row.key)) return true;
      keys.add(row.key);
    }
    return rows.length === 0;
  }, [rows]);
  const filteredMetadata = useMemo(() => {
    return metadata.filter((item) => {
      if (filterTargetId !== "all" && item.deploymentTargetId !== filterTargetId) return false;
      if (filterEnvironment !== "all" && item.environment !== filterEnvironment) return false;
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      return true;
    });
  }, [filterEnvironment, filterStatus, filterTargetId, metadata]);

  async function handleSaveTarget() {
    setMessage(null);
    const targetPayload = {
      action: targetAction,
      slot,
      ownershipMode,
      provider,
      branchName,
      ...(ownershipMode === "byo" ? { providerConnectionId: activeProviderConnectionId } : {}),
      ...(targetAction === "create"
        ? {
            projectName,
            rootDirectory,
            buildCommand,
            ...(provider === "render" && startCommand ? { startCommand } : {}),
          }
        : {
            providerProjectId,
            providerProjectName,
          }),
    } as const;
    try {
      const target = await addTarget(targetPayload);
      setTargetId(target.id);
      setMessage(targetAction === "create" ? "Deployment target created." : "Deployment target registered.");
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
        environment,
        vars: rows,
      });
      setRows([{ key: "", value: "" }]);
      setMessage("Environment variables provisioned.");
    } catch (error) {
      setMessage(formatApiError(error, "Environment variable provisioning failed"));
    }
  }

  async function handleBulkValidate() {
    if (!activeTargetId) return;
    setMessage(null);
    try {
      const result = await validateEnvText({
        deploymentTargetId: activeTargetId,
        environment,
        text: bulkEnvText,
      });
      setBulkValidation(result);
      setBulkEnvText("");
      setMessage(`Parsed ${result.keyCount} env ${result.keyCount === 1 ? "line" : "lines"}. Values were cleared.`);
    } catch (error) {
      setMessage(formatApiError(error, "Environment variable validation failed"));
    }
  }

  function useParsedKeys() {
    if (!bulkValidation?.keys.length) return;
    setRows(bulkValidation.keys.map((key) => ({ key, value: "" })));
  }

  async function handleDeleteMetadata(item: EnvVarMetadata) {
    if (confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      setMessage("Confirm delete to remove this key from the provider and FlowCI metadata.");
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
    setEnvironment(item.environment);
    setRows([{ key: item.key, value: "" }]);
    setMessage(`Re-enter the value for ${item.key} before provisioning.`);
  }

  return (
    <div className="env-provisioning-panel">
      <section className="env-provisioning-section">
        <div className="env-section-header">
          <h4>Deployment target</h4>
          {message ? <span>{message}</span> : null}
        </div>

        <div className="env-target-grid">
          <select
            aria-label="Target action"
            value={targetAction}
            onChange={(event) => setTargetAction(event.target.value as "create" | "register_existing")}
          >
            <option value="create">Create new target</option>
            <option value="register_existing">Use existing target</option>
          </select>
          <select
            aria-label="Ownership mode"
            value={ownershipMode}
            onChange={(event) => setOwnershipMode(event.target.value as EnvOwnershipMode)}
          >
            <option value="flowci_managed">FlowCI-managed</option>
            <option value="byo">Bring your own provider</option>
          </select>
          <select aria-label="Provider" value={provider} onChange={(event) => setProvider(event.target.value as EnvProvider)}>
            <option value="render">Render</option>
            <option value="vercel">Vercel</option>
          </select>
          <select aria-label="Target slot" value={slot} onChange={(event) => setSlot(event.target.value as EnvTargetSlot)}>
            <option value="backend">Backend</option>
            <option value="frontend">Frontend</option>
            <option value="standalone">Standalone</option>
          </select>
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
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Provider project name" />
              <input value={rootDirectory} onChange={(event) => setRootDirectory(event.target.value)} placeholder="Root directory" />
              <input value={buildCommand} onChange={(event) => setBuildCommand(event.target.value)} placeholder="Build command" />
              {provider === "render" ? (
                <input value={startCommand} onChange={(event) => setStartCommand(event.target.value)} placeholder="Start command" />
              ) : null}
            </>
          ) : (
            <>
              <input value={providerProjectId} onChange={(event) => setProviderProjectId(event.target.value)} placeholder="Provider project ID" />
              <input value={providerProjectName} onChange={(event) => setProviderProjectName(event.target.value)} placeholder="Provider project name" />
            </>
          )}
          <input value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="Branch" />
          <button
            className="ghost-button"
            data-testid="save-target"
            disabled={
              saving ||
              !branchName ||
              (targetAction === "create" && !projectName) ||
              (targetAction === "register_existing" && (!providerProjectId || !providerProjectName)) ||
              (ownershipMode === "byo" && !activeProviderConnectionId)
            }
            type="button"
            onClick={() => void handleSaveTarget()}
          >
            {targetAction === "create" ? "Create target" : "Register target"}
          </button>
        </div>

        <select aria-label="Active deployment target" value={activeTargetId} onChange={(event) => setTargetId(event.target.value)} disabled={!targets.length}>
          {targets.length ? (
            targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.providerProjectName} - {target.provider}
              </option>
            ))
          ) : (
            <option value="">Create a target first</option>
          )}
        </select>
      </section>

      <form className="env-provisioning-section" onSubmit={handleProvision}>
        <div className="env-section-header">
          <h4>Variables</h4>
        </div>

        <div className="env-environment-tabs">
          {(["test", "uat", "production"] as EnvEnvironment[]).map((env) => (
            <button
              key={env}
              className={environment === env ? "primary-button" : "ghost-button"}
              type="button"
              onClick={() => setEnvironment(env)}
            >
              {env}
            </button>
          ))}
        </div>

        <div className="env-var-row" style={{ alignItems: "stretch" }}>
          <textarea
            aria-label="Bulk env text"
            value={bulkEnvText}
            onChange={(event) => setBulkEnvText(event.target.value)}
            placeholder={"DATABASE_URL=...\nAPI_KEY=..."}
            rows={4}
            style={{ minHeight: "6rem", resize: "vertical" }}
          />
          <button
            className="ghost-button"
            disabled={saving || loading || !activeTargetId || bulkEnvText.trim() === ""}
            type="button"
            onClick={() => void handleBulkValidate()}
          >
            Validate .env
          </button>
        </div>

        {bulkValidation ? (
          <div className="env-metadata-row provisioned" style={{ alignItems: "center" }}>
            <span>
              <strong>Parsed keys</strong>
              <br />
              {bulkValidation.keys.length ? bulkValidation.keys.join(", ") : "No valid keys"}
              {bulkValidation.duplicates.length ? ` - duplicates: ${bulkValidation.duplicates.join(", ")}` : ""}
              {bulkValidation.invalidKeys.length ? ` - invalid: ${bulkValidation.invalidKeys.join(", ")}` : ""}
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

        {rows.map((row, index) => (
          <div key={index} className="env-var-row">
            <input
              value={row.key}
              onChange={(event) =>
                setRows((current) => current.map((item, i) => (i === index ? { ...item, key: event.target.value.toUpperCase() } : item)))
              }
              placeholder="DATABASE_URL"
            />
            <input
              value={row.value}
              onChange={(event) =>
                setRows((current) => current.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)))
              }
              placeholder="Value"
              type="password"
            />
            <button className="ghost-button" type="button" onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>
              Remove
            </button>
          </div>
        ))}

        <div className="env-form-actions">
          <button className="ghost-button" type="button" onClick={() => setRows((current) => [...current, { key: "", value: "" }])}>
            Add row
          </button>
          <button className="primary-button" disabled={saving || loading || !activeTargetId || invalid} type="submit">
            Provision
          </button>
        </div>
      </form>

      <section className="env-provisioning-section">
        <div className="env-section-header">
          <h4>Provisioned variables</h4>
        </div>
        {metadata.length ? (
          <div className="env-target-grid">
            <select aria-label="Filter target" value={filterTargetId} onChange={(event) => setFilterTargetId(event.target.value)}>
              <option value="all">All targets</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.providerProjectName} - {target.provider}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter environment"
              value={filterEnvironment}
              onChange={(event) => setFilterEnvironment(event.target.value as "all" | EnvEnvironment)}
            >
              <option value="all">All environments</option>
              <option value="test">test</option>
              <option value="uat">uat</option>
              <option value="production">production</option>
            </select>
            <select
              aria-label="Filter status"
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value as "all" | EnvVarMetadata["status"])}
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
                  {item.environment} - {item.status}
                  {item.errorSummary ? ` - ${cleanUserMessage(item.errorSummary)}` : ""}
                </span>
                <span style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button className="ghost-button" type="button" onClick={() => startReProvision(item)}>
                    Re-provision
                  </button>
                  <button className="ghost-button" type="button" onClick={() => void handleDeleteMetadata(item)}>
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
    </div>
  );
}
