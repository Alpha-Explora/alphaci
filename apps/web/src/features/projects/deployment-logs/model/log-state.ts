import type {
  DeploymentLogLine,
  DeploymentLogsResponse,
  LogCursor,
  LogFilterKey,
  LogSource,
} from "./deployment-logs-types";
import { EMPTY_LOG_BUFFER, mergeLogPage, type LogBuffer } from "./log-buffer";

/**
 * The logs ViewModel's state and its transitions, kept out of the hook so each
 * one is a pure function of (state, event) and testable without a DOM.
 *
 * Every state carries the `key` of the query that produced it. A new query
 * (another window, filter or search) does not clear anything; its first page
 * simply replaces a state whose key no longer matches. That keeps the reset
 * out of an effect body, and lets a late page from an old query be dropped by
 * comparing keys.
 */
export interface LogState {
  key: string;
  /** A first page (or stream snapshot) for this key has arrived. */
  received: boolean;
  buffer: LogBuffer;
  /** Cursor for the next older page, as the provider gave it. */
  next: LogCursor | null;
  hasMore: boolean;
  source: LogSource | null;
  reason: string | null;
  filters: LogFilterKey[] | null;
  /** Display string. Never an API object. */
  error: string | null;
  older: "idle" | "loading";
}

export function initialLogState(key: string): LogState {
  return {
    key,
    received: false,
    buffer: EMPTY_LOG_BUFFER,
    next: null,
    hasMore: false,
    source: null,
    reason: null,
    filters: null,
    error: null,
    older: "idle",
  };
}

/** The state for `key`: the current one if it matches, else a fresh one. */
export function stateFor(state: LogState, key: string): LogState {
  return state.key === key ? state : initialLogState(key);
}

function sourceFields(source: LogSource, reason: string | undefined) {
  return { source, reason: source === "live" ? null : (reason ?? null) };
}

/**
 * A full page: the stream's snapshot, or a closed window's one fetch.
 *
 * The first one for a key seeds the older-page cursor. A later one (after a
 * pause, or the browser's own reconnect) is newer lines to merge, and must not
 * move the cursor, which still belongs to the oldest page held.
 */
export function applySnapshot(
  state: LogState,
  key: string,
  page: DeploymentLogsResponse,
): LogState {
  const current = stateFor(state, key);
  const merged = mergeLogPage(current.buffer, page.logs, "newer");
  const seed = !current.received;
  return {
    ...current,
    ...sourceFields(page.source, page.reason),
    received: true,
    buffer: merged,
    next: seed ? page.next : current.next,
    hasMore: seed ? page.hasMore : current.hasMore,
    filters: page.filters,
    error: null,
  };
}

/**
 * Lines past the newest held. Ignored while the buffer is not at live: it was
 * trimmed at the new end to make room for older lines, so appending would
 * leave a hole the reader cannot see.
 */
export function applyAppend(
  state: LogState,
  key: string,
  source: LogSource,
  logs: readonly DeploymentLogLine[],
): LogState {
  if (state.key !== key) return state;
  const buffer = state.buffer.atLive
    ? mergeLogPage(state.buffer, logs, "newer")
    : state.buffer;
  return { ...state, ...sourceFields(source, undefined), buffer, received: true };
}

/** Lines that close a gap left by a pause; merged newer, cursor untouched. */
export function applyGapPage(
  state: LogState,
  key: string,
  logs: readonly DeploymentLogLine[],
): LogState {
  if (state.key !== key) return state;
  return { ...state, buffer: mergeLogPage(state.buffer, logs, "newer") };
}

export function applyStatus(
  state: LogState,
  key: string,
  source: LogSource,
  reason: string | undefined,
): LogState {
  return { ...stateFor(state, key), ...sourceFields(source, reason) };
}

export function applyError(state: LogState, key: string, error: string): LogState {
  return { ...stateFor(state, key), error, older: "idle" };
}

export function applyOlderLoading(state: LogState, key: string): LogState {
  if (state.key !== key) return state;
  return { ...state, older: "loading", error: null };
}

/**
 * One older page. It is merged at the old end, so its own cursor is the next
 * one, and the buffer's oldest page is the provider's again (not trimmed).
 */
export function applyOlderPage(
  state: LogState,
  key: string,
  page: DeploymentLogsResponse,
): LogState {
  if (state.key !== key) return state;
  const merged = mergeLogPage(state.buffer, page.logs, "older");
  return {
    ...state,
    buffer: { ...merged, trimmedOldest: false },
    next: page.next,
    hasMore: page.hasMore,
    older: "idle",
  };
}
