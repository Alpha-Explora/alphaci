"use client";

import { useEffect, useRef, useState } from "react";

import { projectsRepository } from "../../data/projects-repository";
import type { ProjectStatus } from "../../model/projects-types";
import {
  appendAuditPage,
  AUDIT_PAGE_SIZE,
  filterAuditRows,
  normalizeAuditPage,
  showAuditFilters,
  type AuditFilter,
  type AuditGithubSync,
  type AuditPage,
  type AuditRow,
} from "../model/audit-event-rules";
import { githubReadFailure } from "../model/github-read-failure";
import { useLazyProjectQuery } from "./use-lazy-project-query";

export interface ProjectAuditViewModel {
  status: ProjectStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  /** False: the deployment does not record audit events. */
  recording: boolean;
  /** Newest first, every page loaded so far. */
  rows: AuditRow[];
  /** `rows` through the source filter. */
  filteredRows: AuditRow[];
  filter: AuditFilter;
  setFilter: (filter: AuditFilter) => void;
  /** Offer the All / ALPHACI / GitHub chips: the trail can hold GitHub activity. */
  showFilters: boolean;
  /** How fresh the GitHub rows are; null on a backend that does not read GitHub. */
  githubSync: AuditGithubSync | null;
  syncing: boolean;
  syncError: string | null;
  /** Set when the sync failed because GitHub needs the viewer to sign in again. */
  syncSignInHref: string | null;
  /** Asks the server to read GitHub now, then re-reads the first page. */
  syncNow: () => Promise<void>;
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

interface SyncFailure {
  message: string;
  signInHref: string | null;
}

const LOAD_ERROR = "Unable to load audit events.";
const LOAD_MORE_ERROR = "Unable to load older audit events. Try again in a moment.";

/** A "stale" first import is still running server-side: look again this often, this many times. */
export const AUDIT_STALE_REFRESH_MS = 5000;
export const AUDIT_STALE_REFRESH_MAX = 2;

async function loadFirstPage(projectId: string): Promise<AuditState> {
  const response = await projectsRepository.audit(projectId, {
    limit: AUDIT_PAGE_SIZE,
  });
  return { page: normalizeAuditPage(response), readAt: Date.now() };
}

/** The shown page's parts; empty while loading. */
function pageParts(state: AuditState | null): {
  next: string | null;
  rows: AuditRow[];
  githubSync: AuditGithubSync | null;
  recording: boolean;
  readAt: number;
} {
  if (!state)
    return {
      next: null,
      rows: [],
      githubSync: null,
      recording: true,
      readAt: 0,
    };
  const { page, readAt } = state;
  return {
    next: page.next,
    rows: page.items,
    githubSync: page.githubSync,
    recording: page.enabled,
    readAt,
  };
}

interface StaleRefreshInput {
  projectId: string;
  enabled: boolean;
  stale: boolean;
  /** Changes with every shown page, so each re-read re-arms the timer. */
  readAt: number;
  olderLoaded: () => boolean;
  replace: (next: AuditState) => void;
}

/**
 * While the first GitHub import is still running ("stale"), re-reads the first
 * page after a pause, at most AUDIT_STALE_REFRESH_MAX times. Stops on ok/failed,
 * once older pages were loaded (their rows are not stomped), and on unmount,
 * tab disable or project change.
 */
function useStaleAuditRefresh(input: StaleRefreshInput) {
  const { projectId, enabled, stale, readAt, olderLoaded, replace } = input;
  const attempts = useRef({ projectId, count: 0 });
  const latest = useRef({ olderLoaded, replace });
  useEffect(() => {
    latest.current = { olderLoaded, replace };
  });

  useEffect(() => {
    if (attempts.current.projectId !== projectId) attempts.current = { projectId, count: 0 };
    if (!enabled || !stale || attempts.current.count >= AUDIT_STALE_REFRESH_MAX) return;
    let active = true;
    const timer = setTimeout(() => {
      if (latest.current.olderLoaded()) return;
      attempts.current.count += 1;
      loadFirstPage(projectId)
        .then((state) => {
          if (active) latest.current.replace(state);
        })
        .catch(() => undefined);
    }, AUDIT_STALE_REFRESH_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [projectId, enabled, stale, readAt]);
}

function syncFailure(cause: unknown, projectId: string): SyncFailure {
  const failure = githubReadFailure(cause, {
    projectId,
    subject: "sync this repository's GitHub activity",
    notFound: "This repository is not available to you, or it no longer exists.",
    fallback: "Couldn't sync with GitHub. Try again in a moment.",
  });
  return { message: failure.message, signInHref: failure.signInHref };
}

/**
 * ViewModel for the repository Audit tab: the newest page on first open
 * (kept across tab switches), then older pages on "Load more", each asked for
 * with the cursor the previous page returned, unchanged. "Sync now" asks the
 * server to read GitHub, then replaces what is shown with a fresh first page.
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
  const [filter, setFilter] = useState<AuditFilter>("all");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<SyncFailure | null>(null);
  const { next, rows, githubSync, recording, readAt } = pageParts(query.data);
  const olderLoaded = useRef(false);
  useStaleAuditRefresh({
    projectId,
    enabled,
    stale: githubSync?.status === "stale",
    readAt,
    olderLoaded: () => olderLoaded.current,
    replace: query.replace,
  });

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
      olderLoaded.current = true;
      query.setData((current) =>
        current ? { page: appendAuditPage(current.page, page), readAt } : current,
      );
    } catch {
      setLoadMoreError(LOAD_MORE_ERROR);
    } finally {
      setLoadingMore(false);
    }
  }

  async function syncNow() {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      await projectsRepository.syncAudit(projectId);
      query.replace(await loadFirstPage(projectId));
      olderLoaded.current = false;
      setLoadMoreError(null);
    } catch (cause) {
      setSyncError(syncFailure(cause, projectId));
    } finally {
      setSyncing(false);
    }
  }

  return {
    status: query.status,
    error: query.error,
    recording,
    rows,
    // Client-side over the rows loaded so far: the endpoint has no source
    // filter, and older pages still arrive through "Load more".
    filteredRows: filterAuditRows(rows, filter),
    filter,
    setFilter,
    showFilters: showAuditFilters(rows, githubSync),
    githubSync,
    syncing,
    syncError: syncError ? syncError.message : null,
    syncSignInHref: syncError ? syncError.signInHref : null,
    syncNow,
    readAt,
    hasMore: next !== null,
    loadingMore,
    loadMoreError,
    loadMore,
  };
}
