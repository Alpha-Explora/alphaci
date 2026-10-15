"use client";

import "./environment-operations.css";

import { useState } from "react";
import { HostAssignmentPanel } from "@/features/hosts";

import type {
  AppRole,
  DeploymentTarget,
  EnvTargetSlot,
} from "@/shared/api/contracts";
import {
  deploymentStatusLabel,
  shortCommit,
  shortDigest,
  type EnvironmentDeploymentEntry,
  type EnvironmentRow,
} from "../model/environment-operations";
import {
  useEnvironmentOperationsViewModel,
  type EnvironmentOperationsViewModel,
} from "../view-models/use-environment-operations-view-model";

/**
 * Each project environment in promotion order: where it deploys, what it
 * runs, what it ran, and the one release it may receive next.
 */
export function EnvironmentOperationsPanel({
  projectId,
  targets,
  appRole,
  onTargetCreated,
  workspaceId,
}: Readonly<{
  projectId: string;
  workspaceId?: string | null;
  targets: readonly DeploymentTarget[];
  appRole?: AppRole | null;
  onTargetCreated?: (target: DeploymentTarget) => void;
}>) {
  const vm = useEnvironmentOperationsViewModel({
    projectId,
    targets,
    appRole,
    onTargetCreated,
  });
  if (vm.status === "loading") {
    return <p className="env-empty-state">Loading environments...</p>;
  }
  if (vm.status === "error") {
    return <p className="error-text">{vm.loadError}</p>;
  }
  // Projects on the legacy branch path have no environments to show.
  if (vm.rows.length === 0) return null;
  return (
    <section className="envops" aria-labelledby="environments-heading">
      <header className="envops__head">
        <h4 className="envops__title" id="environments-heading">
          Environments
        </h4>
        <p className="envops__intro">
          Releases move left to right: each push deploys the first environment,
          then you promote the same build onward.
        </p>
      </header>
      {vm.releasesNote ? (
        <p className="env-empty-state">{vm.releasesNote}</p>
      ) : null}
      <ol className="envops__list">
        {vm.rows.map((row, index) => (
          <li key={row.environment.id} className="envops__item">
            <EnvironmentCard
              row={row}
              vm={vm}
              step={index + 1}
              host={
                row.hostDelivered &&
                workspaceId &&
                row.targets.every(
                  (target) =>
                    target.slot === "frontend" || target.slot === "backend",
                ) ? (
                  <HostAssignmentPanel
                    key={row.environment.id}
                    projectId={projectId}
                    environmentId={row.environment.id}
                    workspaceId={workspaceId}
                    slots={row.targets.map(
                      (target) => target.slot as "frontend" | "backend",
                    )}
                    production={row.environment.role === "production"}
                    canManage={vm.canManageHosts}
                  />
                ) : null
              }
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

function EnvironmentCard({
  row,
  vm,
  step,
  host,
}: Readonly<{
  row: EnvironmentRow;
  vm: EnvironmentOperationsViewModel;
  step: number;
  host: React.ReactNode;
}>) {
  const { environment } = row;
  const production = environment.role === "production";
  return (
    <article aria-label={environment.displayName} className="envops-card">
      <header className="envops-card__head">
        <span className="envops-card__step" aria-hidden="true">
          {step}
        </span>
        <div className="envops-card__titles">
          <h5 className="envops-card__name">{environment.displayName}</h5>
          <p className="envops-card__meta">
            <span
              className={`envops-chip${production ? " envops-chip--prod" : ""}`}
            >
              {production ? "Production" : environment.slug}
            </span>
            <span className="envops-chip envops-chip--branch">
              ⎇ {environment.sourceBranch}
            </span>
          </p>
        </div>
        <ReleaseBadge entry={row.current} inFlight={row.inFlight} />
      </header>

      <div className="envops-card__body">
        <section className="envops-section" aria-label="Release">
          <h6 className="envops-section__label">Release</h6>
          <CurrentRelease entry={row.current} inFlight={row.inFlight} />
          <EnvironmentTargets row={row} />
          <PromotionControl row={row} vm={vm} />
          <EnvironmentMessageLine environmentId={environment.id} vm={vm} />
          <DeploymentHistory entries={row.history} />
        </section>
        {host ? (
          <section className="envops-section" aria-label="Host">
            <h6 className="envops-section__label">Host</h6>
            {host}
          </section>
        ) : null}
      </div>

      <AdvancedHostTools row={row} vm={vm} />
    </article>
  );
}

function ReleaseBadge({
  entry,
  inFlight,
}: Readonly<{
  entry: EnvironmentDeploymentEntry | null;
  inFlight: EnvironmentDeploymentEntry | null;
}>) {
  if (inFlight)
    return (
      <span className="status-chip status-chip-brand">
        {deploymentStatusLabel(inFlight.deployment.status)}
      </span>
    );
  if (entry)
    return <span className="status-chip status-chip-success">Running</span>;
  return <span className="status-chip status-chip-muted">Not deployed</span>;
}

function EnvironmentTargets({ row }: Readonly<{ row: EnvironmentRow }>) {
  if (row.targets.length === 0) {
    return <p className="envops-muted">No deployment target yet.</p>;
  }
  return (
    <ul className="envops-targets">
      {row.targets.map((target) => (
        <li key={target.id} className="envops-target">
          <span className="envops-target__slot">{target.slot}</span>
          <span className="envops-target__provider">
            {target.providerLabel}
          </span>
          {target.status === "active" ? null : (
            <span className="envops-muted">({target.status})</span>
          )}
          {target.publicUrl ? (
            <a
              className="envops-link"
              href={target.publicUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open app ↗
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function CurrentRelease({
  entry,
  inFlight,
}: Readonly<{
  entry: EnvironmentDeploymentEntry | null;
  inFlight: EnvironmentDeploymentEntry | null;
}>) {
  return (
    <div className="envops-release">
      {entry ? (
        <p className="envops-release__line">
          Running <ReleaseIdentity entry={entry} />
        </p>
      ) : (
        <p className="envops-muted">No release has been deployed here yet.</p>
      )}
      {inFlight ? (
        <p className="envops-release__line">
          {deploymentStatusLabel(inFlight.deployment.status)}{" "}
          <code>{shortCommit(inFlight.release.commitSha)}</code>
        </p>
      ) : null}
    </div>
  );
}

function ReleaseIdentity({
  entry,
}: Readonly<{ entry: EnvironmentDeploymentEntry }>) {
  const { release } = entry;
  return (
    <>
      <code title={release.commitSha}>{shortCommit(release.commitSha)}</code>
      {release.artifacts.map((artifact) => (
        <span
          key={artifact.slot}
          className="envops-muted"
          title={artifact.image + "@" + artifact.digest}
        >
          {" · "}
          {artifact.slot} <code>{shortDigest(artifact.digest)}</code>
        </span>
      ))}
    </>
  );
}

function PromotionControl({
  row,
  vm,
}: Readonly<{ row: EnvironmentRow; vm: EnvironmentOperationsViewModel }>) {
  const { promotion, environment } = row;
  if (promotion.kind === "automatic") {
    return (
      <p className="envops-note">
        Deploys automatically on every push to{" "}
        <code>{environment.sourceBranch}</code>.
      </p>
    );
  }
  if (promotion.kind === "unavailable") {
    return (
      <p className="envops-note">Nothing to promote yet: {promotion.reason}</p>
    );
  }
  if (!vm.canPromote(environment.role === "production")) {
    return (
      <p className="envops-note">
        {environment.role === "production"
          ? "Only product owners and admins can promote to production."
          : "This role cannot promote releases."}
      </p>
    );
  }
  const confirming = vm.confirmingEnvironmentId === environment.id;
  return (
    <div className="envops-actions">
      <button
        className={confirming ? "primary-button" : "ghost-button"}
        disabled={vm.busyEnvironmentId !== null}
        onClick={() => void vm.promote(row)}
        type="button"
      >
        {confirming
          ? "Confirm: deploy " +
            shortCommit(promotion.release.commitSha) +
            " to " +
            environment.displayName
          : "Promote " +
            shortCommit(promotion.release.commitSha) +
            " from " +
            promotion.from.displayName}
      </button>
      {confirming ? (
        <button
          className="ghost-button"
          onClick={vm.cancelPromotion}
          type="button"
        >
          Cancel
        </button>
      ) : null}
    </div>
  );
}

function EnvironmentMessageLine({
  environmentId,
  vm,
}: Readonly<{ environmentId: string; vm: EnvironmentOperationsViewModel }>) {
  if (vm.message?.environmentId !== environmentId) return null;
  return (
    <p
      className={vm.message.tone === "error" ? "error-text" : "envops-note"}
      role={vm.message.tone === "error" ? "alert" : "status"}
    >
      {vm.message.text}
    </p>
  );
}

/**
 * The older per-environment host token and manual target slots. Reusable
 * machines (the Host section) replace both, so they stay out of the way.
 */
function AdvancedHostTools({
  row,
  vm,
}: Readonly<{ row: EnvironmentRow; vm: EnvironmentOperationsViewModel }>) {
  const showRegistration =
    vm.hostsEnabled && vm.canManageHosts && row.hostDelivered;
  const showTargets =
    vm.hostsEnabled &&
    vm.canManageHosts &&
    row.targets.every((target) => target.provider === "onprem-compose");
  const tokenOnScreen = vm.hostToken?.environmentId === row.environment.id;
  if (!showRegistration && !showTargets) return null;
  return (
    <details className="envops-advanced" open={tokenOnScreen}>
      <summary>Advanced: legacy host token and extra targets</summary>
      <div className="envops-advanced__body">
        {showRegistration ? <HostRegistration row={row} vm={vm} /> : null}
        {showTargets ? <OnpremTargetSetup row={row} vm={vm} /> : null}
      </div>
    </details>
  );
}

function HostRegistration({
  row,
  vm,
}: Readonly<{ row: EnvironmentRow; vm: EnvironmentOperationsViewModel }>) {
  const [name, setName] = useState("");
  const environmentId = row.environment.id;
  if (vm.hostToken?.environmentId === environmentId) {
    return (
      <div role="status" className="envops-token">
        <p className="envops-note">
          Host registered. Copy this token into the host&apos;s agent
          configuration now; it is not shown again.
        </p>
        <code className="envops-token__value">{vm.hostToken.token}</code>
        <button
          className="ghost-button"
          onClick={vm.dismissHostToken}
          type="button"
        >
          Done
        </button>
      </div>
    );
  }
  return (
    <form
      className="envops-inline-form"
      onSubmit={(event) => {
        event.preventDefault();
        void vm.registerHost(environmentId, name.trim());
      }}
    >
      <label className="envops-field">
        <span>Legacy host name</span>
        <input onChange={(event) => setName(event.target.value)} value={name} />
      </label>
      <button
        className="ghost-button"
        disabled={!name.trim() || vm.busyEnvironmentId !== null}
        type="submit"
      >
        Register host
      </button>
    </form>
  );
}

function OnpremTargetSetup({
  row,
  vm,
}: Readonly<{ row: EnvironmentRow; vm: EnvironmentOperationsViewModel }>) {
  const [slot, setSlot] = useState<EnvTargetSlot>("standalone");
  const [name, setName] = useState("");
  const slots: EnvTargetSlot[] = ["backend", "frontend", "standalone"];
  const available = slots.filter(
    (candidate) => !row.targets.some((target) => target.slot === candidate),
  );
  if (available.length === 0) return null;
  const selectedSlot = available.includes(slot) ? slot : available[0];
  return (
    <form
      aria-label={`Add on-prem target to ${row.environment.displayName}`}
      className="envops-inline-form"
      onSubmit={(event) => {
        event.preventDefault();
        void vm.addOnpremTarget(row.environment.id, selectedSlot, name.trim());
      }}
    >
      <label className="envops-field">
        <span>Extra target slot</span>
        <select
          aria-label={`On-prem slot for ${row.environment.displayName}`}
          onChange={(event) => setSlot(event.target.value as EnvTargetSlot)}
          value={selectedSlot}
        >
          {available.map((candidate) => (
            <option key={candidate} value={candidate}>
              {candidate}
            </option>
          ))}
        </select>
      </label>
      <label className="envops-field">
        <span>Label</span>
        <input
          aria-label={`On-prem host label for ${row.environment.displayName}`}
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </label>
      <button
        className="ghost-button"
        disabled={!name.trim() || vm.busyEnvironmentId !== null}
        type="submit"
      >
        Add on-prem target
      </button>
    </form>
  );
}

function DeploymentHistory({
  entries,
}: Readonly<{ entries: EnvironmentDeploymentEntry[] }>) {
  if (entries.length === 0) return null;
  return (
    <details className="envops-history">
      <summary>Recent deployments ({entries.length})</summary>
      <ul>
        {entries.map(({ deployment, release }) => (
          <li key={deployment.id}>
            <code>{shortCommit(release.commitSha)}</code>{" "}
            {deploymentStatusLabel(deployment.status)} ·{" "}
            {deployment.trigger === "automatic" ? "on push" : "promoted"} ·{" "}
            {new Date(deployment.updatedAt).toLocaleString()}
            {deployment.detail ? " · " + deployment.detail : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}
