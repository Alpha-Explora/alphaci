/* QA report types — the `qa-report/v1` export. Pure: no React, no fetch.
 *
 * The report is assembled by the server from one QA run. For a signed-off run
 * `run` is the copy frozen at sign-off, so the PDF, the Markdown and the JSON
 * all describe exactly what was signed, even if the checklist changed since.
 * The client renders it; it never recomputes counts the server already gave. */

import type { ChecklistTargetPersona } from "./checklist-types";
import type {
  QaActor,
  QaDefectSeverity,
  QaFixRequest,
  QaRun,
  QaVerdict,
} from "./qa-run-types";

export const QA_REPORT_SCHEMA_VERSION = "qa-report/v1";

export interface QaReportProject {
  id: string;
  repoFullName: string;
  name: string;
}

export interface QaReportSummary {
  totalItems: number;
  passed: number;
  failed: number;
  blocked: number;
  returnedToDev: number;
  pending: number;
  inProgress: number;
  /** 0..1, as the server computed it. */
  completionRate: number;
  openDefects: number;
  blockers: number;
  verdict: QaVerdict | null;
}

export type QaReportDefectStatus = "failed" | "blocked" | "returned_to_dev";

/** One open defect. The server orders these by severity, then position. */
export interface QaReportDefect {
  position: number;
  title: string;
  status: QaReportDefectStatus;
  severity: QaDefectSeverity | null;
  notes: string | null;
  reproductionSteps: string | null;
  targetPersona: ChecklistTargetPersona;
  fixRequest: QaFixRequest | null;
}

/** A sign-off, current or superseded by a reopen. */
export interface QaReportSignoffEntry {
  verdict: QaVerdict;
  summary: string | null;
  conditions: string | null;
  signedBy: QaActor;
  signedAt: string;
  /** Null while this is the run's current sign-off. */
  supersededAt: string | null;
  supersededBy: QaActor | null;
}

export interface QaReport {
  schemaVersion: typeof QA_REPORT_SCHEMA_VERSION;
  generatedAt: string;
  /** True when `run` is the copy frozen at sign-off. */
  frozen: boolean;
  project: QaReportProject;
  run: QaRun;
  summary: QaReportSummary;
  defects: QaReportDefect[];
  /** Reserved for CI-collected test results; always null in v1. */
  automatedResults: null;
  signoffHistory: QaReportSignoffEntry[];
}
