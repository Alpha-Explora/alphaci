'use client';

import './team-todos.css';

import { useId } from 'react';

import {
  BACKLOG_PRIORITIES,
  priorityLabel,
  todayDateOnly,
} from '../../model/backlog-schedule-rules';
import type { BacklogPriority } from '../../model/requirement-types';
import {
  doneTodos,
  openTodos,
  personLabel,
  TEAM_TODO_TITLE_MAX,
  todoChips,
  todoTitleProblem,
} from '../../model/team-todo-rules';
import type { TeamTodo, TodoPerson } from '../../model/team-todo-types';
import {
  useTeamTodosViewModel,
  type TeamTodosViewModel,
} from '../view-models/use-team-todos-view-model';

function AssigneeOptions({
  people,
}: Readonly<{ people: ReadonlyArray<TodoPerson> }>) {
  return (
    <>
      <option value="">Unassigned</option>
      {people.map((person) => (
        <option key={person.id} value={person.id}>
          {personLabel(person)}
        </option>
      ))}
    </>
  );
}

function AddTodo({ vm }: Readonly<{ vm: TeamTodosViewModel }>) {
  const problem = todoTitleProblem(vm.draft.title);
  return (
    <form
      className="team-todos__add"
      onSubmit={(event) => {
        event.preventDefault();
        void vm.add();
      }}
    >
      <label className="hier-field team-todos__title">
        <span className="hier-field-label">New to-do</span>
        <input
          className="hier-input"
          value={vm.draft.title}
          maxLength={TEAM_TODO_TITLE_MAX + 20}
          placeholder="Rotate the staging secret"
          aria-invalid={problem ? 'true' : undefined}
          onChange={(event) => vm.setDraft({ title: event.target.value })}
        />
      </label>
      <label className="hier-field">
        <span className="hier-field-label">Assignee</span>
        <select
          className="hier-select"
          value={vm.draft.assigneeId}
          onChange={(event) => vm.setDraft({ assigneeId: event.target.value })}
        >
          <AssigneeOptions people={vm.list.assignees} />
        </select>
      </label>
      <label className="hier-field">
        <span className="hier-field-label">Due</span>
        <input
          className="hier-input"
          type="date"
          value={vm.draft.dueDate}
          onChange={(event) => vm.setDraft({ dueDate: event.target.value })}
        />
      </label>
      <label className="hier-field">
        <span className="hier-field-label">Priority</span>
        <select
          className="hier-select"
          value={vm.draft.priority}
          onChange={(event) =>
            vm.setDraft({
              priority: event.target.value as BacklogPriority | '',
            })
          }
        >
          <option value="">None</option>
          {BACKLOG_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priorityLabel(priority)}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="primary-button" disabled={!vm.canAdd}>
        {vm.busyId === 'new' ? 'Adding…' : 'Add'}
      </button>
      {problem ? (
        <p className="rq-form-error" role="alert">
          {problem}
        </p>
      ) : null}
    </form>
  );
}

function Assignee({
  todo,
  vm,
}: Readonly<{ todo: TeamTodo; vm: TeamTodosViewModel }>) {
  if (!todo.canEdit || todo.status === 'done')
    return (
      <span className="team-todos__who">{personLabel(todo.assignee)}</span>
    );
  return (
    <select
      className="hier-select team-todos__assignee"
      aria-label={`Assignee of ${todo.title}`}
      value={todo.assignee?.id ?? ''}
      disabled={vm.busyId !== null}
      onChange={(event) => void vm.reassign(todo, event.target.value)}
    >
      <AssigneeOptions people={vm.list.assignees} />
    </select>
  );
}

function TodoRow({
  todo,
  vm,
  today,
}: Readonly<{ todo: TeamTodo; vm: TeamTodosViewModel; today: string }>) {
  const checkboxId = useId();
  return (
    <li className="team-todos__item" data-status={todo.status}>
      <input
        id={checkboxId}
        type="checkbox"
        checked={todo.status === 'done'}
        disabled={vm.busyId !== null}
        onChange={() => void vm.toggle(todo)}
      />
      <label htmlFor={checkboxId} className="team-todos__text">
        {todo.title}
      </label>
      {todoChips(todo, today).map((chip) => (
        <span key={chip.key} className="team-todos__chip" data-tone={chip.tone}>
          {chip.label}
        </span>
      ))}
      <Assignee todo={todo} vm={vm} />
      {todo.canEdit ? (
        <button
          type="button"
          className="rq-link rq-link--danger"
          disabled={vm.busyId !== null}
          aria-label={`Delete ${todo.title}`}
          onClick={() => void vm.remove(todo)}
        >
          Delete
        </button>
      ) : null}
    </li>
  );
}

function TodoList({
  todos,
  vm,
  today,
}: Readonly<{ todos: TeamTodo[]; vm: TeamTodosViewModel; today: string }>) {
  return (
    <ul className="team-todos__list">
      {todos.map((todo) => (
        <TodoRow key={todo.id} todo={todo} vm={vm} today={today} />
      ))}
    </ul>
  );
}

/**
 * Team to-dos: action items that are not stories, with an assignee, a due
 * date and a priority. Everyone on the team adds and ticks them; the creator,
 * a Product owner or an admin reassigns and deletes. Nothing on a backend
 * without to-dos.
 */
export function TeamTodosCard({
  deliveryProjectId,
  enabled = true,
}: Readonly<{ deliveryProjectId: string; enabled?: boolean }>) {
  const vm = useTeamTodosViewModel(deliveryProjectId, enabled);
  const headingId = useId();
  if (!enabled || vm.status === 'loading' || vm.status === 'unavailable')
    return null;
  const today = todayDateOnly();
  const open = openTodos(vm.list.todos);
  const done = doneTodos(vm.list.todos);
  return (
    <section id="team-todos" className="team-todos" aria-labelledby={headingId}>
      <header className="team-todos__head">
        <h3 id={headingId}>Team to-dos</h3>
        <span className="team-todos__count">{open.length} open</span>
      </header>
      {vm.status === 'error' ? (
        <p className="rq-form-error" role="alert">
          Team to-dos did not load.{' '}
          <button
            type="button"
            className="rq-link"
            onClick={() => void vm.reload()}
          >
            Try again
          </button>
        </p>
      ) : null}
      <AddTodo vm={vm} />
      {vm.error ? (
        <p className="rq-form-error" role="alert">
          {vm.error}
        </p>
      ) : null}
      {open.length > 0 ? (
        <TodoList todos={open} vm={vm} today={today} />
      ) : (
        <p className="team-todos__empty">Nothing open.</p>
      )}
      {done.length > 0 ? (
        <details className="team-todos__done">
          <summary>Done in the last 30 days ({done.length})</summary>
          <TodoList todos={done} vm={vm} today={today} />
        </details>
      ) : null}
    </section>
  );
}
