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

import { iterationDateLabel, iterationName, normalizeIterationRef } from "./iteration-rules";
import { normalizeHeads } from "./project-run-rules";
import { QA_ERROR_MESSAGES, qaCodeMessage } from "./qa-error-messages";
import type {
  QaPromotionChecklist,
  QaPromotionIteration,
  QaPromotionMergeError,
  QaPromotionMergeErrorKind,
  QaPromotionMergeResult,
  QaPromotionPullRequest,
  QaPromotionRun,
  QaPromotionScope,
  QaPromotionStatus,
} from "./qa-promotion-types";
import { QA_VERDICTS, shortSha, verdictLabel, type QaTone } from "./qa-run-rules";
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
const SCOPES: ReadonlyArray<QaPromotionScope> = ["project", "unfiled"];

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

function deliveryProjectFrom(value: unknown): QaPromotionStatus["deliveryProject"] {
  const raw = record(value);
  const id = text(raw?.id);
  return id ? { id, name: text(raw?.name) ?? "Project" } : null;
}

function promotionRunFrom(value: unknown): QaPromotionRun | null {
  const raw = record(value);
  const id = text(raw?.id);
  if (!id) return null;
  return { id, verdict: oneOf(raw?.verdict, QA_VERDICTS), signedAt: text(raw?.signedAt), stale: raw?.stale === true };
}

function promotionIterationFrom(value: unknown): QaPromotionIteration | null {
  const ref = normalizeIterationRef(value);
  return ref ? { ...ref, deliveredAt: text(record(value)?.deliveredAt) } : null;
}

/** The stored delivery state (Iterations phase 2). All absent on an older backend. */
function deliveryFrom(raw: Loose) {
  return {
    repositoryDelivered: typeof raw.repositoryDelivered === "boolean" ? raw.repositoryDelivered : null,
    iterationDelivered: raw.iterationDelivered === true,
    iteration: promotionIterationFrom(raw.iteration),
  };
}

/** The Project-level gate fields (design 3.2). All absent on an older backend. */
function projectGateFrom(raw: Loose) {
  return {
    scope: oneOf(raw.scope, SCOPES),
    deliveryProject: deliveryProjectFrom(raw.deliveryProject),
    run: promotionRunFrom(raw.run),
    repositories: normalizeHeads(raw.repositories),
    requirementsChanged: raw.requirementsChanged === true,
  };
}

/**
 * Any input to a status the card can render. Absent lists are empty, absent
 * flags are false, and a PR without a number and an https URL is no PR. The
 * deprecated `checklists` list is kept: it is the only gate an older backend
 * describes.
 */
export function normalizePromotionStatus(value: unknown): QaPromotionStatus {
  const raw = record(value) ?? {};
  return {
    ...projectGateFrom(raw),
    ...deliveryFrom(raw),
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
    alreadyInMain: !merged && raw.how === "already_in_main",
  };
}

/* ── What the card says ──────────────────────────────────────────────────── */

type DeliveryFlags = Partial<Pick<QaPromotionStatus, "iterationDelivered" | "iteration">>;

/** "Iteration 3 delivered", once the server says the Project's iteration reached main. */
export function deliveredTitle(status: DeliveryFlags): string {
  return status.iteration ? `${iterationName(status.iteration.number)} delivered` : "Delivered to production";
}

/**
 * The card's line on a delivered iteration, in place of what blocks the merge:
 * "Iteration 3 delivered on 14 Oct 2026. Every repository's main holds the
 * signed-off uat head." `locale` is for tests.
 */
export function deliveredNote(
  status: DeliveryFlags & Pick<QaPromotionStatus, "qaBranch" | "targetBranch">,
  locale?: string,
): string {
  const date = iterationDateLabel(status.iteration?.deliveredAt ?? null, { withYear: true, locale });
  const when = date ? ` on ${date}` : "";
  return `${deliveredTitle(status)}${when}. Every repository's ${status.targetBranch} holds the signed-off ${status.qaBranch} head.`;
}

export function promotionTitle(status: Pick<QaPromotionStatus, "eligible"> & DeliveryFlags): string {
  if (status.iterationDelivered) return deliveredTitle(status);
  return status.eligible ? "Ready for production" : "Not ready for production";
}

/**
 * The tab bar's status chip: green once the server says uat is eligible,
 * amber while it is not, grey while the answer is loading or could not be
 * read. `label` is the full sentence (the chip's accessible name); `short`
 * is what a narrow column shows.
 */
export type PromotionChipTone = "ready" | "blocked" | "unknown" | "delivered";

export interface PromotionChip {
  tone: PromotionChipTone;
  label: string;
  short: string;
}

export function promotionChip(
  load: "loading" | "ready" | "error",
  status: (Pick<QaPromotionStatus, "eligible"> & DeliveryFlags) | null,
): PromotionChip {
  if (status?.iterationDelivered) return { tone: "delivered", label: deliveredTitle(status), short: "Delivered" };
  if (status) {
    const label = promotionTitle(status);
    return status.eligible
      ? { tone: "ready", label, short: "Ready" }
      : { tone: "blocked", label, short: "Not ready" };
  }
  if (load === "loading") return { tone: "unknown", label: "Checking production readiness", short: "Checking" };
  return { tone: "unknown", label: "Production readiness unknown", short: "Unknown" };
}

/** "uat @ 9f8e7d6 → main". */
export function promotionRoute(
  status: Pick<QaPromotionStatus, "qaBranch" | "targetBranch" | "headSha">,
): string {
  const head = shortSha(status.headSha);
  const from = head ? `${status.qaBranch} @ ${head}` : status.qaBranch;
  return `${from} → ${status.targetBranch}`;
}

/** Where the Project's latest signed-off run stands, in a few words. */
export function promotionRunState(
  status: Pick<QaPromotionStatus, "run">,
): PromotionChecklistState {
  const run = status.run;
  if (!run?.verdict) return { tone: "neutral", label: "No signed-off Project QA run yet", approved: false };
  if (run.stale) return { tone: "warning", label: "Project run is stale: uat moved since sign-off", approved: false };
  if (run.verdict === "APPROVED") return { tone: "success", label: "Project run approved for the current heads", approved: true };
  if (run.verdict === "CONDITIONAL") {
    return { tone: "warning", label: `Conditional — ${PROMOTION_TARGET_BRANCH} needs Approved`, approved: false };
  }
  return { tone: "danger", label: `Latest sign-off is ${verdictLabel(run.verdict)}`, approved: false };
}

/** "1 of 2 checklists approved", or that nothing is shared. */
export function approvedCountLabel(
  status: Pick<QaPromotionStatus, "checklists"> & Partial<Pick<QaPromotionStatus, "scope" | "run">>,
): string {
  if (status.scope === "unfiled") return "Not filed under a Project";
  if (status.scope === "project") return promotionRunState({ run: status.run ?? null }).label;
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
export const UNFILED_REASON = QA_ERROR_MESSAGES.QA_PROJECT_REQUIRED;

/**
 * The server's reasons in Project words, for those who never see
 * repositories: a stale run ("…"orders-api" moved from…") and an unreadable
 * head ("Could not read the uat head of "web"") become one Project sentence
 * each; every other reason is already about the Project and is kept.
 */
export function projectReasons(reasons: ReadonlyArray<string>): string[] {
  const words = reasons.map((reason) => {
    if (/^Project run is stale: ".+"/.test(reason)) return "The Project's code on uat changed since QA signed it off.";
    if (reason.startsWith("Could not read the uat head of")) return "ALPHACI could not read the Project's uat build. Try again in a moment.";
    return reason;
  });
  return [...new Set(words)];
}

export function blockingReasons(
  status: Pick<QaPromotionStatus, "eligible" | "reasons" | "checklists" | "qaBranch"> &
    Partial<Pick<QaPromotionStatus, "scope" | "iterationDelivered">>,
): string[] {
  // Delivered is not blocked: there is simply nothing left to merge.
  if (status.eligible || status.iterationDelivered) return [];
  if (status.reasons.length > 0) return status.reasons;
  if (status.scope === "unfiled") return [UNFILED_REASON];
  if (status.scope === "project") {
    return [`The Project's latest signed-off QA run must be Approved on every repository's current ${status.qaBranch} head.`];
  }
  if (status.checklists.length === 0) return ["No QA checklist is shared with this project yet."];
  return [`Every shared checklist must be signed off Approved on ${status.qaBranch}'s current commit.`];
}

/* ── Merge to main ───────────────────────────────────────────────────────── */

/** Team leads and Admins merge; QA Team reads the same status. */
export function roleCanMerge(role: AppRole | null | undefined): boolean {
  return role === "lead" || role === "admin";
}

/**
 * Whether to draw the button at all: the server's answer AND the role. A
 * delivered iteration has none: the delivered banner takes its place.
 */
export function canOfferMerge(
  status: Pick<QaPromotionStatus, "canMerge"> & Partial<Pick<QaPromotionStatus, "iterationDelivered">>,
  role: AppRole | null | undefined,
): boolean {
  return status.canMerge && roleCanMerge(role) && !status.iterationDelivered;
}

type MergeReasonStatus = Pick<QaPromotionStatus, "eligible" | "headSha" | "qaBranch" | "targetBranch"> &
  Partial<Pick<QaPromotionStatus, "scope" | "repositoryDelivered" | "iterationDelivered" | "iteration">>;

/**
 * Whether this repository's main already holds uat's head: the server's
 * stored answer (`repositoryDelivered`) when it sends one, else (an older
 * backend) whether this viewer just merged exactly this head.
 */
function alreadyInMain(status: MergeReasonStatus, mergedHead: string | null): boolean {
  return status.repositoryDelivered ?? (mergedHead !== null && mergedHead === status.headSha);
}

/**
 * Why the button is disabled, or null when it can be pressed. `mergedHead` is
 * the uat commit this viewer just merged: merging it again has nothing to do.
 */
export function mergeDisabledReason(status: MergeReasonStatus, mergedHead: string | null): string | null {
  if (status.scope === "unfiled") return UNFILED_REASON;
  if (status.iterationDelivered) return `${deliveredTitle(status)}: every repository is already in ${status.targetBranch}.`;
  if (!status.headSha) return `${status.qaBranch}'s current commit could not be resolved.`;
  if (!status.eligible && status.scope === "project") {
    return `Merging opens once the Project's latest QA run is signed off Approved on every repository's current ${status.qaBranch} head.`;
  }
  if (!status.eligible) {
    return `Merging opens once every shared checklist is signed off Approved on ${status.qaBranch} @ ${shortSha(status.headSha)}.`;
  }
  if (alreadyInMain(status, mergedHead)) {
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
  `A reviewer must approve the pull request, or ${PROMOTION_TARGET_BRANCH}'s branch rules must allow this merge. Then try again.`;

export function mergedLabel(result: Pick<QaPromotionMergeResult, "sha">, targetBranch: string): string {
  const sha = shortSha(result.sha);
  return sha ? `${targetBranch} updated · merge commit ${sha}` : `${targetBranch} updated`;
}

/* ── A merge that failed ─────────────────────────────────────────────────── */

const CODE_KINDS: Record<string, QaPromotionMergeErrorKind> = {
  QA_PROMOTION_BLOCKED: "blocked",
  QA_UAT_MOVED: "moved",
  GITHUB_REAUTH: "reauth",
  QA_PROJECT_REQUIRED: "project_required",
  ITERATION_DELIVERED: "delivered",
  PROJECT_HAS_NO_REPOSITORIES: "no_repositories",
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

/** The kinds whose sentence never depends on what the server said. */
const FIXED_COPY: Partial<Record<QaPromotionMergeErrorKind, string>> = {
  project_required: UNFILED_REASON,
  moved: `${QA_BRANCH} moved after QA signed off, so the commit QA approved is no longer ${QA_BRANCH}'s head. The status is refreshed: QA must verify the new commit before it can be merged.`,
  forbidden: `Only a Product owner or admin can merge ${QA_BRANCH} into ${PROMOTION_TARGET_BRANCH}.`,
  not_found: `This project, or its ${QA_BRANCH} → ${PROMOTION_TARGET_BRANCH} pull request, could not be found.`,
  no_repositories: QA_ERROR_MESSAGES.PROJECT_HAS_NO_REPOSITORIES,
};

function copyFor(kind: QaPromotionMergeErrorKind, cause: unknown): string {
  const fixed = FIXED_COPY[kind];
  if (fixed) return fixed;
  const server = errorMessage(cause);
  if (kind === "blocked") return server ?? `QA has not approved every shared checklist on ${QA_BRANCH}'s current commit.`;
  if (kind === "delivered") return qaCodeMessage(cause) ?? QA_ERROR_MESSAGES.ITERATION_DELIVERED;
  if (kind === "reauth") {
    return errorStatus(cause) === 401
      ? "Your session has ended. Sign in again to merge."
      : "GitHub needs you to sign in again before ALPHACI can merge for you.";
  }
  return server ?? "The merge could not be completed. Try again in a moment.";
}

const ERROR_TITLES: Record<QaPromotionMergeErrorKind, string> = {
  blocked: "Not merged — QA approval is incomplete",
  moved: `Not merged — ${QA_BRANCH} moved since sign-off`,
  reauth: "Sign in again to merge",
  project_required: "Not merged — this repository is not in a Project",
  delivered: "Not merged — this iteration was already delivered",
  no_repositories: "Nothing to merge",
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

const REFRESHING_KINDS: ReadonlySet<QaPromotionMergeErrorKind> = new Set<QaPromotionMergeErrorKind>([
  "blocked",
  "moved",
  "project_required",
  "delivered",
]);

/** Outcomes after which the status is stale and must be read again. */
export function mergeErrorRefreshesStatus(error: Pick<QaPromotionMergeError, "kind">): boolean {
  return REFRESHING_KINDS.has(error.kind);
}
