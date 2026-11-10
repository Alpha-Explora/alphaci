/* Team to-dos: reading the wire, the add form, labels and error copy.
 * Pure: no React, no fetch. */

import {
  BACKLOG_PRIORITIES,
  dueLabel,
  dueState,
  priorityLabel,
} from './backlog-schedule-rules';
import { qaCodeMessage } from './qa-error-messages';
import type {
  CreateTeamTodoInput,
  TeamTodo,
  TeamTodoDraft,
  TeamTodoList,
  TodoPerson,
} from './team-todo-types';
import {
  errorCode,
  errorStatus,
  oneOf,
  positiveInt,
  record,
  records,
  text,
  type Loose,
} from './wire-readers';

export const TEAM_TODO_TITLE_MAX = 200;
export const EMPTY_TODO_DRAFT: TeamTodoDraft = {
  title: '',
  assigneeId: '',
  dueDate: '',
  priority: '',
};

function personFrom(value: unknown): TodoPerson | null {
  const raw = record(value);
  const id = text(raw?.id);
  return id ? { id, login: text(raw?.login) } : null;
}

function dateOnly(value: unknown): string | null {
  const date = text(value);
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function todoFrom(raw: Loose): TeamTodo | null {
  const id = text(raw.id);
  const title = text(raw.title);
  if (!id || !title) return null;
  return {
    id,
    title,
    notes: text(raw.notes),
    assignee: personFrom(raw.assignee),
    dueDate: dateOnly(raw.dueDate),
    priority: oneOf(raw.priority, BACKLOG_PRIORITIES),
    status: raw.status === 'done' ? 'done' : 'open',
    createdByLogin: text(record(raw.createdBy)?.login),
    completedByLogin: text(raw.completedByLogin),
    rowVersion: positiveInt(raw.rowVersion) ?? 1,
    canEdit: raw.canEdit === true,
  };
}

export function normalizeTeamTodo(value: unknown): TeamTodo | null {
  const raw = record(value);
  return raw ? todoFrom(raw) : null;
}

export function normalizeTeamTodoList(value: unknown): TeamTodoList {
  const raw = record(value) ?? {};
  return {
    todos: records(raw.todos)
      .map(todoFrom)
      .filter((todo): todo is TeamTodo => todo !== null),
    assignees: records(raw.assignees)
      .map(personFrom)
      .filter((person): person is TodoPerson => person !== null),
  };
}

/** A too-long title, as the viewer types; an empty one just disables Add. */
export function todoTitleProblem(title: string): string | null {
  return title.trim().length > TEAM_TODO_TITLE_MAX
    ? `A to-do is at most ${String(TEAM_TODO_TITLE_MAX)} characters.`
    : null;
}

export function canAddTodo(draft: TeamTodoDraft): boolean {
  return (
    draft.title.trim().length > 0 && todoTitleProblem(draft.title) === null
  );
}

/** The request body: only what was filled in. */
export function createTodoInput(draft: TeamTodoDraft): CreateTeamTodoInput {
  return {
    title: draft.title.trim(),
    ...(draft.assigneeId ? { assigneeId: draft.assigneeId } : {}),
    ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
    ...(draft.priority ? { priority: draft.priority } : {}),
  };
}

export function personLabel(person: TodoPerson | null): string {
  if (!person) return 'Unassigned';
  return person.login ? `@${person.login}` : 'Someone';
}

/** The chips beside an open to-do: priority, then how close its date is. */
export function todoChips(
  todo: Pick<TeamTodo, 'priority' | 'dueDate' | 'status'>,
  today: string,
) {
  const chips: Array<{ key: string; label: string; tone: string }> = [];
  if (todo.priority)
    chips.push({
      key: 'priority',
      label: priorityLabel(todo.priority),
      tone: todo.priority,
    });
  if (todo.dueDate && todo.status === 'open') {
    const state =
      dueState({ dueDate: todo.dueDate, progress: 'todo' }, today) ??
      'scheduled';
    chips.push({
      key: 'due',
      label: dueLabel(todo.dueDate, today),
      tone: state,
    });
  }
  return chips;
}

export function openTodos(todos: ReadonlyArray<TeamTodo>): TeamTodo[] {
  return todos.filter((todo) => todo.status === 'open');
}

export function doneTodos(todos: ReadonlyArray<TeamTodo>): TeamTodo[] {
  return todos.filter((todo) => todo.status === 'done');
}

const CODE_COPY: Readonly<Record<string, string>> = {
  PROJECT_TODO_STALE:
    'Someone changed this to-do meanwhile. The list was read again; try once more.',
  PROJECT_TODO_FORBIDDEN:
    'Only its creator, a Product owner or an admin can change this to-do.',
  PROJECT_TODO_NOT_FOUND: 'This to-do was deleted meanwhile.',
  PROJECT_TODO_ASSIGNEE_INVALID: 'Assign it to someone on this Project team.',
  PROJECT_TODO_DATE_INVALID: 'Pick a real date.',
  PROJECT_TODO_TITLE_REQUIRED: 'Give the to-do a title.',
};

export function todoErrorMessage(cause: unknown): string {
  const byCode = CODE_COPY[errorCode(cause)] ?? qaCodeMessage(cause);
  if (byCode) return byCode;
  if (errorStatus(cause) === 401)
    return 'Your session has ended. Sign in again.';
  return 'The to-do could not be saved. Try again in a moment.';
}

/** Stale or gone: read the list again so the screen matches the server. */
export function todoErrorRefreshes(cause: unknown): boolean {
  const code = errorCode(cause);
  return code === 'PROJECT_TODO_STALE' || code === 'PROJECT_TODO_NOT_FOUND';
}
