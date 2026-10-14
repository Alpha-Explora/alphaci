"use client";

import { useState } from "react";

import {
  domainNextStep,
  domainScopeLabel,
  domainStatus,
} from "../../model/projects-rules";
import { HOSTING_LEAD_ONLY_NOTE as DOMAINS_LEAD_ONLY_NOTE } from "../../detail/model/project-detail-tab-rules";
import type { CustomDomain } from "../../model/projects-types";

export interface ProjectDomainsViewProps {
  domains: CustomDomain[];
  status: "loading" | "ready" | "error";
  error: string | null;
  busyDomainId: string | null;
  isAdding: boolean;
  /** Lead/admin only. Otherwise the list is read-only with a short note. */
  canManage: boolean;
  /** Targets a hostname can be attached to. Empty disables the form. */
  targets: Array<{ id: string; label: string }>;
  onAdd: (
    deploymentTargetId: string,
    hostname: string,
    gitBranch: string,
  ) => Promise<boolean>;
  onVerify: (domainId: string) => void;
  onRemove: (domainId: string) => void;
  /**
   * List first, with the add form behind a "+ Add domain" button (Cancel
   * hides it again). Off by default: the form stays open above the list.
   */
  collapseAddForm?: boolean;
  /**
   * Whether a viewer who cannot manage domains is told so here. A host that
   * already says it (the Hosting tab's service header) turns it off.
   */
  showReadOnlyNote?: boolean;
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
  canManage,
  onVerify,
  onRemove,
}: Readonly<{
  domain: CustomDomain;
  busy: boolean;
  canManage: boolean;
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

      {canManage ? (
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
      ) : null}
    </article>
  );
}

export function ProjectDomainsView({
  domains,
  status,
  error,
  busyDomainId,
  isAdding,
  canManage,
  targets,
  onAdd,
  onVerify,
  onRemove,
  collapseAddForm = false,
  showReadOnlyNote = true,
}: Readonly<ProjectDomainsViewProps>) {
  if (status === "loading") {
    return <p className="env-empty-state">Loading domains…</p>;
  }

  const addArea = (
    <DomainAddArea
      canManage={canManage}
      collapsible={collapseAddForm}
      isAdding={isAdding}
      onAdd={onAdd}
      showReadOnlyNote={showReadOnlyNote}
      targets={targets}
    />
  );
  const list = (
    <DomainList
      canManage={canManage}
      domains={domains}
      busyDomainId={busyDomainId}
      onRemove={onRemove}
      onVerify={onVerify}
    />
  );

  return (
    <div className="project-domains">
      {error ? <p className="project-domains__error">{error}</p> : null}
      {collapseAddForm ? list : addArea}
      {collapseAddForm ? addArea : list}
    </div>
  );
}

/**
 * The add form for those who may add domains, else the read-only note (when
 * the host has not said it already). Collapsible: a "+ Add domain" button
 * opens it, Cancel or a successful add closes it.
 */
function DomainAddArea({
  canManage,
  collapsible,
  isAdding,
  onAdd,
  showReadOnlyNote,
  targets,
}: Readonly<{
  canManage: boolean;
  collapsible: boolean;
  isAdding: boolean;
  onAdd: ProjectDomainsViewProps["onAdd"];
  showReadOnlyNote: boolean;
  targets: Array<{ id: string; label: string }>;
}>) {
  const [hostname, setHostname] = useState("");
  const [gitBranch, setGitBranch] = useState("");
  const [targetId, setTargetId] = useState("");
  const [open, setOpen] = useState(false);
  const activeTargetId = targetId || targets[0]?.id || "";

  if (!canManage) {
    return showReadOnlyNote ? <p className="env-empty-state">{DOMAINS_LEAD_ONLY_NOTE}</p> : null;
  }
  if (collapsible && !open) {
    return (
      <button
        className="ghost-button target-action-btn project-domains__open"
        type="button"
        onClick={() => setOpen(true)}
      >
        + Add domain
      </button>
    );
  }
  return (
    <DomainAddForm
      targets={targets}
      hostname={hostname}
      gitBranch={gitBranch}
      activeTargetId={activeTargetId}
      isAdding={isAdding}
      onHostname={setHostname}
      onGitBranch={setGitBranch}
      onTargetId={setTargetId}
      onAdd={onAdd}
      onAdded={() => setOpen(false)}
      onCancel={collapsible ? () => setOpen(false) : undefined}
    />
  );
}

function DomainAddForm({
  targets,
  hostname,
  gitBranch,
  activeTargetId,
  isAdding,
  onHostname,
  onGitBranch,
  onTargetId,
  onAdd,
  onAdded,
  onCancel,
}: Readonly<{
  targets: Array<{ id: string; label: string }>;
  hostname: string;
  gitBranch: string;
  activeTargetId: string;
  isAdding: boolean;
  onHostname: (value: string) => void;
  onGitBranch: (value: string) => void;
  onTargetId: (value: string) => void;
  onAdd: ProjectDomainsViewProps["onAdd"];
  onAdded: () => void;
  /** Set when the form can be closed again (the collapsible layout). */
  onCancel?: () => void;
}>) {
  if (targets.length === 0) {
    return (
      <p className="env-empty-state">
        Add a hosting service first — a domain attaches to a deployment
        target.
      </p>
    );
  }
  return (
    <form
      className="project-domains__form"
      onSubmit={(event) => {
        event.preventDefault();
        void onAdd(activeTargetId, hostname, gitBranch).then((added) => {
          if (added) {
            onHostname("");
            onGitBranch("");
            onAdded();
          }
        });
      }}
    >
      <label>
        <span>Hostname</span>
        <input
          onChange={(event) => onHostname(event.target.value)}
          placeholder="app.example.com"
          value={hostname}
        />
      </label>
      {targets.length > 1 ? (
        <label>
          <span>Service</span>
          <select
            onChange={(event) => onTargetId(event.target.value)}
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
          onChange={(event) => onGitBranch(event.target.value)}
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
      {onCancel ? (
        <button className="ghost-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      ) : null}
    </form>
  );
}

function DomainList({
  canManage,
  domains,
  busyDomainId,
  onRemove,
  onVerify,
}: Readonly<{
  canManage: boolean;
  domains: CustomDomain[];
  busyDomainId: string | null;
  onRemove: (domainId: string) => void;
  onVerify: (domainId: string) => void;
}>) {
  if (domains.length === 0) {
    return <p className="env-empty-state">No custom domains yet.</p>;
  }
  return (
    <>
      {domains.map((domain) => (
        <DomainRow
          busy={busyDomainId === domain.id}
          canManage={canManage}
          domain={domain}
          key={domain.id}
          onRemove={onRemove}
          onVerify={onVerify}
        />
      ))}
    </>
  );
}
