"use client";

import { useState } from "react";
import {HostAssignmentPanel} from '@/features/hosts';

import type { AppRole, DeploymentTarget, EnvTargetSlot } from "@/shared/api/contracts";
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
  workspaceId?: string|null;
  targets: readonly DeploymentTarget[];
  appRole?: AppRole | null;
  onTargetCreated?: (target: DeploymentTarget) => void;
}>) {
  const vm = useEnvironmentOperationsViewModel({ projectId, targets, appRole, onTargetCreated });
  if (vm.status === "loading") {
    return <p className="env-empty-state">Loading environments...</p>;
  }
  if (vm.status === "error") {
    return <p className="error-text">{vm.loadError}</p>;
  }
  // Projects on the legacy branch path have no environments to show.
  if (vm.rows.length === 0) return null;
  return (
    <section aria-labelledby="environments-heading">
      <h4 className="ws-reported__head" id="environments-heading">
        Environments
      </h4>
      {vm.releasesNote ? (
        <p className="env-empty-state">{vm.releasesNote}</p>
      ) : null}
      <ol className="env-metadata-list" style={{ listStyle: "none", padding: 0 }}>
        {vm.rows.map((row) => (
          <li key={row.environment.id}>
            <EnvironmentCard row={row} vm={vm} />
            {row.hostDelivered&&workspaceId&&row.targets.every(target=>target.slot==='frontend'||target.slot==='backend')?<HostAssignmentPanel key={row.environment.id} projectId={projectId} environmentId={row.environment.id} workspaceId={workspaceId} slots={row.targets.map(target=>target.slot as 'frontend'|'backend')} production={row.environment.role==='production'} canManage={vm.canManageHosts}/>:null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function EnvironmentCard({
  row,
  vm,
}: Readonly<{ row: EnvironmentRow; vm: EnvironmentOperationsViewModel }>) {
  const { environment } = row;
  return (
    <article
      aria-label={environment.displayName}
      className="env-card"
      style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}
    >
      <header style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
        <strong>{environment.displayName}</strong>
        <span className="env-empty-state" style={{ margin: 0 }}>
          {environment.role === "production" ? "Production" : environment.slug} ·
          branch {environment.sourceBranch}
        </span>
      </header>
      <EnvironmentTargets row={row} />
      <CurrentRelease entry={row.current} inFlight={row.inFlight} />
      <PromotionControl row={row} vm={vm} />
      <EnvironmentMessageLine environmentId={environment.id} vm={vm} />
      <HostRegistration row={row} vm={vm} />
      <OnpremTargetSetup row={row} vm={vm} />
      <DeploymentHistory entries={row.history} />
    </article>
  );
}

function EnvironmentTargets({ row }: Readonly<{ row: EnvironmentRow }>) {
  if (row.targets.length === 0) {
    return (
      <p className="env-empty-state" style={{ margin: 0 }}>
        No deployment target yet.
      </p>
    );
  }
  return (
    <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
      {row.targets.map((target) => (
        <li key={target.id}>
          {target.slot}: {target.providerLabel} · {target.name}
          {target.status === "active" ? "" : " (" + target.status + ")"}
          {target.publicUrl ? (
            <>
              {" · "}
              <a href={target.publicUrl} rel="noreferrer" target="_blank">
                open
              </a>
            </>
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
    <div>
      <p style={{ margin: 0 }}>
        Runs:{" "}
        {entry ? (
          <ReleaseIdentity entry={entry} />
        ) : (
          <span className="env-empty-state">no release yet</span>
        )}
      </p>
      {inFlight ? (
        <p style={{ margin: 0 }}>
          {deploymentStatusLabel(inFlight.deployment.status)}:{" "}
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
        <span key={artifact.slot} title={artifact.image + "@" + artifact.digest}>
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
      <p className="env-empty-state" style={{ margin: 0 }}>
        Deploys automatically on every push to {environment.sourceBranch}.
      </p>
    );
  }
  if (promotion.kind === "unavailable") {
    return (
      <p className="env-empty-state" style={{ margin: 0 }}>
        Nothing to promote: {promotion.reason}
      </p>
    );
  }
  if (!vm.canPromote(environment.role === "production")) {
    return (
      <p className="env-empty-state" style={{ margin: 0 }}>
        {environment.role === "production"
          ? "Only product owners and admins can promote to production."
          : "This role cannot promote releases."}
      </p>
    );
  }
  const confirming = vm.confirmingEnvironmentId === environment.id;
  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
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
        <button className="ghost-button" onClick={vm.cancelPromotion} type="button">
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
      className={vm.message.tone === "error" ? "error-text" : "env-empty-state"}
      role={vm.message.tone === "error" ? "alert" : "status"}
      style={{ margin: 0 }}
    >
      {vm.message.text}
    </p>
  );
}

function HostRegistration({
  row,
  vm,
}: Readonly<{ row: EnvironmentRow; vm: EnvironmentOperationsViewModel }>) {
  const [name, setName] = useState("");
  if (!vm.hostsEnabled || !vm.canManageHosts || !row.hostDelivered) return null;
  const environmentId = row.environment.id;
  if (vm.hostToken?.environmentId === environmentId) {
    return (
      <div role="status">
        <p style={{ margin: 0 }}>
          Host registered. Copy this token into the host&apos;s agent
          configuration now; it is not shown again.
        </p>
        <code style={{ wordBreak: "break-all" }}>{vm.hostToken.token}</code>
        <button className="ghost-button" onClick={vm.dismissHostToken} type="button">
          Done
        </button>
      </div>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void vm.registerHost(environmentId, name.trim());
      }}
      style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
    >
      <label>
        On-prem host name{" "}
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
  if (
    !vm.hostsEnabled ||
    !vm.canManageHosts ||
    row.targets.some((target) => target.provider !== "onprem-compose")
  ) {
    return null;
  }
  const slots: EnvTargetSlot[] = ["backend", "frontend", "standalone"];
  const available = slots.filter(
    (candidate) => !row.targets.some((target) => target.slot === candidate),
  );
  if (available.length === 0) return null;
  const selectedSlot = available.includes(slot) ? slot : available[0];
  return (
    <form
      aria-label={`Add on-prem target to ${row.environment.displayName}`}
      onSubmit={(event) => {
        event.preventDefault();
        void vm.addOnpremTarget(row.environment.id, selectedSlot, name.trim());
      }}
      style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}
    >
      <label>
        On-prem slot{" "}
        <select
          aria-label={`On-prem slot for ${row.environment.displayName}`}
          onChange={(event) => setSlot(event.target.value as EnvTargetSlot)}
          value={selectedSlot}
        >
          {available.map((candidate) => (
            <option key={candidate} value={candidate}>{candidate}</option>
          ))}
        </select>
      </label>
      <label>
        Host label{" "}
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
    <details>
      <summary>Recent deployments</summary>
      <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
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
