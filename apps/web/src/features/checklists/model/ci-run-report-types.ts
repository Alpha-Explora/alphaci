/* CI run report types — the `ci-run-report/v1` export of one pipeline
 * execution (a repository, a branch and a commit). Pure: no React, no fetch.
 *
 * Built by the server from the stored run, failures first, for the developer
 * who has to fix what failed. It carries no raw logs and no GitHub links: the
 * logs stay in the app's run view, which is the one place to read them. The
 * client renders it and never recomputes what the server already decided. */

import type {
  FriendlyMessage,
  RunOverallStatus,
  StageCheck,
  StageId,
  StageResults,
  StageStatus,
} from "@/shared/api/contracts";

export const CI_RUN_REPORT_SCHEMA_VERSION = "ci-run-report/v1";

/** Which pipeline execution: a promoted commit is built again on each branch, so the branch is part of the key. */
export interface CiRunReportRef {
  repoFullName: string;
  branch: string;
  commitSha: string;
}

export interface CiRunReportStage {
  stage: StageId;
  status: StageStatus;
  runId: number;
  /** Null for a stage that never reported. */
  reportedAt: string | null;
  messages: FriendlyMessage[];
  checks: StageCheck[];
  results: StageResults | null;
  /** Whether logs exist in the app. The logs themselves are never exported. */
  hasLogs: boolean;
}

export interface CiRunReportFailure {
  stage: StageId;
  severity: FriendlyMessage["severity"];
  title: string;
  detail: string;
  hint: string;
  items: Array<{ label: string; sub?: string }>;
}

export interface CiRunReportSummary {
  stages: number;
  passed: number;
  failed: number;
  inProgress: number;
  /** Pending, blocked by an earlier failure, stalled or cancelled. */
  notRun: number;
}

export interface CiRunReport extends CiRunReportRef {
  schemaVersion: typeof CI_RUN_REPORT_SCHEMA_VERSION;
  generatedAt: string;
  startedAt: string;
  overallStatus: RunOverallStatus;
  summary: CiRunReportSummary;
  /** What to fix, first. */
  failures: CiRunReportFailure[];
  /** Every stage in pipeline order. */
  stages: CiRunReportStage[];
}
