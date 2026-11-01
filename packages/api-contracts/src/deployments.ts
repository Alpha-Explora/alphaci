/**
 * Deployment history: what the providers report as having run.
 *
 * GET /projects/:id/deployments returns DeploymentHistoryResponse.
 */

/**
 * A deployment provider id ("render", "vercel", "onprem-compose", ...).
 *
 * Open on purpose: providers are runtime plugins, so the API does not promise a
 * closed list. A client that labels providers needs a fallback for an id it
 * does not know.
 */
export type DeploymentProvider = string;

/** The role a deployment target fills in a project. */
export type DeploymentSlot = 'backend' | 'frontend' | 'standalone';

export type DeploymentHistoryStatus =
  | 'queued'
  | 'building'
  | 'ready'
  | 'failed'
  | 'canceled'
  /** Went live, then a newer deploy replaced it (Render's `deactivated`). */
  | 'superseded'
  | 'unknown';

/**
 * `unavailable` means a provider was asked and did not answer. `local_mock`
 * means there was nothing to ask.
 */
export type DeploymentHistoryMode = 'local_mock' | 'live' | 'unavailable';

export interface DeploymentHistoryItem {
  id: string;
  targetId: string;
  targetName: string;
  provider: DeploymentProvider;
  /**
   * The target's role, so a reader (e.g. the previews surface rule) can tell a
   * backend deploy from a frontend one without asking Runtime.
   */
  slot: DeploymentSlot;
  /** Provider lane ('production' / 'preview') or the Render environment name. */
  environment: string | null;
  branch: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  /** Who started the deployment, when the provider says. */
  createdBy: string | null;
  status: DeploymentHistoryStatus;
  createdAt: string;
  /** When the provider began the deploy, where it reports that apart from `createdAt`. */
  startedAt?: string | null;
  readyAt: string | null;
  /** What started it, in the provider's word (Render: api, deploy_hook, new_commit, manual...). */
  trigger?: string | null;
  /** The deployed site itself: per deployment on Vercel, per service on Render. */
  deploymentUrl: string | null;
  /** Set when the deployment was built for a pull request. */
  pullRequestNumber: number | null;
  /** Provider console for this one deployment, when the provider has one. */
  inspectorUrl: string | null;
  /** Provider console for the project as a whole. */
  dashboardUrl: string;
  /** Provider console's deployment list for the project. */
  consoleUrl: string;
}

export interface DeploymentHistoryResponse {
  enabled: boolean;
  mode: DeploymentHistoryMode;
  liveProvidersEnabled: boolean;
  deployments: DeploymentHistoryItem[];
  /** Safe message naming the providers that could not be reached. */
  providerError: string | null;
}
