import { Injectable } from '@nestjs/common';

import { DatabaseService } from '#kernel/db/database.service';
import type { BacklogPriority } from '../domain/backlog-schedule.rules';

export type ProjectTodoStatus = 'open' | 'done';

export interface ProjectTodoRow {
  id: string;
  delivery_project_id: string;
  title: string;
  notes: string | null;
  assignee_id: string | null;
  assignee_login: string | null;
  due_date: Date | string | null;
  priority: BacklogPriority | null;
  status: ProjectTodoStatus;
  created_by: string;
  created_by_login: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  completed_by_login: string | null;
  row_version: number;
}

export interface CreateProjectTodoInput {
  deliveryProjectId: string;
  title: string;
  notes: string | null;
  assignee: { id: string; login: string } | null;
  dueDate: string | null;
  priority: BacklogPriority | null;
  createdBy: string;
  createdByLogin: string | null;
}

/** `undefined` = leave unchanged; `null` clears a nullable field. */
export interface UpdateProjectTodoPatch {
  title?: string;
  notes?: string | null;
  assignee?: { id: string; login: string } | null;
  dueDate?: string | null;
  priority?: BacklogPriority | null;
  status?: ProjectTodoStatus;
  /** Recorded when the status moves to done. */
  actorLogin: string | null;
}

/** Open first (soonest due, then highest priority), then the last 30 days of done ones. */
const LIST_ORDER = `
  (status = 'done'),
  CASE WHEN status = 'open' THEN due_date END ASC NULLS LAST,
  CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
  completed_at DESC NULLS LAST,
  created_at ASC
`;

@Injectable()
export class ProjectTodosRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(deliveryProjectId: string): Promise<ProjectTodoRow[]> {
    const result = await this.databaseService.query<ProjectTodoRow>(
      `
        SELECT *
        FROM projects.project_todos
        WHERE delivery_project_id = $1
          AND (status = 'open' OR completed_at > NOW() - INTERVAL '30 days')
        ORDER BY ${LIST_ORDER}
        LIMIT 300;
      `,
      [deliveryProjectId],
    );
    return result.rows;
  }

  async find(
    deliveryProjectId: string,
    todoId: string,
  ): Promise<ProjectTodoRow | null> {
    const result = await this.databaseService.query<ProjectTodoRow>(
      `SELECT * FROM projects.project_todos WHERE delivery_project_id = $1 AND id = $2;`,
      [deliveryProjectId, todoId],
    );
    return result.rows[0] ?? null;
  }

  async insert(input: CreateProjectTodoInput): Promise<ProjectTodoRow> {
    const result = await this.databaseService.query<ProjectTodoRow>(
      `
        INSERT INTO projects.project_todos
          (delivery_project_id, title, notes, assignee_id, assignee_login,
           due_date, priority, created_by, created_by_login)
        VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9)
        RETURNING *;
      `,
      [
        input.deliveryProjectId,
        input.title,
        input.notes,
        input.assignee?.id ?? null,
        input.assignee?.login ?? null,
        input.dueDate,
        input.priority,
        input.createdBy,
        input.createdByLogin,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('project_todos insert returned no row');
    return row;
  }

  /** Conditional on row_version: null when it moved or the to-do is gone. */
  async update(
    deliveryProjectId: string,
    todoId: string,
    expectedRowVersion: number,
    patch: UpdateProjectTodoPatch,
  ): Promise<ProjectTodoRow | null> {
    const result = await this.databaseService.query<ProjectTodoRow>(
      `
        UPDATE projects.project_todos
        SET
          title = COALESCE($4, title),
          notes = CASE WHEN $5::boolean THEN $6 ELSE notes END,
          assignee_id = CASE WHEN $7::boolean THEN $8::uuid ELSE assignee_id END,
          assignee_login = CASE WHEN $7::boolean THEN $9 ELSE assignee_login END,
          due_date = CASE WHEN $10::boolean THEN $11::date ELSE due_date END,
          priority = CASE WHEN $12::boolean THEN $13 ELSE priority END,
          completed_at = CASE
            WHEN $14::text = 'done' AND status = 'open' THEN NOW()
            WHEN $14::text = 'open' THEN NULL
            ELSE completed_at END,
          completed_by_login = CASE
            WHEN $14::text = 'done' AND status = 'open' THEN $15
            WHEN $14::text = 'open' THEN NULL
            ELSE completed_by_login END,
          status = COALESCE($14, status),
          row_version = row_version + 1,
          updated_at = NOW()
        WHERE delivery_project_id = $1 AND id = $2 AND row_version = $3
        RETURNING *;
      `,
      [
        deliveryProjectId,
        todoId,
        expectedRowVersion,
        patch.title ?? null,
        patch.notes !== undefined,
        patch.notes ?? null,
        patch.assignee !== undefined,
        patch.assignee?.id ?? null,
        patch.assignee?.login ?? null,
        patch.dueDate !== undefined,
        patch.dueDate ?? null,
        patch.priority !== undefined,
        patch.priority ?? null,
        patch.status ?? null,
        patch.actorLogin,
      ],
    );
    return result.rows[0] ?? null;
  }

  async delete(deliveryProjectId: string, todoId: string): Promise<boolean> {
    const result = await this.databaseService.query<{ id: string }>(
      `DELETE FROM projects.project_todos WHERE delivery_project_id = $1 AND id = $2 RETURNING id;`,
      [deliveryProjectId, todoId],
    );
    return result.rows.length > 0;
  }

  /** DeliveryProjectDataCleanupPort: every to-do of a deleted Project. */
  async deleteByDeliveryProject(deliveryProjectId: string): Promise<number> {
    const result = await this.databaseService.query<{ id: string }>(
      `DELETE FROM projects.project_todos WHERE delivery_project_id = $1 RETURNING id;`,
      [deliveryProjectId],
    );
    return result.rows.length;
  }
}
