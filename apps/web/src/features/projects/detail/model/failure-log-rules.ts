/**
 * How a run's failed jobs read: which ones to show, a short preview of each
 * error, and why a log could not be shown.
 *
 * The failure log used to describe one job — whichever failed first — so a
 * run where the stage's jobs passed and `promote-to-uat / Create Promotion PR`
 * failed afterwards showed nothing at all, and a run with two failures showed
 * half the story. The backend now lists every failed job; these rules read
 * that list, and fall back to the single top-level job an older backend sends.
 *
 * Structural input types, so the rules hold for both shapes.
 */

export type LogUnavailableReason = "no-failed-job" | "log-expired" | "log-no-access";

/** One failed job, as the rules read it. */
export interface FailureEntry {
  jobId?: number;
  jobName: string;
  stepName?: string;
  lines: readonly string[];
  truncated: boolean;
  reason?: "log-expired" | "log-no-access";
  hint?: string;
}

/** The fields of the failure-log answer the rules read. */
export interface ReadableFailureLog {
  available: boolean;
  reason?: LogUnavailableReason;
  jobId?: number;
  jobName?: string;
  stepName?: string;
  lines?: readonly string[];
  truncated?: boolean;
  hint?: string;
  failures?: readonly FailureEntry[];
  omittedFailures?: number;
}

/**
 * Every failed job to show. `failures` when the backend sent it; otherwise
 * the one job an older backend describes at the top level, when it has lines.
 * Empty means there is no job to show — see `logUnavailableMessage`.
 */
export function failureEntries(log: ReadableFailureLog): FailureEntry[] {
  if (Array.isArray(log.failures) && log.failures.length > 0) return [...log.failures];
  if (!log.available || !log.lines || log.lines.length === 0) return [];
  return [
    {
      jobId: log.jobId,
      jobName: log.jobName ?? "Failed job",
      stepName: log.stepName,
      lines: log.lines,
      truncated: log.truncated === true,
      hint: log.hint,
    },
  ];
}

/** "+2 more failed jobs" past the backend's cap; null when nothing was left out. */
export function omittedFailuresLabel(log: Pick<ReadableFailureLog, "omittedFailures">): string | null {
  const count = log.omittedFailures;
  if (typeof count !== "number" || count <= 0) return null;
  return `+${String(count)} more failed ${count === 1 ? "job" : "jobs"}`;
}

/** The failed job with this id, for a job row's inline preview. */
export function failureForJob(
  log: ReadableFailureLog | null,
  jobId: number,
): FailureEntry | null {
  return log?.failures?.find((entry) => entry.jobId === jobId) ?? null;
}

const UNAVAILABLE: Record<LogUnavailableReason, string> = {
  "log-expired": "This log has expired (GitHub keeps logs for 90 days).",
  "log-no-access":
    "ALPHACI can't read this log: its GitHub connection has no access to Actions logs for this repository. Ask an admin to check the GitHub App's Actions permission.",
  "no-failed-job":
    "No job in this run reported a failure, which usually means the workflow was rejected before any job started.",
};

/**
 * Why there is no output, said plainly. Expiry is normal and nobody can undo
 * it; no access is a fault an admin can fix, so it says who to ask. An older
 * backend sends no reason with an unreadable job log, and it only ever meant
 * expiry.
 */
export function logUnavailableMessage(reason: LogUnavailableReason | undefined): string {
  return UNAVAILABLE[reason ?? "log-expired"];
}

const ERROR_MARKER = "##[error]";
const EXIT_CODE_ONLY = /^Process completed with exit code \d+\.?$/;
const PREVIEW_LINES = 3;

function stripMarker(line: string): string {
  return line.replace(ERROR_MARKER, "").trim();
}

/**
 * One to three lines that say what went wrong, for a job row.
 *
 * The runner's own "Process completed with exit code 1." is the least useful
 * line in any log, so the preview prefers the tool's error lines, then the
 * lines just above the last error marker — a tool prints why it is unhappy,
 * then exits — and only then the marker itself.
 */
export function failurePreview(lines: readonly string[]): string[] {
  const errors = lines
    .filter((line) => line.includes(ERROR_MARKER))
    .map(stripMarker)
    .filter((line) => line !== "" && !EXIT_CODE_ONLY.test(line));
  if (errors.length > 0) return errors.slice(-PREVIEW_LINES);

  const lastMarker = lines.map((line) => line.includes(ERROR_MARKER)).lastIndexOf(true);
  const before = (lastMarker === -1 ? lines : lines.slice(0, lastMarker))
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (before.length > 0) return before.slice(-PREVIEW_LINES);
  return lastMarker === -1 ? [] : [stripMarker(lines[lastMarker] ?? "")];
}
