"use client";

import type { ProvisionedProject } from "@/features/projects";
import { CodeTab } from "./workspace/code-tab";

/** The repository's source at a branch: files only. Its history is the Commits tab. */
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
      className="ws-panel"
    >
      <CodeTab projectId={project.id} />
    </div>
  );
}
