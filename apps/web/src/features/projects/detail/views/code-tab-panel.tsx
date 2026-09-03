"use client";

import type { ProvisionedProject } from "@/features/projects";
import { CodeTab } from "./workspace/code-tab";

export function CodeTabPanel({
  project,
}: Readonly<{
  project: ProvisionedProject;
  vm?: unknown;
  dangerZone?: React.ReactNode;
}>) {
  return (
    <div
      role="tabpanel"
      id="project-detail-panel-code"
      aria-labelledby="project-detail-tab-code"
    >
      <CodeTab projectId={project.id} />
    </div>
  );
}
