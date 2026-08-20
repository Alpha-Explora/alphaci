"use client";

import { STATUS_COLORS, STATUS_LABELS } from "../../model/runs-rules";
import { relativeTime } from "../../model/runs-presentation";
import type { ProjectRunGroup } from "../../model/runs-types";
import { RunCard } from "./run-card";

/** One collapsible repository section, with that project's runs nested. */
export function ProjectGroupSection({
  group,
  reduced,
  collapsed,
  onToggle,
}: Readonly<{
  group: ProjectRunGroup;
  reduced: boolean;
  collapsed: boolean;
  onToggle: () => void;
}>) {
  const latestStatus = group.latestRun.overallStatus;
  const bodyId = `project-runs-${group.repoFullName.replaceAll(/[^a-zA-Z0-9-]/g, "-")}`;
  const runCountLabel = `${group.runs.length} ${group.runs.length === 1 ? "commit" : "commits"}`;
  const metaText = `Latest ${STATUS_LABELS[latestStatus].toLowerCase()} · ${relativeTime(group.latestRun.startedAt)} · ${runCountLabel}`;

  return (
    <section className="runs-project-group" aria-label={group.repoFullName}>
      <button
        type="button"
        className="runs-project-group-header"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={bodyId}
      >
        <span className="runs-project-group-folder" aria-hidden="true">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </span>
        <span className="runs-project-group-name">{group.repoFullName}</span>
        <span className="runs-project-group-meta">
          <span
            className="runs-project-group-status-dot"
            style={{ background: STATUS_COLORS[latestStatus] }}
            aria-hidden="true"
          />
          {metaText}
        </span>
        <span
          className="runs-project-group-chevron"
          style={{
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
          }}
          aria-hidden="true"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {!collapsed && (
        <div className="runs-project-group-body" id={bodyId}>
          {group.runs.map((run, i) => (
            <RunCard key={run.runId} run={run} index={i} reduced={reduced} />
          ))}
        </div>
      )}
    </section>
  );
}
