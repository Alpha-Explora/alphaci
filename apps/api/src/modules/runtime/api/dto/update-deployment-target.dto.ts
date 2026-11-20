import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import type {
  EnvTargetSlot,
  RenderEnvironmentName,
  UpdateDeploymentTargetMetadataInput,
} from '../../core/deployments.types';

/**
 * Body of PATCH /projects/:projectId/deployment-targets/:targetId. A null
 * clears the optional text fields.
 */
export class UpdateDeploymentTargetDto implements UpdateDeploymentTargetMetadataInput {
  @IsOptional()
  @IsIn(['backend', 'frontend', 'standalone'])
  slot?: EnvTargetSlot;

  @IsOptional() @IsString() @MaxLength(200) providerProjectName?: string;
  @IsOptional() @IsString() @MaxLength(255) branchName?: string;
  @IsOptional() @IsString() @MaxLength(500) rootDirectory?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) buildCommand?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) startCommand?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  renderEnvironmentName?: RenderEnvironmentName | null;
}
