import type { QaImportPreviewResponse } from '@/shared/api/contracts';
import { request } from '@/shared/api/request';
import { importRequirements } from '../model/qa-import-rules';
import type {
  ImportRow,
  ImportSheet,
  ImportStory,
} from '../model/qa-import-types';
import { requirementsRepository } from './requirements-repository';
export const qaImportRepository = {
  async preview(projectId: string, file: File): Promise<ImportSheet[]> {
    const body = new FormData();
    body.append('file', file);
    return (
      await request<QaImportPreviewResponse>(
        `/delivery-projects/${encodeURIComponent(projectId)}/qa-import-preview`,
        {
          method: 'POST',
          body,
        },
      )
    ).sheets;
  },
  async requirements(projectId: string, rows: ImportRow[]): Promise<string> {
    const result = await requirementsRepository.createBatch(projectId, {
      kind: 'functional',
      requirements: importRequirements(rows),
    });
    return `${result.length} Features imported.`;
  },
  async testCases(story: ImportStory, rows: ImportRow[]): Promise<string> {
    const result = await request<{ added: number; skipped: number }>(
      `/requirements/${encodeURIComponent(story.requirementId)}/items/${encodeURIComponent(story.itemId)}/test-cases/import`,
      {
        method: 'POST',
        body: JSON.stringify({
          rows: rows.map((row) => ({
            category: row.group,
            title: row.title,
            expectedResult: row.details,
          })),
        }),
      },
    );
    return `${result.added} test cases imported; ${result.skipped} identical cases skipped.`;
  },
};
