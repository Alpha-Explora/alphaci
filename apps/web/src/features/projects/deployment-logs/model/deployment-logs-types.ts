/**
 * Deployment log shapes, mirrored from the backend logs contract (v1).
 *
 * The backend normalises every provider onto these, so nothing here names a
 * host. Lines always arrive oldest to newest, whatever the query direction.
 */

export type LogLevel = "error" | "warn" | "info" | "debug";
export type LogType = "app" | "build" | "request";
export type LogSource = "live" | "unavailable" | "simulated";
/** The filters a provider can apply server-side. The UI renders only these. */
export type LogFilterKey = "level" | "type" | "text" | "instance";

export interface DeploymentLogLine {
  /** Provider line id; the dedupe key. */
  id: string;
  /** ISO timestamp. */
  timestamp: string;
  message: string;
  level: LogLevel;
  type: LogType | null;
  /** Raw instance label value. */
  instance: string | null;
  /** Every raw provider label, kept for parity and debugging. */
  labels: Record<string, string>;
}

/** A page cursor: pass back as startTime/endTime with the same direction. */
export interface LogCursor {
  startTime: string;
  endTime: string;
}

export interface DeploymentLogsResponse {
  /**
   * `simulated` only when live providers are switched off (local mock mode).
   * A provider failure is `unavailable` with a reason and no lines.
   */
  source: LogSource;
  reason?: string;
  logs: DeploymentLogLine[];
  hasMore: boolean;
  next: LogCursor | null;
  filters: LogFilterKey[];
}

/** One event of the `mode=append` stream. */
export type DeploymentLogStreamEvent =
  | ({ kind: "snapshot" } & DeploymentLogsResponse)
  | { kind: "append"; source: LogSource; logs: DeploymentLogLine[] }
  | { kind: "status"; source: LogSource; reason?: string };

/**
 * The span of time a log view covers. `endTime: null` is the current deploy:
 * still running, so the view live-tails it.
 */
export interface LogWindow {
  startTime: string;
  endTime: string | null;
}

/** Query filters the reader picks. Empty means everything. */
export interface LogQueryFilters {
  type?: Exclude<LogType, "request"> | null;
}

export interface DeploymentLogsQuery {
  startTime?: string;
  endTime?: string | null;
  direction?: "backward" | "forward";
  limit?: number;
  type?: readonly string[];
  level?: readonly LogLevel[];
  text?: string;
  instance?: readonly string[];
}

/** Where a log view should open, handed from the Overview card to Hosting. */
export interface DeploymentLogFocus {
  targetId: string;
  window: LogWindow | null;
}
