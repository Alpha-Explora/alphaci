"use client";

import type { ProvisionedProject } from "@/features/projects";
import { PullRequestsTab } from "./workspace/pull-requests-tab";

export function PullsTabPanel({
  project,
}: Readonly<{
  project: ProvisionedProject;
  vm?: unknown;
  dangerZone?: React.ReactNode;
}>) {
  return (
    <div
      role="tabpanel"
      id="project-detail-panel-pulls"
      aria-labelledby="project-detail-tab-pulls"
    >
      <PullRequestsTab projectId={project.id} />
    </div>
  );
}
