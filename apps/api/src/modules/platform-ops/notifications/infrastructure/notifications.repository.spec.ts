import type { DatabaseService } from '#kernel/db/database.service';
import { NotificationsRepository } from './notifications.repository';

describe('NotificationsRepository.createForUser', () => {
  let query: jest.Mock;
  let repository: NotificationsRepository;

  const row = (projectId: string | null) => ({
    id: 'n-1',
    title: 'GitHub repository deleted',
    body: 'acme/app was deleted from GitHub.',
    event_code: 'project_github_repo_deleted',
    read_at: null,
    created_at: '2026-11-09T00:00:00.000Z',
    project_id: projectId,
    delivery_project_id: null,
    group_id: null,
  });
  const input = {
    userId: 'user-1',
    projectId: 'project-1',
    eventCode: 'project_github_repo_deleted',
    title: 'GitHub repository deleted',
    body: 'acme/app was deleted from GitHub.',
  };
  const projectDeleted = () =>
    Object.assign(new Error('violates foreign key constraint'), {
      code: '23503',
      constraint: 'notifications_project_id_fkey',
    });
  const projectIdOfCall = (call: number) =>
    (query.mock.calls[call] as [string, unknown[]])[1][1];

  beforeEach(() => {
    query = jest.fn();
    repository = new NotificationsRepository({
      query,
    } as unknown as DatabaseService);
  });

  it('stores the notification with its Project', async () => {
    query.mockResolvedValueOnce({ rows: [row('project-1')] });

    await expect(repository.createForUser(input)).resolves.toMatchObject({
      id: 'n-1',
      projectId: 'project-1',
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(projectIdOfCall(0)).toBe('project-1');
  });

  it('stores it without the Project when that Project was deleted before delivery', async () => {
    query
      .mockRejectedValueOnce(projectDeleted())
      .mockResolvedValueOnce({ rows: [row(null)] });

    await expect(repository.createForUser(input)).resolves.toMatchObject({
      id: 'n-1',
      projectId: null,
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(projectIdOfCall(1)).toBeNull();
  });

  it('does not retry a different failure', async () => {
    query.mockRejectedValueOnce(
      Object.assign(new Error('violates foreign key constraint'), {
        code: '23503',
        constraint: 'notifications_user_id_fkey',
      }),
    );

    await expect(repository.createForUser(input)).rejects.toThrow(
      'violates foreign key constraint',
    );
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('does not retry a notification that named no Project', async () => {
    query.mockRejectedValueOnce(projectDeleted());

    await expect(
      repository.createForUser({ ...input, projectId: null }),
    ).rejects.toThrow();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
