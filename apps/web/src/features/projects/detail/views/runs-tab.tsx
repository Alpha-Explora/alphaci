"use client";

import type { ProvisionedProject } from "@/features/projects";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { PipelineRunsTab } from "./workspace/pipeline-runs-tab";
import { CiRunsList } from "./ci-runs-list";

export function RunsTab({
  project,
  vm,
}: Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  dangerZone?: React.ReactNode;
}>) {
  return (
    <div
      role="tabpanel"
      id="project-detail-panel-runs"
      aria-labelledby="project-detail-tab-runs"
      style={{ display: "grid", gap: "1.25rem" }}
    >
      <PipelineRunsTab
        projectId={project.id}
        appRole={vm.appRole}
        onOpenPullRequest={vm.visibleTabs.includes("pulls") ? vm.openPullRequest : undefined}
      />
      <ReportedResults project={project} vm={vm} />
    </div>
  );
}

function ReportedResults({
  vm,
}: Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
}>) {
  if (!vm.ciRunTrackingEnabled || !vm.overview?.capabilities.ciRunTracking) {
    return null;
  }
  return (
    <div className="ws-reported">
      <h3 className="ws-reported__head">Reported results</h3>
      <p className="ws-hint">
        What the workflow sent back to ALPHACI. If a run above is green but
        missing here, the report never arrived.
      </p>
      <ReportedResultsBody error={vm.ciRunsError} response={vm.ciRuns} />
    </div>
  );
}

function ReportedResultsBody({
  error,
  response,
}: Readonly<{
  error: string | null;
  response: ProjectDetailTabsViewModel["ciRuns"];
}>) {
  if (error) {
    return (
      <p className="error-text" style={{ margin: 0 }}>
        {error}
      </p>
    );
  }
  return <CiRunsList response={response} />;
}
