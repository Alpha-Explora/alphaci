/**
 * How the Verify stage's visual checks read: which screenshots come first,
 * what the header counts, which approve buttons show, and what an approval
 * that failed says.
 *
 * Every decision is here rather than in JSX so the wording and the precedence
 * are tested. Pure: no React, no fetch.
 */

import type { AppRole } from "@/shared/api/contracts";
import { ApiError } from "@/shared/api/request";

import { apiErrorReason } from "./api-error-reason";
import type {
  VisualBranch,
  VisualChecksResponse,
  VisualSnapshot,
  VisualSnapshotStatus,
} from "./visual-check-types";

/* ── Where visual checks exist ───────────────────────────────────────────── */

const VISUAL_BRANCHES: readonly string[] = ["uat", "main"];

/**
 * Only the hosted tiers are screenshotted: the generated pipelines run the
 * browser tests against the deployed uat and main sites, and dev has none.
 */
export function isVisualBranch(branch: string): branch is VisualBranch {
  return VISUAL_BRANCHES.includes(branch);
}

/**
 * The GitHub run to ask about: the Verify stage's own run, or null (the
 * branch's latest) when the report carries no usable run id.
 */
export function visualRequestRunId(runId: number | null | undefined): number | null {
  return typeof runId === "number" && Number.isInteger(runId) && runId > 0 ? runId : null;
}

/* ── Image URLs ──────────────────────────────────────────────────────────── */

/**
 * A full URL for an image path the backend sent without the `/api/v1` prefix.
 *
 * Only a root-relative API path is accepted: the images are served with the
 * session cookie, so an absolute or protocol-relative URL would send the
 * browser somewhere this product does not control. Anything else is null and
 * the pane says there is no image.
 */
export function visualImageUrl(apiBaseUrl: string, path: string | null): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return `${apiBaseUrl.replace(/\/+$/, "")}${path}`;
}

/** The response with every image path resolved to a full URL. */
export function withImageUrls(
  response: VisualChecksResponse,
  apiBaseUrl: string,
): VisualChecksResponse {
  if (response.runId === null) return response;
  return {
    ...response,
    snapshots: response.snapshots.map((snapshot) => ({
      ...snapshot,
      baselineUrl: visualImageUrl(apiBaseUrl, snapshot.baselineUrl),
      actualUrl: visualImageUrl(apiBaseUrl, snapshot.actualUrl),
      diffUrl: visualImageUrl(apiBaseUrl, snapshot.diffUrl),
    })),
  };
}

/* ── Order and counts ────────────────────────────────────────────────────── */

export interface VisualGroups {
  changed: VisualSnapshot[];
  added: VisualSnapshot[];
  passed: VisualSnapshot[];
}

function byName(a: VisualSnapshot, b: VisualSnapshot): number {
  return a.name.localeCompare(b.name);
}

/**
 * Changed first, then new, then passed — the order someone has to act in. A
 * changed screenshot is the one that may be a regression; a new one only
 * needs a first reference; a passing one needs nothing. Names sort within a
 * group so the list does not reshuffle between runs.
 */
export function groupSnapshots(snapshots: readonly VisualSnapshot[]): VisualGroups {
  const pick = (status: VisualSnapshotStatus) =>
    snapshots.filter((snapshot) => snapshot.status === status).sort(byName);
  return { changed: pick("changed"), added: pick("new"), passed: pick("passed") };
}

export interface VisualCounts {
  changed: number;
  added: number;
  passed: number;
}

export function visualCounts(snapshots: readonly VisualSnapshot[]): VisualCounts {
  const groups = groupSnapshots(snapshots);
  return {
    changed: groups.changed.length,
    added: groups.added.length,
    passed: groups.passed.length,
  };
}

/**
 * "Visual checks · 2 changed · 1 new · 5 unchanged". A zero is left out — "0
 * changed" is noise beside a count that is not zero — unless every count is
 * zero, which is said once.
 */
export function visualHeader(counts: VisualCounts): string {
  const parts = [
    counts.changed > 0 ? `${String(counts.changed)} changed` : null,
    counts.added > 0 ? `${String(counts.added)} new` : null,
    counts.passed > 0 ? `${String(counts.passed)} unchanged` : null,
  ].filter((part): part is string => part !== null);
  return ["Visual checks", ...(parts.length > 0 ? parts : ["no screenshots captured"])].join(" · ");
}

/** "Visual: 2 changed" for the stage's summary, or null when nothing changed. */
export function visualChipLabel(response: VisualChecksResponse | null): string | null {
  if (!response) return null;
  const { changed } = visualCounts(response.snapshots);
  return changed > 0 ? `Visual: ${String(changed)} changed` : null;
}

/** True when any `main` screenshot is still compared with uat's reference. */
export function inheritsUatReferences(snapshots: readonly VisualSnapshot[]): boolean {
  return snapshots.some((snapshot) => snapshot.inheritedFrom === "uat");
}

/** "No visual checks reported for uat yet. They run …". */
export function visualEmptyMessage(branch: string): string {
  return `No visual checks reported for ${branch} yet. They run with the browser tests after each deploy.`;
}

/* ── Approving ───────────────────────────────────────────────────────────── */

/**
 * Whether one screenshot can be approved: changed or new, not yet the
 * reference, and with a captured image to become it. The backend refuses the
 * whole batch if any name fails this, so the client must not offer it.
 */
export function isApprovable(snapshot: VisualSnapshot): boolean {
  return snapshot.status !== "passed" && !snapshot.approved && snapshot.actualUrl !== null;
}

/** Every name "Approve all" sends: changed, then new, each approvable. */
export function approvableNames(snapshots: readonly VisualSnapshot[]): string[] {
  const groups = groupSnapshots(snapshots);
  return [...groups.changed, ...groups.added].filter(isApprovable).map((snapshot) => snapshot.name);
}

/**
 * "Approve all (3)". Explicit because there is no confirmation and no undo:
 * the button has to say what it is about to do.
 */
export function approveAllLabel(count: number): string {
  return `Approve all (${String(count)})`;
}

export const APPROVE_ONE_LABEL = "Approve new look";

export const NEW_SNAPSHOT_NOTE = "No reference yet — approve to make this the reference.";

const APPROVER_ROLES: readonly AppRole[] = ["member", "lead", "admin"];

export const VISUAL_ROLE_NOTE = "Only developers, team leads and admins can approve visual changes.";

/** Why a panel is read-only: the viewer's role, or a run that is not the latest. */
export type VisualReadOnlyReason = "role" | "not-latest";

/**
 * Why approve buttons are hidden, or null when they show.
 *
 * The backend says only `canApprove: false`; it is false for a role that
 * cannot approve and for an older run, which need different sentences. The
 * viewer's own role tells them apart. An unknown role reads as the role
 * reason, as it does on the server: it approves nothing.
 */
export function visualReadOnlyReason(input: {
  canApprove: boolean;
  appRole: AppRole | null | undefined;
  /** The server answered an approval with VISUAL_APPROVE_ROLE_FORBIDDEN. */
  roleForbidden: boolean;
}): VisualReadOnlyReason | null {
  const roleMayApprove = input.appRole != null && APPROVER_ROLES.includes(input.appRole);
  if (input.roleForbidden || !roleMayApprove) return "role";
  return input.canApprove ? null : "not-latest";
}

/** The read-only note's sentence. */
export function visualReadOnlyNote(reason: VisualReadOnlyReason, branch: string): string {
  return reason === "role"
    ? VISUAL_ROLE_NOTE
    : `This is not the latest visual run for ${branch}, so it can't be approved here.`;
}

/**
 * The response once the server confirmed `approved`: those screenshots read
 * as approved before the refetch lands, and stay so if the refetch fails.
 */
export function markApproved(
  response: VisualChecksResponse,
  approved: readonly string[],
): VisualChecksResponse {
  if (response.runId === null) return response;
  const names = new Set(approved);
  return {
    ...response,
    snapshots: response.snapshots.map((snapshot) =>
      names.has(snapshot.name) ? { ...snapshot, approved: true } : snapshot,
    ),
  };
}

/* ── An approval that failed ─────────────────────────────────────────────── */

export type VisualApproveErrorKind =
  | "superseded"
  | "not-approvable"
  | "forbidden"
  | "not-found"
  | "failed";

export interface VisualApproveError {
  kind: VisualApproveErrorKind;
  message: string;
  /** Superseded: the run that can be approved instead. */
  latestRunId: number | null;
  /** Not approvable: the names the server refused. */
  names: string[];
}

function errorBody(cause: unknown): Record<string, unknown> | null {
  if (!(cause instanceof ApiError)) return null;
  const body = cause.details;
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
}

function bodyCode(body: Record<string, unknown> | null): string {
  return typeof body?.code === "string" ? body.code.toUpperCase() : "";
}

function bodyNames(body: Record<string, unknown> | null): string[] {
  const names = body?.names;
  return Array.isArray(names) ? names.filter((name): name is string => typeof name === "string") : [];
}

function bodyRunId(body: Record<string, unknown> | null): number | null {
  return typeof body?.latestRunId === "number" ? body.latestRunId : null;
}

function notApprovableMessage(names: readonly string[]): string {
  const subject = names.length === 0 ? "some screenshots" : names.join(", ");
  return `Nothing was approved: ${subject} can't be approved — already passing, unknown, or without a captured screenshot.`;
}

const CODE_KINDS: Readonly<Record<string, VisualApproveErrorKind>> = {
  VISUAL_RUN_SUPERSEDED: "superseded",
  VISUAL_NOT_APPROVABLE: "not-approvable",
  VISUAL_APPROVE_ROLE_FORBIDDEN: "forbidden",
  VISUAL_RUN_NOT_FOUND: "not-found",
};

const FIXED_MESSAGES: Readonly<Record<Exclude<VisualApproveErrorKind, "not-approvable" | "failed">, string>> = {
  superseded:
    "Not approved: a newer visual run has been reported for this branch. Load it and approve its screenshots instead.",
  forbidden: VISUAL_ROLE_NOTE,
  "not-found": "Not approved: that visual run is no longer available. Load the latest run and try again.",
};

/**
 * What a refused approval says, by the backend's `code` (case-insensitive,
 * like every other code this feature reads). An unrecognised error falls
 * back to the server's own sentence, then to a generic one.
 */
export function visualApproveError(cause: unknown): VisualApproveError {
  const body = errorBody(cause);
  const kind = CODE_KINDS[bodyCode(body)] ?? "failed";
  const names = kind === "not-approvable" ? bodyNames(body) : [];
  let message: string;
  if (kind === "not-approvable") message = notApprovableMessage(names);
  else if (kind === "failed") message = apiErrorReason(cause, "The approval could not be saved. Try again in a moment.");
  else message = FIXED_MESSAGES[kind];
  return {
    kind,
    message,
    latestRunId: kind === "superseded" ? bodyRunId(body) : null,
    names,
  };
}

/** Whether a refusal is answered with a "Load latest run" button. */
export function offersLoadLatest(error: VisualApproveError | null): boolean {
  return error?.kind === "superseded" || error?.kind === "not-found";
}
