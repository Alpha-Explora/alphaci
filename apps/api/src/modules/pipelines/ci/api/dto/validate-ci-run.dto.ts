import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body of POST /ci/validate. Two callers send it: the staged workflows
 * AlphaCI generates (repo, stage, workflowRunId, headSha), and the
 * `validate-subscription.yml` reusable workflow the catalog's customer
 * templates call, which sends only `repo`. A missing stage is the access
 * check those templates run, so the controller reads it as `access`.
 */
export class ValidateCiRunDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  repo!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  stage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  workflowRunId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  headSha?: string;
}
