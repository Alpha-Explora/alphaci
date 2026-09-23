import type { LogWindow } from "./deployment-logs-types";

/**
 * Formatting options. Both default to the viewer's own: the log's timestamps
 * are shown in the reader's timezone, never a hard-coded offset.
 */
export interface LogTimeOptions {
  timeZone?: string;
  locale?: string;
}

/** `14:03:07` in the viewer's timezone; the raw value if it does not parse. */
export function formatLogTime(iso: string, options: LogTimeOptions = {}): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(options.locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: options.timeZone,
  }).format(date);
}

/** The full date and time, for a row's tooltip. */
export function formatLogDateTime(
  iso: string,
  options: LogTimeOptions = {},
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(options.locale, {
    dateStyle: "medium",
    timeStyle: "long",
    timeZone: options.timeZone,
  }).format(date);
}

/**
 * The viewer's timezone abbreviation (`PST`, `GMT+8`), taken from Intl so it
 * follows the reader's machine and daylight saving at that moment.
 */
export function timeZoneAbbreviation(
  at: Date,
  options: LogTimeOptions = {},
): string {
  const part = new Intl.DateTimeFormat(options.locale, {
    timeZoneName: "short",
    timeZone: options.timeZone,
  })
    .formatToParts(at)
    .find((entry) => entry.type === "timeZoneName");
  return part?.value ?? "";
}

/**
 * A short tag for the instance that wrote a line.
 *
 * Instance names end in the part that tells replicas apart
 * (`srv-abc123-5d8f9c7b6-x2k4j` ends `x2k4j`), so that is what is kept.
 */
export function instanceTag(instance: string | null): string | null {
  if (!instance) return null;
  const parts = instance.split("-").filter(Boolean);
  const tail = parts[parts.length - 1] ?? instance;
  return tail.slice(-5);
}

// Escape sequences a build tool colours its output with. Shown raw they are
// noise; the line's level already carries the colour that matters. Built from
// the ESC char code so the source carries no literal control character.
const ANSI_PATTERN = new RegExp(
  `${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`,
  "g",
);

export function stripAnsi(message: string): string {
  return message.replace(ANSI_PATTERN, "");
}

/* ── Time range presets ─────────────────────────────────────────────────── */

export type LogRangePreset = "deploy" | "15m" | "1h" | "6h" | "24h" | "7d";

export const LOG_RANGE_OPTIONS: ReadonlyArray<{
  value: LogRangePreset;
  label: string;
}> = [
  { value: "deploy", label: "This deploy" },
  { value: "15m", label: "Last 15 minutes" },
  { value: "1h", label: "Last hour" },
  { value: "6h", label: "Last 6 hours" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
];

const RANGE_MINUTES: Record<Exclude<LogRangePreset, "deploy">, number> = {
  "15m": 15,
  "1h": 60,
  "6h": 6 * 60,
  "24h": 24 * 60,
  "7d": 7 * 24 * 60,
};

/**
 * The window a preset covers, measured back from `now`. Every relative preset
 * is open-ended, so it keeps tailing. "This deploy" is the deploy's own window,
 * or null when there is no deploy to scope to.
 */
export function rangeWindow(
  preset: LogRangePreset,
  now: number,
  deployWindow: LogWindow | null,
): LogWindow | null {
  if (preset === "deploy") return deployWindow;
  const minutes = RANGE_MINUTES[preset];
  return {
    startTime: new Date(now - minutes * 60_000).toISOString(),
    endTime: null,
  };
}

/** The presets on offer: "This deploy" only when there is a deploy. */
export function rangeOptions(deployWindow: LogWindow | null) {
  return deployWindow
    ? LOG_RANGE_OPTIONS
    : LOG_RANGE_OPTIONS.filter((option) => option.value !== "deploy");
}
