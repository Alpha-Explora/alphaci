/**
 * Custom domains on a deployment target.
 *
 * GET /projects/:id/domains returns CustomDomain[].
 * POST /projects/:id/domains takes AddCustomDomainRequest and returns
 * CustomDomain; POST /projects/:id/domains/:domainId/verify returns CustomDomain.
 * DELETE /projects/:id/domains/:domainId returns RemoveCustomDomainResponse.
 */

import type { DeploymentProvider } from './deployments.js';

/**
 * One DNS record the provider says must exist before a hostname will serve.
 *
 * Passed through from the provider verbatim, never generated locally: the
 * provider is the authority and its instructions change without notice, so
 * the UI repeats what the provider said rather than hardcoding an apex IP that
 * goes stale.
 */
export interface DomainVerificationChallenge {
  type: string;
  domain: string;
  value: string;
  reason: string;
}

export interface CustomDomain {
  id: string;
  projectId: string;
  deploymentTargetId: string;
  provider: DeploymentProvider;
  hostname: string;
  apexDomain: string | null;
  /** Branch this hostname serves. Null for the production domain. */
  gitBranch: string | null;
  verified: boolean;
  verification: DomainVerificationChallenge[];
  /**
   * Whether DNS currently points at the provider. Null until checked once,
   * and reported separately from `verified`, because a domain can be verified
   * as owned while still not pointed at the deployment.
   */
  misconfigured: boolean | null;
  lastCheckedAt: string | null;
  lastErrorSafeMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddCustomDomainRequest {
  deploymentTargetId: string;
  hostname: string;
  /** Pins the hostname to one branch. Omitted means the production domain. */
  gitBranch?: string | null;
}

export interface RemoveCustomDomainResponse {
  removed: true;
  hostname: string;
  /** Set when the local row was removed but the provider call failed. */
  providerError: string | null;
}
