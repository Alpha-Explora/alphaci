import type { RunOverallStatus, StageStatus, MessageSeverity } from "@/lib/api/contracts";

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

export function stageLabel(stage: "access" | "quality" | "package"): string {
  switch (stage) {
    case "access":
      return "Access";
    case "quality":
      return "Quality";
    case "package":
      return "Package";
  }
}
