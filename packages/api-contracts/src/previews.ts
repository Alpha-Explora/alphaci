/**
 * Per-environment previews: each branch's current deployment.
 *
 * GET /projects/:id/previews returns ProjectPreviewsResponse.
 */

import type {
  DeploymentHistoryStatus,
  DeploymentProvider,
  DeploymentSlot,
} from './deployments.js';

/**
 * What a deployment card shows in its media slot: a live log tail for a
 * backend target whose provider serves logs, the page thumbnail otherwise.
 */
export type PreviewSurface = 'page' | 'logs';

/**
 * `not_deployed` is an environment that exists and has never been released to.
 *
 * Not a DeploymentHistoryStatus: nothing ran, so there is nothing for a
 * provider to report. The branch is still a real environment with a real
 * address, and a project provisioned an hour ago is made entirely of them.
 */
export type ProjectBranchPreviewStatus =
  DeploymentHistoryStatus | 'not_deployed';

/** One of an environment's recent deploys, as its Overview card lists them. */
export interface ProjectPreviewDeploy {
  id: string;
  status: DeploymentHistoryStatus;
  commitSha: string | null;
  commitMessage: string | null;
  /** What started it, in the provider's word; null where the provider does not say. */
  trigger: string | null;
  createdAt: string;
  /** When the provider began it; the duration runs from here (or createdAt) to readyAt. */
  startedAt: string | null;
  readyAt: string | null;
}

/**
 * One branch's current deployment.
 *
 * The unit is the branch, not the deployment: a branch's preview is whatever
 * its newest deployment is, which is also what Vercel's own branch alias
 * resolves to. A push to a branch updates that branch's card in place instead
 * of appending a row.
 */
export interface ProjectBranchPreview {
  branch: string;
  /** True for the branch the provider deploys to production. */
  isProduction: boolean;
  /** Null when nothing has been deployed to this environment yet. */
  deploymentId: string | null;
  targetId: string;
  targetName: string;
  provider: DeploymentProvider;
  /** The target's role. Null only for an older or degraded source that cannot report it. */
  slot: DeploymentSlot | null;
  surface: PreviewSurface;
  /** Display name for `provider`, falling back to the id when the provider is not in the catalog. */
  providerLabel: string;
  /** Whether this provider both declares and implements log retrieval. */
  logsAvailable: boolean;
  /**
   * The window a `logs` surface tails: from the current deployment's start to
   * now (`endTime: null` means live). Null when nothing is deployed yet.
   */
  logWindow: { startTime: string; endTime: string | null } | null;
  status: ProjectBranchPreviewStatus;
  commitSha: string | null;
  commitMessage: string | null;
  /** Set when the branch's newest deployment was built for a pull request. */
  pullRequestNumber: number | null;
  /** Who started the newest deployment, when the provider says. */
  createdBy: string | null;
  /** What started the newest deployment, in the provider's word. */
  trigger: string | null;
  /**
   * The URL to open, and to frame when `embeddable` is true: the environment's
   * stable address where it has one (the provider's domain for the branch,
   * which keeps pointing at its newest release), otherwise the deployment's
   * own address.
   */
  previewUrl: string | null;
  /**
   * This one deployment's own address. On Vercel it is unique per deployment
   * and sits behind deployment protection, so it is linked, never framed.
   */
  deploymentUrl: string | null;
  inspectorUrl: string | null;
  /** Null for an environment with no deployment to date. */
  createdAt: string | null;
  startedAt: string | null;
  readyAt: string | null;
  /**
   * This environment's newest deploys, newest first, the current one included.
   * Empty when nothing is deployed.
   */
  recentDeploys: ProjectPreviewDeploy[];
  /**
   * Null means undetermined: the UI must not frame it, but should still link
   * it. A browser fires no error event for an X-Frame-Options refusal, so an
   * unverified embed shows an unexplained blank box.
   */
  embeddable: boolean | null;
  embedBlockedReason: string | null;
}

export interface ProjectPreviewsResponse {
  enabled: boolean;
  /** False when no provider integration is connected, so the list is empty rather than live. */
  liveProvidersEnabled: boolean;
  branches: ProjectBranchPreview[];
  /**
   * Safe message when a provider could not be reached, so an empty list is not
   * read as "no branch has been deployed".
   */
  providerError: string | null;
}
