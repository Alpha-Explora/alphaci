/* Pure rules for the project detail surface. No React, no Next, no fetch. */
import { ApiError } from "@/shared/api/request";

import type { ProjectBranchPreview } from "./projects-types";

/** Status-badge variant for a provisioned project. */
export function projectStatusVariant(status: string): string {
  if (status === "provisioned") return "provisioned";
  if (status === "provisioning" || status === "pending") return "provisioning";
  return "failed";
}

/**
 * Whether a repository sits outside the org the product provisions into.
 *
 * Only labels already-attached repositories; existing external attachments are
 * left alone by design. Unknown org means no claim either way.
 */
export function isExternalRepo(
  repoFullName: string,
  enforcedOrg?: string,
): boolean {
  if (!enforcedOrg) return false;
  return repoFullName.split("/")[0]?.toLowerCase() !== enforcedOrg.toLowerCase();
}

/**
 * Message for a failed overview load.
 *
 * 404 is called out separately because it usually means the project was
 * disconnected rather than that something broke, and saying "retry" there would
 * send someone round a loop that cannot succeed.
 */
export function toOverviewError(cause: unknown): string {
  if (cause instanceof ApiError && cause.status === 404) {
    return "This project could not be found. It may have been disconnected.";
  }
  return "Could not load this project. Please retry.";
}

export function routeProjectId(
  params: { projectId?: string } | null | undefined,
): string {
  return params?.projectId ?? "";
}

export function overviewProject<T>(
  overview: { project: T } | null | undefined,
): T | null {
  return overview?.project ?? null;
}

export function projectRepoFullName(
  project: { repoFullName?: string } | null,
): string | null {
  return project?.repoFullName ?? null;
}

export function isSignedInMember(status: string, guest: boolean): boolean {
  return status === "signed-in" && !guest;
}

export function reducedMotionFlag(value: boolean | null): boolean {
  return value ?? false;
}

/* ── Branch previews ──────────────────────────────────────────────────────── */

export type PreviewStatusTone = "ok" | "pending" | "danger";

const PREVIEW_STATUS_LABELS: Record<
  ProjectBranchPreview["status"],
  string
> = {
  queued: "Queued",
  building: "Building",
  ready: "Live",
  failed: "Failed",
  canceled: "Canceled",
  unknown: "Unknown",
};

export function previewStatusLabel(
  status: ProjectBranchPreview["status"],
): string {
  return PREVIEW_STATUS_LABELS[status];
}

export function previewStatusTone(
  status: ProjectBranchPreview["status"],
): PreviewStatusTone {
  if (status === "failed" || status === "canceled") return "danger";
  if (status === "ready") return "ok";
  return "pending";
}

/**
 * Whether the preview should actually be framed.
 *
 * Requires both a confirmed-embeddable verdict and a live deployment. A browser
 * fires no error event when X-Frame-Options refuses an embed, so anything less
 * than a positive server-side verdict would render an unexplained blank box.
 */
export function canFramePreview(preview: ProjectBranchPreview): boolean {
  return (
    preview.embeddable === true &&
    preview.status === "ready" &&
    Boolean(preview.previewUrl)
  );
}

/**
 * Why a preview is not being framed, phrased for the reader.
 *
 * Distinguishes "not ready yet" from "the site refuses to be framed", because
 * the first resolves itself and the second never will.
 */
export function previewUnavailableReason(
  preview: ProjectBranchPreview,
): string {
  if (preview.status === "queued" || preview.status === "building") {
    return "This branch is still deploying. The preview appears once it is live.";
  }
  if (preview.status === "failed" || preview.status === "canceled") {
    return "The last deployment for this branch did not finish, so there is nothing to preview yet.";
  }
  if (!preview.previewUrl) {
    return "This deployment did not report a URL to preview.";
  }
  return (
    preview.embedBlockedReason ??
    "This deployment cannot be shown inline. Open it in a new tab to view it."
  );
}

/** Stable key for a branch card. One branch can be deployed by two targets. */
export function previewKey(preview: ProjectBranchPreview): string {
  return `${preview.targetId}:${preview.branch}`;
}

/** Short commit for display, or null when the provider reported none. */
export function shortCommitSha(commitSha: string | null): string | null {
  return commitSha ? commitSha.slice(0, 7) : null;
}

/* ── Custom domains ───────────────────────────────────────────────────────── */

export type DomainStatusTone = "ok" | "pending" | "danger";

/**
 * What a domain's state means to the reader.
 *
 * `verified` and `misconfigured` answer different questions — one is "do you
 * own it", the other "does DNS point here" — and a domain can be verified and
 * still serve nothing. Collapsing them into one badge would call that ready.
 */
export function domainStatus(domain: {
  verified: boolean;
  misconfigured: boolean | null;
  lastErrorSafeMessage: string | null;
}): { label: string; tone: DomainStatusTone } {
  if (!domain.verified) {
    return { label: "Pending verification", tone: "pending" };
  }
  if (domain.misconfigured === true) {
    return { label: "DNS not pointed here", tone: "danger" };
  }
  if (domain.misconfigured === null) {
    return { label: "Verified", tone: "pending" };
  }
  return { label: "Live", tone: "ok" };
}

/** What the reader should do next, or null when nothing is required. */
export function domainNextStep(domain: {
  verified: boolean;
  misconfigured: boolean | null;
  verification: Array<{ type: string; domain: string; value: string }>;
}): string | null {
  if (!domain.verified && domain.verification.length > 0) {
    return "Add the record below at your DNS provider, then check again.";
  }
  if (!domain.verified) {
    return "Waiting on the provider to confirm ownership. Check again shortly.";
  }
  if (domain.misconfigured === true) {
    return "Ownership is confirmed, but DNS still points elsewhere. Update the record, then check again.";
  }
  return null;
}

/** Label for which branch a hostname serves. */
export function domainScopeLabel(gitBranch: string | null): string {
  return gitBranch ? `branch: ${gitBranch}` : "production";
}
