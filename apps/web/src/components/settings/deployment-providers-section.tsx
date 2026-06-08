"use client";

import { FormEvent, useState } from "react";

import { useCapabilities } from "@/hooks/use-capabilities";
import { useProviderConnections } from "@/hooks/use-provider-connections";
import type { EnvProvider } from "@/lib/api/contracts";

const fieldStyle = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "rgba(15, 23, 42, 0.45)",
  color: "var(--text-primary)",
  minHeight: "2.5rem",
  padding: "0.55rem 0.7rem",
} as const;

export function DeploymentProvidersSection() {
  const { envProvisioningEnabled, loading: loadingCapabilities } = useCapabilities();
  const { connections, loading, revokeConnection, saveConnection, saving } =
    useProviderConnections(envProvisioningEnabled);
  const [provider, setProvider] = useState<EnvProvider>("render");
  const [label, setLabel] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (loadingCapabilities || !envProvisioningEnabled) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await saveConnection({ provider, label, token });
      setLabel("");
      setToken("");
    } catch {
      setError("Unable to save provider connection right now.");
    }
  }

  return (
    <section className="glass-panel" style={{ padding: "1rem", display: "grid", gap: "1rem" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "1rem" }}>Deployment Providers</h2>
        <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)", fontSize: "0.84rem" }}>
          Provider tokens are stored encrypted so FlowCI can provision env vars for your projects.
          Application env var values are not stored by FlowCI.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))", gap: "0.6rem" }}>
          <select value={provider} onChange={(event) => setProvider(event.target.value as EnvProvider)} style={fieldStyle}>
            <option value="render">Render</option>
            <option value="vercel">Vercel</option>
          </select>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Label"
            style={fieldStyle}
          />
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Provider token"
            type="password"
            style={fieldStyle}
          />
          <button className="primary-button" disabled={saving || !label || !token} type="submit">
            Save
          </button>
        </div>
        {error ? <p className="error-text" style={{ margin: 0 }}>{error}</p> : null}
      </form>

      <div style={{ display: "grid", gap: "0.5rem" }}>
        {loading ? (
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.82rem" }}>Loading providers...</p>
        ) : connections.length ? (
          connections.map((connection) => (
            <div
              key={connection.id}
              style={{
                alignItems: "center",
                border: "1px solid var(--border-soft)",
                borderRadius: "8px",
                display: "flex",
                gap: "0.75rem",
                justifyContent: "space-between",
                padding: "0.65rem 0.75rem",
              }}
            >
              <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                {connection.label}
              </span>
              <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                {connection.provider} token ending {connection.tokenLastFour} · {connection.status}
              </span>
              {connection.status === "active" ? (
                <button className="ghost-button" type="button" onClick={() => void revokeConnection(connection.id)}>
                  Revoke
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.82rem" }}>No provider connections saved.</p>
        )}
      </div>
    </section>
  );
}
