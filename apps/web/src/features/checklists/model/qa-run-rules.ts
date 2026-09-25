/* Pure QA run rules: labels, what a viewer may do, signoff eligibility and
 * error copy. No React, no fetch.
 *
 * Every "may" here MIRRORS a server rule and is never looser than it. The
 * server's own answers (item.canUpdate, run.permissions) are always ANDed in,
 * so a rule here can only hide a control the server would allow, never show
 * one it would refuse. */

import type { AppRole } from "@/shared/api/contracts";

import type {
  QaActionError,
  QaCommitSource,
  QaDefectSeverity,
  QaItemDraft,
  QaRun,
  QaRunItem,
  QaRunItemStatus,
  QaVerdict,
  QaSignoffInput,
  UpdateQaRunItemInput,
} from "./qa-run-types";

/* ── Labels ─────────────────────────────────────────────────────────────── */

const STATUS_LABELS: Record<QaRunItemStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  passed: "Passed",
  failed: "Failed",
  blocked: "Blocked",
  returned_to_dev: "Returned to dev",
};

const SEVERITY_LABELS: Record<QaDefectSeverity, string> = {
  blocker: "Blocker",
  major: "Major",
  minor: "Minor",
};

const VERDICT_LABELS: Record<QaVerdict, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CONDITIONAL: "Conditional",
};

/** Every status, in the order a tester moves through them. */
export const QA_ITEM_STATUSES: ReadonlyArray<QaRunItemStatus> = [
  "pending",
  "in_progress",
  "passed",
  "failed",
  "blocked",
  "returned_to_dev",
];

export const QA_SEVERITIES: ReadonlyArray<QaDefectSeverity> = ["blocker", "major", "minor"];

/** In the order a signer weighs them: approve, approve with conditions, reject. */
export const QA_VERDICTS: ReadonlyArray<QaVerdict> = ["APPROVED", "CONDITIONAL", "REJECTED"];

export function itemStatusLabel(status: QaRunItemStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function severityLabel(severity: QaDefectSeverity): string {
  return SEVERITY_LABELS[severity] ?? severity;
}

export function verdictLabel(verdict: QaVerdict): string {
  return VERDICT_LABELS[verdict] ?? verdict;
}

export type QaTone = "success" | "danger" | "warning" | "brand" | "neutral";

const STATUS_TONES: Record<QaRunItemStatus, QaTone> = {
  pending: "neutral",
  in_progress: "brand",
  passed: "success",
  failed: "danger",
  blocked: "danger",
  returned_to_dev: "warning",
};

export function itemStatusTone(status: QaRunItemStatus): QaTone {
  return STATUS_TONES[status] ?? "neutral";
}

const VERDICT_TONES: Record<QaVerdict, QaTone> = {
  APPROVED: "success",
  CONDITIONAL: "warning",
  REJECTED: "danger",
};

export function verdictTone(verdict: QaVerdict): QaTone {
  return VERDICT_TONES[verdict] ?? "neutral";
}

export function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : "";
}

/** "main @ abc1234". */
export function commitLabel(branch: string, sha: string | null | undefined): string {
  const short = shortSha(sha);
  return short ? `${branch} @ ${short}` : branch;
}

/** Whether the commit under test is what is actually deployed. */
export function commitSourceLabel(source: QaCommitSource | null): string | null {
  if (source === "deployment") return "deployed";
  if (source === "branch_head") return "not deployed — testing the branch head";
  return null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Coarse relative time: "just now", "12m ago", "5h ago", "3d ago". */
export function agoLabel(
  iso: string | null | undefined,
  now: number = Date.now(),
): string {
  const at = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(at)) return "";
  const elapsed = Math.max(0, now - at);
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  return `${Math.floor(elapsed / DAY)}d ago`;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/* ── What the viewer may do ─────────────────────────────────────────────── */

export function isSignedOff(run: Pick<QaRun, "status">): boolean {
  return run.status === "signed_off";
}

/**
 * Starting a run is a QA Team, Team lead or Admin job. The server enforces it;
 * this only decides whether to offer the button or explain who can.
 */
export function roleCanStartRun(role: AppRole | null | undefined): boolean {
  return role === "qa" || role === "lead" || role === "admin";
}

/**
 * The returned-items list carries no run permissions, so the Overview card
 * mirrors `permissions.canRequestRetest` from the role: the people who fix a
 * returned item are Developers, Team leads and Admins. QA Team members return
 * items; they do not mark their own returns fixed. The server still decides.
 */
export function roleCanRequestRetest(role: AppRole | null | undefined): boolean {
  return role === "member" || role === "lead" || role === "admin";
}

/** Whether this viewer may change this item at all, on this run. */
export function canEditItem(
  item: Pick<QaRunItem, "canUpdate">,
  run: Pick<QaRun, "status" | "permissions">,
): boolean {
  return !isSignedOff(run) && run.permissions.canUpdateItems && item.canUpdate;
}

/**
 * The statuses this viewer can move an item to. Empty when the item is
 * read-only for them. "Returned to dev" only with the run's permission.
 */
export function allowedItemStatuses(
  item: Pick<QaRunItem, "canUpdate">,
  run: Pick<QaRun, "status" | "permissions">,
): QaRunItemStatus[] {
  if (!canEditItem(item, run)) return [];
  return QA_ITEM_STATUSES.filter(
    (status) => status !== "returned_to_dev" || run.permissions.canReturnToDev,
  );
}

/** Failed and Returned to dev must say how bad it is before they are sent. */
export function statusNeedsSeverity(status: QaRunItemStatus): boolean {
  return status === "failed" || status === "returned_to_dev";
}

/** Statuses that describe a defect, so severity and repro steps apply. */
export function statusShowsDefect(status: QaRunItemStatus): boolean {
  return status === "failed" || status === "blocked" || status === "returned_to_dev";
}

export function canRequestRetest(
  item: Pick<QaRunItem, "status">,
  run: Pick<QaRun, "status" | "permissions">,
): boolean {
  return (
    !isSignedOff(run) &&
    run.permissions.canRequestRetest &&
    item.status === "returned_to_dev"
  );
}

/* ── Item drafts ─────────────────────────────────────────────────────────── */

export function itemDraftFrom(
  item: Pick<QaRunItem, "status" | "notes" | "defectSeverity" | "reproductionSteps">,
  status: QaRunItemStatus = item.status,
): QaItemDraft {
  return {
    status,
    notes: item.notes ?? "",
    defectSeverity: item.defectSeverity ?? "",
    reproductionSteps: item.reproductionSteps ?? "",
  };
}

/** Why a draft cannot be saved yet, or null when it can. */
export function itemDraftError(draft: QaItemDraft): string | null {
  if (statusNeedsSeverity(draft.status) && !draft.defectSeverity) {
    return `Choose a severity before marking this item ${itemStatusLabel(draft.status)}.`;
  }
  return null;
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * The PATCH body for a draft: the rowVersion read, plus only the fields that
 * changed. Null when nothing changed, so an idle Save sends nothing.
 */
export function itemUpdatePayload(
  item: Pick<
    QaRunItem,
    "status" | "notes" | "defectSeverity" | "reproductionSteps" | "rowVersion"
  >,
  draft: QaItemDraft,
): UpdateQaRunItemInput | null {
  const body: UpdateQaRunItemInput = { expectedRowVersion: item.rowVersion };
  const notes = textOrNull(draft.notes);
  const steps = textOrNull(draft.reproductionSteps);
  const severity = draft.defectSeverity || null;
  if (draft.status !== item.status) body.status = draft.status;
  if (notes !== (item.notes ?? null)) body.notes = notes;
  if (severity !== (item.defectSeverity ?? null)) body.defectSeverity = severity;
  if (steps !== (item.reproductionSteps ?? null)) body.reproductionSteps = steps;
  return Object.keys(body).length > 1 ? body : null;
}

/* ── Summary ─────────────────────────────────────────────────────────────── */

export function passedLabel(run: Pick<QaRun, "summary">): string {
  return `${run.summary.byStatus.passed ?? 0}/${run.summary.total} passed`;
}

export function openDefectsLabel(count: number): string {
  return plural(count, "open defect", "open defects");
}

export function blockersLabel(count: number): string {
  return plural(count, "blocker", "blockers");
}

/** Each status's share of the run, for the progress bar. Zero shares dropped. */
export function statusSegments(
  run: Pick<QaRun, "summary">,
): Array<{ status: QaRunItemStatus; count: number; percent: number }> {
  const total = run.summary.total;
  if (total <= 0) return [];
  return QA_ITEM_STATUSES.map((status) => {
    const count = run.summary.byStatus[status] ?? 0;
    return { status, count, percent: (count / total) * 100 };
  }).filter((segment) => segment.count > 0);
}

/** "Last run on abc1234: Failed", or null on a first run. */
export function previousResultLabel(item: Pick<QaRunItem, "previous">): string | null {
  if (!item.previous) return null;
  return `Last run on ${shortSha(item.previous.commitSha)}: ${itemStatusLabel(item.previous.status)}`;
}

/* ── Signoff ─────────────────────────────────────────────────────────────── */

export interface VerdictEligibility {
  verdict: QaVerdict;
  allowed: boolean;
  /** Why it is not allowed, phrased for the signer. Null when allowed. */
  reason: string | null;
}

function countWhere(
  items: ReadonlyArray<Pick<QaRunItem, "status">>,
  test: (status: QaRunItemStatus) => boolean,
): number {
  return items.filter((item) => test(item.status)).length;
}

function approvedReason(items: ReadonlyArray<Pick<QaRunItem, "status">>): string | null {
  if (items.length === 0) return "This run has no items to approve.";
  const notPassed = countWhere(items, (status) => status !== "passed");
  if (notPassed === 0) return null;
  return `${plural(notPassed, "item is", "items are")} not passed yet.`;
}

function conditionalReason(items: ReadonlyArray<Pick<QaRunItem, "status">>): string | null {
  const open = countWhere(items, (status) => status === "pending" || status === "in_progress");
  if (open === 0) return null;
  return `${plural(open, "item is", "items are")} still pending or in progress.`;
}

/**
 * Which verdicts the run can take now. Approved needs every item passed;
 * Conditional needs nothing left pending or in progress (and conditions,
 * checked on submit); Rejected is always open.
 */
export function signoffEligibility(
  run: Pick<QaRun, "items">,
): VerdictEligibility[] {
  const reasons: Record<QaVerdict, string | null> = {
    APPROVED: approvedReason(run.items),
    CONDITIONAL: conditionalReason(run.items),
    REJECTED: null,
  };
  return QA_VERDICTS.map((verdict) => ({
    verdict,
    allowed: reasons[verdict] === null,
    reason: reasons[verdict],
  }));
}

/** The first verdict the run can take, preferring Approved. */
export function defaultVerdict(run: Pick<QaRun, "items">): QaVerdict {
  return signoffEligibility(run).find((entry) => entry.allowed)?.verdict ?? "REJECTED";
}

export function signoffError(
  run: Pick<QaRun, "items">,
  verdict: QaVerdict,
  conditions: string,
): string | null {
  const entry = signoffEligibility(run).find((candidate) => candidate.verdict === verdict);
  if (entry && !entry.allowed) return entry.reason;
  if (verdict === "CONDITIONAL" && !conditions.trim()) {
    return "Write the conditions this approval depends on.";
  }
  return null;
}

/** The signoff body: trimmed text, empty fields left out, conditions only when Conditional. */
export function signoffPayload(
  verdict: QaVerdict,
  summary: string,
  conditions: string,
): QaSignoffInput {
  const body: QaSignoffInput = { verdict };
  const trimmedSummary = summary.trim();
  const trimmedConditions = conditions.trim();
  if (trimmedSummary) body.summary = trimmedSummary;
  if (verdict === "CONDITIONAL" && trimmedConditions) body.conditions = trimmedConditions;
  return body;
}

/* ── Errors ──────────────────────────────────────────────────────────────── */

function errorStatus(cause: unknown): number | null {
  if (typeof cause !== "object" || cause === null) return null;
  const status = (cause as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

/** The server's own message, when it sent one. Nest sends arrays for validation. */
function serverMessage(cause: unknown): string | null {
  const details = (cause as { details?: { message?: unknown } } | null)?.details;
  const message = details?.message;
  if (Array.isArray(message)) {
    const joined = message.filter((part) => typeof part === "string").join(" ");
    return joined || null;
  }
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

function serverCode(cause: unknown): string {
  const details = (cause as { details?: { code?: unknown } } | null)?.details;
  return typeof details?.code === "string" ? details.code.toLowerCase() : "";
}

/** Codes the backend sends on the 409s a reload resolves (stale item, run changed mid-signoff). */
const STALE_CODES = new Set(["qa_item_stale", "qa_run_changed"]);

/** Fallback for a backend that predates the codes. */
const STALE_PATTERN = /row ?version|stale|changed since|modified|someone else/;

export const STALE_RUN_MESSAGE =
  "Someone else updated this item since you loaded the run. Reload the run to see their change, then try again.";

/** True for the 409 a reload fixes: the item moved on since the viewer read it. */
export function isStaleRunConflict(cause: unknown): boolean {
  if (errorStatus(cause) !== 409) return false;
  if (STALE_CODES.has(serverCode(cause))) return true;
  const text = `${serverCode(cause)} ${(serverMessage(cause) ?? "").toLowerCase()}`;
  return STALE_PATTERN.test(text);
}

function fallbackFor(status: number | null, fallback: string): string {
  if (status === 403) return "Your role cannot make this change.";
  if (status === 404) return "This QA run no longer exists, or you no longer have access to it.";
  return fallback;
}

/**
 * Any thrown error to something a view can show. 409s and 400s carry the
 * server's own sentence (no commit found, not every item passed, conditions
 * required…); a stale rowVersion is flagged so the view can offer a reload.
 */
export function qaActionError(cause: unknown, fallback: string): QaActionError {
  const status = errorStatus(cause);
  const stale = isStaleRunConflict(cause);
  const message = serverMessage(cause);
  if (stale) return { message: message ?? STALE_RUN_MESSAGE, stale: true };
  if (message && (status === 400 || status === 403 || status === 409)) {
    return { message, stale: false };
  }
  return { message: fallbackFor(status, fallback), stale: false };
}
