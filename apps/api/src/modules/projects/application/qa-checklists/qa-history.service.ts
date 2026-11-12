import { Injectable } from '@nestjs/common';
import { badRequest } from '#kernel/http/coded-errors';
import { isUUID } from 'class-validator';
import { QaHistoryRepository } from '../../infrastructure/qa-history.repository';
import type { QaHistoryEvent } from '../../infrastructure/qa-history.repository';
import { QaProjectContextService } from './qa-project-context.service';
import {
  QA_HISTORY_EXPORT_MAX_EVENTS,
  renderQaHistoryWorkbook,
} from './qa-history.workbook';

const EXPORT_PAGE = 1000;

@Injectable()
export class QaHistoryService {
  constructor(
    private readonly context: QaProjectContextService,
    private readonly history: QaHistoryRepository,
  ) {}

  async list(
    projectId: string,
    userId: string,
    query: {
      itemId?: string;
      iterationId?: string;
      before?: string;
    },
  ) {
    await this.context.requireProject(projectId, userId);
    for (const id of [query.itemId, query.iterationId]) {
      if (id !== undefined && !isUUID(id))
        throw badRequest('QA_HISTORY_FILTER_INVALID', 'Invalid history filter');
    }
    const before =
      query.before === undefined ? undefined : decodeCursor(query.before);
    const rows = await this.history.list(projectId, {
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.iterationId ? { iterationId: query.iterationId } : {}),
      ...(before ? { before } : {}),
    });
    const events = rows.slice(0, 50);
    const last = events.at(-1);
    return {
      events,
      nextCursor:
        rows.length > 50 && last
          ? Buffer.from(
              JSON.stringify({ at: last.createdAt, id: last.id }),
            ).toString('base64url')
          : null,
    };
  }

  /**
   * The whole audit trail (one Iteration when `iterationId` is given) as an
   * .xlsx file, for anyone who can see the Project. Pages through the same
   * query the timeline reads, newest first, up to QA_HISTORY_EXPORT_MAX_EVENTS.
   */
  async exportWorkbook(
    projectId: string,
    userId: string,
    query: { iterationId?: string },
  ): Promise<{ filename: string; content: Buffer }> {
    const project = await this.context.requireProject(projectId, userId);
    if (query.iterationId !== undefined && !isUUID(query.iterationId)) {
      throw badRequest('QA_HISTORY_FILTER_INVALID', 'Invalid history filter');
    }
    const events: QaHistoryEvent[] = [];
    let before: { at: string; id: string } | undefined;
    let truncated = false;
    for (;;) {
      const rows = await this.history.list(projectId, {
        ...(query.iterationId ? { iterationId: query.iterationId } : {}),
        ...(before ? { before } : {}),
        limit: EXPORT_PAGE + 1,
      });
      events.push(...rows.slice(0, EXPORT_PAGE));
      if (events.length >= QA_HISTORY_EXPORT_MAX_EVENTS) {
        truncated =
          rows.length > EXPORT_PAGE ||
          events.length > QA_HISTORY_EXPORT_MAX_EVENTS;
        events.length = Math.min(events.length, QA_HISTORY_EXPORT_MAX_EVENTS);
        break;
      }
      const last = rows.slice(0, EXPORT_PAGE).at(-1);
      if (rows.length <= EXPORT_PAGE || !last) break;
      before = { at: last.createdAt, id: last.id };
    }
    const generatedAt = new Date();
    const safeName =
      project.name.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') ||
      'project';
    return {
      filename: `${safeName}-qa-audit-trail-${generatedAt.toISOString().slice(0, 10)}.xlsx`,
      content: await renderQaHistoryWorkbook({
        projectName: project.name,
        generatedAt,
        events,
        truncated,
      }),
    };
  }
}

function decodeCursor(value: string): { at: string; id: string } {
  try {
    if (value.length > 300) throw new Error();
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString(),
    ) as Record<string, unknown>;
    if (
      typeof parsed.at !== 'string' ||
      !Number.isFinite(Date.parse(parsed.at)) ||
      typeof parsed.id !== 'string' ||
      !/^(qa|progress|signoff):[\da-f-]{36}$/i.test(parsed.id)
    )
      throw new Error();
    return { at: parsed.at, id: parsed.id };
  } catch {
    throw badRequest('QA_HISTORY_CURSOR_INVALID', 'Invalid history cursor');
  }
}
