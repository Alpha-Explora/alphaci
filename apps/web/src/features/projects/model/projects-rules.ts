/* Pure rules for the project detail surface. No React, no Next, no fetch. */
import { ApiError } from "@/lib/api/request";

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
