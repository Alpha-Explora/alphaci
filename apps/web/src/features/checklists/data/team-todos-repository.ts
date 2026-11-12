import type { ProjectTodo, ProjectTodoList } from '@/shared/api/contracts';
import { request } from '@/shared/api/request';

import {
  normalizeTeamTodo,
  normalizeTeamTodoList,
} from '../model/team-todo-rules';
import type {
  CreateTeamTodoInput,
  TeamTodo,
  TeamTodoList,
  UpdateTeamTodoInput,
} from '../model/team-todo-types';

/* The only place that talks to the Project's team to-do endpoints. */

function path(deliveryProjectId: string, todoId?: string): string {
  const base = `/delivery-projects/${encodeURIComponent(deliveryProjectId)}/todos`;
  return todoId ? `${base}/${encodeURIComponent(todoId)}` : base;
}

function todoOrThrow(value: unknown): TeamTodo {
  const todo = normalizeTeamTodo(value);
  if (!todo) throw new Error('The server did not return the to-do.');
  return todo;
}

export const teamTodosRepository = {
  async list(deliveryProjectId: string): Promise<TeamTodoList> {
    return normalizeTeamTodoList(
      await request<ProjectTodoList>(path(deliveryProjectId)),
    );
  },
  async create(
    deliveryProjectId: string,
    input: CreateTeamTodoInput,
  ): Promise<TeamTodo> {
    return todoOrThrow(
      await request<ProjectTodo>(path(deliveryProjectId), {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
  },
  async update(
    deliveryProjectId: string,
    todoId: string,
    input: UpdateTeamTodoInput,
  ): Promise<TeamTodo> {
    return todoOrThrow(
      await request<ProjectTodo>(path(deliveryProjectId, todoId), {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    );
  },
  async remove(deliveryProjectId: string, todoId: string): Promise<void> {
    await request<unknown>(path(deliveryProjectId, todoId), {
      method: 'DELETE',
    });
  },
};
