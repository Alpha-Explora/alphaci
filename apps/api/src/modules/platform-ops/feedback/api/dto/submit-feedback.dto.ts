import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import type { FeedbackCategory } from '../../application/feedback.types';

export class SubmitFeedbackDto {
  @IsOptional()
  @IsIn(['general', 'bug', 'feature_request', 'billing', 'other'])
  category?: FeedbackCategory;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  @Matches(/\S/, { message: 'subject must contain visible text' })
  subject!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  @Matches(/\S/, { message: 'body must contain visible text' })
  body!: string;
}
