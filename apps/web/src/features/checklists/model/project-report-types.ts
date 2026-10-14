/* Project QA report types — the `qa-report/v2` export of a Project run. Pure:
 * no React, no fetch.
 *
 * v1 plus the repositories the run covered and, on every item and defect, the
 * requirement it speaks for. The server builds it; for a signed-off run `run`
 * is the copy frozen at sign-off. The client renders it and never recomputes
 * counts the server already gave. */

import type { ProjectQaRun } from "./project-run-types";
import type { QaReportDefect, QaReportSignoffEntry, QaReportSummary } from "./qa-report-types";

export const QA_PROJECT_REPORT_SCHEMA_VERSION = "qa-report/v2";

export interface QaProjectReportRepository {
  projectId: string;
  repoFullName: string;
  /** The repository's own name: the last segment of `repoFullName`. */
  name: string;
  /** The uat head the run captured when it started. Null when it captured none. */
  headSha: string | null;
}

export interface QaProjectReportDefect extends QaReportDefect {
  requirementName: string | null;
  requirementKind: "functional" | "system" | null;
}

export interface QaProjectReport {
  schemaVersion: typeof QA_PROJECT_REPORT_SCHEMA_VERSION;
  generatedAt: string;
  /** True when `run` is the copy frozen at sign-off. */
  frozen: boolean;
  project: { id: string; name: string };
  repositories: QaProjectReportRepository[];
  run: ProjectQaRun;
  summary: QaReportSummary;
  defects: QaProjectReportDefect[];
  signoffHistory: QaReportSignoffEntry[];
}
