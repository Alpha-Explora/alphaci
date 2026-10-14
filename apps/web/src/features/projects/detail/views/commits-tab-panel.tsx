"use client";

import type { ProvisionedProject } from "@/features/projects";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { CommitsSection } from "./workspace/commits-section";

/**
 * A branch's commit history, newest first. The tab's one selector picks the
 * branch; a deep link (`openCommits(branch)`) arrives with one preselected,
 * and the key restarts the list when a different branch is asked for.
 */
export function CommitsTabPanel({
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
      id="project-detail-panel-commits"
      aria-labelledby="project-detail-tab-commits"
      className="ws-panel"
    >
      <CommitsSection
        key={vm.commitsBranch ?? ""}
        projectId={project.id}
        initialBranch={vm.commitsBranch}
        onOpenPullRequest={vm.visibleTabs.includes("pulls") ? vm.openPullRequest : undefined}
      />
    </div>
  );
}
