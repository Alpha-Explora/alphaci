import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  BACKLOG_PRIORITIES,
  type BacklogPriority,
} from '../../../domain/backlog-schedule.rules';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** POST /delivery-projects/:id/todos */
export class CreateProjectTodoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @IsOptional()
  @Matches(DATE_ONLY, { message: 'dueDate must be YYYY-MM-DD' })
  dueDate?: string | null;

  @IsOptional()
  @IsIn(BACKLOG_PRIORITIES)
  priority?: BacklogPriority | null;
}

/** PATCH /delivery-projects/:id/todos/:todoId. Omitted keys are left; null clears. */
export class UpdateProjectTodoDto {
  @IsInt()
  @Min(1)
  expectedRowVersion!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @IsOptional()
  @Matches(DATE_ONLY, { message: 'dueDate must be YYYY-MM-DD' })
  dueDate?: string | null;

  @IsOptional()
  @IsIn(BACKLOG_PRIORITIES)
  priority?: BacklogPriority | null;

  @IsOptional()
  @IsIn(['open', 'done'])
  status?: 'open' | 'done';
}
