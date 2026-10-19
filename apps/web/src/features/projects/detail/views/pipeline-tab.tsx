"use client";

import "./pipeline-tab.css";

import type { ProvisionedProject } from "@/features/projects";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { RunsTab } from "./runs-tab";
import { WorkflowTab } from "./workflow-tab";

/**
 * The Pipeline tab presents workflow execution and its configuration.
 */
export function PipelineTab({
  project,
  vm,
  dangerZone,
}: Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  dangerZone?: React.ReactNode;
}>) {
  return (
    <div
      role="tabpanel"
      id="project-detail-panel-pipeline"
      aria-labelledby="project-detail-tab-pipeline"
      className="pipeline-tab"
    >
      <div className="pipeline-tab__head">
        <h2 className="pipeline-tab__name">Workflows</h2>
      </div>
      <div>
        {vm.pipelineView === "configuration" ? (
          <WorkflowTab project={project} vm={vm} dangerZone={dangerZone} />
        ) : (
          <RunsTab project={project} vm={vm} />
        )}
      </div>
    </div>
  );
}
