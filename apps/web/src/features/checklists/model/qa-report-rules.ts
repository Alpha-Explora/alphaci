/* Pure QA report rules: labels, the completion figure, file names, links and
 * error copy for the report export. No React, no fetch.
 *
 * Counts come from the server's summary; nothing here recounts items. The one
 * number computed here is the percentage shown beside "N / M passed", and it is
 * derived from those same two integers so the sentence can never contradict
 * itself (see `percentFloor`). */

import type { QaDefectSeverity, QaRunItem, QaRunItemStatus, QaRunStatus, QaCommitSource, QaVerdict } from "./qa-run-types";
import type { QaReport, QaReportSignoffEntry, QaReportSummary } from "./qa-report-types";
import { severityLabel, verdictLabel, type QaTone } from "./qa-run-rules";

/* ── Labels ─────────────────────────────────────────────────────────────── */

export function reportSeverityLabel(severity: QaDefectSeverity | null): string {
  return severity ? severityLabel(severity) : "Unrated";
}

export function reportVerdictLabel(verdict: QaVerdict | null): string {
  return verdict ? verdictLabel(verdict) : "Not signed off";
}

const VERDICT_TONES: Record<QaVerdict, QaTone> = {
  APPROVED: "success",
  CONDITIONAL: "warning",
  REJECTED: "danger",
};

export function reportVerdictTone(verdict: QaVerdict | null): QaTone {
  return verdict ? VERDICT_TONES[verdict] ?? "neutral" : "neutral";
}

const RUN_STATUS_LABELS: Record<QaRunStatus, string> = {
  open: "Open",
  signed_off: "Signed off",
};

export function runStatusLabel(status: QaRunStatus): string {
  return RUN_STATUS_LABELS[status] ?? status;
}

const COMMIT_SOURCE_LABELS: Record<QaCommitSource, string> = {
  deployment: "Deployed",
  branch_head: "Branch head",
};

/** "Deployed" when the tested commit is what the host serves, else "Branch head". */
export function commitSourceShortLabel(source: QaCommitSource | null | undefined): string {
  return source ? COMMIT_SOURCE_LABELS[source] ?? source : "";
}

export function actorLabel(actor: { login: string } | null | undefined): string {
  return actor?.login ? `@${actor.login}` : "Unknown";
}

/** The frozen/live note under the report header. */
export function reportStateLabel(frozen: boolean): string {
  return frozen ? "Frozen at sign-off" : "Live — not signed off";
}

/* ── Dates ──────────────────────────────────────────────────────────────── */

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((entry) => entry.type === type)?.value ?? "";
}

/**
 * "2026-09-25 14:32 GMT+8": ISO-ordered so a printed report reads the same in
 * every locale, with the zone spelled out because a PDF outlives the screen it
 * was made on. `timeZone` is a parameter so the rule stays testable.
 */
export function formatReportDate(iso: string | null | undefined, timeZone?: string): string {
  const at = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(at)) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
    timeZoneName: "short",
  }).formatToParts(new Date(at));
  const date = `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`;
  const time = `${part(parts, "hour")}:${part(parts, "minute")}`;
  return `${date} ${time} ${part(parts, "timeZoneName")}`.trim();
}

/* ── Completion ─────────────────────────────────────────────────────────── */

/**
 * `part` of `total` as a whole percent, rounded DOWN so "100%" only ever means
 * every item passed. Integer arithmetic, not `(part / total) * 100`: in floating
 * point 29 / 100 * 100 is 28.999…, which would floor to 28.
 */
export function percentFloor(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0 || part <= 0) return 0;
  return Math.min(100, Math.floor((Math.trunc(part) * 100) / Math.trunc(total)));
}

/** "3 / 5 passed (60%)". */
export function completionLabel(summary: Pick<QaReportSummary, "passed" | "totalItems">): string {
  const percent = percentFloor(summary.passed, summary.totalItems);
  return `${summary.passed} / ${summary.totalItems} passed (${percent}%)`;
}

const SUMMARY_FIELDS: ReadonlyArray<[QaRunItemStatus, keyof QaReportSummary]> = [
  ["passed", "passed"],
  ["failed", "failed"],
  ["blocked", "blocked"],
  ["returned_to_dev", "returnedToDev"],
  ["in_progress", "inProgress"],
  ["pending", "pending"],
];

/** Each status's count from the summary, in bar order, zero counts dropped. */
export function summaryBreakdown(
  summary: QaReportSummary,
): Array<{ status: QaRunItemStatus; count: number }> {
  return SUMMARY_FIELDS.map(([status, field]) => ({ status, count: Number(summary[field]) || 0 }))
    .filter((entry) => entry.count > 0);
}

/* ── Items and sign-offs ────────────────────────────────────────────────── */

export function orderedItems(items: ReadonlyArray<QaRunItem>): QaRunItem[] {
  return [...items].sort((a, b) => a.position - b.position);
}

/**
 * Superseded sign-offs, oldest first — the same chronological order the
 * backend Markdown uses, so the PDF and the PR comment agree. The current one
 * is `run.signoff`.
 */
export function previousSignoffs(
  history: ReadonlyArray<QaReportSignoffEntry>,
): QaReportSignoffEntry[] {
  return history
    .filter((entry) => entry.supersededAt !== null)
    .sort((a, b) => Date.parse(a.signedAt) - Date.parse(b.signedAt));
}

/* ── File names and links ───────────────────────────────────────────────── */

/**
 * One file-name segment: anything outside [A-Za-z0-9._-] becomes "-", runs of
 * "-" collapse, and leading dots/dashes go (no hidden or flag-like names).
 */
export function sanitizeFilenamePart(value: string | null | undefined): string {
  const cleaned = (value ?? "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+/, "")
    .replace(/-$/, "");
  return cleaned || "unknown";
}

/** The repository's own name: the last segment of "owner/repo". */
function repoName(repoFullName: string): string {
  return repoFullName.split("/").pop() || repoFullName;
}

/**
 * "QA-Report-orders-api-main-a1b2c3d" — no extension. Matches the backend's
 * Content-Disposition name (repo name, not owner/repo) so a report downloads
 * under one name whichever side produced it.
 */
export function reportBaseName(report: Pick<QaReport, "project" | "run">): string {
  const repo = sanitizeFilenamePart(
    report.project.repoFullName ? repoName(report.project.repoFullName) : report.project.name,
  );
  const branch = sanitizeFilenamePart(report.run.branch);
  const sha = sanitizeFilenamePart(report.run.commitSha?.slice(0, 7));
  return `QA-Report-${repo}-${branch}-${sha}`;
}

export function reportFilename(
  report: Pick<QaReport, "project" | "run">,
  extension: "json" | "md" | "pdf" | "xlsx",
): string {
  return `${reportBaseName(report)}.${extension}`;
}

/** The printable report page. `print` asks it to open the print dialog once. */
export function reportPageHref(projectId: string, runId: string, options: { print?: boolean } = {}): string {
  const path = `/projects/${encodeURIComponent(projectId)}/qa/report/${encodeURIComponent(runId)}`;
  return options.print ? `${path}?print=1` : path;
}

/** The project page opened on its QA Studio tab (the tab id is "qa"). */
export function qaStudioHref(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}#qa`;
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

function errorStatus(cause: unknown): number | null {
  if (typeof cause !== "object" || cause === null) return null;
  const status = (cause as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

export interface QaReportErrorCopy {
  title: string;
  text: string;
  /** True when signing in again is the fix. */
  signIn: boolean;
}

/** Why the report page has nothing to show, as a title and a next step. */
export function reportErrorCopy(cause: unknown): QaReportErrorCopy {
  const status = errorStatus(cause);
  if (status === 404) {
    return {
      title: "This report is not available",
      text: "The QA run may have been removed, or you no longer have access to its project.",
      signIn: false,
    };
  }
  if (status === 401) {
    return { title: "Sign in to view this report", text: "Your session has ended.", signIn: true };
  }
  return {
    title: "The report did not load",
    text: "Something went wrong while building it. Try again in a moment.",
    signIn: false,
  };
}

/** The Excel report's media type, as the server sends it. */
export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** What went wrong with an export action, phrased for the person who clicked it. */
export function exportErrorMessage(
  action: "copy-fetch" | "copy-clipboard" | "download" | "download-excel",
  cause: unknown,
): string {
  if (errorStatus(cause) === 404) return "This run's report is not available any more. Reload the run.";
  if (action === "copy-clipboard") {
    return "Your browser blocked clipboard access, so nothing was copied. Allow clipboard access for this site, or use Download JSON.";
  }
  if (action === "copy-fetch") return "The Markdown report could not be fetched. Try again in a moment.";
  if (action === "download-excel") return "The Excel report could not be downloaded. Try again in a moment.";
  return "The JSON report could not be downloaded. Try again in a moment.";
}
