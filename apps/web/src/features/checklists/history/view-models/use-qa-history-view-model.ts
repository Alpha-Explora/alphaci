'use client';
import { useEffect, useRef, useState } from 'react';
import { downloadBlob } from '@/shared/browser/download-blob';
import { qaHistoryRepository } from '../../data/qa-history-repository';
import type { QaHistoryPage } from '../../model/qa-history-types';

const LOAD_ERROR = 'History could not be loaded. Try again.';
const EMPTY_PAGE: QaHistoryPage = { events: [], nextCursor: null };

/** The pages read for one filter (and reload), tagged with it so a stale answer is ignored. */
interface HistoryResult {
  key: string;
  page: QaHistoryPage;
  error: string | null;
}

function historyFilters(
  itemId?: string,
  iterationId?: string,
): { itemId?: string; iterationId?: string } {
  return {
    ...(itemId ? { itemId } : {}),
    ...(iterationId ? { iterationId } : {}),
  };
}

/** What the panel shows for the current filter: the answer for this key only. */
function historyView(
  result: HistoryResult | null,
  key: string,
  open: boolean,
  loadingMore: boolean,
) {
  const current = result?.key === key ? result : null;
  const error = current ? current.error : null;
  const loading = open && (!current || loadingMore);
  const status = !open
    ? 'idle'
    : loading
      ? 'loading'
      : error
        ? 'error'
        : 'ready';
  return {
    current,
    page: current ? current.page : EMPTY_PAGE,
    error,
    loading,
    status,
  };
}

export function useQaHistoryViewModel(
  projectId: string,
  itemId?: string,
  iterationId?: string,
) {
  const [open, setOpen] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<HistoryResult | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const moreRef = useRef<AbortController | null>(null);
  const key = JSON.stringify([projectId, itemId, iterationId, nonce]);

  // The first page: state is set only in the callbacks (react/set-state-in-effect).
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    qaHistoryRepository
      .list(projectId, historyFilters(itemId, iterationId), controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setResult({ key, page, error: null });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ key, page: EMPTY_PAGE, error: LOAD_ERROR });
      });
    return () => {
      controller.abort();
      moreRef.current?.abort();
    };
  }, [open, key, projectId, itemId, iterationId]);

  const { current, page, error, loading, status } = historyView(
    result,
    key,
    open,
    loadingMore,
  );

  async function loadMore() {
    const before = page.nextCursor;
    if (!before || loading || !current) return;
    moreRef.current?.abort();
    const controller = new AbortController();
    moreRef.current = controller;
    setLoadingMore(true);
    try {
      const next = await qaHistoryRepository.list(
        projectId,
        { ...historyFilters(itemId, iterationId), before },
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setResult({
          key,
          page: { ...next, events: [...page.events, ...next.events] },
          error: null,
        });
      }
    } catch {
      if (!controller.signal.aborted)
        setResult({ key, page, error: LOAD_ERROR });
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }

  return {
    status,
    open,
    setOpen,
    ...page,
    loading,
    error,
    reload: () => setNonce((value) => value + 1),
    loadMore: () => void loadMore(),
    exporting,
    exportError,
    /** Downloads the whole audit trail (Project or Iteration) as .xlsx. */
    exportWorkbook: async () => {
      if (exporting) return;
      setExporting(true);
      setExportError(null);
      try {
        const blob = await qaHistoryRepository.exportWorkbook(
          projectId,
          iterationId,
        );
        const day = new Date().toISOString().slice(0, 10);
        downloadBlob(`qa-audit-trail-${day}.xlsx`, blob);
      } catch {
        setExportError('The audit trail could not be downloaded. Try again.');
      } finally {
        setExporting(false);
      }
    },
  };
}
