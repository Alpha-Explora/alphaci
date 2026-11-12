import { IsIn, IsOptional, Matches } from 'class-validator';

import {
  BACKLOG_PRIORITIES,
  type BacklogPriority,
} from '../../../domain/backlog-schedule.rules';

/**
 * PATCH a story's due date and priority. `null` clears one; an omitted key
 * leaves it. Scheduling is not a definition change: no row version is needed.
 */
export class SetItemScheduleDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dueDate must be YYYY-MM-DD' })
  dueDate?: string | null;

  @IsOptional()
  @IsIn(BACKLOG_PRIORITIES)
  priority?: BacklogPriority | null;
}
