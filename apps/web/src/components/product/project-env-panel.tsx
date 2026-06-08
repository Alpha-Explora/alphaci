"use client";

import { FormEvent, useMemo, useState } from "react";

import { useProjectEnvProvisioning } from "@/hooks/use-project-env-provisioning";
import type { EnvEnvironment, EnvProvider, ProvisionedProject } from "@/lib/api/contracts";

const ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]{1,127}$/;

interface EnvRow {
  key: string;
  value: string;
}

export function ProjectEnvPanel({ project }: Readonly<{ project: ProvisionedProject }>) {
  const { addTarget, loading, metadata, provision, saving, targets } =
    useProjectEnvProvisioning(project.id, project.status === "provisioned");
  const [targetId, setTargetId] = useState("");
  const [provider, setProvider] = useState<EnvProvider>("render");
  const [environment, setEnvironment] = useState<EnvEnvironment>("test");
  const [projectName, setProjectName] = useState(`${project.serviceName}-test`);
  const [branchName, setBranchName] = useState("test");
  const [rows, setRows] = useState<EnvRow[]>([{ key: "", value: "" }]);
  const [message, setMessage] = useState<string | null>(null);

  const activeTargetId = targetId || targets[0]?.id || "";
  const invalid = useMemo(() => {
    const keys = new Set<string>();
    for (const row of rows) {
      if (!ENV_KEY_PATTERN.test(row.key) || row.value === "" || keys.has(row.key)) return true;
      keys.add(row.key);
    }
    return rows.length === 0;
  }, [rows]);

  async function handleCreateTarget() {
    setMessage(null);
    const targetPayload = {
      action: "create",
      slot: provider === "render" ? "backend" : "frontend",
      ownershipMode: "flowci_managed",
      provider,
      projectName,
      branchName,
      rootDirectory: ".",
      buildCommand: provider === "render" ? "npm ci && npm run build" : "npm run build",
      ...(provider === "render" ? { startCommand: "npm run start:prod" } : {}),
    } as const;
    const target = await addTarget(targetPayload);
    setTargetId(target.id);
    setMessage("Deployment target created.");
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <select value={provider} onChange={(event) => setProvider(event.target.value as EnvProvider)}>
            <option value="render">Render</option>
            <option value="vercel">Vercel</option>
          </select>
          <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Provider project name" />
          <input value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="Branch" />
          <button className="ghost-button" disabled={saving || !projectName || !branchName} type="button" onClick={() => void handleCreateTarget()}>
            Create target
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
          <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr auto", gap: "0.45rem" }}>
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
              <span>{item.environment} · {item.status}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
