import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { teamTodosRepository } from '@/features/checklists/data/team-todos-repository';
import {
  createTodoInput,
  normalizeTeamTodoList,
  todoChips,
  todoErrorMessage,
} from '@/features/checklists/model/team-todo-rules';
import type { TeamTodo } from '@/features/checklists/model/team-todo-types';
import { TeamTodosCard } from '@/features/checklists/todos';
import { notificationHref } from '@/features/notifications/model/notification-links';

/* Phase 4, item 13: team to-dos with an assignee, due date and priority. */

jest.mock('@/features/checklists/data/team-todos-repository', () => ({
  teamTodosRepository: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));
const repo = teamTodosRepository as jest.Mocked<typeof teamTodosRepository>;

const todo = (overrides: Partial<TeamTodo> = {}): TeamTodo => ({
  id: 'todo-1',
  title: 'Rotate the staging secret',
  notes: null,
  assignee: { id: 'qa-1', login: 'qa' },
  dueDate: null,
  priority: null,
  status: 'open',
  createdByLogin: 'dev',
  completedByLogin: null,
  rowVersion: 3,
  canEdit: true,
  ...overrides,
});

describe('team to-do rules', () => {
  it('reads the list, dropping broken rows', () => {
    const list = normalizeTeamTodoList({
      todos: [
        {
          id: 't1',
          title: 'A',
          status: 'done',
          rowVersion: 2,
          canEdit: true,
          assignee: { id: 'u', login: 'ana' },
          dueDate: '2026-11-01',
          priority: 'high',
        },
        { id: 't2' },
      ],
      assignees: [{ id: 'u', login: 'ana' }, { login: 'nobody' }],
    });
    expect(list.todos).toHaveLength(1);
    expect(list.todos[0]).toMatchObject({
      status: 'done',
      rowVersion: 2,
      canEdit: true,
      dueDate: '2026-11-01',
      priority: 'high',
    });
    expect(list.assignees).toEqual([{ id: 'u', login: 'ana' }]);
  });

  it('sends only what was filled in', () => {
    expect(
      createTodoInput({
        title: '  A  ',
        assigneeId: '',
        dueDate: '',
        priority: '',
      }),
    ).toEqual({ title: 'A' });
    expect(
      createTodoInput({
        title: 'A',
        assigneeId: 'u',
        dueDate: '2026-11-01',
        priority: 'low',
      }),
    ).toEqual({
      title: 'A',
      assigneeId: 'u',
      dueDate: '2026-11-01',
      priority: 'low',
    });
  });

  it('shows priority and how close the date is, but no date chip once done', () => {
    expect(
      todoChips(
        todo({ priority: 'urgent', dueDate: '2026-10-27' }),
        '2026-10-28',
      ).map((chip) => chip.label),
    ).toEqual(['Urgent', 'Overdue by 1 day']);
    expect(
      todoChips(todo({ dueDate: '2026-10-27', status: 'done' }), '2026-10-28'),
    ).toEqual([]);
  });

  it('explains a stale write in product words', () => {
    expect(
      todoErrorMessage({
        status: 409,
        details: { code: 'PROJECT_TODO_STALE' },
      }),
    ).toMatch(/changed this to-do/);
  });

  it('deep-links an assignment to the Checklists tab', () => {
    expect(
      notificationHref(
        {
          eventCode: 'project.todo.assigned',
          projectId: 'p-1',
          groupId: null,
          deliveryProjectId: null,
        },
        'member',
      ),
    ).toBe('/projects/p-1#checklists');
  });
});

describe('TeamTodosCard', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    jest.resetAllMocks();
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  async function mount() {
    await act(async () => {
      root.render(<TeamTodosCard deliveryProjectId="dp-1" />);
      await Promise.resolve();
    });
  }

  it('draws nothing on a backend without to-dos', async () => {
    repo.list.mockRejectedValue(
      Object.assign(new Error('not found'), { status: 404 }),
    );
    await mount();
    expect(host.innerHTML).toBe('');
  });

  it('lists open to-dos and ticks one done with its row version', async () => {
    repo.list.mockResolvedValue({
      todos: [todo()],
      assignees: [{ id: 'qa-1', login: 'qa' }],
    });
    repo.update.mockResolvedValue(todo({ status: 'done' }));
    await mount();

    expect(host.textContent).toContain('Team to-dos');
    expect(host.textContent).toContain('1 open');
    const checkbox = host.querySelector<HTMLInputElement>(
      '.team-todos__item input[type="checkbox"]',
    );
    await act(async () => {
      checkbox?.click();
      await Promise.resolve();
    });

    expect(repo.update).toHaveBeenCalledWith('dp-1', 'todo-1', {
      expectedRowVersion: 3,
      status: 'done',
    });
    expect(repo.list).toHaveBeenCalledTimes(2);
  });

  it("hides Delete and the assignee picker on someone else's to-do", async () => {
    repo.list.mockResolvedValue({
      todos: [todo({ canEdit: false })],
      assignees: [],
    });
    await mount();
    expect(host.textContent).not.toContain('Delete');
    expect(host.querySelector('.team-todos__assignee')).toBeNull();
    expect(host.textContent).toContain('@qa');
  });
});
