"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  getDeploymentTargetLogs,
  LOG_PAGE_LIMIT,
  openDeploymentLogStream,
} from "../data/deployment-logs-api";
import type {
  DeploymentLogLine,
  DeploymentLogsQuery,
  DeploymentLogsResponse,
  LogFilterKey,
  LogQueryFilters,
  LogSource,
  LogWindow,
} from "../model/deployment-logs-types";
import {
  errorCount,
  newestTimestamp,
  olderPageCursor,
} from "../model/log-buffer";
import {
  applyAppend,
  applyError,
  applyGapPage,
  applyOlderLoading,
  applyOlderPage,
  applyRateLimited,
  applySnapshot,
  applyStatus,
  initialLogState,
  stateFor,
  type LogState,
} from "../model/log-state";
import { LEGACY_LOG_FILTERS } from "../model/log-normalize";
import { useHiddenPause } from "./use-hidden-pause";

/** Debounce on the server-side search, so typing is not a query per key. */
export const LOG_SEARCH_DEBOUNCE_MS = 350;
/** Pages fetched at most to close the gap a pause left. 10 x 100 lines. */
const GAP_FILL_PAGES = 10;

const LOAD_ERROR = "Could not load logs. Please retry.";
const OLDER_ERROR = "Could not load older logs. Please retry.";
const CLOSED_ERROR = "The live log connection closed. Restart the tail to retry.";
const MALFORMED_ERROR = "Received a malformed log update.";

export type DeploymentLogsStatus = "idle" | "loading" | "ready" | "error";
/**
 * `live` tails an open window; `paused` is the same window after the tab has
 * been hidden for a while (the stream is closed to spare provider calls); `closed` is a window
 * that has ended, fetched once; `off` has no window at all.
 */
export type LogTailState = "off" | "connecting" | "live" | "paused" | "closed";
export type OlderPageState = "available" | "loading" | "none";

export interface DeploymentLogsViewModel {
  status: DeploymentLogsStatus;
  lines: DeploymentLogLine[];
  errorCount: number;
  source: LogSource | null;
  /** Why the provider did not answer, or why lines are simulated. */
  reason: string | null;
  /**
   * While the provider is rate limiting reads: when it lifts (epoch ms). The
   * lines stay; the view shows a countdown, and the next event clears it.
   */
  rateLimitedUntil: number | null;
  /** Filters this provider supports. Controls render only for these. */
  supportedFilters: readonly LogFilterKey[];
  tail: LogTailState;
  /** False once older pages pushed the newest lines out of the buffer. */
  atLive: boolean;
  older: OlderPageState;
  loadOlder: () => void;
  errorsOnly: boolean;
  toggleErrorsOnly: () => void;
  search: string;
  setSearch: (value: string) => void;
  /** Reopen from scratch: back to the live edge, or retry after an error. */
  restart: () => void;
  /** Display string. Never an API object. */
  error: string | null;
}

function timeOf(iso: string): number {
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
}

function logsQuery(
  type: LogQueryFilters["type"],
  errorsOnly: boolean,
  text: string,
): DeploymentLogsQuery {
  return {
    limit: LOG_PAGE_LIMIT,
    ...(type ? { type: [type] } : {}),
    ...(errorsOnly ? { level: ["error" as const] } : {}),
    ...(text ? { text } : {}),
  };
}

function deriveStatus(state: LogState, key: string, on: boolean): DeploymentLogsStatus {
  if (!on) return "idle";
  if (state.key !== key || !state.received) {
    return state.key === key && state.error ? "error" : "loading";
  }
  return "ready";
}

/** The parts of the ViewModel read straight off the current state. */
function readState(state: LogState, key: string, on: boolean) {
  return {
    status: deriveStatus(state, key, on),
    lines: state.buffer.lines,
    errorCount: errorCount(state.buffer.lines),
    source: state.source,
    reason: state.reason,
    rateLimitedUntil: state.rateLimitedUntil,
    supportedFilters: state.filters ?? LEGACY_LOG_FILTERS,
    atLive: state.buffer.atLive,
    error: state.error,
  };
}

function deriveTail(
  on: boolean,
  logWindow: LogWindow | null,
  paused: boolean,
  received: boolean,
): LogTailState {
  if (!on || !logWindow) return "off";
  if (logWindow.endTime !== null) return "closed";
  if (paused) return "paused";
  return received ? "live" : "connecting";
}

function deriveOlder(state: LogState, current: boolean): OlderPageState {
  if (!current) return "none";
  if (state.older === "loading") return "loading";
  const more = state.buffer.trimmedOldest || (state.hasMore && state.next !== null);
  return more ? "available" : "none";
}

function readOptions(options: {
  projectId: string;
  targetId: string;
  window: LogWindow | null;
  filters?: LogQueryFilters;
  enabled?: boolean;
}) {
  const windowStart = options.window?.startTime ?? null;
  return {
    windowStart,
    windowEnd: options.window?.endTime ?? null,
    type: options.filters?.type ?? null,
    on:
      options.enabled !== false &&
      Boolean(options.projectId && options.targetId && windowStart),
  };
}

interface GapFill {
  projectId: string;
  targetId: string;
  query: DeploymentLogsQuery;
  from: DeploymentLogsResponse["next"];
  /** The newest line held before the gap opened; paging stops once past it. */
  until: string;
  isCurrent: () => boolean;
  merge: (logs: DeploymentLogLine[]) => void;
}

/**
 * Close the gap a pause left. The snapshot after a resume is only the newest
 * page; if more lines landed while the tab was hidden, the ones between the
 * last line held and that page are paged in backward until they meet.
 */
async function fillGap(fill: GapFill): Promise<void> {
  let cursor = fill.from;
  for (let page = 0; cursor && page < GAP_FILL_PAGES; page += 1) {
    const response = await getDeploymentTargetLogs(fill.projectId, fill.targetId, {
      ...fill.query,
      ...cursor,
      direction: "backward",
    });
    if (!fill.isCurrent()) return;
    fill.merge(response.logs);
    const oldest = response.logs[0];
    if (!response.hasMore || !oldest) return;
    if (timeOf(oldest.timestamp) <= timeOf(fill.until)) return;
    cursor = response.next;
  }
}

/**
 * ViewModel for a deployment's logs: the card's tail and the Hosting console.
 *
 * An open window (`endTime: null`) is live-tailed over the append stream: a
 * snapshot of the newest page, then only new lines. A closed window is one
 * fetch. Older lines page in backward on request. Errors-only, the type and
 * the search are server-side filters, so changing one is a new query.
 *
 * Cost: the stream is closed once the tab has been hidden for 30s and reopened
 * from the newest line held when it is shown again; the overlap is deduped by
 * id. One stream per instance: the effect's cleanup closes it before any
 * reopen, so a re-render or a StrictMode remount never leaves two.
 *
 * A provider 429 is not an outage: the backend keeps the stream open and says
 * when it will read again, so the lines stay and only a countdown is shown.
 */
export function useDeploymentLogsViewModel(options: {
  projectId: string;
  targetId: string;
  window: LogWindow | null;
  filters?: LogQueryFilters;
  /** False while the session is unknown, or when there is nothing to show. */
  enabled?: boolean;
}): DeploymentLogsViewModel {
  const { projectId, targetId, window: logWindow } = options;
  const { windowStart, windowEnd, type, on } = readOptions(options);

  const [errorsOnly, setErrorsOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [nonce, setNonce] = useState(0);
  const paused = useHiddenPause();

  const key = JSON.stringify([
    projectId,
    targetId,
    windowStart,
    windowEnd,
    type,
    errorsOnly,
    text,
    nonce,
  ]);
  const query = useMemo(() => logsQuery(type, errorsOnly, text), [type, errorsOnly, text]);

  const [state, setState] = useState<LogState>(() => initialLogState(key));
  // The effects below read the latest state without depending on it: the
  // stream must not reopen on every line that arrives.
  const stateRef = useRef(state);
  const keyRef = useRef(key);
  useEffect(() => {
    stateRef.current = state;
    keyRef.current = key;
  }, [state, key]);

  useEffect(() => {
    const timer = setTimeout(() => setText(search.trim()), LOG_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Live tail. Reopened when the query changes or the tab is shown again.
  useEffect(() => {
    if (!on || !windowStart || windowEnd !== null || paused) return;
    const held = stateFor(stateRef.current, key).buffer;
    const resumeFrom = newestTimestamp(held);

    const stream = openDeploymentLogStream(
      projectId,
      targetId,
      { ...query, startTime: resumeFrom ?? windowStart },
      {
        onEvent: (event) => {
          if (event.kind === "append") {
            setState((prev) => applyAppend(prev, key, event.source, event.logs));
            return;
          }
          if (event.kind === "status") {
            setState((prev) =>
              event.rateLimited
                ? applyRateLimited(prev, key, event.retryAfterMs, Date.now())
                : applyStatus(prev, key, event.source, event.reason),
            );
            return;
          }
          const until = newestTimestamp(stateFor(stateRef.current, key).buffer);
          setState((prev) => applySnapshot(prev, key, event));
          if (!until || !event.hasMore || !event.next) return;
          void fillGap({
            projectId,
            targetId,
            query,
            from: event.next,
            until,
            isCurrent: () => keyRef.current === key,
            merge: (logs) => setState((prev) => applyGapPage(prev, key, logs)),
          }).catch(() => undefined);
        },
        onError: (reason) => {
          const message = reason === "closed" ? CLOSED_ERROR : MALFORMED_ERROR;
          setState((prev) => applyError(prev, key, message));
        },
      },
    );
    return () => stream.close();
  }, [on, key, query, projectId, targetId, windowStart, windowEnd, paused]);

  // Closed window: one fetch of its newest page.
  useEffect(() => {
    if (!on || !windowStart || windowEnd === null) return;
    let active = true;
    getDeploymentTargetLogs(projectId, targetId, {
      ...query,
      startTime: windowStart,
      endTime: windowEnd,
      direction: "backward",
    })
      .then((page) => {
        if (active) setState((prev) => applySnapshot(prev, key, page));
      })
      .catch(() => {
        if (active) setState((prev) => applyError(prev, key, LOAD_ERROR));
      });
    return () => {
      active = false;
    };
  }, [on, key, query, projectId, targetId, windowStart, windowEnd]);

  const current = stateFor(state, key);
  const older = deriveOlder(current, on && current.received);

  function loadOlder() {
    if (!logWindow || older !== "available") return;
    const cursor = olderPageCursor(current.buffer, current.next, logWindow);
    if (!cursor) return;
    setState((prev) => applyOlderLoading(prev, key));
    getDeploymentTargetLogs(projectId, targetId, {
      ...query,
      ...cursor,
      direction: "backward",
    })
      .then((page) => setState((prev) => applyOlderPage(prev, key, page)))
      .catch(() =>
        setState((prev) =>
          prev.key === key ? applyError(prev, key, OLDER_ERROR) : prev,
        ),
      );
  }

  return {
    ...readState(current, key, on),
    tail: deriveTail(on, logWindow, paused, current.received),
    older,
    loadOlder,
    errorsOnly,
    toggleErrorsOnly: () => setErrorsOnly((value) => !value),
    search,
    setSearch,
    restart: () => setNonce((value) => value + 1),
  };
}
