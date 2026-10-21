"use client";

/* These refs deliberately track the latest fetcher/options without changing
 * the dependency identity that controls a request. */

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/shared/api/request";

/**
 * Load state for any hierarchy resource. 403 and 404 are first-class UI states
 * (plan §2.0: 404 hides existence, 403 = known-but-forbidden) rather than raw
 * error dumps.
 */
export type ResourceState =
  | "loading"
  | "ready"
  | "empty"
  | "forbidden"
  | "notfound"
  | "error";

export interface UseApiResourceResult<T> {
  data: T | null;
  state: ResourceState;
  error: string | null;
  reload: () => void;
  setData: (updater: (current: T | null) => T | null) => void;
}

/**
 * Generic loader for a single hierarchy GET. `emptyWhen` lets a list resource
 * resolve to the dedicated "empty" state so callers don't re-implement it.
 */
export function useApiResource<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  options?: { emptyWhen?: (data: T) => boolean; enabled?: boolean },
): UseApiResourceResult<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [state, setState] = useState<ResourceState>("loading");
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef(0);
  const enabled = options?.enabled ?? true;

  // `emptyWhen` and `fetcher` are almost always passed inline (new identity every
  // render). Keep the latest via refs so they never enter `run`'s dependency
  // list — otherwise `run` would change every render and re-trigger the effect in
  // an infinite fetch loop. Re-fetching is driven exclusively by `deps`.
  const emptyWhenRef = useRef(options?.emptyWhen);
  emptyWhenRef.current = options?.emptyWhen;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(() => {
    if (!enabled) return;
    const version = versionRef.current + 1;
    versionRef.current = version;
    setState("loading");
    setError(null);

    void fetcherRef
      .current()
      .then((result) => {
        if (version !== versionRef.current) return;
        setDataState(result);
        setState(emptyWhenRef.current?.(result) ? "empty" : "ready");
      })
      .catch((cause: unknown) => {
        if (version !== versionRef.current) return;
        if (cause instanceof ApiError) {
          if (cause.status === 404) {
            setState("notfound");
            return;
          }
          if (cause.status === 403) {
            setState("forbidden");
            return;
          }
          setError(cause.message);
        } else {
          setError("Something went wrong loading this view.");
        }
        setState("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    run();
  }, [run]);

  const setData = useCallback(
    (updater: (current: T | null) => T | null) => {
      setDataState((current) => updater(current));
    },
    [],
  );

  return { data, state, error, reload: run, setData };
}

/** Human-friendly relative time (mirrors the home dashboard's timeAgo). */
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (Number.isNaN(minutes)) return "";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
