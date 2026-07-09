"use client";

import { FormEvent, useState } from "react";

import { useCapabilities } from "@/hooks/use-capabilities";
import { useProviderConnections } from "@/hooks/use-provider-connections";
import type { EnvProvider, WorkspaceRole } from "@/lib/api/contracts";

const fieldStyle = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  background: "rgba(15, 23, 42, 0.45)",
  color: "var(--text-primary)",
  minHeight: "2.5rem",
  padding: "0.55rem 0.7rem",
} as const;

export function DeploymentProvidersSection({
  workspaceRole = "owner",
}: {
  workspaceRole?: WorkspaceRole | null;
}) {
  const { envProvisioningEnabled, loading: loadingCapabilities } =
    useCapabilities();
  const { connections, loading, revokeConnection, saveConnection, saving } =
    useProviderConnections(envProvisioningEnabled);
  const [provider, setProvider] = useState<EnvProvider>("render");
  const [label, setLabel] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (loadingCapabilities || !envProvisioningEnabled) {
    return null;
  }

  const canManageProviders =
    workspaceRole === "owner" || workspaceRole === "admin";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageProviders) {
      return;
    }
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
    <section className="provider-settings-panel">
      <div className="provider-settings-header">
        <h2>Deployment Providers</h2>
        <p>
          Provider tokens are encrypted. Env var values are sent to the provider
          and are not stored by ALPHACI.
        </p>
        {!canManageProviders ? (
          <p className="provider-empty-state" style={{ margin: 0 }}>
            Provider management requires owner or admin access.
          </p>
        ) : null}
      </div>

      <form className="provider-connection-form" onSubmit={handleSubmit}>
        <div className="provider-connection-fields">
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as EnvProvider)}
            style={fieldStyle}
            disabled={!canManageProviders}
          >
            <option value="render">Render</option>
            <option value="vercel">Vercel</option>
          </select>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Label"
            style={fieldStyle}
            disabled={!canManageProviders}
          />
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Provider token"
            type="password"
            autoComplete="off"
            style={fieldStyle}
            disabled={!canManageProviders}
          />
          <button
            className="primary-button"
            disabled={!canManageProviders || saving || !label || !token}
            type="submit"
          >
            Save
          </button>
        </div>
        {error ? (
          <p className="error-text" style={{ margin: 0 }}>
            {error}
          </p>
        ) : null}
      </form>

      <div className="provider-connections-wrap">
        {loading ? (
          <p className="provider-empty-state">Loading providers...</p>
        ) : connections.length ? (
          <table className="provider-connections-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Provider</th>
                <th>Token</th>
                <th>Status</th>
                <th aria-label="Provider actions" />
              </tr>
            </thead>
            <tbody>
              {connections.map((connection) => (
                <tr key={connection.id}>
                  <td data-label="Label">{connection.label}</td>
                  <td data-label="Provider">{connection.provider}</td>
                  <td data-label="Token">
                    {connection.provider} token ending{" "}
                    {connection.tokenLastFour}
                  </td>
                  <td data-label="Status">{connection.status}</td>
                  <td data-label="Action">
                    {connection.status === "active" ? (
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={!canManageProviders}
                        onClick={() => {
                          if (canManageProviders) {
                            void revokeConnection(connection.id);
                          }
                        }}
                      >
                        Revoke
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="provider-empty-state">No provider connections saved.</p>
        )}
      </div>
    </section>
  );
}
