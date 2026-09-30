"use client";

import { useState } from "react";

import {
  deleteConfigurationEntry,
  getRepositoryConfiguration,
  putConfigurationSecret,
  putConfigurationVariable,
} from "@/features/groups";
import { ApiError } from "@/shared/api/request";
import {
  CONFIGURATION_LEAD_ONLY_NOTE,
  roleGateMessage,
} from "../../model/role-gate-rules";
import type {
  ConfigurationItemMetadata,
  ConfigurationType,
  RepositoryConfigurationResponse,
} from "@/features/groups";
import { timeAgo, useApiResource } from "@/features/groups";
import { LoadingRows, ResourceBoundary, SectionHeader } from "./primitives";

/**
 * Repository configuration broker (write-only).
 *
 * CRITICAL: this panel NEVER holds or renders a value. GET returns names +
 * metadata only (plan §2.7). Writes are fire-and-forget: the value is sent
 * straight to the backend (which seals secrets before GitHub) and is never read
 * back. Production scope is hard-blocked this session — the option is present but
 * visibly disabled, so nothing silently submits and 403s (plan §3.4).
 */

function ConfigWriteForm({
  repositoryId,
  configurationType,
  onWritten,
}: {
  repositoryId: string;
  configurationType: ConfigurationType;
  onWritten: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSecret = configurationType === "secret";

  function reset() {
    setName("");
    setValue("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || !value) {
      setError("Both a name and a value are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        value,
        environmentScope: "non_production" as const,
      };
      if (isSecret) {
        await putConfigurationSecret(repositoryId, trimmedName, payload);
      } else {
        await putConfigurationVariable(repositoryId, trimmedName, payload);
      }
      reset();
      setOpen(false);
      onWritten();
    } catch (cause) {
      setError(
        roleGateMessage(cause) ??
          (cause instanceof ApiError && cause.status === 403
            ? "You're not allowed to write configuration here."
            : `The ${configurationType} could not be saved. Please try again.`),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="hier-btn-sm"
        onClick={() => setOpen(true)}
      >
        Add {configurationType}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="hier-inline-form"
      style={{
        width: "100%",
        padding: "0.9rem 1rem",
        background: "var(--bg-frost)",
        border: "1px solid var(--border-soft)",
        borderRadius: "0.7rem",
      }}
    >
      <div className="hier-field">
        <label className="hier-field-label" htmlFor={`cfg-name-${configurationType}`}>
          Name
        </label>
        <input
          id={`cfg-name-${configurationType}`}
          className="hier-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={isSecret ? "API_TOKEN" : "FEATURE_FLAG"}
          autoComplete="off"
        />
      </div>
      <div className="hier-field">
        <label className="hier-field-label" htmlFor={`cfg-value-${configurationType}`}>
          Value
        </label>
        <input
          id={`cfg-value-${configurationType}`}
          className="hier-input"
          type={isSecret ? "password" : "text"}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="hier-field">
        <label className="hier-field-label" htmlFor={`cfg-scope-${configurationType}`}>
          Environment
        </label>
        <select
          id={`cfg-scope-${configurationType}`}
          className="hier-select"
          defaultValue="non_production"
        >
          <option value="non_production">Non-production</option>
          <option value="production" disabled>
            Production (not yet available)
          </option>
        </select>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className="error-text" role="alert" style={{ margin: 0, width: "100%" }}>
          {error}
        </p>
      )}
    </form>
  );
}

function ConfigList({
  repositoryId,
  configurationType,
  items,
  canWrite,
  onDeleted,
}: {
  repositoryId: string;
  configurationType: ConfigurationType;
  items: ConfigurationItemMetadata[];
  canWrite: boolean;
  onDeleted: () => void;
}) {
  const [busyName, setBusyName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(name: string) {
    setBusyName(name);
    setError(null);
    try {
      await deleteConfigurationEntry(repositoryId, configurationType, name);
      onDeleted();
    } catch (cause) {
      setError(
        roleGateMessage(cause) ??
          `The ${configurationType} could not be deleted. Please try again.`,
      );
    } finally {
      setBusyName(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="hier-tree-empty">
        No {configurationType === "secret" ? "secrets" : "variables"} set.
      </div>
    );
  }

  return (
    <>
      {error ? (
        <p className="error-text" role="alert" style={{ margin: "0.5rem 1rem" }}>
          {error}
        </p>
      ) : null}
      {items.map((item) => (
        <div key={`${item.environmentScope}:${item.name}`} className="hier-row">
          <div className="hier-row-identity">
            <div className="hier-row-name">
              <strong style={{ fontFamily: "var(--font-mono), monospace" }}>
                {item.name}
              </strong>
              <span>
                {item.environmentScope === "production"
                  ? "Production"
                  : "Non-production"}{" "}
                · updated {timeAgo(item.updatedAt)}
              </span>
            </div>
          </div>
          <div className="hier-row-actions">
            {/* Value is never shown — write-only broker. */}
            <span className="hier-badge hier-badge--muted">
              {configurationType === "secret" ? "Secret" : "Variable"}
            </span>
            {canWrite ? (
              <button
                type="button"
                className="hier-btn-danger"
                disabled={busyName === item.name}
                onClick={() => void handleDelete(item.name)}
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </>
  );
}

export function ConfigurationPanel({
  repositoryId,
  canWrite,
}: {
  repositoryId: string;
  /** Team lead or admin: the only roles the backend lets write configuration. */
  canWrite: boolean;
}) {
  const { data, state, reload } = useApiResource<RepositoryConfigurationResponse>(
    () => getRepositoryConfiguration(repositoryId),
    [repositoryId],
  );

  if (state === "loading") {
    return <LoadingRows rows={2} />;
  }
  if (state !== "ready" || !data) {
    return (
      <ResourceBoundary
        state={state}
        onRetry={reload}
        forbiddenMessage="You need an active assignment on this repository to manage its configuration."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <p className="hier-subtitle" style={{ margin: 0 }}>
        Manage non-production variables and secrets. Values are write-only —
        AlphaCI stores names and metadata only, never the value. Production
        configuration requires a separate approval workflow that is not yet
        available.
      </p>

      {canWrite ? null : (
        <p className="hier-subtitle" role="note" style={{ margin: 0 }}>
          {CONFIGURATION_LEAD_ONLY_NOTE}
        </p>
      )}

      <section aria-label="Variables">
        <SectionHeader
          title="Variables"
          count={data.variables.length}
          actions={
            canWrite ? (
              <ConfigWriteForm
                repositoryId={repositoryId}
                configurationType="variable"
                onWritten={reload}
              />
            ) : null
          }
        />
        <div className="hier-panel">
          <ConfigList
            repositoryId={repositoryId}
            configurationType="variable"
            items={data.variables}
            canWrite={canWrite}
            onDeleted={reload}
          />
        </div>
      </section>

      <section aria-label="Secrets">
        <SectionHeader
          title="Secrets"
          count={data.secrets.length}
          actions={
            canWrite ? (
              <ConfigWriteForm
                repositoryId={repositoryId}
                configurationType="secret"
                onWritten={reload}
              />
            ) : null
          }
        />
        <div className="hier-panel">
          <ConfigList
            repositoryId={repositoryId}
            configurationType="secret"
            items={data.secrets}
            canWrite={canWrite}
            onDeleted={reload}
          />
        </div>
      </section>
    </div>
  );
}
