import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';

import { PIPELINE_BRANCHES } from '#kernel/config/pipeline-branches';

/**
 * The branch of an untargeted release is one of the fixed pipeline branches.
 * A release aimed at one target (`targetId`) is not looked up by branch, and
 * an environment's source branch can be any safe branch name, so it only has
 * to be a branch name.
 */
@ValidatorConstraint({ name: 'pipelineBranchUnlessTargeted', async: false })
class PipelineBranchUnlessTargeted implements ValidatorConstraintInterface {
  validate(branch: unknown, args: ValidationArguments): boolean {
    const { targetId } = args.object as { targetId?: unknown };
    return (
      targetId !== undefined ||
      (PIPELINE_BRANCHES as readonly unknown[]).includes(branch)
    );
  }

  defaultMessage(): string {
    return `branch must be one of the following values: ${PIPELINE_BRANCHES.join(', ')}`;
  }
}

/** What a generated pipeline sends when it asks for a release. */
export class StartReleaseDto {
  @IsString()
  @Matches(/^[\w.-]+\/[\w.-]+$/, {
    message: 'repoFullName must be owner/repo',
  })
  repoFullName!: string;

  @IsIn(['backend', 'frontend', 'standalone'])
  slot!: string;

  // The branch the run belongs to, taken from pipeline-context rather than the
  // git context: a workflow_run chain reports the default branch.
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Validate(PipelineBranchUnlessTargeted)
  branch!: string;

  @IsString()
  @Matches(/^[0-9a-f]{7,40}$/i, {
    message: 'commitSha must be a git commit sha',
  })
  commitSha!: string;

  /** What the pipeline built, e.g. an image reference. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  artifact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  runUrl?: string;

  /** The environment being deployed, when the pipeline has environments. */
  @IsOptional()
  @IsUUID()
  environmentId?: string;

  /** The environment's slug, for the run summary. Not used to find anything. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  environmentName?: string;

  /**
   * The deployment target to release, by ID. An environment's target is never
   * found by branch: two environments may share one. Required with
   * `environmentId`.
   */
  @ValidateIf(
    (body: StartReleaseDto) =>
      body.targetId !== undefined || body.environmentId !== undefined,
  )
  @IsUUID()
  targetId?: string;
}
