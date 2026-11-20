import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import {
  FEEDBACK_STATUSES,
  type FeedbackStatus,
} from '#kernel/ports/feedback.port';

/** Body of PATCH /admin/feedback/:id. */
export class TriageFeedbackDto {
  @IsOptional()
  @IsIn(FEEDBACK_STATUSES)
  status?: FeedbackStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  adminResponse?: string;
}
