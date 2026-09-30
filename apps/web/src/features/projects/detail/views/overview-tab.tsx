"use client";

import Link from "next/link";

import { MyQaItemsCard } from "@/features/checklists/returned";
import { ProductionDeploymentPanel } from "@/features/projects/previews";
import { formatDate } from "@/features/workflows";
import type {
  ProjectOverviewResponse,
  ProvisionedProject,
  WorkflowFileMetadata,
} from "@/features/projects";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { DriftFindingsPanel } from "./drift-findings-panel";
import {
  ciAuthLabel,
  healthCheckRowClass,
  selectedChecksLabel,
  snapshotFindingLabel,
  stagesLabel,
  syncNowLabel,
  targetsCountLabel,
} from "../model/project-detail-tab-rules";

export function OverviewTab({
  project,
  vm,
}: Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  dangerZone?: React.ReactNode;
}>) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <OverviewPreviews
        enabled={vm.previewDeploymentsEnabled}
        onOpenFullLogs={vm.openTargetLogs}
        project={project}
      />
      <MyQaItemsCard
        appRole={vm.appRole}
        enabled={vm.qaChecklistsEnabled && Boolean(vm.appRole)}
        projectId={project.id}
        highlightRequested={vm.highlightMyQaItems}
      />
      <OverviewFacts
        project={project}
        overview={vm.overview}
        files={vm.workflowFiles}
      />
      <DeveloperAccessRow project={project} overview={vm.overview} />
      <SnapshotRow
        snapshot={vm.syncSnapshot}
        syncAvailable={vm.syncAvailable}
        syncing={vm.syncingProjectId === project.id}
        onSync={() => void vm.syncNow()}
      />
      <ErrorText message={vm.syncMessage} />
      <ErrorText message={project.failureReason} />
      <HealthChecksList checks={vm.overview?.health.checks ?? []} />
      <OverviewDrift vm={vm} />
    </div>
  );
}

function OverviewFacts({
  project,
  overview,
  files,
}: Readonly<{
  project: ProvisionedProject;
  overview: ProjectOverviewResponse | null;
  files: WorkflowFileMetadata[];
}>) {
  return (
    <dl className="project-detail-grid">
      <div>
        <dt>Workflow</dt>
        <dd>{overview?.workflow.path ?? project.workflowPath}</dd>
      </div>
      <div>
        <dt>Checks</dt>
        <dd>{selectedChecksLabel(project)}</dd>
      </div>
      <CommitFact sha={project.githubCommitSha} />
      <div>
        <dt>Stages</dt>
        <dd>{stagesLabel(files.length)}</dd>
      </div>
      <div>
        <dt>CI token</dt>
        <dd>{ciAuthLabel(overview?.ciAuth.status)}</dd>
      </div>
      <div>
        <dt>Targets</dt>
        <dd>{targetsCountLabel(overview?.deploymentTargets.count)}</dd>
      </div>
    </dl>
  );
}

function CommitFact({ sha }: Readonly<{ sha: string | null }>) {
  if (!sha) return null;
  return (
    <div>
      <dt>Commit</dt>
      <dd>{sha.slice(0, 10)}</dd>
    </div>
  );
}

/**
 * First on the Overview: what is live is the first question asked of a
 * project, and the facts grid below describes how it got there.
 */
function OverviewPreviews({
  enabled,
  onOpenFullLogs,
  project,
}: Readonly<{
  enabled: boolean;
  onOpenFullLogs: ProjectDetailTabsViewModel["openTargetLogs"];
  project: ProvisionedProject;
}>) {
  if (!enabled) return null;
  return (
    <ProductionDeploymentPanel
      enabled
      onOpenFullLogs={onOpenFullLogs}
      projectId={project.id}
      repoFullName={project.repoFullName}
    />
  );
}

function DeveloperAccessRow({
  project,
  overview,
}: Readonly<{
  project: ProvisionedProject;
  overview: ProjectOverviewResponse | null;
}>) {
  if (!overview?.hierarchyRepositoryId || !project.workspaceId) return null;
  return (
    <div
      className="env-metadata-row provisioned"
      style={{ alignItems: "center" }}
    >
      <span>
        <strong>Developer access</strong>
        <br />
        Grant or revoke this repository for members of the team that owns it.
      </span>
      <Link
        className="ghost-button target-action-btn"
        href={`/groups/${encodeURIComponent(project.workspaceId)}/repositories/${encodeURIComponent(overview.hierarchyRepositoryId)}`}
      >
        Manage access
      </Link>
    </div>
  );
}

function SnapshotRow({
  snapshot,
  syncAvailable,
  syncing,
  onSync,
}: Readonly<{
  snapshot: ProjectOverviewResponse["syncSnapshot"] | null;
  syncAvailable: boolean;
  syncing: boolean;
  onSync: () => void;
}>) {
  if (!snapshot) return null;
  return (
    <div
      className="env-metadata-row provisioned"
      style={{ alignItems: "center" }}
    >
      <span>
        <strong>Local snapshot</strong>
        <br />
        <SnapshotLatest latest={snapshot.latest} />
      </span>
      <SyncNowButton
        available={syncAvailable}
        syncing={syncing}
        onSync={onSync}
      />
    </div>
  );
}

function SnapshotLatest({
  latest,
}: Readonly<{
  latest: NonNullable<
    ProjectOverviewResponse["syncSnapshot"]
  >["latest"];
}>) {
  if (!latest) return <>Not synced yet</>;
  return (
    <>
      {latest.status} - {snapshotFindingLabel(latest.findings.length)} -{" "}
      {formatDate(latest.completedAt)}
    </>
  );
}

function SyncNowButton({
  available,
  syncing,
  onSync,
}: Readonly<{ available: boolean; syncing: boolean; onSync: () => void }>) {
  if (!available) return null;
  return (
    <button
      className="ghost-button target-action-btn"
      type="button"
      disabled={syncing}
      onClick={onSync}
    >
      {syncNowLabel(syncing)}
    </button>
  );
}

function ErrorText({ message }: Readonly<{ message: string | null }>) {
  if (!message) return null;
  return (
    <p className="error-text" style={{ margin: 0 }}>
      {message}
    </p>
  );
}

function HealthChecksList({
  checks,
}: Readonly<{
  checks: ProjectOverviewResponse["health"]["checks"];
}>) {
  if (!checks.length) return null;
  return (
    <div className="env-metadata-list" data-tour="sync-health">
      {checks.map((check) => (
        <HealthCheckRow key={check.key} check={check} />
      ))}
    </div>
  );
}

function HealthCheckRow({
  check,
}: Readonly<{
  check: ProjectOverviewResponse["health"]["checks"][number];
}>) {
  return (
    <div className={`env-metadata-row ${healthCheckRowClass(check.status)}`}>
      <span>{check.label}</span>
      <span>{check.message}</span>
    </div>
  );
}

function OverviewDrift({
  vm,
}: Readonly<{
  vm: ProjectDetailTabsViewModel;
}>) {
  if (!vm.driftDetectionEnabled || !vm.overview?.capabilities.driftDetection) {
    return null;
  }
  if (vm.driftError) {
    return (
      <p className="error-text" style={{ margin: 0 }}>
        {vm.driftError}
      </p>
    );
  }
  return (
    <DriftFindingsPanel
      onRun={() => void vm.runDriftDetection()}
      onRepair={vm.repairDriftFinding}
      repairEnabled={vm.driftRepairEnabled}
      response={vm.drift}
      running={vm.runningDriftCheck}
      workflowUpdatePrEnabled={vm.workflowUpdatePrEnabled}
    />
  );
}
