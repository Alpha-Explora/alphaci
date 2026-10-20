"use client";

import type { ProvisionedProject } from "@/features/projects";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { CodeTab } from "./workspace/code-tab";

/**
 * The repository's source at a branch, or at one commit when the Commits tab's
 * "Browse files" opened it: files only. Its history is the Commits tab. The
 * key restarts the browser when a different commit is asked for.
 */
export function CodeTabPanel({
  project,
  vm,
}: Readonly<{
  project: ProvisionedProject;
  vm?: Pick<ProjectDetailTabsViewModel, "codeCommit">;
  dangerZone?: React.ReactNode;
}>) {
  const commit = vm?.codeCommit ?? null;
  return (
    <div
      role="tabpanel"
      id="project-detail-panel-code"
      aria-labelledby="project-detail-tab-code"
      className="ws-panel"
    >
      <CodeTab key={commit?.sha ?? ""} projectId={project.id} commit={commit} />
    </div>
  );
}
