"use client";

import { branchDisplayLabel } from "@/shared/api/pipeline-branches";
import {
  groupRunsByBranch,
  STATUS_COLORS,
  STATUS_LABELS,
} from "../../model/runs-rules";
import { relativeTime } from "../../model/runs-presentation";
import type { BranchRunGroup, ProjectRunGroup } from "../../model/runs-types";
import { RunCard } from "./run-card";

/**
 * One branch's history inside a repository.
 *
 * A repository's runs arrive interleaved: a push to dev, the promotion PR into
 * uat and a main deploy land next to each other with nothing but a label to
 * tell them apart. The question people actually ask is per branch - what is on
 * dev, what reached uat, what shipped - and a flat list cannot answer it
 * without reading every card.
 *
 * The heading carries the branch's own latest status, so "dev is green but uat
 * is red" is legible without expanding anything.
 */
function BranchSection({
  group,
  reduced,
}: Readonly<{ group: BranchRunGroup; reduced: boolean }>) {
  const latest = group.latestRun;
  const count = group.runs.length;

  return (
    <section
      className="runs-branch-group"
      aria-label={`${branchDisplayLabel(group.branch)} runs`}
    >
      <h3 className="runs-branch-group-header">
        <span
          className="runs-branch-group-dot"
          style={{
            background: latest
              ? STATUS_COLORS[latest.overallStatus]
              : "var(--border-layer)",
          }}
          aria-hidden="true"
        />
        <span className="runs-branch-group-name">
          {branchDisplayLabel(group.branch)}
        </span>
        {!group.isPipelineBranch && (
          <span className="runs-branch-group-tag">outside the flow</span>
        )}
        <span className="runs-branch-group-meta">
          {latest
            ? `${STATUS_LABELS[latest.overallStatus]} · ${relativeTime(latest.startedAt)} · ${String(count)} ${count === 1 ? "commit" : "commits"}`
            : "Nothing promoted here yet"}
        </span>
      </h3>

      {latest ? (
        <div className="runs-branch-group-body">
          {group.runs.map((run, i) => (
            <RunCard key={run.runId} run={run} index={i} reduced={reduced} />
          ))}
        </div>
      ) : (
        /* An empty declared branch is rendered, not skipped. A section that
           vanishes cannot say "nothing has reached uat". */
        <p className="runs-branch-group-empty">
          No runs on this branch yet.
        </p>
      )}
    </section>
  );
}

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
  // Ordered by the promotion flow (dev, then uat, then main) rather than by
  // recency, so the column reads in the direction the pipeline runs.
  const branchGroups = groupRunsByBranch(group.runs);
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
          {branchGroups.map((branchGroup) => (
            <BranchSection
              key={branchGroup.branch}
              group={branchGroup}
              reduced={reduced}
            />
          ))}
        </div>
      )}
    </section>
  );
}
