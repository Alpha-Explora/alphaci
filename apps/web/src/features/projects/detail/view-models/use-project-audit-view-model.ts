"use client";

import { useState } from "react";

import { projectsRepository } from "../../data/projects-repository";
import type { ProjectStatus } from "../../model/projects-types";
import {
  appendAuditPage,
  AUDIT_PAGE_SIZE,
  normalizeAuditPage,
  type AuditPage,
  type AuditRow,
} from "../model/audit-event-rules";
import { useLazyProjectQuery } from "./use-lazy-project-query";

export interface ProjectAuditViewModel {
  status: ProjectStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  /** False: the deployment does not record audit events. */
  recording: boolean;
  /** Newest first, every page loaded so far. */
  rows: AuditRow[];
  /** When the shown rows were read: the base for their "5m ago". */
  readAt: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError: string | null;
  loadMore: () => Promise<void>;
}

interface AuditState {
  page: AuditPage;
  readAt: number;
}

const LOAD_ERROR = "Unable to load audit events.";
const LOAD_MORE_ERROR = "Unable to load older audit events. Try again in a moment.";

async function loadFirstPage(projectId: string): Promise<AuditState> {
  const response = await projectsRepository.audit(projectId, { limit: AUDIT_PAGE_SIZE });
  return { page: normalizeAuditPage(response), readAt: Date.now() };
}

/**
 * ViewModel for the repository Audit tab: the newest page on first open
 * (kept across tab switches), then older pages on "Load more", each asked for
 * with the cursor the previous page returned, unchanged.
 */
export function useProjectAuditViewModel(options: {
  projectId: string;
  enabled: boolean;
}): ProjectAuditViewModel {
  const { projectId, enabled } = options;
  const query = useLazyProjectQuery<AuditState>({
    projectId,
    enabled,
    load: loadFirstPage,
    errorMessage: LOAD_ERROR,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const state = query.data;
  const next = state?.page.next ?? null;

  async function loadMore() {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const response = await projectsRepository.audit(projectId, {
        limit: AUDIT_PAGE_SIZE,
        before: next,
      });
      const page = normalizeAuditPage(response);
      const readAt = Date.now();
      query.setData((current) =>
        current ? { page: appendAuditPage(current.page, page), readAt } : current,
      );
    } catch {
      setLoadMoreError(LOAD_MORE_ERROR);
    } finally {
      setLoadingMore(false);
    }
  }

  return {
    status: query.status,
    error: query.error,
    recording: state?.page.enabled ?? true,
    rows: state?.page.items ?? [],
    readAt: state?.readAt ?? 0,
    hasMore: next !== null,
    loadingMore,
    loadMoreError,
    loadMore,
  };
}
