/* Team to-dos: a Project's engineering and QA action items beside its
 * stories ("Rotate the staging secret"). Pure types. */

import type { BacklogPriority } from './requirement-types';

export type TeamTodoStatus = 'open' | 'done';

export interface TodoPerson {
  id: string;
  login: string | null;
}

export interface TeamTodo {
  id: string;
  title: string;
  notes: string | null;
  assignee: TodoPerson | null;
  /** "YYYY-MM-DD" or null. */
  dueDate: string | null;
  priority: BacklogPriority | null;
  status: TeamTodoStatus;
  createdByLogin: string | null;
  completedByLogin: string | null;
  rowVersion: number;
  /** Server-decided: its creator, a Product owner or an admin. Anyone on the team may tick it. */
  canEdit: boolean;
}

/** GET /delivery-projects/:id/todos, normalised. */
export interface TeamTodoList {
  todos: TeamTodo[];
  /** Who a to-do can be assigned to. */
  assignees: TodoPerson[];
}

/** The add form. "" means none. */
export interface TeamTodoDraft {
  title: string;
  assigneeId: string;
  dueDate: string;
  priority: BacklogPriority | '';
}

export interface CreateTeamTodoInput {
  title: string;
  assigneeId?: string;
  dueDate?: string;
  priority?: BacklogPriority;
}

export interface UpdateTeamTodoInput {
  expectedRowVersion: number;
  status?: TeamTodoStatus;
  assigneeId?: string | null;
}
