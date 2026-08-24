"use client";

import { useState } from "react";

import {
  domainNextStep,
  domainScopeLabel,
  domainStatus,
} from "../../model/projects-rules";
import type { CustomDomain } from "../../model/projects-types";

export interface ProjectDomainsViewProps {
  domains: CustomDomain[];
  status: "loading" | "ready" | "error";
  error: string | null;
  busyDomainId: string | null;
  isAdding: boolean;
  /** Targets a hostname can be attached to. Empty disables the form. */
  targets: Array<{ id: string; label: string }>;
  onAdd: (
    deploymentTargetId: string,
    hostname: string,
    gitBranch: string,
  ) => Promise<boolean>;
  onVerify: (domainId: string) => void;
  onRemove: (domainId: string) => void;
}

/**
 * The DNS record the provider asked for.
 *
 * Rendered exactly as it arrived. Copy buttons rather than prose because these
 * get pasted into a DNS console character-for-character, and a typo here is a
 * domain that silently never resolves.
 */
function VerificationRecord({
  challenge,
}: Readonly<{
  challenge: { type: string; domain: string; value: string };
}>) {
  return (
    <div className="project-domain__record">
      <dl>
        <div>
          <dt>Type</dt>
          <dd>{challenge.type}</dd>
        </div>
        <div>
          <dt>Name</dt>
          <dd>{challenge.domain}</dd>
        </div>
        <div>
          <dt>Value</dt>
          <dd className="project-domain__record-value">{challenge.value}</dd>
        </div>
      </dl>
      <button
        className="ghost-button target-action-btn"
        type="button"
        onClick={() => void navigator.clipboard?.writeText(challenge.value)}
      >
        Copy value
      </button>
    </div>
  );
}

function DomainRow({
  domain,
  busy,
  onVerify,
  onRemove,
}: Readonly<{
  domain: CustomDomain;
  busy: boolean;
  onVerify: (domainId: string) => void;
  onRemove: (domainId: string) => void;
}>) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const state = domainStatus(domain);
  const nextStep = domainNextStep(domain);

  return (
    <article className="project-domain">
      <header className="project-domain__header">
        <div>
          <h5 className="project-domain__hostname">
            <a
              href={`https://${domain.hostname}`}
              rel="noreferrer noopener"
              target="_blank"
            >
              {domain.hostname}
            </a>
          </h5>
          <p className="project-domain__meta">
            {domainScopeLabel(domain.gitBranch)}
          </p>
        </div>
        <span
          className={`project-domain__status project-domain__status--${state.tone}`}
        >
          {state.label}
        </span>
      </header>

      {nextStep ? (
        <p className="project-domain__next-step">{nextStep}</p>
      ) : null}

      {domain.verification.map((challenge) => (
        <VerificationRecord
          key={`${challenge.type}:${challenge.domain}`}
          challenge={challenge}
        />
      ))}

      {domain.lastErrorSafeMessage ? (
        <p className="project-domain__error">{domain.lastErrorSafeMessage}</p>
      ) : null}

      <footer className="project-domain__actions">
        <button
          className="ghost-button target-action-btn"
          disabled={busy}
          type="button"
          onClick={() => onVerify(domain.id)}
        >
          {busy ? "Checking…" : "Check again"}
        </button>
        {confirmingRemove ? (
          <>
            <span className="project-domain__confirm">
              Remove {domain.hostname}?
            </span>
            <button
              className="ghost-button target-action-btn"
              disabled={busy}
              type="button"
              onClick={() => {
                setConfirmingRemove(false);
                onRemove(domain.id);
              }}
            >
              Yes, remove
            </button>
            <button
              className="ghost-button target-action-btn"
              type="button"
              onClick={() => setConfirmingRemove(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            className="ghost-button target-action-btn"
            disabled={busy}
            type="button"
            onClick={() => setConfirmingRemove(true)}
          >
            Remove
          </button>
        )}
      </footer>
    </article>
  );
}

export function ProjectDomainsView({
  domains,
  status,
  error,
  busyDomainId,
  isAdding,
  targets,
  onAdd,
  onVerify,
  onRemove,
}: Readonly<ProjectDomainsViewProps>) {
  const [hostname, setHostname] = useState("");
  const [gitBranch, setGitBranch] = useState("");
  const [targetId, setTargetId] = useState("");

  const activeTargetId = targetId || targets[0]?.id || "";

  if (status === "loading") {
    return <p className="env-empty-state">Loading domains…</p>;
  }

  return (
    <div className="project-domains">
      {error ? <p className="project-domains__error">{error}</p> : null}

      {targets.length === 0 ? (
        <p className="env-empty-state">
          Add a hosting service first — a domain attaches to a deployment
          target.
        </p>
      ) : (
        <form
          className="project-domains__form"
          onSubmit={(event) => {
            event.preventDefault();
            void onAdd(activeTargetId, hostname, gitBranch).then((added) => {
              if (added) {
                setHostname("");
                setGitBranch("");
              }
            });
          }}
        >
          <label>
            <span>Hostname</span>
            <input
              onChange={(event) => setHostname(event.target.value)}
              placeholder="app.example.com"
              value={hostname}
            />
          </label>
          {targets.length > 1 ? (
            <label>
              <span>Service</span>
              <select
                onChange={(event) => setTargetId(event.target.value)}
                value={activeTargetId}
              >
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            <span>Branch (optional)</span>
            <input
              onChange={(event) => setGitBranch(event.target.value)}
              placeholder="leave empty for production"
              value={gitBranch}
            />
          </label>
          <button
            className="primary-button"
            disabled={isAdding || !hostname.trim()}
            type="submit"
          >
            {isAdding ? "Adding…" : "Add domain"}
          </button>
        </form>
      )}

      {domains.length === 0 ? (
        <p className="env-empty-state">No custom domains yet.</p>
      ) : (
        domains.map((domain) => (
          <DomainRow
            busy={busyDomainId === domain.id}
            domain={domain}
            key={domain.id}
            onRemove={onRemove}
            onVerify={onVerify}
          />
        ))
      )}
    </div>
  );
}
