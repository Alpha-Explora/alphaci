import type { FriendlyMessage } from "@/shared/api/contracts";
import { stripAnsi } from "@/shared/ui/strip-ansi";

import type {
  RunOverallStatus,
  StageStatus,
  MessageSeverity,
  StageId,
} from "./runs-types";

/**
 * A friendly message as the page shows it: the stored text can carry the
 * terminal colour codes a runner printed (Playwright errors quoted into a
 * detail or an item), which a browser renders as stray "[2m" fragments.
 */
export function plainFriendlyMessage(message: FriendlyMessage): FriendlyMessage {
  return {
    ...message,
    title: stripAnsi(message.title),
    detail: stripAnsi(message.detail),
    hint: stripAnsi(message.hint),
    items: message.items?.map((item) => ({
      label: stripAnsi(item.label),
      ...(item.sub === undefined ? {} : { sub: stripAnsi(item.sub) }),
    })),
  };
}

/* ── Color tokens for overall run status ─────────────────────────────────── */

export interface StatusColors {
  /** CSS color for the ring / border accent */
  ring: string;
  /** CSS color for the glow / shadow */
  glow: string;
  /** CSS background for the badge */
  bg: string;
  /** CSS color for badge text */
  text: string;
  /** Human-readable label */
  label: string;
}

export function runStatusColors(status: RunOverallStatus): StatusColors {
  switch (status) {
    case "success":
      return {
        ring: "var(--success)",
        glow: "rgba(52,211,153,0.35)",
        bg: "rgba(52,211,153,0.12)",
        text: "var(--success)",
        label: "Passed",
      };
    case "failure":
      return {
        ring: "var(--danger)",
        glow: "rgba(248,113,113,0.35)",
        bg: "rgba(248,113,113,0.12)",
        text: "var(--danger)",
        label: "Failed",
      };
    case "running":
      return {
        ring: "var(--brand)",
        glow: "var(--brand-glow)",
        bg: "var(--brand-light)",
        text: "var(--brand)",
        label: "Running",
      };
    case "partial":
      return {
        ring: "var(--accent-amber)",
        glow: "rgba(251,191,36,0.3)",
        bg: "var(--accent-amber-light)",
        text: "var(--accent-amber)",
        label: "Partial",
      };
    case "cancelled":
      return {
        ring: "var(--text-muted)",
        glow: "rgba(100,116,139,0.2)",
        bg: "rgba(100,116,139,0.1)",
        text: "var(--text-muted)",
        label: "Cancelled",
      };
  }
}

/* ── Color tokens for individual stage status ────────────────────────────── */

export interface StageColors {
  ring: string;
  glow: string;
  bg: string;
  iconColor: string;
}

export function stageStatusColors(status: StageStatus): StageColors {
  switch (status) {
    case "success":
      return {
        ring: "var(--success)",
        glow: "rgba(52,211,153,0.4)",
        bg: "rgba(52,211,153,0.1)",
        iconColor: "var(--success)",
      };
    case "failure":
      return {
        ring: "var(--danger)",
        glow: "rgba(248,113,113,0.4)",
        bg: "rgba(248,113,113,0.1)",
        iconColor: "var(--danger)",
      };
    case "running":
      return {
        ring: "var(--brand)",
        glow: "var(--brand-glow)",
        bg: "var(--brand-light)",
        iconColor: "var(--brand)",
      };
    case "cancelled":
      return {
        ring: "var(--text-muted)",
        glow: "rgba(100,116,139,0.2)",
        bg: "rgba(100,116,139,0.08)",
        iconColor: "var(--text-muted)",
      };
    case "pending":
      return {
        ring: "var(--border-strong)",
        glow: "transparent",
        bg: "rgba(255,255,255,0.04)",
        iconColor: "var(--text-muted)",
      };
    // A stage that never started is a broken pipeline, not a quiet one, so it
    // reads like a failure rather than like something still waiting.
    case "stalled":
      return {
        ring: "var(--danger)",
        glow: "rgba(248,113,113,0.4)",
        bg: "rgba(248,113,113,0.1)",
        iconColor: "var(--danger)",
      };
    // Blocked is a consequence of an earlier failure, not a problem of its own.
    // It stays muted so the stage that actually broke is what draws the eye.
    case "blocked":
      return {
        ring: "var(--border-strong)",
        glow: "transparent",
        bg: "rgba(255,255,255,0.02)",
        iconColor: "var(--text-muted)",
      };
  }
}

/* ── Color tokens for message severity ───────────────────────────────────── */

export interface SeverityColors {
  border: string;
  bg: string;
  icon: string;
  label: string;
}

export function severityColors(severity: MessageSeverity): SeverityColors {
  switch (severity) {
    case "error":
      return {
        border: "var(--danger)",
        bg: "rgba(248,113,113,0.06)",
        icon: "var(--danger)",
        label: "Error",
      };
    case "warning":
      return {
        border: "var(--accent-amber)",
        bg: "rgba(251,191,36,0.06)",
        icon: "var(--accent-amber)",
        label: "Warning",
      };
    case "info":
      return {
        border: "var(--brand)",
        bg: "rgba(56,189,248,0.06)",
        icon: "var(--brand)",
        label: "Info",
      };
    case "success":
      return {
        border: "var(--success)",
        bg: "rgba(52,211,153,0.06)",
        icon: "var(--success)",
        label: "Success",
      };
  }
}

/* ── Relative time formatter ──────────────────────────────────────────────── */

/**
 * Returns a short human-readable relative time string.
 * "just now", "2m ago", "5h ago", "3d ago", etc.
 */
export function relativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/* ── Short commit SHA ────────────────────────────────────────────────────── */

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

/* ── Stage display name ──────────────────────────────────────────────────── */

export function stageLabel(stage: StageId): string {
  switch (stage) {
    case "access":
      return "Access";
    case "quality":
      return "Quality";
    case "package":
      return "Package";
    case "verify":
      return "Verify";
  }
}

/** How a tool's outcome should read: the semantic tone, not a colour. */
export type CheckTone = "passed" | "failed" | "skipped" | "running";

/**
 * Map a GitHub job conclusion onto a tone.
 *
 * `skipped` is deliberately its own tone rather than folded into "passed".
 * A skipped tool proved nothing, and showing it green is the same mistake the
 * pipeline itself used to make when a stage of entirely skipped jobs reported
 * success. An unrecognised conclusion also lands here rather than in "passed" —
 * an outcome nobody has interpreted is not evidence that anything worked.
 */
export function checkTone(conclusion: string): CheckTone {
  switch (conclusion) {
    case "success":
      return "passed";
    case "failure":
    case "timed_out":
    case "startup_failure":
    case "action_required":
      return "failed";
    case "running":
    case "in_progress":
    case "queued":
      return "running";
    default:
      return "skipped";
  }
}

/**
 * Turn a job id into something readable.
 *
 * Job ids are written for the pipeline — `dotnet-tests`, `sbom` — and the
 * reader wants the tool. Known ids get a real name; anything else is
 * de-hyphenated rather than dropped, so a stack this build has never heard of
 * still shows its tools instead of a blank row.
 */
export function checkLabel(name: string): string {
  const known: Record<string, string> = {
    "validate-access": "Access check",
    "branch-policy": "Branch policy",
    "dotnet-tests": "Unit tests & coverage",
    "backend-tests": "Unit tests & coverage",
    "frontend-tests": "Unit tests & coverage",
    lint: "Format & style",
    typecheck: "Static analysis",
    security: "Dependency audit",
    secrets: "Secret scan",
    licenses: "Licence scan",
    sbom: "SBOM export",
    sonar: "Code quality & SAST",
    build: "Build & publish",
  };

  return (
    known[name] ??
    name.replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase())
  );
}

/** How a stage's tool roster reads at a glance. */
/**
 * What the tools in one stage concluded, counted apart.
 *
 * `passed` and `total` alone could not say what a stage did. The package stage
 * runs one deploy job per branch and skips the two that do not apply, so a
 * perfectly healthy uat package reads 4 passed out of 9 — and a reader cannot
 * tell those five apart from five broken tools. On the run that prompted this,
 * four were skipped by design and exactly one had failed.
 *
 * Skipped stays separate from passed rather than being dropped from the total.
 * Counting a skipped tool as passed would rebuild the original bug — a stage of
 * entirely skipped jobs reporting success — inside the number meant to expose
 * it; hiding it would leave the reader unable to see that a deploy never ran.
 */
export interface CheckSummary {
  passed: number;
  failed: number;
  skipped: number;
  running: number;
  total: number;
}

/**
 * Count what actually passed inside a stage.
 *
 * Returns null — not a zero summary — when the stage reports no checks. A
 * pipeline generated before per-tool reporting is "not known", and rendering
 * that as "0 of 0 checks passed" states something false about a run that may
 * have exercised every tool it had.
 *
 * Only `passed` counts toward the numerator. A skipped or unrecognised
 * conclusion proved nothing, and folding it in would rebuild the bug this
 * whole line of work came from — a stage of entirely skipped jobs reporting
 * success — inside the number meant to expose it.
 */
export function summarizeChecks(
  checks: readonly { conclusion: string }[] | undefined,
): CheckSummary | null {
  if (checks === undefined || checks.length === 0) {
    return null;
  }

  const count = (tone: CheckTone) =>
    checks.filter((check) => checkTone(check.conclusion) === tone).length;

  return {
    passed: count("passed"),
    failed: count("failed"),
    skipped: count("skipped"),
    running: count("running"),
    total: checks.length,
  };
}

/**
 * The one line above the folded tool list.
 *
 * Problems lead. Someone opening a red stage is looking for what broke, and
 * "4 of 9 checks passed" made them count backwards to find out whether the
 * other five were failures or skips — the two things they most need to tell
 * apart.
 *
 * A stage where everything ran and passed keeps its original phrasing. There
 * is nothing to disambiguate there, and "8 of 8 checks passed" says it better
 * than a list of one.
 */
export function checkSummaryLabel(summary: CheckSummary): string {
  if (summary.passed === summary.total) {
    return `${summary.passed} of ${summary.total} checks passed`;
  }

  const parts: string[] = [];
  if (summary.failed > 0) parts.push(`${summary.failed} failed`);
  if (summary.running > 0) parts.push(`${summary.running} running`);
  if (summary.passed > 0) parts.push(`${summary.passed} passed`);
  if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`);

  // Every conclusion fell outside the four tones — possible for a pipeline
  // newer than this build. Say how many there are rather than nothing.
  return parts.length > 0 ? parts.join(", ") : `${summary.total} checks`;
}

/**
 * The failed-job names, without the prefix the workflow writes on each line.
 *
 * The payload repeats "Failed GitHub Actions job:" on every entry, which the
 * surrounding heading already says once. Repeating it per line pushes the job
 * name - the only part that differs - off to the right of the column.
 *
 * Falls back to the original text when nothing matches, so an unrecognised
 * payload is still shown rather than silently blanked.
 */
export function formatFailedJobs(rawLogs: string): string {
  const lines = rawLogs
    .split(/\r?\n/)
    .map((line) => line.replace(/^Failed GitHub Actions job:\s*/i, "").trim())
    .filter((line) => line.length > 0);

  return lines.length > 0 ? lines.join("\n") : rawLogs;
}
