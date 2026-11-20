import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import type {
  EnvOwnershipMode,
  EnvProvider,
  EnvTargetSlot,
  RenderDeployMethod,
  RenderEnvironmentName,
  RenderRuntime,
  RenderServiceType,
} from '../../core/deployments.types';

const SLOTS = [
  'backend',
  'frontend',
  'standalone',
] as const satisfies readonly EnvTargetSlot[];
const OWNERSHIP_MODES = [
  'byo',
  'flowci_managed',
] as const satisfies readonly EnvOwnershipMode[];
const RENDER_DEPLOY_METHODS = [
  'managed_image',
  'byo_image',
  'native_git',
  'existing_service',
] as const satisfies readonly RenderDeployMethod[];
const RENDER_SERVICE_TYPES = [
  'web_service',
  'private_service',
  'background_worker',
  'cron_job',
] as const satisfies readonly RenderServiceType[];
const RENDER_RUNTIMES = [
  'node',
  'python',
  'ruby',
  'go',
  'rust',
  'elixir',
  'docker',
] as const satisfies readonly RenderRuntime[];

/**
 * Body of POST /projects/:projectId/deployment-targets. Types and value sets
 * are checked here; which combinations a provider accepts stays with the
 * service and the provider plugin. The provider itself is a free string the
 * provider registry resolves (an unknown one is a 400 there).
 */
export class CreateDeploymentTargetDto {
  @IsIn(['create', 'register_existing'])
  action!: 'create' | 'register_existing';

  /**
   * Project environment this target deploys. When set, the target branch is
   * the environment's source branch and the environment may hold at most one
   * target per slot. Omit it for the legacy branch-based path.
   */
  @IsOptional()
  @IsUUID()
  environmentId?: string;

  @IsIn(SLOTS)
  slot!: EnvTargetSlot;

  @IsIn(OWNERSHIP_MODES)
  ownershipMode!: EnvOwnershipMode;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  provider!: EnvProvider;

  @IsOptional()
  @IsUUID()
  providerConnectionId?: string;

  @IsOptional() @IsString() @MaxLength(200) providerProjectId?: string;
  @IsOptional() @IsString() @MaxLength(200) providerProjectName?: string;
  @IsOptional() @IsString() @MaxLength(200) projectName?: string;
  @IsOptional() @IsString() @MaxLength(255) branchName?: string;
  @IsOptional() @IsString() @MaxLength(500) rootDirectory?: string;
  @IsOptional() @IsString() @MaxLength(2000) buildCommand?: string;
  @IsOptional() @IsString() @MaxLength(2000) startCommand?: string;

  @IsOptional()
  @IsIn(RENDER_DEPLOY_METHODS)
  renderDeployMethod?: RenderDeployMethod;

  @IsOptional()
  @IsIn(RENDER_SERVICE_TYPES)
  renderServiceType?: RenderServiceType;

  @IsOptional()
  @IsIn(RENDER_RUNTIMES)
  renderRuntime?: RenderRuntime;

  @IsOptional() @IsString() @MaxLength(100) renderInstanceType?: string;
  @IsOptional() @IsString() @MaxLength(100) renderRegion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  renderEnvironmentName?: RenderEnvironmentName;

  @IsOptional() @IsString() @MaxLength(500) dockerContext?: string;
  @IsOptional() @IsString() @MaxLength(500) dockerfilePath?: string;
  @IsOptional() @IsString() @MaxLength(1000) imageUrl?: string;

  @IsOptional()
  @IsObject()
  environmentMap?: Record<string, unknown>;
}
