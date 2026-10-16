"use client";

import { useState } from "react";

import type {
  AppRole,
  ProjectDriftFinding,
  ProjectDriftRepairAction,
} from "@/shared/api/contracts";
import { apiErrorReason } from "../model/api-error-reason";
import {
  DRIFT_REPAIR_LEAD_ONLY_MESSAGE,
  canRunDriftRepair,
  driftAffectedFiles,
  driftFindingTitle,
  driftPullRequestUrl,
  driftRepairBaseBranch,
  driftRepairActionFor,
} from "../model/drift-finding-rules";
import { useProjectDriftViewModel } from "../view-models/use-project-drift-view-model";

type PendingRepair = {
  findingId: string;
  action: ProjectDriftRepairAction;
} | null;

/** What a repair reports: the message, and the pull request it opened, if any. */
type RepairNotice = { text: string; url: string | null } | null;

/**
 * The project's health findings, for Settings. Anyone may run the checks; the
 * repair buttons follow the backend's gate (the roles that manage the project).
 * A repair asks once more before it acts, because it opens a pull request.
 */
export function ProjectDriftPanel({
  projectId,
  appRole,
}: Readonly<{
  projectId: string;
  appRole?: AppRole | null;
}>) {
  const vm = useProjectDriftViewModel(projectId);
  const [pending, setPending] = useState<PendingRepair>(null);
  const [repairingId, setRepairingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<RepairNotice>(null);

  async function applyRepair(
    finding: ProjectDriftFinding,
    action: ProjectDriftRepairAction,
  ) {
    if (pending?.findingId !== finding.id || pending.action !== action) {
      setPending({ findingId: finding.id, action });
      setNotice({
        text: `Confirm to reset the two AlphaCI CI secrets and open a pull request into ${driftRepairBaseBranch(finding) ?? "the project's first environment branch"} that points the workflows at this deployment.`,
        url: null,
      });
      return;
    }
    setRepairingId(finding.id);
    setNotice(null);
    try {
      const outcome = await vm.repair(finding.id, action);
      setNotice({ text: outcome.message, url: driftPullRequestUrl(outcome) });
    } catch (caught) {
      setNotice({
        text: apiErrorReason(caught, "Unable to apply the repair."),
        url: null,
      });
    } finally {
      setPending(null);
      setRepairingId(null);
    }
  }

  return (
    <section
      className="glass-panel"
      aria-label="Health findings"
      style={{
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "0.75rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h4 style={{ margin: 0, fontSize: "0.95rem" }}>Health findings</h4>
          <p className="env-empty-state" style={{ margin: "0.25rem 0 0" }}>
            Checked against the repository&apos;s CI workflows on each pipeline
            branch.
          </p>
        </div>
        <button
          className="ghost-button"
          type="button"
          disabled={vm.status !== "idle"}
          onClick={() => void vm.check()}
          style={{
            minHeight: "2rem",
            padding: "0.35rem 0.85rem",
            fontSize: "0.78rem",
          }}
        >
          {vm.status === "checking" ? "Checking..." : "Run check"}
        </button>
      </header>
      {notice ? (
        <p className="env-empty-state" role="status" style={{ margin: 0 }}>
          {notice.text}
          {notice.url ? (
            <>
              {" "}
              <a href={notice.url} target="_blank" rel="noreferrer">
                Open pull request
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      {vm.error ? (
        <p className="error-text" style={{ margin: 0 }}>
          {vm.error}
        </p>
      ) : null}
      <FindingsBody
        appRole={appRole}
        error={vm.error}
        pending={pending}
        repairingId={repairingId}
        response={vm.response}
        onRepair={(finding, action) => void applyRepair(finding, action)}
      />
    </section>
  );
}

function FindingsBody({
  appRole,
  error,
  pending,
  repairingId,
  response,
  onRepair,
}: Readonly<{
  appRole?: AppRole | null;
  error: string | null;
  pending: PendingRepair;
  repairingId: string | null;
  response: { enabled: boolean; findings: ProjectDriftFinding[] } | null;
  onRepair: (
    finding: ProjectDriftFinding,
    action: ProjectDriftRepairAction,
  ) => void;
}>) {
  if (!response) {
    return error ? null : (
      <p className="env-empty-state">Loading health findings...</p>
    );
  }
  if (!response.enabled) {
    return (
      <p className="env-empty-state">
        Health checks are not enabled on this deployment.
      </p>
    );
  }
  if (response.findings.length === 0) {
    return <p className="env-empty-state">No active findings.</p>;
  }
  return (
    <div className="env-metadata-list">
      {response.findings.map((finding) => (
        <FindingRow
          key={finding.id}
          appRole={appRole}
          finding={finding}
          pending={pending}
          repairingId={repairingId}
          onRepair={onRepair}
        />
      ))}
    </div>
  );
}

function FindingRow({
  appRole,
  finding,
  pending,
  repairingId,
  onRepair,
}: Readonly<{
  appRole?: AppRole | null;
  finding: ProjectDriftFinding;
  pending: PendingRepair;
  repairingId: string | null;
  onRepair: (
    finding: ProjectDriftFinding,
    action: ProjectDriftRepairAction,
  ) => void;
}>) {
  const files = driftAffectedFiles(finding);
  return (
    <div className="env-metadata-row" style={{ alignItems: "flex-start" }}>
      <span style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
        <strong>{driftFindingTitle(finding)}</strong>
        <small>
          {finding.severity} - {finding.source}
        </small>
        <small>{finding.message}</small>
        {files.length > 0 ? (
          <ul
            className="env-empty-state"
            style={{ margin: "0.2rem 0 0", paddingLeft: "1.1rem" }}
          >
            {files.map((file) => (
              <li key={file}>
                <small>{file}</small>
              </li>
            ))}
          </ul>
        ) : null}
      </span>
      <RepairControl
        appRole={appRole}
        finding={finding}
        pending={pending}
        repairingId={repairingId}
        onRepair={onRepair}
      />
    </div>
  );
}

function RepairControl({
  appRole,
  finding,
  pending,
  repairingId,
  onRepair,
}: Readonly<{
  appRole?: AppRole | null;
  finding: ProjectDriftFinding;
  pending: PendingRepair;
  repairingId: string | null;
  onRepair: (
    finding: ProjectDriftFinding,
    action: ProjectDriftRepairAction,
  ) => void;
}>) {
  const action = driftRepairActionFor(finding);
  if (!action) return null;
  if (!canRunDriftRepair(appRole)) {
    return (
      <small className="env-empty-state" role="note">
        {DRIFT_REPAIR_LEAD_ONLY_MESSAGE}
      </small>
    );
  }
  const confirming =
    pending?.findingId === finding.id && pending.action === action;
  const busy = repairingId === finding.id;
  return (
    <button
      className="ghost-button"
      type="button"
      disabled={repairingId !== null}
      onClick={() => onRepair(finding, action)}
      style={{
        minHeight: "2rem",
        padding: "0.35rem 0.7rem",
        fontSize: "0.76rem",
      }}
    >
      {busy ? "Repairing..." : confirming ? "Confirm repair" : "Repair"}
    </button>
  );
}
