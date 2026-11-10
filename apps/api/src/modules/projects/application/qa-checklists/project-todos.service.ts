import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from '#kernel/http/coded-errors';
import { NotificationEventPublisher } from '#kernel/events/platform-event-publisher.js';
import type { PlatformAppRole } from '#kernel/ports/platform-admin.port';
import { isDateOnly, toDateOnly } from '../../domain/backlog-schedule.rules';
import {
  ProjectTodosRepository,
  type ProjectTodoRow,
  type UpdateProjectTodoPatch,
} from '../../infrastructure/project-todos.repository';
import type {
  CreateProjectTodoDto,
  UpdateProjectTodoDto,
} from './dto/project-todo.dto';
import type { ProjectTodo, ProjectTodoList } from './project-todos.contracts';
import { QaAccessService } from './qa-access.service';
import {
  QaProjectContextService,
  type QaProjectContext,
} from './qa-project-context.service';

export const PROJECT_TODO_ASSIGNED_EVENT = 'project.todo.assigned';

type NotificationEventSink = Pick<NotificationEventPublisher, 'record'>;

export interface TodoActor {
  userId: string;
  userLogin: string | null;
}

/** Personas that work on a Project. Anything else (an unknown role) gets nothing. */
const TEAM_ROLES: ReadonlySet<PlatformAppRole> = new Set([
  'lead',
  'member',
  'qa',
  'admin',
]);

/** The creator, a Product owner or an admin edits the details and deletes. */
export function canEditTodo(
  row: Pick<ProjectTodoRow, 'created_by'>,
  userId: string,
  role: PlatformAppRole,
): boolean {
  return role === 'lead' || role === 'admin' || row.created_by === userId;
}

function todoError(
  status: 400 | 403 | 404 | 409,
  code: string,
  message: string,
) {
  if (status === 400) return badRequest(code, message);
  if (status === 403) return forbidden(code, message);
  if (status === 404) return notFound(code, message);
  return conflict(code, message);
}

/**
 * Team to-dos: a Project's engineering and QA action items beside its
 * stories. Everyone on the Project team sees them, adds them and ticks them
 * done; the creator, Product owners and admins edit and delete them. Assigning
 * someone else notifies them.
 */
@Injectable()
export class ProjectTodosService {
  private readonly logger = new Logger(ProjectTodosService.name);

  constructor(
    private readonly todos: ProjectTodosRepository,
    private readonly context: QaProjectContextService,
    private readonly access: QaAccessService,
    @Optional()
    @Inject(NotificationEventPublisher)
    private readonly notifications?: NotificationEventSink,
  ) {}

  async list(
    deliveryProjectId: string,
    userId: string,
  ): Promise<ProjectTodoList> {
    const project = await this.context.requireProject(
      deliveryProjectId,
      userId,
    );
    const [rows, role, members] = await Promise.all([
      this.todos.list(deliveryProjectId),
      this.access.findAppRole(userId),
      this.access.listWorkspaceMembers(project.groupId),
    ]);
    return {
      todos: rows.map((row) => this.toTodo(row, userId, role)),
      assignees: members,
    };
  }

  async create(
    deliveryProjectId: string,
    actor: TodoActor,
    dto: CreateProjectTodoDto,
  ): Promise<ProjectTodo> {
    const project = await this.context.requireProject(
      deliveryProjectId,
      actor.userId,
    );
    const role = await this.requireTeamRole(actor.userId);
    this.assertDate(dto.dueDate);
    const assignee = dto.assigneeId
      ? await this.resolveAssignee(project, dto.assigneeId)
      : null;
    const row = await this.todos.insert({
      deliveryProjectId,
      title: this.requireTitle(dto.title),
      notes: dto.notes?.trim() || null,
      assignee,
      dueDate: dto.dueDate ?? null,
      priority: dto.priority ?? null,
      createdBy: actor.userId,
      createdByLogin: actor.userLogin,
    });
    if (assignee) await this.notifyAssignee(project, row, actor);
    return this.toTodo(row, actor.userId, role);
  }

  async update(
    deliveryProjectId: string,
    todoId: string,
    actor: TodoActor,
    dto: UpdateProjectTodoDto,
  ): Promise<ProjectTodo> {
    const project = await this.context.requireProject(
      deliveryProjectId,
      actor.userId,
    );
    const role = await this.requireTeamRole(actor.userId);
    const current = await this.requireTodo(deliveryProjectId, todoId);
    const { status, expectedRowVersion, ...details } = dto;
    // The validation pipe builds a class instance whose optional fields exist
    // as undefined keys, so count only the details actually sent.
    const editsDetails = Object.values(details).some(
      (value) => value !== undefined,
    );
    if (editsDetails && !canEditTodo(current, actor.userId, role)) {
      throw todoError(
        403,
        'PROJECT_TODO_FORBIDDEN',
        'Only its creator, a Product owner or an admin can edit this to-do.',
      );
    }
    this.assertDate(dto.dueDate);
    const patch = await this.patchFrom(project, dto, actor);
    const updated = await this.todos.update(
      deliveryProjectId,
      todoId,
      expectedRowVersion,
      {
        ...patch,
        ...(status !== undefined ? { status } : {}),
      },
    );
    if (!updated) {
      throw todoError(
        409,
        'PROJECT_TODO_STALE',
        'This to-do has changed since you opened it. Reload and try again.',
      );
    }
    if (patch.assignee && patch.assignee.id !== current.assignee_id) {
      await this.notifyAssignee(project, updated, actor);
    }
    return this.toTodo(updated, actor.userId, role);
  }

  async remove(
    deliveryProjectId: string,
    todoId: string,
    userId: string,
  ): Promise<void> {
    await this.context.requireProject(deliveryProjectId, userId);
    const role = await this.requireTeamRole(userId);
    const current = await this.requireTodo(deliveryProjectId, todoId);
    if (!canEditTodo(current, userId, role)) {
      throw todoError(
        403,
        'PROJECT_TODO_FORBIDDEN',
        'Only its creator, a Product owner or an admin can delete this to-do.',
      );
    }
    await this.todos.delete(deliveryProjectId, todoId);
  }

  // ---------------------------------------------------------------------

  private async patchFrom(
    project: QaProjectContext,
    dto: UpdateProjectTodoDto,
    actor: TodoActor,
  ): Promise<UpdateProjectTodoPatch> {
    const patch: UpdateProjectTodoPatch = { actorLogin: actor.userLogin };
    if (dto.title !== undefined) patch.title = this.requireTitle(dto.title);
    if (dto.notes !== undefined) patch.notes = dto.notes?.trim() || null;
    if (dto.dueDate !== undefined) patch.dueDate = dto.dueDate;
    if (dto.priority !== undefined) patch.priority = dto.priority;
    if (dto.assigneeId !== undefined) {
      patch.assignee = dto.assigneeId
        ? await this.resolveAssignee(project, dto.assigneeId)
        : null;
    }
    return patch;
  }

  private async requireTeamRole(userId: string): Promise<PlatformAppRole> {
    const role = await this.access.findAppRole(userId);
    if (!TEAM_ROLES.has(role)) {
      throw todoError(
        403,
        'PROJECT_TODO_FORBIDDEN',
        'Your role cannot change team to-dos.',
      );
    }
    return role;
  }

  private async requireTodo(
    deliveryProjectId: string,
    todoId: string,
  ): Promise<ProjectTodoRow> {
    const row = await this.todos.find(deliveryProjectId, todoId);
    if (!row)
      throw todoError(
        404,
        'PROJECT_TODO_NOT_FOUND',
        'This to-do no longer exists.',
      );
    return row;
  }

  private requireTitle(title: string): string {
    const trimmed = title.trim();
    if (!trimmed)
      throw todoError(
        400,
        'PROJECT_TODO_TITLE_REQUIRED',
        'Give the to-do a title.',
      );
    return trimmed;
  }

  private assertDate(dueDate: string | null | undefined): void {
    if (typeof dueDate === 'string' && !isDateOnly(dueDate)) {
      throw todoError(
        400,
        'PROJECT_TODO_DATE_INVALID',
        'The due date is not a real calendar date.',
      );
    }
  }

  /** Only an active member of the Project's team can be assigned. */
  private async resolveAssignee(
    project: QaProjectContext,
    assigneeId: string,
  ): Promise<{ id: string; login: string }> {
    const members = await this.access.listWorkspaceMembers(project.groupId);
    const member = members.find((entry) => entry.id === assigneeId);
    if (!member) {
      throw todoError(
        400,
        'PROJECT_TODO_ASSIGNEE_INVALID',
        'Assign the to-do to someone on this Project team.',
      );
    }
    return { id: member.id, login: member.login ?? '' };
  }

  /** Best effort: the to-do is saved whether or not the notification is. */
  private async notifyAssignee(
    project: QaProjectContext,
    row: ProjectTodoRow,
    actor: TodoActor,
  ): Promise<void> {
    if (
      !this.notifications ||
      !row.assignee_id ||
      row.assignee_id === actor.userId
    )
      return;
    try {
      const anchor = await this.context.anchorProjectId(project);
      if (!anchor) return;
      const due = toDateOnly(row.due_date);
      await this.notifications.record({
        userId: row.assignee_id,
        projectId: anchor,
        eventCode: PROJECT_TODO_ASSIGNED_EVENT,
        title: `To-do for you in ${project.name}`,
        body: `${row.title}${due ? ` (due ${due})` : ''}${actor.userLogin ? `, from @${actor.userLogin}` : ''}.`,
      });
    } catch (error) {
      this.logger.warn(
        `To-do ${row.id} was assigned but notifying failed: ${String(error)}`,
      );
    }
  }

  toTodo(
    row: ProjectTodoRow,
    userId: string,
    role: PlatformAppRole,
  ): ProjectTodo {
    return {
      id: row.id,
      deliveryProjectId: row.delivery_project_id,
      title: row.title,
      notes: row.notes,
      assignee: row.assignee_id
        ? { id: row.assignee_id, login: row.assignee_login }
        : null,
      dueDate: toDateOnly(row.due_date),
      priority: row.priority,
      status: row.status,
      createdBy: { id: row.created_by, login: row.created_by_login },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      completedByLogin: row.completed_by_login,
      rowVersion: row.row_version,
      canEdit: canEditTodo(row, userId, role),
    };
  }
}
