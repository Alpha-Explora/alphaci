import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { QaHistoryRepository } from '../../infrastructure/qa-history.repository';
import type { QaProjectContextService } from './qa-project-context.service';
import { QaHistoryService } from './qa-history.service';

function fixture() {
  const context = { requireProject: jest.fn().mockResolvedValue({}) };
  const history = { list: jest.fn().mockResolvedValue([]) };
  return {
    context,
    history,
    service: new QaHistoryService(
      context as unknown as QaProjectContextService,
      history as unknown as QaHistoryRepository,
    ),
  };
}
describe('QA progress history access and pagination', () => {
  it('checks membership before querying or parsing filters', async () => {
    const { service, context, history } = fixture();
    context.requireProject.mockRejectedValue(new NotFoundException());
    await expect(
      service.list('other-project', 'viewer', { before: 'bad' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(history.list).not.toHaveBeenCalled();
  });
  it('rejects malformed filters and cursors', async () => {
    const { service, history } = fixture();
    for (const query of [
      { itemId: 'bad' },
      { iterationId: 'bad' },
      { before: 'bad' },
      { before: 'x'.repeat(301) },
    ]) {
      await expect(
        service.list('project', 'viewer', query),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(history.list).not.toHaveBeenCalled();
  });
  it('uses a stable timestamp and id cursor, scoped to this project', async () => {
    const { service, history } = fixture();
    const id = 'qa:123e4567-e89b-42d3-a456-426614174000';
    const at = '2026-10-27T00:00:00.000Z';
    history.list.mockResolvedValue(
      Array.from({ length: 51 }, () => ({ id, createdAt: at })),
    );
    const page = await service.list('project', 'viewer', {});
    expect(page.events).toHaveLength(50);
    expect(page.nextCursor).toBeTruthy();
    await service.list('project', 'viewer', { before: page.nextCursor! });
    expect(history.list).toHaveBeenLastCalledWith('project', {
      before: { at, id },
    });
  });
});
