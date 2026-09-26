/* Pure promotion rules: reading the promotion status and merge result, what
 * each checklist row says, who is offered "Merge to main", and the copy for
 * every way a merge can end. No React, no fetch.
 *
 * The server decides eligibility (every non-archived shared checklist signed
 * off APPROVED on uat's CURRENT head) and who may merge. Nothing here can make
 * a project look readier than the server says: `eligible` and `canMerge` are
 * true only when the server sent exactly `true`, and the role check below can
 * only hide the button, never show it. */

import type { AppRole } from "@/shared/api/contracts";
import { QA_BRANCH } from "@/shared/api/pipeline-branches";

import type {
  QaPromotionChecklist,
  QaPromotionMergeError,
  QaPromotionMergeErrorKind,
  QaPromotionMergeResult,
  QaPromotionPullRequest,
  QaPromotionStatus,
} from "./qa-promotion-types";
import { QA_VERDICTS, shortSha, type QaTone } from "./qa-run-rules";
import type { QaRunStatus } from "./qa-run-types";
import {
  errorCode,
  errorDetails,
  errorMessage,
  errorStatus,
  httpsUrl,
  positiveInt,
  record,
  records,
  oneOf,
  text,
  texts,
  type Loose,
} from "./wire-readers";

/** Where a QA-approved uat is promoted to. Mirrors the backend's pipeline. */
export const PROMOTION_TARGET_BRANCH = "main";

const RUN_STATUSES: ReadonlyArray<QaRunStatus> = ["open", "signed_off"];

/* ── Reading the status ──────────────────────────────────────────────────── */

function checklistFrom(raw: Loose): QaPromotionChecklist | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    name: text(raw.name) ?? "Untitled checklist",
    runId: text(raw.runId),
    verdict: oneOf(raw.verdict, QA_VERDICTS),
    runStatus: oneOf(raw.runStatus, RUN_STATUSES),
    approvedForHead: raw.approvedForHead === true,
  };
}

function pullRequestFrom(value: unknown): QaPromotionPullRequest | null {
  const raw = record(value);
  const number = positiveInt(raw?.number);
  const url = httpsUrl(raw?.url);
  if (!number || !url) return null;
  return { number, url, headSha: text(raw?.headSha) };
}

/**
 * Any input to a status the card can render. Absent lists are empty, absent
 * flags are false, and a PR without a number and an https URL is no PR.
 */
export function normalizePromotionStatus(value: unknown): QaPromotionStatus {
  const raw = record(value) ?? {};
  return {
    qaBranch: text(raw.qaBranch) ?? QA_BRANCH,
    targetBranch: text(raw.targetBranch) ?? PROMOTION_TARGET_BRANCH,
    headSha: text(raw.headSha),
    checklists: records(raw.checklists)
      .map(checklistFrom)
      .filter((entry): entry is QaPromotionChecklist => entry !== null),
    eligible: raw.eligible === true,
    reasons: texts(raw.reasons),
    pullRequest: pullRequestFrom(raw.pullRequest),
    canMerge: raw.canMerge === true,
  };
}

const MERGED_FALLBACK = `Merged into ${PROMOTION_TARGET_BRANCH}.`;
const REFUSED_FALLBACK = "GitHub did not merge the pull request and gave no reason.";

/** The merge reply. `merged` only when the server said exactly `true`. */
export function normalizePromotionMerge(value: unknown): QaPromotionMergeResult {
  const raw = record(value) ?? {};
  const merged = raw.merged === true;
  const pr = record(raw.pullRequest);
  const number = positiveInt(pr?.number);
  const url = httpsUrl(pr?.url);
  return {
    merged,
    sha: merged ? text(raw.sha) : null,
    message: text(raw.message) ?? (merged ? MERGED_FALLBACK : REFUSED_FALLBACK),
    pullRequest: number && url ? { number, url } : null,
  };
}

/* ── What the card says ──────────────────────────────────────────────────── */

export function promotionTitle(status: Pick<QaPromotionStatus, "eligible">): string {
  return status.eligible ? "Ready for production" : "Not ready for production";
}

/** "uat @ 9f8e7d6 → main". */
export function promotionRoute(
  status: Pick<QaPromotionStatus, "qaBranch" | "targetBranch" | "headSha">,
): string {
  const head = shortSha(status.headSha);
  const from = head ? `${status.qaBranch} @ ${head}` : status.qaBranch;
  return `${from} → ${status.targetBranch}`;
}

/** "1 of 2 checklists approved", or that nothing is shared. */
export function approvedCountLabel(status: Pick<QaPromotionStatus, "checklists">): string {
  const total = status.checklists.length;
  if (total === 0) return "No checklist shared";
  const approved = status.checklists.filter((entry) => entry.approvedForHead).length;
  return `${approved} of ${total} ${total === 1 ? "checklist" : "checklists"} approved`;
}

export interface PromotionChecklistState {
  tone: QaTone;
  label: string;
  approved: boolean;
}

/** Where one checklist stands on uat's current commit, in a few words. */
export function promotionChecklistState(entry: QaPromotionChecklist): PromotionChecklistState {
  if (entry.approvedForHead) return { tone: "success", label: "Approved for this commit", approved: true };
  if (!entry.runId) return { tone: "neutral", label: "Not verified on this commit yet", approved: false };
  if (entry.runStatus !== "signed_off" || !entry.verdict) {
    return { tone: "brand", label: "Run in progress — not signed off yet", approved: false };
  }
  if (entry.verdict === "REJECTED") return { tone: "danger", label: "Signed off Rejected", approved: false };
  if (entry.verdict === "CONDITIONAL") {
    return { tone: "warning", label: `Conditional — ${PROMOTION_TARGET_BRANCH} needs Approved`, approved: false };
  }
  return { tone: "warning", label: "Approved, but not for this commit", approved: false };
}

/**
 * What stops the merge, in the server's words. When a server says "not
 * eligible" without saying why, the card still gives the rule.
 */
export function blockingReasons(
  status: Pick<QaPromotionStatus, "eligible" | "reasons" | "checklists" | "qaBranch">,
): string[] {
  if (status.eligible) return [];
  if (status.reasons.length > 0) return status.reasons;
  if (status.checklists.length === 0) return ["No QA checklist is shared with this project yet."];
  return [`Every shared checklist must be signed off Approved on ${status.qaBranch}'s current commit.`];
}

/* ── Merge to main ───────────────────────────────────────────────────────── */

/** Team leads and Admins merge; QA Team reads the same status. */
export function roleCanMerge(role: AppRole | null | undefined): boolean {
  return role === "lead" || role === "admin";
}

/** Whether to draw the button at all: the server's answer AND the role. */
export function canOfferMerge(
  status: Pick<QaPromotionStatus, "canMerge">,
  role: AppRole | null | undefined,
): boolean {
  return status.canMerge && roleCanMerge(role);
}

/**
 * Why the button is disabled, or null when it can be pressed. `mergedHead` is
 * the uat commit this viewer just merged: merging it again has nothing to do.
 */
export function mergeDisabledReason(
  status: Pick<QaPromotionStatus, "eligible" | "headSha" | "qaBranch" | "targetBranch">,
  mergedHead: string | null,
): string | null {
  if (!status.headSha) return `${status.qaBranch}'s current commit could not be resolved.`;
  if (!status.eligible) {
    return `Merging opens once every shared checklist is signed off Approved on ${status.qaBranch} @ ${shortSha(status.headSha)}.`;
  }
  if (mergedHead && mergedHead === status.headSha) {
    return `${status.qaBranch} @ ${shortSha(status.headSha)} is already merged into ${status.targetBranch}.`;
  }
  return null;
}

/** The confirmation's sentence: project, commit and pull request, named. */
export function mergeConfirmText(
  status: Pick<QaPromotionStatus, "qaBranch" | "targetBranch" | "headSha" | "pullRequest">,
  projectName: string,
): string {
  const pr = status.pullRequest
    ? `pull request #${status.pullRequest.number}`
    : `a new ${status.qaBranch} → ${status.targetBranch} pull request`;
  return `Merge ${projectName} ${status.qaBranch} @ ${shortSha(status.headSha)} into ${status.targetBranch} through ${pr}, with your GitHub account.`;
}

/** Under GitHub's verbatim refusal: what usually unblocks it. */
export const MERGE_REFUSED_HINT =
  `A reviewer must approve the pull request on GitHub, or ${PROMOTION_TARGET_BRANCH}'s branch rules must allow this merge. Then try again.`;

export function mergedLabel(result: Pick<QaPromotionMergeResult, "sha">, targetBranch: string): string {
  const sha = shortSha(result.sha);
  return sha ? `${targetBranch} updated · merge commit ${sha}` : `${targetBranch} updated`;
}

/* ── A merge that failed ─────────────────────────────────────────────────── */

const CODE_KINDS: Record<string, QaPromotionMergeErrorKind> = {
  QA_PROMOTION_BLOCKED: "blocked",
  QA_UAT_MOVED: "moved",
  GITHUB_REAUTH: "reauth",
};

const STATUS_KINDS: Record<number, QaPromotionMergeErrorKind> = {
  401: "reauth",
  403: "forbidden",
  404: "not_found",
};

function kindOf(cause: unknown): QaPromotionMergeErrorKind {
  const byCode = CODE_KINDS[errorCode(cause)];
  if (byCode) return byCode;
  const status = errorStatus(cause);
  return (status !== null && STATUS_KINDS[status]) || "failed";
}

function copyFor(kind: QaPromotionMergeErrorKind, cause: unknown): string {
  const server = errorMessage(cause);
  switch (kind) {
    case "blocked":
      return server ?? `QA has not approved every shared checklist on ${QA_BRANCH}'s current commit.`;
    case "moved":
      return `${QA_BRANCH} moved after QA signed off, so the commit QA approved is no longer ${QA_BRANCH}'s head. The status is refreshed: QA must verify the new commit before it can be merged.`;
    case "reauth":
      return errorStatus(cause) === 401
        ? "Your session has ended. Sign in again to merge."
        : "GitHub needs you to sign in again before ALPHACI can merge for you.";
    case "forbidden":
      return `Only a Team lead or Admin can merge ${QA_BRANCH} into ${PROMOTION_TARGET_BRANCH}.`;
    case "not_found":
      return `This project, or its ${QA_BRANCH} → ${PROMOTION_TARGET_BRANCH} pull request, could not be found.`;
    default:
      return server ?? "The merge could not be completed. Try again in a moment.";
  }
}

const ERROR_TITLES: Record<QaPromotionMergeErrorKind, string> = {
  blocked: "Not merged — QA approval is incomplete",
  moved: `Not merged — ${QA_BRANCH} moved since sign-off`,
  reauth: "Sign in again to merge",
  forbidden: "Not merged",
  not_found: "Not merged",
  failed: "Not merged",
};

export function mergeErrorTitle(kind: QaPromotionMergeErrorKind): string {
  return ERROR_TITLES[kind];
}

/** Any thrown merge error, as the card explains it. */
export function promotionMergeError(cause: unknown): QaPromotionMergeError {
  const kind = kindOf(cause);
  return {
    kind,
    message: copyFor(kind, cause),
    reasons: kind === "blocked" ? texts(errorDetails(cause)?.reasons) : [],
    signIn: kind === "reauth",
  };
}

/** Outcomes the card shows in place (the dialog closes); the rest stay in the dialog to retry. */
export function mergeErrorClosesDialog(error: Pick<QaPromotionMergeError, "kind">): boolean {
  return error.kind !== "failed";
}

/** Outcomes after which the status is stale and must be read again. */
export function mergeErrorRefreshesStatus(error: Pick<QaPromotionMergeError, "kind">): boolean {
  return error.kind === "blocked" || error.kind === "moved";
}
