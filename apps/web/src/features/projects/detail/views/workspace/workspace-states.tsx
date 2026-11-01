"use client";

/**
 * The three states every workspace tab shares.
 *
 * Kept together so Code, Pull requests and Pipeline runs cannot drift into
 * three different ways of saying "nothing here" — a tab strip where each panel
 * fails differently reads as three separate products.
 */

import { isFailedConclusion } from "../../model/github-conclusion";

export function WorkspaceLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="ws-loading" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="ws-loading__row" />
      ))}
    </div>
  );
}

export function WorkspaceEmpty({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="ws-empty" role="status">
      <strong>{title}</strong>
      <p>{message}</p>
      {action}
    </div>
  );
}

/**
 * Always offers a retry. Every one of these panels reads GitHub live, and the
 * most common failure is transient — a rate limit or a dropped connection —
 * so a dead end here would be wrong far more often than it was right.
 */
export function WorkspaceError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="ws-error" role="alert">
      <p>{message}</p>
      <button type="button" className="ghost-button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

/** Status → visual tone, shared by runs, jobs, steps and pull requests. */
export function statusTone(
  status: string,
  conclusion: string | null,
): "success" | "failure" | "running" | "neutral" {
  if (status !== "completed") {
    return status === "queued" || status === "waiting" ? "neutral" : "running";
  }
  if (conclusion === "success") return "success";
  if (isFailedConclusion(conclusion)) return "failure";
  return "neutral";
}

export function StatusPill({
  status,
  conclusion,
}: {
  status: string;
  conclusion: string | null;
}) {
  const tone = statusTone(status, conclusion);
  const label =
    status === "completed" ? (conclusion ?? "completed") : status;
  return (
    <span className={`ws-pill ws-pill--${tone}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}
