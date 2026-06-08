"use client";

import { FormEvent, useMemo, useState } from "react";

import { useProjectEnvProvisioning } from "@/hooks/use-project-env-provisioning";
import type {
  EnvEnvironment,
  EnvOwnershipMode,
  EnvProvider,
  EnvTargetSlot,
  ProvisionedProject,
} from "@/lib/api/contracts";

const ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]{1,127}$/;

interface EnvRow {
  key: string;
  value: string;
}

export function ProjectEnvPanel({ project }: Readonly<{ project: ProvisionedProject }>) {
  const { addTarget, loading, metadata, providerConnections, provision, saving, targets } =
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
    const target = await addTarget(targetPayload);
    setTargetId(target.id);
    setMessage(targetAction === "create" ? "Deployment target created." : "Deployment target registered.");
  }

  async function handleProvision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    await provision({
      deploymentTargetId: activeTargetId,
      environment,
      vars: rows,
    });
    setRows([{ key: "", value: "" }]);
    setMessage("Environment variables provisioned.");
  }

  return (
    <div style={{ borderTop: "1px solid var(--border-soft)", display: "grid", gap: "0.75rem", paddingTop: "0.75rem" }}>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(11.5rem, 1fr))", gap: "0.5rem" }}>
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
          <select value={provider} onChange={(event) => setProvider(event.target.value as EnvProvider)}>
            <option value="render">Render</option>
            <option value="vercel">Vercel</option>
          </select>
          <select value={slot} onChange={(event) => setSlot(event.target.value as EnvTargetSlot)}>
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
                    {connection.label} · {connection.tokenLastFour}
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
            style={{ minHeight: "2.75rem" }}
          >
            {targetAction === "create" ? "Create target" : "Register target"}
          </button>
        </div>
        <select value={activeTargetId} onChange={(event) => setTargetId(event.target.value)} disabled={!targets.length}>
          {targets.length ? (
            targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.providerProjectName} · {target.provider}
              </option>
            ))
          ) : (
            <option value="">Create a target first</option>
          )}
        </select>
      </div>

      <form onSubmit={handleProvision} style={{ display: "grid", gap: "0.55rem" }}>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
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
        {rows.map((row, index) => (
          <div key={index} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))", gap: "0.45rem" }}>
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
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button className="ghost-button" type="button" onClick={() => setRows((current) => [...current, { key: "", value: "" }])}>
            Add row
          </button>
          <button className="primary-button" disabled={saving || loading || !activeTargetId || invalid} type="submit">
            Provision
          </button>
        </div>
      </form>

      {message ? <p style={{ color: "var(--success)", margin: 0, fontSize: "0.8rem" }}>{message}</p> : null}
      {metadata.length ? (
        <div style={{ display: "grid", gap: "0.25rem" }}>
          {metadata.map((item) => (
            <div key={item.id} style={{ color: "var(--text-secondary)", display: "flex", fontSize: "0.75rem", gap: "0.5rem", justifyContent: "space-between" }}>
              <span>{item.key}</span>
              <span>
                {item.environment} · {item.status}
                {item.errorSummary ? ` · ${item.errorSummary}` : ""}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
