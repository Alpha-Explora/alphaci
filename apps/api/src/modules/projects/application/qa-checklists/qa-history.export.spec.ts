import { NotFoundException } from '@nestjs/common';
import { Workbook } from 'exceljs';

import type { QaHistoryRepository } from '../../infrastructure/qa-history.repository';
import type { QaProjectContextService } from './qa-project-context.service';
import { QaHistoryService } from './qa-history.service';

const event = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `qa:${String(n).padStart(8, '0')}-e89b-42d3-a456-426614174000`,
  createdAt: `2026-10-27T00:00:${String(n % 60).padStart(2, '0')}.000Z`,
  iterationId: 'it-1',
  iterationNumber: 1,
  runId: 'run-1',
  itemId: 'item-1',
  title: 'Pay with a saved card',
  requirementName: 'Checkout',
  actorLogin: 'ana',
  type: 'status_changed',
  fromStatus: 'pending',
  toStatus: 'failed',
  payload: { severity: 'major', notes: '=HYPERLINK("x")' },
  ...extra,
});

function fixture(pages: unknown[][]) {
  const context = {
    requireProject: jest.fn().mockResolvedValue({ name: 'St Peter / Shop' }),
  };
  const history = { list: jest.fn() };
  for (const page of pages) history.list.mockResolvedValueOnce(page);
  return {
    context,
    history,
    service: new QaHistoryService(
      context as unknown as QaProjectContextService,
      history as unknown as QaHistoryRepository,
    ),
  };
}

async function readRows(content: Buffer): Promise<unknown[][]> {
  const workbook = new Workbook();
  await workbook.xlsx.load(
    content as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const rows: unknown[][] = [];
  workbook.getWorksheet('Audit trail')?.eachRow((row) => {
    rows.push((row.values as unknown[]).slice(1));
  });
  return rows;
}

describe('QA audit trail export', () => {
  it('checks membership before reading history', async () => {
    const { service, context, history } = fixture([]);
    context.requireProject.mockRejectedValue(new NotFoundException());
    await expect(
      service.exportWorkbook('p', 'viewer', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(history.list).not.toHaveBeenCalled();
  });

  it('pages through every event and writes notes as plain text', async () => {
    const first = Array.from({ length: 1001 }, (_, i) => event(i));
    const second = [event(2000, { type: 'progress_changed', payload: {} })];
    const { service, history } = fixture([first, second]);

    const file = await service.exportWorkbook('p', 'viewer', {});

    expect(file.filename).toMatch(
      /^St-Peter-Shop-qa-audit-trail-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
    expect(history.list).toHaveBeenCalledTimes(2);
    expect(history.list.mock.calls[1]?.[1]).toMatchObject({
      before: { id: first[999]?.id },
      limit: 1001,
    });
    const rows = await readRows(file.content);
    expect(rows).toHaveLength(1 + 1000 + 1);
    expect(rows[1]).toEqual([
      '2026-10-27 00:00:00',
      1,
      'Checkout',
      'Pay with a saved card',
      '@ana',
      'QA verification',
      'pending',
      'failed',
      'severity: major | notes: =HYPERLINK("x")',
    ]);
    expect(rows[1001]?.[5]).toBe('Developer progress');
  });
});
