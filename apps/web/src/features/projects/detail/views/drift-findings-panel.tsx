"use client";

import { useState } from "react";
import { formatDate } from "@/features/workflows";
import type {
  AppRole,
  ProjectDriftFinding,
  ProjectDriftRepairAction,
  ProjectDriftResponse,
} from "@/shared/api/contracts";
import {
  DRIFT_REPAIR_LEAD_ONLY_MESSAGE,
  canRunDriftRepair,
  driftCheckLabel,
  driftFindingRowClass,
  driftRepairActionForCode,
  driftRepairButtonLabel,
  driftSourceLabel,
} from "../model/project-detail-tab-rules";

export function DriftFindingsPanel({
  appRole,
  onRun,
  onRepair,
  repairEnabled,
  response,
  running,
  workflowUpdatePrEnabled,
}: Readonly<{
  appRole?: AppRole | null;
  onRun: () => void;
  onRepair: (
    findingId: string,
    action: ProjectDriftRepairAction,
  ) => Promise<string>;
  repairEnabled: boolean;
  response: ProjectDriftResponse | null;
  running: boolean;
  workflowUpdatePrEnabled: boolean;
}>) {
  const [pendingRepair, setPendingRepair] = useState<{
    findingId: string;
    action: ProjectDriftRepairAction;
  } | null>(null);
  const [repairingFindingId, setRepairingFindingId] = useState<string | null>(
    null,
  );
  const [repairMessage, setRepairMessage] = useState<string | null>(null);

  if (!response) {
    return <p className="env-empty-state">Loading drift findings...</p>;
  }

  return (
    <div
      className="glass-panel"
      style={{
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
      }}
    >
      <DriftFindingsHeader
        sourceLabel={driftSourceLabel(response.findings)}
        running={running}
        onRun={onRun}
      />
      <DriftRepairMessage message={repairMessage} />
      <DriftFindingsBody
        appRole={appRole}
        findings={response.findings}
        pendingRepair={pendingRepair}
        repairEnabled={repairEnabled}
        repairingFindingId={repairingFindingId}
        workflowUpdatePrEnabled={workflowUpdatePrEnabled}
        onAskConfirm={(findingId, action) => {
          setPendingRepair({ findingId, action });
          setRepairMessage("Confirm repair to run this local-safe action.");
        }}
        onConfirm={(findingId, action) => {
          setRepairingFindingId(findingId);
          void onRepair(findingId, action)
            .then((message) => {
              setRepairMessage(
                `${message}. Run drift check again to refresh findings.`,
              );
              setPendingRepair(null);
            })
            .catch((error: unknown) => {
              setRepairMessage(
                error instanceof Error && error.message
                  ? error.message
                  : "Unable to run repair action.",
              );
            })
            .finally(() => setRepairingFindingId(null));
        }}
      />
    </div>
  );
}

function DriftFindingsHeader({
  sourceLabel,
  running,
  onRun,
}: Readonly<{ sourceLabel: string; running: boolean; onRun: () => void }>) {
  return (
    <div
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
          {sourceLabel}
        </p>
      </div>
      <button
        className="ghost-button"
        type="button"
        disabled={running}
        onClick={onRun}
        style={{
          minHeight: "2rem",
          padding: "0.35rem 0.85rem",
          fontSize: "0.78rem",
        }}
      >
        {driftCheckLabel(running)}
      </button>
    </div>
  );
}

function DriftRepairMessage({ message }: Readonly<{ message: string | null }>) {
  if (!message) return null;
  return (
    <p className="env-empty-state" style={{ margin: 0 }}>
      {message}
    </p>
  );
}

function DriftFindingsBody({
  appRole,
  findings,
  pendingRepair,
  repairEnabled,
  repairingFindingId,
  workflowUpdatePrEnabled,
  onAskConfirm,
  onConfirm,
}: Readonly<{
  appRole?: AppRole | null;
  findings: ProjectDriftFinding[];
  pendingRepair: {
    findingId: string;
    action: ProjectDriftRepairAction;
  } | null;
  repairEnabled: boolean;
  repairingFindingId: string | null;
  workflowUpdatePrEnabled: boolean;
  onAskConfirm: (findingId: string, action: ProjectDriftRepairAction) => void;
  onConfirm: (findingId: string, action: ProjectDriftRepairAction) => void;
}>) {
  if (!findings.length) {
    return <p className="env-empty-state">No active drift findings.</p>;
  }

  return (
    <div className="env-metadata-list">
      {findings.map((finding) => (
        <DriftFindingRow
          key={finding.id}
          appRole={appRole}
          finding={finding}
          pendingRepair={pendingRepair}
          repairEnabled={repairEnabled}
          repairingFindingId={repairingFindingId}
          workflowUpdatePrEnabled={workflowUpdatePrEnabled}
          onAskConfirm={onAskConfirm}
          onConfirm={onConfirm}
        />
      ))}
    </div>
  );
}

function DriftFindingRow({
  appRole,
  finding,
  pendingRepair,
  repairEnabled,
  repairingFindingId,
  workflowUpdatePrEnabled,
  onAskConfirm,
  onConfirm,
}: Readonly<{
  appRole?: AppRole | null;
  finding: ProjectDriftFinding;
  pendingRepair: {
    findingId: string;
    action: ProjectDriftRepairAction;
  } | null;
  repairEnabled: boolean;
  repairingFindingId: string | null;
  workflowUpdatePrEnabled: boolean;
  onAskConfirm: (findingId: string, action: ProjectDriftRepairAction) => void;
  onConfirm: (findingId: string, action: ProjectDriftRepairAction) => void;
}>) {
  const action = driftRepairActionForCode(
    finding.code,
    workflowUpdatePrEnabled,
  );
  const isConfirming =
    pendingRepair?.findingId === finding.id && pendingRepair.action === action;

  return (
    <div
      className={`env-metadata-row ${driftFindingRowClass(finding.severity)}`}
      style={{ alignItems: "flex-start" }}
    >
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.2rem",
        }}
      >
        <strong>{finding.code}</strong>
        <small>
          {finding.severity} - {finding.source} -{" "}
          {formatDate(finding.detectedAt)}
        </small>
        <small>{finding.message}</small>
      </span>
      <DriftRepairButton
        action={action}
        appRole={appRole}
        confirming={isConfirming}
        findingId={finding.id}
        repairEnabled={repairEnabled}
        repairing={repairingFindingId === finding.id}
        onAskConfirm={onAskConfirm}
        onConfirm={onConfirm}
      />
    </div>
  );
}

function DriftRepairButton({
  action,
  appRole,
  confirming,
  findingId,
  repairEnabled,
  repairing,
  onAskConfirm,
  onConfirm,
}: Readonly<{
  action: ProjectDriftRepairAction | null;
  appRole?: AppRole | null;
  confirming: boolean;
  findingId: string;
  repairEnabled: boolean;
  repairing: boolean;
  onAskConfirm: (findingId: string, action: ProjectDriftRepairAction) => void;
  onConfirm: (findingId: string, action: ProjectDriftRepairAction) => void;
}>) {
  if (!action) return null;
  if (!canRunDriftRepair(action, appRole)) {
    return (
      <small className="env-empty-state" role="note">
        {DRIFT_REPAIR_LEAD_ONLY_MESSAGE}
      </small>
    );
  }
  if (!repairEnabled) {
    return (
      <button
        className="ghost-button"
        type="button"
        disabled
        title="Repair actions coming in the next phase"
        style={{
          minHeight: "2rem",
          padding: "0.35rem 0.7rem",
          fontSize: "0.76rem",
        }}
      >
        Repair actions coming in the next phase
      </button>
    );
  }

  return (
    <button
      className="ghost-button"
      type="button"
      disabled={repairing}
      onClick={() => clickRepair(confirming, findingId, action, onAskConfirm, onConfirm)}
      style={{
        minHeight: "2rem",
        padding: "0.35rem 0.7rem",
        fontSize: "0.76rem",
      }}
    >
      {driftRepairButtonLabel({ repairing, confirming, action })}
    </button>
  );
}

function clickRepair(
  confirming: boolean,
  findingId: string,
  action: ProjectDriftRepairAction,
  onAskConfirm: (findingId: string, action: ProjectDriftRepairAction) => void,
  onConfirm: (findingId: string, action: ProjectDriftRepairAction) => void,
) {
  if (!confirming) {
    onAskConfirm(findingId, action);
    return;
  }
  onConfirm(findingId, action);
}
