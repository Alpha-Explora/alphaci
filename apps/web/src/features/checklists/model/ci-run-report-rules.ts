/* CI run report rules — reading the server's `ci-run-report/v1`, naming its
 * files, linking to its print page and wording its states. Pure: no React, no
 * fetch. */

import type { RunOverallStatus, StageId, StageStatus } from "@/shared/api/contracts";

import {
  CI_RUN_REPORT_SCHEMA_VERSION,
  type CiRunReport,
  type CiRunReportFailure,
  type CiRunReportRef,
  type CiRunReportStage,
  type CiRunReportSummary,
} from "./ci-run-report-types";
import { sanitizeFilenamePart } from "./qa-report-rules";
import { record, records, text } from "./wire-readers";

const SHA_LENGTH = 7;

const EMPTY_SUMMARY: CiRunReportSummary = { stages: 0, passed: 0, failed: 0, inProgress: 0, notRun: 0 };

function listOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function stageOf(raw: unknown): CiRunReportStage | null {
  const value = record(raw);
  const stage = text(value?.stage);
  const status = text(value?.status);
  if (!value || !stage || !status) return null;
  return {
    stage: stage as StageId,
    status: status as StageStatus,
    runId: typeof value.runId === "number" ? value.runId : 0,
    reportedAt: text(value.reportedAt),
    messages: listOf(value.messages),
    checks: listOf(value.checks),
    results: record(value.results) as CiRunReportStage["results"],
    hasLogs: value.hasLogs === true,
  };
}

function summaryOf(raw: unknown): CiRunReportSummary {
  const value = record(raw);
  if (!value) return EMPTY_SUMMARY;
  const count = (key: keyof CiRunReportSummary) => (typeof value[key] === "number" ? (value[key] as number) : 0);
  return {
    stages: count("stages"),
    passed: count("passed"),
    failed: count("failed"),
    inProgress: count("inProgress"),
    notRun: count("notRun"),
  };
}

/** The execution a report names, or null when any part is missing. */
function refOf(raw: Record<string, unknown> | null): CiRunReportRef | null {
  const repoFullName = text(raw?.repoFullName);
  const branch = text(raw?.branch);
  const commitSha = text(raw?.commitSha);
  return repoFullName && branch && commitSha ? { repoFullName, branch, commitSha } : null;
}

function failuresOf(value: unknown): CiRunReportFailure[] {
  return records(value).map((failure) => ({ ...failure, items: listOf(failure.items) })) as unknown as CiRunReportFailure[];
}

function stagesOf(value: unknown): CiRunReportStage[] {
  return records(value)
    .map(stageOf)
    .filter((stage): stage is CiRunReportStage => stage !== null);
}

/**
 * The report as the server sent it. Null when it names no execution, so the
 * page says so instead of drawing an empty sheet.
 */
export function normalizeCiRunReport(value: unknown): CiRunReport | null {
  const raw = record(value);
  const ref = refOf(raw);
  if (!raw || !ref) return null;
  return {
    schemaVersion: CI_RUN_REPORT_SCHEMA_VERSION,
    generatedAt: text(raw.generatedAt) ?? "",
    ...ref,
    startedAt: text(raw.startedAt) ?? "",
    overallStatus: (text(raw.overallStatus) ?? "partial") as RunOverallStatus,
    summary: summaryOf(raw.summary),
    failures: failuresOf(raw.failures),
    stages: stagesOf(raw.stages),
  };
}

/** "CI-Results-orders-api-uat-a1b2c3d" — no extension. The backend names its download the same way. */
export function ciRunReportBaseName(ref: CiRunReportRef): string {
  const repo = sanitizeFilenamePart(ref.repoFullName.split("/").pop() ?? ref.repoFullName);
  const branch = sanitizeFilenamePart(ref.branch);
  const sha = sanitizeFilenamePart(ref.commitSha.slice(0, SHA_LENGTH));
  return `CI-Results-${repo}-${branch}-${sha}`;
}

export function ciRunReportFilename(ref: CiRunReportRef, extension: "json" | "md" | "pdf"): string {
  return `${ciRunReportBaseName(ref)}.${extension}`;
}

/** The query the report endpoint and the print page both take. */
export function ciRunReportQuery(ref: CiRunReportRef, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    repoFullName: ref.repoFullName,
    branch: ref.branch,
    commitSha: ref.commitSha,
    ...extra,
  });
  return params.toString();
}

/** The printable report page. `print` asks it to open the print dialog once. */
export function ciRunReportPageHref(ref: CiRunReportRef, options: { print?: boolean } = {}): string {
  return `/runs/report?${ciRunReportQuery(ref, options.print ? { print: "1" } : {})}`;
}

/** The execution a page's query names, or null when any part is missing. */
export function ciRunReportRefFromQuery(params: { get(name: string): string | null } | null): CiRunReportRef | null {
  const repoFullName = params?.get("repoFullName")?.trim();
  const branch = params?.get("branch")?.trim();
  const commitSha = params?.get("commitSha")?.trim();
  return repoFullName && branch && commitSha ? { repoFullName, branch, commitSha } : null;
}

/* ── Wording ────────────────────────────────────────────────────────────── */

const STAGE_TITLES: Record<StageId, string> = {
  access: "Access",
  quality: "Quality",
  package: "Package",
  verify: "Verify",
};

const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  success: "Passed",
  failure: "Failed",
  running: "Running",
  cancelled: "Cancelled",
  pending: "Not run yet",
  blocked: "Blocked by an earlier failure",
  stalled: "Stalled",
};

const OVERALL_LABELS: Record<RunOverallStatus, string> = {
  success: "Passed",
  failure: "Failed",
  running: "Running",
  cancelled: "Cancelled",
  partial: "Partial",
};

export function ciStageTitle(stage: StageId): string {
  return STAGE_TITLES[stage] ?? stage;
}

export function ciStageStatusLabel(status: StageStatus): string {
  return STAGE_STATUS_LABELS[status] ?? status;
}

export function ciOverallLabel(status: RunOverallStatus): string {
  return OVERALL_LABELS[status] ?? status;
}

export type CiTone = "success" | "danger" | "warning" | "neutral";

export function ciOverallTone(status: RunOverallStatus): CiTone {
  if (status === "success") return "success";
  if (status === "failure") return "danger";
  if (status === "partial" || status === "cancelled") return "warning";
  return "neutral";
}

export function ciStageTone(status: StageStatus): CiTone {
  if (status === "success") return "success";
  if (status === "failure") return "danger";
  if (status === "stalled" || status === "cancelled" || status === "blocked") return "warning";
  return "neutral";
}

/** "1 of 4 stages passed, 1 failed, 2 not run". */
export function ciSummaryLine(summary: CiRunReportSummary): string {
  const parts = [`${summary.passed} of ${summary.stages} stages passed`];
  if (summary.failed > 0) parts.push(`${summary.failed} failed`);
  if (summary.notRun > 0) parts.push(`${summary.notRun} not run`);
  return parts.join(", ");
}

export function ciShortSha(sha: string): string {
  return sha.slice(0, SHA_LENGTH);
}
