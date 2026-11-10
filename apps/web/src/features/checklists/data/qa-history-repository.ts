import { request, requestBlob } from '@/shared/api/request';
import type { QaHistoryPage } from '../model/qa-history-types';

export const qaHistoryRepository = {
  list(
    projectId: string,
    filter: { itemId?: string; iterationId?: string; before?: string },
    signal: AbortSignal,
  ): Promise<QaHistoryPage> {
    const query = new URLSearchParams(filter);
    return request<QaHistoryPage>(
      `/delivery-projects/${encodeURIComponent(projectId)}/qa-history?${query}`,
      { signal },
    );
  },
  /** The Dev and QA audit trail as an Excel workbook (one Iteration when given). */
  exportWorkbook(projectId: string, iterationId?: string): Promise<Blob> {
    const query = new URLSearchParams(iterationId ? { iterationId } : {});
    const suffix = query.toString() ? `?${query}` : '';
    return requestBlob(
      `/delivery-projects/${encodeURIComponent(projectId)}/qa-history/export${suffix}`,
    );
  },
};
