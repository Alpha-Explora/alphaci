"use client";

import type { ProvisionedProject } from "@/features/projects";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { PullRequestsTab } from "./workspace/pull-requests-tab";

export function PullsTabPanel({
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
      id="project-detail-panel-pulls"
      aria-labelledby="project-detail-tab-pulls"
    >
      <PullRequestsTab
        projectId={project.id}
        appRole={vm.appRole}
        viewerLogin={vm.viewerLogin}
        onOpenQaStudio={() => vm.setTab("qa")}
        initialFocusNumber={vm.pullFocus}
      />
    </div>
  );
}
