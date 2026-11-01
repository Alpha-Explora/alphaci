"use client";

import { STATUS_LABELS } from "../../model/runs-rules";
import { relativeTime } from "../../model/runs-presentation";
import type { RunsSummary } from "../../model/runs-types";

/* Counts arrive computed. The view used to derive them in a useMemo, which put
 * a reduce over run statuses inside JSX; summarizeRuns() is now a pure function
 * with its own tests. */
export function RunsSummaryStrip({
  summary,
  repoFullName,
}: Readonly<{
  summary: RunsSummary;
  repoFullName?: string;
}>) {
  const latestStatus = summary.latestRun
    ? STATUS_LABELS[summary.latestRun.overallStatus]
    : "None";

  return (
    <section className="runs-summary-strip" aria-label="Pipeline run summary">
      <div className="runs-summary-card runs-summary-card--primary">
        <span>Tracked commits</span>
        <strong>{summary.total}</strong>
        <p>
          {repoFullName ? "Filtered repository" : "Across all repositories"}
        </p>
      </div>
      <div className="runs-summary-card">
        <span>Running</span>
        <strong>{summary.counts.running}</strong>
        <p>Active GitHub Actions</p>
      </div>
      <div className="runs-summary-card">
        <span>Needs review</span>
        <strong>{summary.needsAttention}</strong>
        <p>Failed, partial, or cancelled</p>
      </div>
      <div className="runs-summary-card">
        <span>Latest</span>
        <strong>{latestStatus}</strong>
        <p>
          {summary.latestRun
            ? relativeTime(summary.latestRun.startedAt)
            : "No runs yet"}
        </p>
      </div>
    </section>
  );
}
