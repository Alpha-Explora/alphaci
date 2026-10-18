/* Pure rules for the project detail surface. No React, no Next, no fetch. */
import { ApiError } from "@/shared/api/request";

import type {
  ProjectBranchPreview,
  ProjectBranchPreviewSurface,
  ProjectPreviewsResponse,
} from "./projects-types";

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
  superseded: "Replaced",
  unknown: "Unknown",
  not_deployed: "Not deployed yet",
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
  /*
   * An environment, not a failure. It exists, it has an address, and nothing
   * has been released to it - so the reader is told what will fill it rather
   * than shown an error for something that has not gone wrong.
   */
  if (preview.status === "not_deployed") {
    return preview.previewUrl
      ? `Nothing has been deployed here yet. The first release to ${preview.branch} appears at this address.`
      : `Nothing has been deployed here yet. The first release to ${preview.branch} appears here.`;
  }
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

/**
 * The strict sandbox: what every framed deployment gets at minimum, and all it
 * gets when its origin cannot be told apart from the dashboard's.
 */
export const PREVIEW_FRAME_SANDBOX = "allow-scripts allow-forms allow-popups";

/**
 * The sandbox for one framed deployment, given the dashboard's own origin.
 *
 * Without `allow-same-origin` the framed page runs in an opaque origin, so any
 * site that touches cookies or storage at boot throws and never gets past its
 * loader. Granting it is only an escape when the page shares the dashboard's
 * origin: `allow-scripts` would then let it reach into the parent and strip
 * its own sandbox. A cross-origin page cannot touch the parent either way, so
 * it gets its real origin; a same-origin, non-http(s) or unparseable address,
 * or an origin not known yet, gets the strict sandbox. One function, so the
 * thumbnail and the full viewport cannot drift apart.
 */
export function previewFrameSandbox(
  frameUrl: string,
  dashboardOrigin: string | null,
): string {
  if (!dashboardOrigin) return PREVIEW_FRAME_SANDBOX;
  let frame: URL;
  try {
    frame = new URL(frameUrl);
  } catch {
    return PREVIEW_FRAME_SANDBOX;
  }
  const isWeb = frame.protocol === "https:" || frame.protocol === "http:";
  if (!isWeb || frame.origin === dashboardOrigin) return PREVIEW_FRAME_SANDBOX;
  return `${PREVIEW_FRAME_SANDBOX} allow-same-origin`;
}

export type OverviewPreviews = {
  /** At most one per target: the Production Deployment cards. */
  production: ProjectBranchPreview[];
  /**
   * A backend's other named environments (uat), each its own card with live
   * logs and recent deploys, like Production: a JSON API has no page to show
   * in a row, and its logs are what a reader opens it for.
   */
  environments: ProjectBranchPreview[];
  /** Everything else, in the order received: the Active branches rows. */
  branches: ProjectBranchPreview[];
};

/** The branches besides main that get an environment card when their service shows logs. */
const ENVIRONMENT_CARD_BRANCHES = new Set(["uat"]);

function isEnvironmentCard(preview: ProjectBranchPreview): boolean {
  return previewSurface(preview) === "logs" && ENVIRONMENT_CARD_BRANCHES.has(preview.branch.toLowerCase());
}

/**
 * The Overview's split: a production card per target, every other branch a row.
 *
 * Per target, because a project with a frontend and a backend slot has a
 * production environment for each and neither is "the" one. At most one per
 * target, because a provider can label a second branch's deployment
 * production - Vercel reports the deploy target, and the platform deploys
 * every branch through it - which drew that branch as a second, identical
 * card. The list arrives production-first, so the first one a target offers
 * keeps the card and any other becomes a row like the rest.
 */
export function splitOverviewPreviews(
  previews: ProjectPreviewsResponse | null,
): OverviewPreviews {
  const production: ProjectBranchPreview[] = [];
  const environments: ProjectBranchPreview[] = [];
  const branches: ProjectBranchPreview[] = [];
  const carded = new Set<string>();

  for (const preview of previews?.branches ?? []) {
    if (preview.isProduction && !carded.has(preview.targetId)) {
      carded.add(preview.targetId);
      production.push(preview);
    } else if (!preview.isProduction && isEnvironmentCard(preview)) {
      environments.push(preview);
    } else {
      branches.push(preview);
    }
  }

  return { production, environments, branches };
}

/** "Production Deployment", "UAT Deployment": a card's title, from its environment. */
export function deploymentCardTitle(preview: Pick<ProjectBranchPreview, "isProduction" | "branch">): string {
  return `${environmentName(preview)} Deployment`;
}

/** "Production", "UAT", "Staging": an environment's name, as its tab and card say it. */
export function environmentName(preview: Pick<ProjectBranchPreview, "isProduction" | "branch">): string {
  if (preview.isProduction) return "Production";
  const branch = preview.branch.trim();
  return branch.length <= 3 ? branch.toUpperCase() : `${branch.slice(0, 1).toUpperCase()}${branch.slice(1)}`;
}

/** "main · live": the line under an environment tab's name. */
export function environmentTabLine(preview: Pick<ProjectBranchPreview, "branch" | "status">): string {
  return `${preview.branch} · ${previewStatusLabel(preview.status).toLowerCase()}`;
}

const TAB_STEPS: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/** WAI-ARIA tabs: the tab a key moves to from `index`, wrapping; null for any other key. */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  const step = TAB_STEPS[key];
  if (step === undefined) return null;
  return (index + step + count) % count;
}

/** "https://web-app.vercel.app/" -> "web-app.vercel.app". Unparseable URLs pass through. */
export function displayHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Coarse relative time for a deployment: "just now", "12m ago", "5h ago",
 * "3d ago". Reads the clock, so a caller that needs determinism passes `now`.
 */
export function deployedAgo(iso: string, now: number = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** "2h ago by tone", "2h ago", or what to say when nothing has deployed. */
export function createdLabel(
  preview: Pick<ProjectBranchPreview, "createdAt" | "createdBy">,
  now: number = Date.now(),
): string {
  if (!preview.createdAt) return "Nothing deployed yet";
  const ago = deployedAgo(preview.createdAt, now);
  return preview.createdBy ? `${ago} by ${preview.createdBy}` : ago;
}

export function previewProviderLabel(
  provider: ProjectBranchPreview["provider"],
): string {
  return provider === "vercel" ? "Vercel" : "Render";
}

/**
 * The host's display name: the backend's provider descriptor label, or the
 * older fixed rule when a backend predates the field.
 */
export function previewHostLabel(
  preview: Pick<ProjectBranchPreview, "provider" | "providerLabel">,
): string {
  return preview.providerLabel || previewProviderLabel(preview.provider);
}

/**
 * What the card's media slot shows. The backend decides (a backend target on
 * a host that serves logs gets `logs`); a backend older than the field gets
 * the page, which is all it could show before.
 */
export function previewSurface(
  preview: Pick<ProjectBranchPreview, "surface">,
): ProjectBranchPreviewSurface {
  return preview.surface === "logs" ? "logs" : "page";
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
