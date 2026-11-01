import type {
  DeploymentLogLine,
  DeploymentLogsResponse,
  DeploymentLogStreamEvent,
  LogFilterKey,
  LogLevel,
  LogSource,
  LogType,
} from "./deployment-logs-types";

/**
 * Tolerant readers for the logs payloads.
 *
 * The backend normalises to the v1 contract, but the Hosting console can meet
 * an older backend that predates it: lines with no id, a `system` level, no
 * paging fields, and a stream with no `kind`. Reading through here keeps the
 * view on one shape either way. Nothing is invented: a missing field becomes
 * its empty value, never a fabricated line.
 */

const LEVELS: ReadonlySet<string> = new Set(["error", "warn", "info", "debug"]);
const TYPES: ReadonlySet<string> = new Set(["app", "build", "request"]);
const SOURCES: ReadonlySet<string> = new Set(["live", "unavailable", "simulated"]);

/** What an older backend could filter by, before it said so itself. */
export const LEGACY_LOG_FILTERS: readonly LogFilterKey[] = ["type"];

type Raw = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function level(value: unknown): LogLevel {
  return typeof value === "string" && LEVELS.has(value)
    ? (value as LogLevel)
    : "info";
}

function lineType(value: unknown): LogType | null {
  return typeof value === "string" && TYPES.has(value) ? (value as LogType) : null;
}

function labels(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Raw)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

export function normalizeLogLine(raw: Raw): DeploymentLogLine {
  const timestamp = text(raw.timestamp);
  const message = text(raw.message);
  return {
    // An older backend sent no id; timestamp + message is the stable stand-in.
    id: text(raw.id) || `${timestamp}#${message}`,
    timestamp,
    message,
    level: level(raw.level),
    type: lineType(raw.type),
    instance: typeof raw.instance === "string" ? raw.instance : null,
    labels: labels(raw.labels),
  };
}

function lines(value: unknown): DeploymentLogLine[] {
  return Array.isArray(value)
    ? value.filter((entry) => entry && typeof entry === "object").map(normalizeLogLine)
    : [];
}

function source(value: unknown): LogSource {
  return typeof value === "string" && SOURCES.has(value)
    ? (value as LogSource)
    : "unavailable";
}

function cursor(value: unknown): DeploymentLogsResponse["next"] {
  if (!value || typeof value !== "object") return null;
  const { startTime, endTime } = value as Raw;
  return typeof startTime === "string" && typeof endTime === "string"
    ? { startTime, endTime }
    : null;
}

function filters(value: unknown): LogFilterKey[] {
  return Array.isArray(value)
    ? (value.filter((entry) => typeof entry === "string") as LogFilterKey[])
    : [...LEGACY_LOG_FILTERS];
}

function reason(value: unknown): { reason?: string } {
  return typeof value === "string" && value ? { reason: value } : {};
}

/**
 * The rate-limit fields, additive on the backend. Only a literal `true` counts,
 * and a wait that is not a finite, non-negative number is dropped rather than
 * guessed at: the state falls back to its default cooldown.
 */
function rateLimit(raw: Raw): { rateLimited?: true; retryAfterMs?: number } {
  if (raw.rateLimited !== true) return {};
  const wait = raw.retryAfterMs;
  const valid = typeof wait === "number" && Number.isFinite(wait) && wait >= 0;
  return valid ? { rateLimited: true, retryAfterMs: wait } : { rateLimited: true };
}

export function normalizeLogsResponse(raw: Raw): DeploymentLogsResponse {
  return {
    ...rateLimit(raw),
    source: source(raw.source),
    ...reason(raw.reason),
    logs: lines(raw.logs),
    hasMore: raw.hasMore === true,
    next: cursor(raw.next),
    filters: filters(raw.filters),
  };
}

/** A stream frame. One with no `kind` is an older backend's full snapshot. */
export function normalizeStreamEvent(raw: Raw): DeploymentLogStreamEvent {
  if (raw.kind === "append") {
    return { kind: "append", source: source(raw.source), logs: lines(raw.logs) };
  }
  if (raw.kind === "status") {
    return {
      kind: "status",
      source: source(raw.source),
      ...reason(raw.reason),
      ...rateLimit(raw),
    };
  }
  return { kind: "snapshot", ...normalizeLogsResponse(raw) };
}
