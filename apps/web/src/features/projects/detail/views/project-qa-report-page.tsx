"use client";

import { ProjectQaReportView } from "@/features/checklists/report";

import { VisualEvidence } from "./visual-evidence";

/**
 * The printable Project QA report with its screenshots. The report is the
 * checklists feature's; the screenshots in its appendix are this page's, so
 * the two meet here and the route only mounts the result.
 */
export function ProjectQaReportPage() {
  return (
    <ProjectQaReportView
      renderEvidence={(repository, { onSettled }) => (
        <VisualEvidence projectId={repository.projectId} headSha={repository.headSha} onSettled={onSettled} />
      )}
    />
  );
}
