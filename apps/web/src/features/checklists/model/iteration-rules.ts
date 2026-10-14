/* Project Iterations: reading them off the wire, naming them, and every way a
 * Merge all repositories can end. Pure: no React, no fetch, no Next.
 *
 * The server alone decides when an iteration is Delivered (every covered
 * repository's main contains the signed-off uat head) and who may merge.
 * Nothing here can make an iteration look delivered or a Project look
 * mergeable on its own: `canMergeAll` and `delivered` are true only when the
 * server sent exactly `true`. */

import type { AppRole } from "@/shared/api/contracts";

import type {
  CoveredRepository,
  CurrentIteration,
  DeliveredRepository,
  DeliveryHow,
  IterationRef,
  IterationStatus,
  MergeAllError,
  MergeAllErrorKind,
  MergeAllRepositoryResult,
  MergeAllResult,
  ProjectIteration,
} from "./iteration-types";
import { normalizeCarryOver } from "./iteration-carry-over-rules";
import { QA_ERROR_MESSAGES, qaCodeMessage } from "./qa-error-messages";
import { shortSha } from "./qa-run-rules";
import {
  errorCode,
  errorDetails,
  errorMessage,
  errorStatus,
  oneOf,
  positiveInt,
  record,
  records,
  text,
  texts,
  type Loose,
} from "./wire-readers";

const STATUSES: ReadonlyArray<IterationStatus> = ["active", "delivered"];
const HOWS: ReadonlyArray<DeliveryHow> = ["merged", "already_in_main"];

/* ── Reading the wire ────────────────────────────────────────────────────── */

/** `{ id, number, status }`, or null when any of the three is missing. */
export function normalizeIterationRef(value: unknown): IterationRef | null {
  const raw = record(value);
  const id = text(raw?.id);
  const number = positiveInt(raw?.number);
  const status = oneOf(raw?.status, STATUSES);
  if (!id || !number || !status) return null;
  return { id, number, status };
}

/** A login sent as text (`deliveredByLogin`) or inside an actor (`deliveredBy.login`). */
function deliveredLogin(raw: Loose): string | null {
  return text(raw.deliveredByLogin) ?? text(record(raw.deliveredBy)?.login);
}

export function normalizeIteration(value: unknown): ProjectIteration | null {
  const ref = normalizeIterationRef(value);
  const raw = record(value);
  if (!ref || !raw) return null;
  return {
    ...ref,
    goal: text(raw.goal),
    deliveredAt: text(raw.deliveredAt),
    deliveredByLogin: deliveredLogin(raw),
  };
}

function deliveredRepositoryFrom(raw: Loose): DeliveredRepository | null {
  const projectId = text(raw.projectId);
  const how = oneOf(raw.how, HOWS);
  if (!projectId || !how) return null;
  return {
    projectId,
    repoFullName: text(raw.repoFullName) ?? "Repository",
    how,
    mergeSha: text(raw.mergeSha),
    prNumber: positiveInt(raw.prNumber),
  };
}

function coveredRepositoryFrom(raw: Loose): CoveredRepository | null {
  const projectId = text(raw.projectId);
  if (!projectId) return null;
  const how = oneOf(raw.how, HOWS);
  return {
    projectId,
    repoFullName: text(raw.repoFullName) ?? "Repository",
    // A stated `how` is proof enough; otherwise only an explicit `true`.
    delivered: raw.delivered === true || how !== null,
    how,
  };
}

function present<T>(value: T | null): value is T {
  return value !== null;
}

/**
 * The current-iteration answer, or null when it names no iteration (a body
 * that is not one, or a backend that sends something else): the caller then
 * shows nothing iteration-related at all.
 */
export function normalizeCurrentIteration(value: unknown): CurrentIteration | null {
  const raw = record(value) ?? {};
  const iteration = normalizeIteration(raw.iteration);
  if (!iteration) return null;
  const canStartNext = typeof raw.canStartNext === "boolean" ? raw.canStartNext : null;
  return {
    iteration,
    deliveredRepositories: records(raw.deliveredRepositories).map(deliveredRepositoryFrom).filter(present),
    coveredRepositories: records(raw.coveredRepositories).map(coveredRepositoryFrom).filter(present),
    canMergeAll: raw.canMergeAll === true,
    canStartNext,
    // The candidates mean something only to a viewer the server lets start.
    carryOver: canStartNext === true ? normalizeCarryOver(raw.carryOver) : null,
  };
}

function mergeAllRowFrom(raw: Loose): MergeAllRepositoryResult | null {
  const projectId = text(raw.projectId);
  if (!projectId) return null;
  return {
    projectId,
    repoFullName: text(raw.repoFullName) ?? "Repository",
    merged: raw.merged === true,
    how: oneOf(raw.how, HOWS),
    message: text(raw.message),
  };
}

export function normalizeMergeAll(value: unknown): MergeAllResult {
  const raw = record(value) ?? {};
  return {
    repositories: records(raw.repositories).map(mergeAllRowFrom).filter(present),
    delivered: raw.delivered === true,
    iteration: normalizeIteration(raw.iteration),
  };
}

/* ── Names and dates ─────────────────────────────────────────────────────── */

export function iterationName(number: number): string {
  return `Iteration ${String(number)}`;
}

/** "Iteration 4 · Loyalty points" with a goal, "Iteration 4" without. */
export function iterationTitle(iteration: { number: number; goal?: string | null }): string {
  const goal = iteration.goal?.trim();
  return goal ? `${iterationName(iteration.number)} · ${goal}` : iterationName(iteration.number);
}

/**
 * A date in the viewer's locale ("14 Oct" in en-GB, "Oct 14" in en-US), or
 * null when there is none or it is not a date. `locale` is for tests; the
 * screens pass nothing, so the browser's own locale decides.
 */
export function iterationDateLabel(
  iso: string | null,
  options: { withYear?: boolean; locale?: string } = {},
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(options.locale, {
    day: "numeric",
    month: "short",
    year: options.withYear ? "numeric" : undefined,
  }).format(date);
}

/** "Iteration 3 · Active", "Iteration 3 · Delivered 14 Oct", or with a goal "Iteration 4 · Loyalty points · Active". */
export function iterationStatusLabel(
  iteration: Pick<ProjectIteration, "number" | "status" | "deliveredAt"> & { goal?: string | null },
  locale?: string,
): string {
  const name = iterationTitle(iteration);
  if (iteration.status === "active") return `${name} · Active`;
  const date = iterationDateLabel(iteration.deliveredAt, { locale });
  return date ? `${name} · Delivered ${date}` : `${name} · Delivered`;
}

/** The delivered iteration's number, when changes are locked; null while active or unknown. */
export function lockedIterationNumber(
  iteration: Pick<IterationRef, "number" | "status"> | null | undefined,
): number | null {
  return iteration?.status === "delivered" ? iteration.number : null;
}

/** The read-only banner on a delivered iteration's QA run and requirements. */
export function iterationLockedText(number: number): string {
  return `${iterationName(number)} was delivered. Changes are locked.`;
}

/** "Iteration 3 delivered on 14 Oct 2026 by @ana" (with its goal: "Iteration 3 · Loyalty points delivered …"). */
export function deliveredBannerTitle(
  iteration: Pick<ProjectIteration, "number" | "deliveredAt" | "deliveredByLogin"> & { goal?: string | null },
  locale?: string,
): string {
  const date = iterationDateLabel(iteration.deliveredAt, { withYear: true, locale });
  const on = date ? ` on ${date}` : "";
  const by = iteration.deliveredByLogin ? ` by @${iteration.deliveredByLogin}` : "";
  return `${iterationTitle(iteration)} delivered${on}${by}`;
}

/* ── How each repository reached main ────────────────────────────────────── */

const HOW_LABELS: Record<DeliveryHow, string> = {
  merged: "Merged into main",
  already_in_main: "Already in main",
};

export function deliveryHowLabel(how: DeliveryHow): string {
  return HOW_LABELS[how];
}

/** "Merged into main · PR #12 · merge commit abc1234", or "Already in main". */
export function deliveredRepositoryDetail(
  repository: Pick<DeliveredRepository, "how" | "prNumber" | "mergeSha">,
): string {
  const parts = [deliveryHowLabel(repository.how)];
  if (repository.prNumber) parts.push(`PR #${String(repository.prNumber)}`);
  const sha = shortSha(repository.mergeSha);
  if (sha) parts.push(`merge commit ${sha}`);
  return parts.join(" · ");
}

export interface DeliveryRowState {
  tone: "success" | "neutral" | "danger";
  label: string;
}

/** A covered repository on an active iteration: in main already, or not yet. */
export function coveredRepositoryState(repository: Pick<CoveredRepository, "delivered" | "how">): DeliveryRowState {
  if (!repository.delivered) return { tone: "neutral", label: "Not in main yet" };
  return { tone: "success", label: repository.how ? deliveryHowLabel(repository.how) : "In main" };
}

/** One row of a Merge all answer. `already_in_main` with `merged: false` is a success, never an error. */
export function mergeAllRowState(row: Pick<MergeAllRepositoryResult, "merged" | "how">): DeliveryRowState {
  if (row.how) return { tone: "success", label: deliveryHowLabel(row.how) };
  if (row.merged) return { tone: "success", label: HOW_LABELS.merged };
  return { tone: "danger", label: "Not merged" };
}

/** The repositories a Merge all did not get into main: what Retry merges. */
export function mergeAllFailures(result: Pick<MergeAllResult, "repositories">): MergeAllRepositoryResult[] {
  return result.repositories.filter((row) => mergeAllRowState(row).tone === "danger");
}

/** The answer's headline. */
export function mergeAllSummary(result: MergeAllResult): string {
  if (result.delivered) {
    return result.iteration ? `${iterationName(result.iteration.number)} delivered.` : "Iteration delivered.";
  }
  const failed = mergeAllFailures(result).length;
  if (failed === 0) return "Every repository reached main.";
  const reached = result.repositories.length - failed;
  return `${String(reached)} of ${String(result.repositories.length)} repositories reached main. Retry merges only the rest.`;
}

/* ── Who is offered Merge all repositories ───────────────────────────────── */

/** Product owners (`lead`) and admins merge, as for one repository. */
function roleCanDeliver(role: AppRole | null | undefined): boolean {
  return role === "lead" || role === "admin";
}

/** The covered repositories whose main does not contain the signed-off head yet. */
export function pendingRepositories(current: Pick<CurrentIteration, "coveredRepositories">): CoveredRepository[] {
  return current.coveredRepositories.filter((repository) => !repository.delivered);
}

/**
 * More than one covered repository, the server's `canMergeAll`, an active
 * iteration and a lead or admin. The role check can only hide the button.
 */
export function canOfferMergeAll(
  current: CurrentIteration | null,
  role: AppRole | null | undefined,
): boolean {
  if (!current?.canMergeAll || current.iteration.status !== "active") return false;
  return current.coveredRepositories.length > 1 && roleCanDeliver(role);
}

export function mergeAllConfirmText(projectName: string, pending: ReadonlyArray<Pick<CoveredRepository, "repoFullName">>): string {
  const names = pending.map((repository) => repository.repoFullName).join(", ");
  return `Merge uat into main in every repository of ${projectName} that is not in main yet (${names}), one after another, with your GitHub account. ALPHACI keeps going if one fails, and the iteration is delivered when the last one lands.`;
}

/* ── A Merge all that was refused ────────────────────────────────────────── */

const CODE_KINDS: Record<string, MergeAllErrorKind> = {
  ITERATION_DELIVERED: "delivered",
  QA_PROMOTION_BLOCKED: "blocked",
  PROJECT_HAS_NO_REPOSITORIES: "no_repositories",
  GITHUB_REAUTH: "reauth",
};

const STATUS_KINDS: Record<number, MergeAllErrorKind> = { 401: "reauth", 403: "forbidden", 404: "not_found" };

function kindOf(cause: unknown): MergeAllErrorKind {
  const byCode = CODE_KINDS[errorCode(cause)];
  if (byCode) return byCode;
  const status = errorStatus(cause);
  return (status !== null && STATUS_KINDS[status]) || "failed";
}

const FIXED_COPY: Partial<Record<MergeAllErrorKind, string>> = {
  no_repositories: QA_ERROR_MESSAGES.PROJECT_HAS_NO_REPOSITORIES,
  forbidden: "Only a Product owner or admin can merge this Project's repositories into main.",
  not_found: "This Project could not be found, or this server cannot merge a whole Project yet.",
};

function copyFor(kind: MergeAllErrorKind, cause: unknown): string {
  if (kind === "delivered") return qaCodeMessage(cause) ?? QA_ERROR_MESSAGES.ITERATION_DELIVERED;
  if (kind === "blocked") {
    return errorMessage(cause) ?? "QA has not signed off this Project's current uat heads as Approved, so nothing was merged.";
  }
  if (kind === "reauth") {
    return errorStatus(cause) === 401
      ? "Your session has ended. Sign in again to merge."
      : "GitHub needs you to sign in again before ALPHACI can merge for you.";
  }
  return FIXED_COPY[kind] ?? errorMessage(cause) ?? "The merge could not be completed. Try again in a moment.";
}

export function mergeAllError(cause: unknown): MergeAllError {
  const kind = kindOf(cause);
  return {
    kind,
    message: copyFor(kind, cause),
    reasons: kind === "blocked" ? texts(errorDetails(cause)?.reasons) : [],
    signIn: kind === "reauth",
  };
}

const ERROR_TITLES: Record<MergeAllErrorKind, string> = {
  delivered: "Already delivered",
  blocked: "Not merged — QA approval is incomplete",
  no_repositories: "Nothing to merge",
  forbidden: "Not merged",
  reauth: "Sign in again to merge",
  not_found: "Not merged",
  failed: "Not merged",
};

export function mergeAllErrorTitle(kind: MergeAllErrorKind): string {
  return ERROR_TITLES[kind];
}

/** Refusals after which the iteration and the promotion status must be read again. */
export function mergeAllErrorRefreshes(error: Pick<MergeAllError, "kind">): boolean {
  return error.kind === "delivered" || error.kind === "blocked" || error.kind === "no_repositories";
}
