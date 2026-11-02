/**
 * Environment variables: the metadata AlphaCI keeps about each key it wrote to
 * a provider, and the requests that write, check and forget them. Values are
 * never stored or returned.
 *
 * GET /projects/:id/env-vars returns EnvVarMetadata[].
 * POST /projects/:id/env-vars/provision takes ProvisionEnvVarsRequest and
 * returns ProvisionEnvVarsResponse.
 * POST /projects/:id/env-vars/validate takes ValidateEnvVarsRequest and returns
 * ValidateEnvVarsResponse.
 * DELETE /projects/:id/env-vars/:metadataId returns DeleteEnvVarMetadataResponse.
 */

import type { DeploymentProvider } from './deployments.js';

/**
 * Deployment lane an environment variable applies to.
 *
 * Mirrors what a provider actually has rather than a promotion ladder:
 * `production` is the lane the provider's production branch deploys to and
 * carries no branch of its own (Vercel resolves it from the project's
 * production-branch setting), while `preview` is always scoped to one branch,
 * which is what gives every branch its own set of values.
 *
 * Not Render's environment name on a deployment target ('test', 'uat', ...):
 * that is a separate idea stored on the target.
 */
export type EnvLane = 'production' | 'preview';

/**
 * Which values a provisioning call targets.
 *
 * The lane and the branch are not independent: production has no branch, and
 * preview is meaningless without one.
 */
export interface EnvVarScope {
  lane: EnvLane;
  /** The branch these values apply to. Null if and only if lane is production. */
  gitBranch: string | null;
}

export type EnvVarProvisionStatus = 'provisioned' | 'failed';

/** One key and its value, as sent to the provider. Only ever in a request. */
export interface EnvVarInput {
  key: string;
  value: string;
}

/** What AlphaCI records about one key it wrote to a provider. Never the value. */
export interface EnvVarMetadata {
  id: string;
  projectId: string;
  deploymentTargetId: string;
  lane: EnvLane;
  /** Null if and only if `lane` is production. */
  gitBranch: string | null;
  key: string;
  provider: DeploymentProvider;
  valueStored: false;
  lastProvisionedAt: string;
  lastProvisionedBy: string;
  status: EnvVarProvisionStatus;
  errorSummary: string | null;
  removedAt?: string | null;
}

export interface ProvisionEnvVarsRequest {
  deploymentTargetId: string;
  lane: EnvLane;
  /** Required for the preview lane, rejected for production. */
  gitBranch?: string | null;
  vars: EnvVarInput[];
}

export interface ProvisionEnvVarsResponse {
  provisioned: Array<{ key: string; status: 'provisioned' }>;
  failed: Array<{ key: string; status: 'failed'; errorSummary: string }>;
}

export interface ValidateEnvVarsRequest {
  deploymentTargetId: string;
  lane: EnvLane;
  gitBranch?: string | null;
  /** Dotenv-style text: one KEY=value per line. */
  text: string;
}

export interface ValidateEnvVarsResponse {
  keyCount: number;
  keys: string[];
  duplicates: string[];
  invalidKeys: string[];
  warnings: Array<{ code: string; message: string }>;
}

export interface DeleteEnvVarMetadataResponse {
  removed: true;
  key: string;
}
