import { plainToInstance } from 'class-transformer';

import type { PlatformAppRole } from '#kernel/ports/platform-admin.port';
import type {
  ProjectTodoRow,
  ProjectTodosRepository,
} from '../../infrastructure/project-todos.repository';
import { UpdateProjectTodoDto } from './dto/project-todo.dto';
import {
  canEditTodo,
  PROJECT_TODO_ASSIGNED_EVENT,
  ProjectTodosService,
} from './project-todos.service';
import type { QaAccessService } from './qa-access.service';
import type { QaProjectContextService } from './qa-project-context.service';

const DP = 'dp-1';
const MEMBERS = [
  { id: 'dev-1', login: 'dev' },
  { id: 'qa-1', login: 'qa' },
  { id: 'lead-1', login: 'lead' },
];

const todoRow = (overrides: Partial<ProjectTodoRow> = {}): ProjectTodoRow => ({
  id: 'todo-1',
  delivery_project_id: DP,
  title: 'Rotate the staging secret',
  notes: null,
  assignee_id: null,
  assignee_login: null,
  due_date: null,
  priority: null,
  status: 'open',
  created_by: 'dev-1',
  created_by_login: 'dev',
  created_at: '2026-10-28T00:00:00.000Z',
  updated_at: '2026-10-28T00:00:00.000Z',
  completed_at: null,
  completed_by_login: null,
  row_version: 1,
  ...overrides,
});

function setup(role: PlatformAppRole = 'member') {
  const todos = {
    list: jest.fn().mockResolvedValue([todoRow()]),
    find: jest.fn().mockResolvedValue(todoRow()),
    insert: jest
      .fn()
      .mockImplementation(
        (input: {
          assignee: { id: string; login: string } | null;
          title: string;
        }) =>
          Promise.resolve(
            todoRow({
              title: input.title,
              assignee_id: input.assignee?.id ?? null,
              assignee_login: input.assignee?.login ?? null,
            }),
          ),
      ),
    update: jest.fn().mockResolvedValue(todoRow({ row_version: 2 })),
    delete: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<ProjectTodosRepository>;
  const context = {
    requireProject: jest.fn().mockResolvedValue({
      deliveryProjectId: DP,
      groupId: 'group-1',
      name: 'Checkout',
      repositories: [],
    }),
    anchorProjectId: jest.fn().mockResolvedValue('p-web'),
  } as unknown as jest.Mocked<QaProjectContextService>;
  const access = {
    findAppRole: jest.fn().mockResolvedValue(role),
    listWorkspaceMembers: jest.fn().mockResolvedValue(MEMBERS),
  } as unknown as jest.Mocked<QaAccessService>;
  const notifications = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new ProjectTodosService(
    todos,
    context,
    access,
    notifications,
  );
  return { service, todos, context, access, notifications };
}

const actor = (userId = 'dev-1', userLogin = 'dev') => ({ userId, userLogin });

describe('ProjectTodosService (phase 4: team to-dos)', () => {
  it('lists the to-dos with who may edit each, and the team to assign', async () => {
    const { service, todos } = setup('member');
    todos.list.mockResolvedValue([
      todoRow(),
      todoRow({ id: 'todo-2', created_by: 'qa-1' }),
    ]);

    const list = await service.list(DP, 'dev-1');

    expect(list.todos.map((todo) => [todo.id, todo.canEdit])).toEqual([
      ['todo-1', true],
      ['todo-2', false],
    ]);
    expect(list.assignees).toEqual(MEMBERS);
  });

  it('adds a to-do assigned to a teammate and notifies them, not the author', async () => {
    const { service, todos, notifications } = setup('member');

    const todo = await service.create(DP, actor(), {
      title: '  Resolve the uat merge conflict ',
      assigneeId: 'qa-1',
      dueDate: '2026-11-02',
      priority: 'high',
    });

    expect(todos.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Resolve the uat merge conflict',
        assignee: { id: 'qa-1', login: 'qa' },
        dueDate: '2026-11-02',
        priority: 'high',
        createdBy: 'dev-1',
      }),
    );
    expect(todo.assignee).toEqual({ id: 'qa-1', login: 'qa' });
    expect(notifications.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'qa-1',
        projectId: 'p-web',
        eventCode: PROJECT_TODO_ASSIGNED_EVENT,
        title: 'To-do for you in Checkout',
      }),
    );
  });

  it('does not notify someone who assigns themselves', async () => {
    const { service, notifications } = setup('member');
    await service.create(DP, actor(), { title: 'Mine', assigneeId: 'dev-1' });
    expect(notifications.record).not.toHaveBeenCalled();
  });

  it('refuses an assignee outside the team, a blank title and an impossible date', async () => {
    const { service, todos } = setup('member');
    await expect(
      service.create(DP, actor(), { title: 'x', assigneeId: 'stranger' }),
    ).rejects.toMatchObject({
      response: { code: 'PROJECT_TODO_ASSIGNEE_INVALID' },
    });
    await expect(
      service.create(DP, actor(), { title: '   ' }),
    ).rejects.toMatchObject({
      response: { code: 'PROJECT_TODO_TITLE_REQUIRED' },
    });
    await expect(
      service.create(DP, actor(), { title: 'x', dueDate: '2026-02-30' }),
    ).rejects.toMatchObject({
      response: { code: 'PROJECT_TODO_DATE_INVALID' },
    });
    expect(todos.insert).not.toHaveBeenCalled();
  });

  it('gives an unknown role nothing', async () => {
    const { service, todos } = setup('guest' as PlatformAppRole);
    await expect(
      service.create(DP, actor(), { title: 'x' }),
    ).rejects.toMatchObject({
      response: { code: 'PROJECT_TODO_FORBIDDEN' },
    });
    expect(todos.insert).not.toHaveBeenCalled();
  });

  it('lets anyone on the team tick a to-do done, but only its creator, a PO or admin edit it', async () => {
    const { service, todos } = setup('qa');
    await service.update(DP, 'todo-1', actor('qa-1', 'qa'), {
      expectedRowVersion: 1,
      status: 'done',
    });
    expect(todos.update).toHaveBeenCalledWith(DP, 'todo-1', 1, {
      actorLogin: 'qa',
      status: 'done',
    });

    await expect(
      service.update(DP, 'todo-1', actor('qa-1', 'qa'), {
        expectedRowVersion: 1,
        title: 'Mine now',
      }),
    ).rejects.toMatchObject({ response: { code: 'PROJECT_TODO_FORBIDDEN' } });
  });

  it('lets someone who is not the creator tick it through the validation pipe', async () => {
    // The global ValidationPipe hands the service a class instance, whose
    // optional fields exist as undefined keys; a tick must still be a tick.
    const { service, todos } = setup('qa');
    const dto = plainToInstance(UpdateProjectTodoDto, {
      expectedRowVersion: 1,
      status: 'done',
    });

    await service.update(DP, 'todo-1', actor('qa-1', 'qa'), dto);

    expect(todos.update).toHaveBeenCalledWith(DP, 'todo-1', 1, {
      actorLogin: 'qa',
      status: 'done',
    });
  });

  it('notifies a newly assigned teammate on edit, and answers a moved row version with STALE', async () => {
    const { service, todos, notifications } = setup('lead');
    todos.update.mockResolvedValueOnce(
      todoRow({ assignee_id: 'qa-1', assignee_login: 'qa', row_version: 2 }),
    );

    await service.update(DP, 'todo-1', actor('lead-1', 'lead'), {
      expectedRowVersion: 1,
      assigneeId: 'qa-1',
    });
    expect(notifications.record).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'qa-1' }),
    );

    todos.update.mockResolvedValueOnce(null);
    await expect(
      service.update(DP, 'todo-1', actor('lead-1', 'lead'), {
        expectedRowVersion: 1,
        priority: 'low',
      }),
    ).rejects.toMatchObject({ response: { code: 'PROJECT_TODO_STALE' } });
  });

  it('deletes only for its creator, a PO or an admin, and 404s a missing one', async () => {
    const { service, todos } = setup('qa');
    await expect(service.remove(DP, 'todo-1', 'qa-1')).rejects.toMatchObject({
      response: { code: 'PROJECT_TODO_FORBIDDEN' },
    });
    todos.find.mockResolvedValueOnce(null);
    await expect(service.remove(DP, 'todo-9', 'qa-1')).rejects.toMatchObject({
      response: { code: 'PROJECT_TODO_NOT_FOUND' },
    });
    expect(todos.delete).not.toHaveBeenCalled();
  });

  it('canEditTodo: creator, lead or admin', () => {
    expect(canEditTodo({ created_by: 'u-1' }, 'u-1', 'member')).toBe(true);
    expect(canEditTodo({ created_by: 'u-1' }, 'u-2', 'lead')).toBe(true);
    expect(canEditTodo({ created_by: 'u-1' }, 'u-2', 'admin')).toBe(true);
    expect(canEditTodo({ created_by: 'u-1' }, 'u-2', 'qa')).toBe(false);
  });
});
