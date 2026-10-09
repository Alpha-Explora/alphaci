"use client";

import { ProjectQaReportView } from "@/features/checklists/report";
import { VisualEvidence } from "@/features/projects/detail";

/**
 * The printable Project QA report. The report is the checklists feature's; the
 * screenshots in its appendix are the Project page's, so this route is where
 * the two meet.
 */
export default function ProjectQaReportPage() {
  return (
    <ProjectQaReportView
      renderEvidence={(repository, { onSettled }) => (
        <VisualEvidence projectId={repository.projectId} headSha={repository.headSha} onSettled={onSettled} />
      )}
    />
  );
}
