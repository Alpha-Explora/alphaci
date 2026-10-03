"use client";

import type { ProvisionedProject } from "@/features/projects";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { CodeTab } from "./workspace/code-tab";
import { CommitsSection } from "./workspace/commits-section";

/** The repository's source at a branch, then that branch's commits. */
export function CodeTabPanel({
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
      id="project-detail-panel-code"
      aria-labelledby="project-detail-tab-code"
      className="ws-panel"
    >
      <CodeTab projectId={project.id} />
      <CommitsSection projectId={project.id} onOpenPullRequest={vm.openPullRequest} />
    </div>
  );
}
