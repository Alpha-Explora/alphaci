import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import type { WorkflowSettingsPreviewRequest } from '../../application/workflows/project-workflows.service';
import {
  CATALOG_ID,
  WORKFLOW_GIT_REF,
  WORKFLOW_NODE_VERSION,
  WORKFLOW_SERVICE_NAME,
  WORKFLOW_SERVICE_NAME_MESSAGE,
  WORKFLOW_SERVICE_PATH,
  WORKFLOW_SERVICE_PATH_MESSAGE,
} from './workflow-values';

function isPresent(_body: unknown, value: unknown): boolean {
  return value !== undefined;
}

export class WorkflowChecksDto {
  @ValidateIf(isPresent) @IsBoolean() lint?: boolean;
  @ValidateIf(isPresent) @IsBoolean() unit?: boolean;
  @ValidateIf(isPresent) @IsBoolean() build?: boolean;
  @ValidateIf(isPresent) @IsBoolean() security?: boolean;
}

/**
 * Body of POST /projects/:id/workflow-settings/preview and .../pr. Every value
 * here lands in generated workflow YAML, so each is held to a shape that
 * cannot carry an expression, a line break or a path outside the repository
 * (see workflow-values.ts).
 * The coverage threshold is only typed: an out-of-range value comes back as a
 * preview warning, which the UI shows.
 */
export class WorkflowSettingsPreviewDto implements WorkflowSettingsPreviewRequest {
  /**
   * The web sends back the settings it read, which carry the project id. The
   * id in the path is the one used; this is accepted and ignored.
   */
  @ValidateIf(isPresent)
  @IsUUID()
  projectId?: string;

  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(100)
  @Matches(CATALOG_ID)
  templateId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(CATALOG_ID)
  projectTypeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(CATALOG_ID)
  workflowRecipeId?: string | null;

  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(100)
  @Matches(WORKFLOW_SERVICE_NAME, { message: WORKFLOW_SERVICE_NAME_MESSAGE })
  serviceName?: string;

  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(300)
  @Matches(WORKFLOW_SERVICE_PATH, { message: WORKFLOW_SERVICE_PATH_MESSAGE })
  servicePath?: string;

  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(20)
  @Matches(WORKFLOW_NODE_VERSION, {
    message: 'nodeVersion must look like 24, 22.x or lts/*',
  })
  nodeVersion?: string;

  @ValidateIf(isPresent)
  @IsIn(['npm'])
  packageManager?: 'npm';

  @ValidateIf(isPresent)
  @IsNumber()
  coverageThreshold?: number;

  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(100)
  @Matches(WORKFLOW_GIT_REF, {
    message: 'centralWorkflowRef must be a git ref such as v1',
  })
  centralWorkflowRef?: string;

  @ValidateIf(isPresent)
  @IsObject()
  @ValidateNested()
  @Type(() => WorkflowChecksDto)
  checks?: WorkflowChecksDto;
}
