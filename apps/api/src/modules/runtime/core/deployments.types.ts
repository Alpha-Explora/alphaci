import type { DeploymentProviderId } from './deployment-provider-id';
import type { RenderServiceType } from './deployment-target.types';

/*
 * The env-var and custom-domain HTTP shapes are defined once in
 * `@alphaci/api-contracts`, which the web app imports too. Change them there:
 * a change that breaks the web then fails its typecheck in the same pull
 * request.
 */
export type {
  CustomDomain as CustomDomainSummary,
  DomainVerificationChallenge,
  EnvLane,
  EnvVarInput,
  EnvVarMetadata,
  EnvVarProvisionStatus,
  EnvVarScope,
} from '@alphaci/api-contracts';

export type { DeploymentProviderId } from './deployment-provider-id';
export type { RenderServiceType } from './deployment-target.types';

export type EnvProvider = DeploymentProviderId;

export type EnvOwnershipMode = 'byo' | 'flowci_managed';
export type EnvTargetSlot = 'backend' | 'frontend' | 'standalone';
export type RenderDeploymentStrategy =
  'render_git_connected' | 'render_image_pushed' | 'render_existing_service';
export type VercelDeploymentStrategy =
  'vercel_git_connected' | 'vercel_ci_pushed';
/** Strategy identifiers are owned by the provider plugin that implements them. */
export type DeploymentStrategy = string;
export type RenderRuntime =
  'node' | 'python' | 'ruby' | 'go' | 'rust' | 'elixir' | 'docker';
export type RenderDeployMethod =
  'managed_image' | 'byo_image' | 'native_git' | 'existing_service';
/**
 * Render's own environment naming on a deployment target.
 *
 * Deliberately NOT EnvLane: this is a Render concept stored on the target and
 * constrained separately in the database
 * (project_deployment_targets_render_environment_check). It used to alias the
 * env-var environment enum, which made two unrelated ideas move together.
 */
export type RenderEnvironmentName = 'dev' | 'test' | 'uat' | 'production';
export type ProviderConnectionStatus = 'active' | 'revoked' | 'failed';
export type DeploymentTargetStatus = 'active' | 'missing' | 'failed';

export interface ProviderConnectionSummary {
  id: string;
  provider: EnvProvider;
  label: string;
  tokenLastFour: string;
  status: ProviderConnectionStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

export interface ProviderConnectionWithToken extends ProviderConnectionSummary {
  encryptedToken: string;
}

export interface DeploymentTargetSummary {
  id: string;
  projectId: string;
  /** Project environment this target deploys; null on the legacy branch path. */
  environmentId?: string | null;
  slot: EnvTargetSlot;
  ownershipMode: EnvOwnershipMode;
  provider: EnvProvider;
  providerConnectionId: string | null;
  providerProjectId: string;
  providerProjectName: string;
  repoFullName: string;
  branchName: string;
  rootDirectory: string | null;
  buildCommand: string | null;
  startCommand: string | null;
  renderServiceType?: RenderServiceType | null;
  renderRuntime?: RenderRuntime | null;
  renderInstanceType?: string | null;
  renderRegion?: string | null;
  renderEnvironmentName?: RenderEnvironmentName | null;
  dockerContext?: string | null;
  dockerfilePath?: string | null;
  imageUrl?: string | null;
  environmentMap: Record<string, unknown>;
  deploymentStrategy: DeploymentStrategy;
  providerMetadata: Record<string, unknown>;
  status: DeploymentTargetStatus;
}

export interface UpdateDeploymentTargetMetadataInput {
  slot?: EnvTargetSlot;
  providerProjectName?: string;
  branchName?: string;
  rootDirectory?: string | null;
  buildCommand?: string | null;
  startCommand?: string | null;
  renderEnvironmentName?: RenderEnvironmentName | null;
}
