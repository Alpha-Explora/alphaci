'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { teamTodosRepository } from '../../data/team-todos-repository';
import {
  canAddTodo,
  createTodoInput,
  EMPTY_TODO_DRAFT,
  todoErrorMessage,
  todoErrorRefreshes,
} from '../../model/team-todo-rules';
import type {
  TeamTodo,
  TeamTodoDraft,
  TeamTodoList,
} from '../../model/team-todo-types';
import { errorStatus } from '../../model/wire-readers';

export type TeamTodosStatus = 'loading' | 'ready' | 'unavailable' | 'error';

export interface TeamTodosViewModel {
  status: TeamTodosStatus;
  list: TeamTodoList;
  draft: TeamTodoDraft;
  setDraft: (patch: Partial<TeamTodoDraft>) => void;
  canAdd: boolean;
  /** The to-do being written, or "new" while adding. */
  busyId: string | null;
  error: string | null;
  add: () => Promise<void>;
  toggle: (todo: TeamTodo) => Promise<void>;
  reassign: (todo: TeamTodo, assigneeId: string) => Promise<void>;
  remove: (todo: TeamTodo) => Promise<void>;
  reload: () => Promise<void>;
}

const EMPTY_LIST: TeamTodoList = { todos: [], assignees: [] };

/**
 * A Project's team to-dos: read on mount, then add, tick, reassign and delete.
 * Every write reads the list again so the order (open first, soonest due)
 * stays the server's. A backend without to-dos (404) is "unavailable": the
 * card then draws nothing.
 */
export function useTeamTodosViewModel(
  deliveryProjectId: string,
  enabled = true,
): TeamTodosViewModel {
  const [status, setStatus] = useState<TeamTodosStatus>('loading');
  const [list, setList] = useState<TeamTodoList>(EMPTY_LIST);
  const [draft, setDraftState] = useState<TeamTodoDraft>(EMPTY_TODO_DRAFT);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const reload = useCallback(async () => {
    try {
      setList(await teamTodosRepository.list(deliveryProjectId));
      setStatus('ready');
    } catch (cause) {
      setStatus(errorStatus(cause) === 404 ? 'unavailable' : 'error');
    }
  }, [deliveryProjectId]);

  // The first read sets state only in its callbacks (react/set-state-in-effect);
  // reload() is for the event handlers below.
  useEffect(() => {
    if (!enabled || !deliveryProjectId) return;
    let active = true;
    teamTodosRepository
      .list(deliveryProjectId)
      .then((next) => {
        if (!active) return;
        setList(next);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (active)
          setStatus(errorStatus(cause) === 404 ? 'unavailable' : 'error');
      });
    return () => {
      active = false;
    };
  }, [enabled, deliveryProjectId]);

  async function write(
    id: string,
    action: () => Promise<unknown>,
    after?: () => void,
  ) {
    if (busy.current) return;
    busy.current = true;
    setBusyId(id);
    setError(null);
    try {
      await action();
      after?.();
      await reload();
    } catch (cause) {
      setError(todoErrorMessage(cause));
      if (todoErrorRefreshes(cause)) await reload();
    } finally {
      busy.current = false;
      setBusyId(null);
    }
  }

  return {
    status,
    list,
    draft,
    setDraft: (patch) => setDraftState((current) => ({ ...current, ...patch })),
    canAdd: canAddTodo(draft) && busyId === null,
    busyId,
    error,
    add: () =>
      canAddTodo(draft)
        ? write(
            'new',
            () =>
              teamTodosRepository.create(
                deliveryProjectId,
                createTodoInput(draft),
              ),
            () => setDraftState(EMPTY_TODO_DRAFT),
          )
        : Promise.resolve(),
    toggle: (todo) =>
      write(todo.id, () =>
        teamTodosRepository.update(deliveryProjectId, todo.id, {
          expectedRowVersion: todo.rowVersion,
          status: todo.status === 'open' ? 'done' : 'open',
        }),
      ),
    reassign: (todo, assigneeId) =>
      write(todo.id, () =>
        teamTodosRepository.update(deliveryProjectId, todo.id, {
          expectedRowVersion: todo.rowVersion,
          assigneeId: assigneeId || null,
        }),
      ),
    remove: (todo) =>
      write(todo.id, () =>
        teamTodosRepository.remove(deliveryProjectId, todo.id),
      ),
    reload,
  };
}
