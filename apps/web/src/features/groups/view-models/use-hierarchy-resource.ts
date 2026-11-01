"use client";

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

/** How the newest request ended, kept with the request it answered. */
interface Outcome {
  key: string;
  state: Exclude<ResourceState, "loading">;
  error: string | null;
}

function failureOutcome(key: string, cause: unknown): Outcome {
  if (cause instanceof ApiError) {
    if (cause.status === 404) return { key, state: "notfound", error: null };
    if (cause.status === 403) return { key, state: "forbidden", error: null };
    return { key, state: "error", error: cause.message };
  }
  return { key, state: "error", error: "Something went wrong loading this view." };
}

/**
 * The outcome to show. While disabled nothing is asked for, so the last
 * outcome stays; otherwise an outcome for another request reads as loading.
 */
function shownOutcome(enabled: boolean, outcome: Outcome | null, key: string): Outcome | null {
  if (!enabled) return outcome;
  return outcome?.key === key ? outcome : null;
}

/**
 * Generic loader for a single hierarchy GET. `emptyWhen` lets a list resource
 * resolve to the dedicated "empty" state so callers don't re-implement it.
 *
 * Each request is keyed by `deps` and a reload counter: an outcome for an
 * older key reads as "loading", and a request counter stops a slow request
 * overwriting a newer one. `deps` must be primitives (they form the key).
 */
export function useApiResource<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  options?: { emptyWhen?: (data: T) => boolean; enabled?: boolean },
): UseApiResourceResult<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [nonce, setNonce] = useState(0);
  const requestRef = useRef(0);
  const enabled = options?.enabled ?? true;
  const key = JSON.stringify([...deps, nonce]);

  // `emptyWhen` and `fetcher` are almost always passed inline (new identity every
  // render). Keep the latest in a ref so they never enter the effect's
  // dependency list — otherwise every render would re-trigger the effect in an
  // infinite fetch loop. Re-fetching is driven exclusively by `deps` (the key).
  const latest = useRef({ fetcher, emptyWhen: options?.emptyWhen });
  useEffect(() => {
    latest.current = { fetcher, emptyWhen: options?.emptyWhen };
  });

  useEffect(() => {
    if (!enabled) return;
    requestRef.current += 1;
    const requestId = requestRef.current;
    void latest.current
      .fetcher()
      .then((result) => {
        if (requestId !== requestRef.current) return;
        setDataState(result);
        const empty = latest.current.emptyWhen?.(result) ?? false;
        setOutcome({ key, state: empty ? "empty" : "ready", error: null });
      })
      .catch((cause: unknown) => {
        if (requestId === requestRef.current) setOutcome(failureOutcome(key, cause));
      });
  }, [enabled, key]);

  const reload = useCallback(() => {
    if (enabled) setNonce((value) => value + 1);
  }, [enabled]);

  const setData = useCallback(
    (updater: (current: T | null) => T | null) => {
      setDataState((current) => updater(current));
    },
    [],
  );

  const shown = shownOutcome(enabled, outcome, key);
  return {
    data,
    state: shown ? shown.state : "loading",
    error: shown ? shown.error : null,
    reload,
    setData,
  };
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
