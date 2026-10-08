/* Live Playwright progress rules: reading the wire, what the header says, the
 * progress bar, the finished list, the milestones a screen reader hears, and
 * when to keep polling. Pure: no React, no fetch. */

import type {
  PlaywrightLiveRun,
  PlaywrightLiveRunningTest,
  PlaywrightLiveStatus,
  PlaywrightLiveTest,
  PlaywrightLiveTestStatus,
} from "./playwright-live-types";
import type { QaTone } from "./qa-run-rules";
import { record, records, text, type Loose } from "./wire-readers";

/* ── Reading the wire ────────────────────────────────────────────────────── */

const RUN_STATUSES: Readonly<Record<string, PlaywrightLiveStatus>> = {
  queued: "queued",
  waiting: "queued",
  pending: "queued",
  starting: "starting",
  running: "running",
  in_progress: "running",
  passed: "passed",
  success: "passed",
  failed: "failed",
  failure: "failed",
  cancelled: "cancelled",
  canceled: "cancelled",
  timedout: "timedout",
  timed_out: "timedout",
};

const TEST_STATUSES: Readonly<Record<string, PlaywrightLiveTestStatus>> = {
  passed: "passed",
  expected: "passed",
  flaky: "passed",
  failed: "failed",
  unexpected: "failed",
  timedout: "failed",
  timed_out: "failed",
  interrupted: "failed",
  skipped: "skipped",
};

function lowered(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** A status this page does not know reads as `unknown`: still going, never a crash. */
export function liveRunStatus(value: unknown): PlaywrightLiveStatus {
  return RUN_STATUSES[lowered(value)] ?? "unknown";
}

export function liveTestStatus(value: unknown): PlaywrightLiveTestStatus {
  return TEST_STATUSES[lowered(value)] ?? "unknown";
}

/** A whole, non-negative count; anything else is "not known". */
function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
}

function runNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Non-empty date text that parses; else null. */
function isoDate(value: unknown): string | null {
  const candidate = text(value);
  return candidate && !Number.isNaN(Date.parse(candidate)) ? candidate : null;
}

/** A test needs something to call it by: its title, else its file. */
function testTitle(value: Loose): string | null {
  return text(value.title) ?? text(value.file);
}

function testId(value: Loose, title: string, index: number): string {
  return text(value.id) ?? `${text(value.file) ?? ""}:${title}:${String(index)}`;
}

function normalizeRunning(value: Loose, index: number): PlaywrightLiveRunningTest | null {
  const title = testTitle(value);
  if (!title) return null;
  return {
    id: testId(value, title, index),
    file: text(value.file),
    title,
    project: text(value.project),
    startedAt: isoDate(value.startedAt),
  };
}

function normalizeTest(value: Loose, index: number): PlaywrightLiveTest | null {
  const title = testTitle(value);
  if (!title) return null;
  const status = liveTestStatus(value.status);
  return {
    id: testId(value, title, index),
    file: text(value.file),
    title,
    project: text(value.project),
    status,
    durationMs: count(value.durationMs),
    error: status === "failed" ? text(value.error) : null,
  };
}

function present<T>(value: T | null): value is T {
  return value !== null;
}

function tally(tests: ReadonlyArray<PlaywrightLiveTest>, status: PlaywrightLiveTestStatus): number {
  return tests.filter((test) => test.status === status).length;
}

/** The server's counts; a count it left out is counted from the tests it sent. */
function counts(value: Loose, tests: ReadonlyArray<PlaywrightLiveTest>) {
  return {
    total: count(value.total),
    done: count(value.done) ?? tests.length,
    passed: count(value.passed) ?? tally(tests, "passed"),
    failed: count(value.failed) ?? tally(tests, "failed"),
    skipped: count(value.skipped) ?? tally(tests, "skipped"),
  };
}

function normalizeRun(value: Loose): PlaywrightLiveRun {
  const tests = records(value.tests).map(normalizeTest).filter(present);
  return {
    runId: runNumber(value.runId),
    runAttempt: runNumber(value.runAttempt),
    commitSha: text(value.commitSha),
    branch: text(value.branch),
    status: liveRunStatus(value.status),
    stage: text(value.stage),
    startedAt: isoDate(value.startedAt),
    updatedAt: isoDate(value.updatedAt),
    finishedAt: isoDate(value.finishedAt),
    ...counts(value, tests),
    running: records(value.running).map(normalizeRunning).filter(present),
    tests,
  };
}

/**
 * GET …/workspace/playwright-live: `{ run }`. No run, or an answer that is
 * not the expected shape, is null — never a crash.
 */
export function normalizePlaywrightLive(raw: unknown): PlaywrightLiveRun | null {
  const run = record(record(raw)?.run);
  return run ? normalizeRun(run) : null;
}

/* ── State ───────────────────────────────────────────────────────────────── */

const ACTIVE: ReadonlyArray<PlaywrightLiveStatus> = ["queued", "starting", "running", "unknown"];

/** Still going: queued, starting, running (or a status this page does not know). */
export function isLiveActive(run: Pick<PlaywrightLiveRun, "status"> | null | undefined): boolean {
  return Boolean(run && ACTIVE.includes(run.status));
}

export function isLiveFinished(run: Pick<PlaywrightLiveRun, "status"> | null | undefined): boolean {
  return Boolean(run && !ACTIVE.includes(run.status));
}

function runKey(run: PlaywrightLiveRun): string {
  return [run.runId, run.runAttempt, run.startedAt].map((part) => String(part ?? "")).join("|");
}

function sameRun(a: PlaywrightLiveRun | null | undefined, b: PlaywrightLiveRun): boolean {
  return Boolean(a) && runKey(a as PlaywrightLiveRun) === runKey(b);
}

/**
 * Whether `next` is a run that finished since `prev` was read: the same run
 * was still going, or a new run appeared already finished. `prev` undefined
 * is the first read: the latest finished run is history, not news.
 */
export function liveFinishedNow(
  prev: PlaywrightLiveRun | null | undefined,
  next: PlaywrightLiveRun | null,
): boolean {
  if (prev === undefined || !next || !isLiveFinished(next)) return false;
  return !sameRun(prev, next) || isLiveActive(prev);
}

/* ── What the header says ────────────────────────────────────────────────── */

const LABELS: Record<PlaywrightLiveStatus, string> = {
  queued: "Queued",
  starting: "Starting",
  running: "Running tests",
  passed: "Passed",
  failed: "Failed",
  cancelled: "Cancelled",
  timedout: "Timed out",
  unknown: "In progress",
};

const TONES: Record<PlaywrightLiveStatus, QaTone> = {
  queued: "neutral",
  starting: "brand",
  running: "brand",
  passed: "success",
  failed: "danger",
  cancelled: "neutral",
  timedout: "warning",
  unknown: "brand",
};

/** "320 ms", "1.4s", "58s", "1m 01s". */
export function formatLiveDuration(ms: number | null): string | null {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${String(Math.round(ms))} ms`;
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${String(seconds)}s`;
  return `${String(Math.floor(seconds / 60))}m ${String(seconds % 60).padStart(2, "0")}s`;
}

/** How long a finished run took, from its own timestamps. */
export function liveRunDuration(run: Pick<PlaywrightLiveRun, "startedAt" | "finishedAt">): string | null {
  if (!run.startedAt || !run.finishedAt) return null;
  return formatLiveDuration(Date.parse(run.finishedAt) - Date.parse(run.startedAt));
}

/** "4 of 12", or "4 done" while the total is not known. */
export function liveProgressText(run: Pick<PlaywrightLiveRun, "done" | "total">): string {
  return run.total === null ? `${String(run.done)} done` : `${String(run.done)} of ${String(run.total)}`;
}

function finishedDetail(run: PlaywrightLiveRun): string[] {
  const duration = liveRunDuration(run);
  const head = run.status === "failed" && run.failed > 0 ? `${String(run.failed)} failed` : liveProgressText(run);
  return duration ? [head, duration] : [head];
}

function liveDetail(run: PlaywrightLiveRun): string[] {
  if (run.status === "queued") return [];
  if (run.status === "starting") return run.stage ? [run.stage] : [];
  if (isLiveActive(run)) return [liveProgressText(run)];
  return finishedDetail(run);
}

export interface LiveHeadline {
  /** The pill: "Running tests". */
  label: string;
  tone: QaTone;
  /** After the pill: "4 of 12", "Install Playwright browsers", "12 of 12 · 1m 01s". */
  detail: string | null;
  /** The whole line: "Running tests · 4 of 12". */
  text: string;
}

/** "Queued", "Starting · Install Playwright browsers", "Running tests · 4 of 12", "Passed · 12 of 12 · 1m 01s", "Failed · 1 failed". */
export function liveHeadline(run: PlaywrightLiveRun): LiveHeadline {
  const label = LABELS[run.status];
  const parts = liveDetail(run);
  const detail = parts.length > 0 ? parts.join(" · ") : null;
  return { label, tone: TONES[run.status], detail, text: detail ? `${label} · ${detail}` : label };
}

/** Percent done, or null for an indeterminate bar (the total is not known yet). */
export function liveProgressShare(run: Pick<PlaywrightLiveRun, "done" | "total" | "status">): number | null {
  if (run.total === null || run.total === 0) return isLiveFinished(run) ? 100 : null;
  return Math.min(100, Math.round((run.done / run.total) * 100));
}

/* ── The finished list ───────────────────────────────────────────────────── */

/** How many finished tests show before "Show all". */
export const LIVE_TESTS_CAP = 50;

/** Newest first, capped unless every test was asked for. */
export function visibleLiveTests(tests: ReadonlyArray<PlaywrightLiveTest>, showAll: boolean): PlaywrightLiveTest[] {
  const newestFirst = [...tests].reverse();
  return showAll ? newestFirst : newestFirst.slice(0, LIVE_TESTS_CAP);
}

/** "Show all 73 tests"; null when nothing is hidden. */
export function showAllLabel(total: number, showAll: boolean): string | null {
  return showAll || total <= LIVE_TESTS_CAP ? null : `Show all ${String(total)} tests`;
}

const TEST_STATUS_WORDS: Record<PlaywrightLiveTestStatus, string> = {
  passed: "Passed",
  failed: "Failed",
  skipped: "Skipped",
  unknown: "Finished",
};

export function liveTestStatusWord(status: PlaywrightLiveTestStatus): string {
  return TEST_STATUS_WORDS[status];
}

/* ── Milestones for the polite live region ───────────────────────────────── */

const MAX_ANNOUNCED_FAILURES = 3;

function failedIds(run: PlaywrightLiveRun | null | undefined): Set<string> {
  return new Set((run?.tests ?? []).filter((test) => test.status === "failed").map((test) => test.id));
}

function startedLine(prev: PlaywrightLiveRun | null | undefined, next: PlaywrightLiveRun, name: string): string | null {
  if (!isLiveActive(next)) return null;
  if (prev === undefined) return `Playwright is running in ${name}.`;
  return sameRun(prev, next) && isLiveActive(prev) ? null : `Playwright started in ${name}.`;
}

function failureLines(prev: PlaywrightLiveRun | null | undefined, next: PlaywrightLiveRun, name: string): string[] {
  // The first read is the state on arrival, not news: only failures seen arriving are announced.
  if (prev === undefined) return [];
  const known = sameRun(prev, next) ? failedIds(prev) : new Set<string>();
  const fresh = next.tests.filter((test) => test.status === "failed" && !known.has(test.id));
  const lines = fresh.slice(0, MAX_ANNOUNCED_FAILURES).map((test) => `Failed in ${name}: ${test.title}.`);
  const more = fresh.length - MAX_ANNOUNCED_FAILURES;
  return more > 0 ? [...lines, `${String(more)} more failed in ${name}.`] : lines;
}

function finishedLine(prev: PlaywrightLiveRun | null | undefined, next: PlaywrightLiveRun, name: string): string | null {
  if (!liveFinishedNow(prev, next)) return null;
  const headline = liveHeadline(next);
  const detail = headline.detail ? `: ${headline.detail}` : "";
  return `Playwright ${headline.label.toLowerCase()} in ${name}${detail}.`;
}

/**
 * What the live region says between two reads of one repository: that
 * Playwright started, each test that failed since, and that it finished. Not
 * every test: a screen reader hears milestones only.
 */
export function liveMilestones(
  prev: PlaywrightLiveRun | null | undefined,
  next: PlaywrightLiveRun | null,
  name: string,
): string[] {
  if (!next) return [];
  const started = startedLine(prev, next, name);
  const finished = finishedLine(prev, next, name);
  return [started, ...failureLines(prev, next, name), finished].filter((line): line is string => line !== null);
}

/* ── Polling ─────────────────────────────────────────────────────────────── */

/** Every 3 s while a run is going. */
export const LIVE_POLL_INTERVAL_MS = 3_000;

/** After Run Playwright: how long to wait for the new run to show up. */
export const LIVE_DISPATCH_GRACE_MS = 3 * 60_000;

/** A run that never finishes (a lost runner) stops being watched after this long. */
export const LIVE_POLL_MAX_MS = 45 * 60_000;

/**
 * Whether to read again in 3 s: a run is still going, or Playwright was just
 * started and its run has not shown up yet. Never while the route is missing.
 */
export function liveKeepPolling(input: {
  runs: ReadonlyArray<PlaywrightLiveRun | null>;
  supported: boolean;
  awaitingUntil: number | null;
  now: number;
}): boolean {
  if (!input.supported) return false;
  if (input.runs.some(isLiveActive)) return true;
  return input.awaitingUntil !== null && input.now < input.awaitingUntil;
}

/* ── Run Playwright's confirmation, once progress is live ────────────────── */

const RESULTS_LATER = / Results appear here when the runs? reports?\.$/;

/**
 * While the live view waits for its first answer, the confirmation keeps its
 * first sentence and says progress is on the way, instead of "results appear
 * here when the runs report".
 */
export function liveWaitingConfirmation(confirmation: string): string {
  return `${confirmation.replace(RESULTS_LATER, "")} Waiting for its first progress report…`;
}

/* ── Folding one round of reads in ───────────────────────────────────────── */

/** One repository's answer: its run (or none), the route missing (404), or a read that failed. */
export type LiveRead = { kind: "run"; run: PlaywrightLiveRun | null } | { kind: "missing" } | { kind: "error" };

/** Project id → its latest run; a repository not read yet is absent. */
export type LiveRuns = Readonly<Record<string, PlaywrightLiveRun | null>>;

export interface LiveRound {
  runs: LiveRuns;
  /** Milestones for the live region, in repository order. */
  milestones: string[];
  /** A run finished since the last read: the run's results are worth re-reading. */
  finished: boolean;
  /** A run that started (or finished) since Run Playwright was pressed has shown up. */
  arrived: boolean;
  /** The backend has no live route (404). */
  missing: boolean;
}

function previous(runs: LiveRuns, projectId: string): PlaywrightLiveRun | null | undefined {
  return Object.prototype.hasOwnProperty.call(runs, projectId) ? runs[projectId] : undefined;
}

/**
 * Folds one round of reads (one per repository, in `repositories` order) into
 * what was known. A failed read keeps what the repository last showed: the
 * next round tries again.
 */
export function applyLiveReads(
  known: LiveRuns,
  repositories: ReadonlyArray<{ projectId: string; name: string }>,
  reads: ReadonlyArray<LiveRead>,
): LiveRound {
  const runs: Record<string, PlaywrightLiveRun | null> = { ...known };
  const round: LiveRound = { runs, milestones: [], finished: false, arrived: false, missing: false };
  reads.forEach((read, index) => {
    const repository = repositories[index];
    if (read.kind === "missing") round.missing = true;
    if (read.kind !== "run" || !repository) return;
    const prev = previous(known, repository.projectId);
    const finished = liveFinishedNow(prev, read.run);
    round.milestones.push(...liveMilestones(prev, read.run, repository.name));
    round.finished = round.finished || finished;
    round.arrived = round.arrived || finished || isLiveActive(read.run);
    runs[repository.projectId] = read.run;
  });
  return round;
}

/**
 * What Run Playwright's confirmation does once progress can be live:
 * `as-is` (no live route, or nothing read yet), `waiting` (started, its run
 * not shown up yet: keep a short line) or `hidden` (the live cards say it).
 */
export type LiveConfirmationMode = "as-is" | "waiting" | "hidden";

export function liveConfirmationMode(input: {
  supported: boolean | null;
  awaiting: boolean;
  anyRun: boolean;
}): LiveConfirmationMode {
  if (input.supported !== true) return "as-is";
  if (input.awaiting) return "waiting";
  return input.anyRun ? "hidden" : "as-is";
}
