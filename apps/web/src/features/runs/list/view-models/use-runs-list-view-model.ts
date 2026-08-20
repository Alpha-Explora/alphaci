"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { runsRepository } from "../../data/runs-repository";
import {
  groupRunsByProject,
  summarizeRuns,
  toUserError,
} from "../../model/runs-rules";
import type {
  ProjectRunGroup,
  RunGroup,
  RunsStatus,
  RunsSummary,
} from "../../model/runs-types";

export interface RunsListViewModel {
  /** Repository filter taken from ?repoFullName, or undefined for all. */
  repoFullName: string | undefined;
  /** Just the repo name, for headings. */
  visibleRepoName: string | undefined;
  runs: RunGroup[];
  grouped: ProjectRunGroup[];
  summary: RunsSummary;
  status: RunsStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  isCollapsed: (repoFullName: string) => boolean;
  toggleRepo: (repoFullName: string) => void;
  reload: () => void;
}

/**
 * ViewModel for the runs list.
 *
 * Owns the fetch, the repository filter, and the per-project collapse state,
 * and exposes `status` plus a user-safe `error` as the skill requires of any
 * interactive view-model.
 *
 * Calls useSearchParams, so it must only run inside a Suspense boundary —
 * RunsListContent is rendered inside the one RunsListView provides. Hoisting
 * this above that boundary opts the whole route into dynamic rendering.
 */
export function useRunsListViewModel(options: {
  /** Guests see the sign-in gate instead of a fetch. */
  guest: boolean;
}): RunsListViewModel {
  const { guest } = options;
  const searchParams = useSearchParams();
  const repoFullName = searchParams.get("repoFullName") ?? undefined;

  const [runs, setRuns] = useState<RunGroup[]>([]);
  const [fetchStatus, setFetchStatus] = useState<RunsStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  // Expanded, not collapsed — an empty set means every repository starts
  // closed, which is the intended first view. Tracking the inverse would need
  // an effect to seed the set once runs arrive, and until that effect ran the
  // list would paint fully expanded and then snap shut.
  const [expandedRepos, setExpandedRepos] = useState<ReadonlySet<string>>(
    new Set(),
  );

  // Bumped on every load so a resolution from a superseded request cannot
  // overwrite a newer one. The route had no such guard: switching repository
  // filters quickly could land stale runs in state.
  const requestId = useRef(0);
  const [reloadNonce, setReloadNonce] = useState(0);

  const grouped = useMemo(() => groupRunsByProject(runs), [runs]);
  const summary = useMemo(() => summarizeRuns(runs), [runs]);

  useEffect(() => {
    // Guests never fetch; `status` is derived as "idle" for them below.
    if (guest) return;

    requestId.current += 1;
    const id = requestId.current;
    let active = true;

    runsRepository
      .list(repoFullName)
      .then((loaded) => {
        if (!active || id !== requestId.current) return;
        setRuns(loaded);
        setError(null);
        setFetchStatus("ready");
      })
      .catch((err: unknown) => {
        if (!active || id !== requestId.current) return;
        setError(toUserError(err));
        setFetchStatus("error");
      });

    return () => {
      active = false;
    };
  }, [repoFullName, guest, reloadNonce]);

  const toggleRepo = useCallback((repo: string) => {
    setExpandedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(repo)) {
        next.delete(repo);
      } else {
        next.add(repo);
      }
      return next;
    });
  }, []);

  const isCollapsed = useCallback(
    (repo: string) => !expandedRepos.has(repo),
    [expandedRepos],
  );

  const reload = useCallback(() => {
    setFetchStatus("loading");
    setReloadNonce((n) => n + 1);
  }, []);

  return {
    repoFullName,
    visibleRepoName: repoFullName?.split("/")[1] ?? repoFullName,
    runs,
    grouped,
    summary,
    status: guest ? "idle" : fetchStatus,
    error,
    isCollapsed,
    toggleRepo,
    reload,
  };
}
