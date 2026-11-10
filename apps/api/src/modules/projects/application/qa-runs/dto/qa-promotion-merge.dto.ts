import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body of the two merge-to-main routes. Empty for the normal gated merge.
 * overrideReason asks to merge past a blocked gate (admins and holders of
 * deployment_override only); the reason is stored in the audit trail.
 */
export class QaPromotionMergeDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  overrideReason?: string;
}
