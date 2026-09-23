import type {
  DeploymentLogLine,
  LogCursor,
  LogLevel,
  LogWindow,
} from "./deployment-logs-types";

/** Lines a view holds at most. Past it, the end away from the reader goes. */
export const LOG_BUFFER_CAP = 2000;

export interface LogBuffer {
  /** Oldest to newest, unique by id. */
  lines: DeploymentLogLine[];
  /**
   * False once the newest lines were dropped to make room for older ones: the
   * buffer no longer reaches the live edge, so appending to it would leave a
   * hole between what is shown and what arrives.
   */
  atLive: boolean;
  /**
   * True once the oldest lines were dropped to make room for newer ones. The
   * provider's own `next` cursor then points past a hole, so the next older
   * page is asked for from the oldest line still held.
   */
  trimmedOldest: boolean;
}

export const EMPTY_LOG_BUFFER: LogBuffer = {
  lines: [],
  atLive: true,
  trimmedOldest: false,
};

function timeOf(line: DeploymentLogLine): number {
  const value = Date.parse(line.timestamp);
  return Number.isNaN(value) ? 0 : value;
}

/**
 * Merge one page into the buffer.
 *
 * Deduped by id (the copy already held wins), then ordered by timestamp. The
 * sort is stable, so lines that share a millisecond keep the provider's order,
 * which is what makes a page that overlaps the buffer's edge safe to merge.
 *
 * Over the cap, the end AWAY from the reader goes: merging newer lines drops
 * the oldest; merging older lines drops the newest and marks the buffer as no
 * longer at live.
 */
export function mergeLogPage(
  buffer: LogBuffer,
  page: readonly DeploymentLogLine[],
  position: "older" | "newer",
  cap: number = LOG_BUFFER_CAP,
): LogBuffer {
  const seen = new Set(buffer.lines.map((line) => line.id));
  const fresh: DeploymentLogLine[] = [];
  for (const line of page) {
    if (seen.has(line.id)) continue;
    seen.add(line.id);
    fresh.push(line);
  }
  if (fresh.length === 0) return buffer;

  const combined =
    position === "newer"
      ? [...buffer.lines, ...fresh]
      : [...fresh, ...buffer.lines];
  combined.sort((a, b) => timeOf(a) - timeOf(b));

  if (combined.length <= cap) return { ...buffer, lines: combined };
  if (position === "newer") {
    return {
      ...buffer,
      lines: combined.slice(combined.length - cap),
      trimmedOldest: true,
    };
  }
  return { ...buffer, lines: combined.slice(0, cap), atLive: false };
}

/**
 * The cursor for the next older page.
 *
 * The provider's own `next` while the buffer still holds its oldest page; once
 * that was trimmed away, the window from its start up to the oldest line kept.
 */
export function olderPageCursor(
  buffer: LogBuffer,
  next: LogCursor | null,
  window: LogWindow,
): LogCursor | null {
  const oldest = buffer.lines[0];
  if (buffer.trimmedOldest && oldest) {
    return { startTime: window.startTime, endTime: oldest.timestamp };
  }
  return next;
}

export function newestTimestamp(buffer: LogBuffer): string | null {
  return buffer.lines[buffer.lines.length - 1]?.timestamp ?? null;
}

export function errorCount(lines: readonly DeploymentLogLine[]): number {
  let count = 0;
  for (const line of lines) if (line.level === "error") count += 1;
  return count;
}

/**
 * How many lines arrived after the one the reader last saw. The buffer can
 * stay the same length while it rolls, so this counts from an id, not a
 * length. A seen line that has rolled out means everything held is new.
 */
export function countLinesAfter(
  lines: readonly DeploymentLogLine[],
  seenId: string | null,
): number {
  if (!seenId) return 0;
  const index = lines.findIndex((line) => line.id === seenId);
  return index === -1 ? lines.length : lines.length - 1 - index;
}

export type LogTone = "danger" | "warning" | "default" | "muted";

const LEVEL_TONE: Record<LogLevel, LogTone> = {
  error: "danger",
  warn: "warning",
  info: "default",
  debug: "muted",
};

/** Error rows red, warn rows amber, as the provider's own log view has them. */
export function logLevelTone(level: LogLevel): LogTone {
  return LEVEL_TONE[level] ?? "default";
}
