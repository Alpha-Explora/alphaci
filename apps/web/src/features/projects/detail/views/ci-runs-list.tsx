"use client";

import { formatDate } from "@/features/workflows";
import type { ProjectCiRun, ProjectCiRunsResponse } from "@/shared/api/contracts";
import { ciRunRowClass } from "../model/project-detail-tab-rules";

export function CiRunsList({
  response,
}: Readonly<{ response: ProjectCiRunsResponse | null }>) {
  if (!response) {
    return <p className="env-empty-state">Loading CI runs...</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <CiRunsLiveBanner response={response} />
      <CiRunsBody runs={response.runs} />
    </div>
  );
}

function CiRunsLiveBanner({
  response,
}: Readonly<{ response: ProjectCiRunsResponse }>) {
  if (!response.liveGithubEnabled) {
    return (
      <p className="env-empty-state" style={{ margin: 0 }}>
        Live GitHub run sync is not enabled
      </p>
    );
  }
  if (response.mode === "local_mock") {
    return (
      <p className="env-empty-state" style={{ margin: 0 }}>
        Live sync is enabled, but no GitHub Actions integration is connected
        yet — the runs below are simulated, not live.
      </p>
    );
  }
  return null;
}

function CiRunsBody({ runs }: Readonly<{ runs: ProjectCiRun[] }>) {
  if (!runs.length) {
    return <p className="env-empty-state">No CI runs tracked yet.</p>;
  }

  return (
    <div className="env-metadata-list">
      {runs.map((run) => (
        <CiRunRow key={run.id} run={run} />
      ))}
    </div>
  );
}

function CiRunRow({ run }: Readonly<{ run: ProjectCiRun }>) {
  return (
    <div className={`env-metadata-row ${ciRunRowClass(run.conclusion)}`}>
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.2rem",
        }}
      >
        <strong>{run.workflowName}</strong>
        <small>
          {run.stage} - {run.branch} - {run.status}
          {runConclusionSuffix(run.conclusion)}
        </small>
        <small>
          Commit {run.commitSha ?? "not available"} - Actor {run.actor}
        </small>
        <small>
          {formatDate(run.createdAt)} - {formatDate(run.updatedAt)}
        </small>
      </span>
      <CiRunActions run={run} />
    </div>
  );
}

function runConclusionSuffix(conclusion: string | null): string {
  if (!conclusion) return "";
  return ` - ${conclusion}`;
}

function CiRunActions({ run }: Readonly<{ run: ProjectCiRun }>) {
  return (
    <span
      style={{
        display: "flex",
        gap: "0.4rem",
        flexWrap: "wrap",
        justifyContent: "flex-end",
      }}
    >
      <a
        className="ghost-button"
        href={run.htmlUrl}
        rel="noreferrer"
        target="_blank"
      >
        GitHub run
      </a>
      <CiRunRerunButton canRerun={run.canRerun} />
    </span>
  );
}

function CiRunRerunButton({ canRerun }: Readonly<{ canRerun: boolean }>) {
  if (!canRerun) return null;
  return (
    <button className="ghost-button" type="button">
      Rerun
    </button>
  );
}
