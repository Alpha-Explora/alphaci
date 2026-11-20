import type {
  EnvLane,
  EnvVarInput,
  ProvisionEnvVarsRequest,
  ValidateEnvVarsRequest,
} from '@alphaci/api-contracts';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const LANES = ['production', 'preview'] as const satisfies readonly EnvLane[];

export class EnvVarInputDto implements EnvVarInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  key!: string;

  @IsString()
  @MaxLength(65536)
  value!: string;
}

/**
 * The body of POST /projects/:projectId/env-vars/provision
 * (`ProvisionEnvVarsRequest` in `@alphaci/api-contracts`).
 *
 * `gitBranch` is required for the preview lane and rejected for production;
 * EnvVarsService.resolveScope is the single place that pairing is validated.
 */
export class ProvisionEnvVarsDto implements ProvisionEnvVarsRequest {
  @IsUUID()
  deploymentTargetId!: string;

  @IsIn(LANES)
  lane!: EnvLane;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  gitBranch?: string | null;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => EnvVarInputDto)
  vars!: EnvVarInputDto[];
}

/** The body of POST /projects/:projectId/env-vars/validate. */
export class ValidateEnvTextDto implements ValidateEnvVarsRequest {
  @IsUUID()
  deploymentTargetId!: string;

  @IsIn(LANES)
  lane!: EnvLane;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  gitBranch?: string | null;

  /** Dotenv-style text: one KEY=value per line. */
  @IsString()
  @MaxLength(1_000_000)
  text!: string;
}
