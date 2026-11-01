"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties } from "react";
import { useId, useMemo, useState } from "react";
import type { RunGroup } from "../../model/runs-types";
import {
  runStatusColors,
  relativeTime,
  shortSha,
} from "../../model/runs-presentation";
import { RunPipeline } from "./run-pipeline";

interface RunCardProps {
  run: RunGroup;
  index: number;
  reduced: boolean;
}

function summarizeFailures(run: RunGroup) {
  const failedStages = run.stages.filter((stage) => stage.status === "failure");
  const errors = failedStages.flatMap((stage) =>
    stage.friendlyMessages.filter((message) => message.severity === "error"),
  );
  return {
    failedStageCount: failedStages.length,
    errorCount: errors.length,
    firstError: errors[0]?.title ?? null,
  };
}

export function RunCard({ run, index, reduced }: RunCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsId = useId();
  const colors = runStatusColors(run.overallStatus);
  const delay = index * 0.06;
  const visibleCommit = shortSha(run.commitSha);
  const failureSummary = useMemo(() => summarizeFailures(run), [run]);

  const hasErrors = failureSummary.failedStageCount > 0;

  return (
    <motion.article
      className={`runs-run-card runs-run-card--commit${isExpanded ? " runs-run-card--expanded" : ""}`}
      aria-label={`Commit ${visibleCommit}: ${run.overallStatus}`}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.25, 0, 0, 1], delay }}
      style={
        {
          "--run-accent": colors.ring,
          "--run-glow": colors.glow,
        } as CSSProperties
      }
    >
      <div className="runs-card-accent" aria-hidden="true" />

      <button
        type="button"
        className="runs-commit-row"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
        aria-controls={detailsId}
      >
        <CommitStatusIcon hasErrors={hasErrors} colors={colors} />

        <span className="runs-commit-primary">
          <span className="runs-commit-sha">{visibleCommit}</span>
          <span className="runs-commit-meta">
            <span>{run.branch}</span>
            <span>{relativeTime(run.startedAt)}</span>
            <span>Run #{run.runId}</span>
          </span>
        </span>

        <CommitHealth
          hasErrors={hasErrors}
          summary={failureSummary}
          colors={colors}
          status={run.overallStatus}
        />

        <span className="runs-commit-open" aria-hidden="true">
          <span>{isExpanded ? "Hide workflow" : "View workflow"}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <WorkflowDetails
            id={detailsId}
            run={run}
            reduced={reduced}
            visibleCommit={visibleCommit}
          />
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}

type StatusColors = ReturnType<typeof runStatusColors>;
type FailureSummary = ReturnType<typeof summarizeFailures>;

function CommitStatusIcon({
  hasErrors,
  colors,
}: Readonly<{ hasErrors: boolean; colors: StatusColors }>) {
  return (
    <span
      className="runs-commit-status"
      style={{
        color: colors.text,
        background: colors.bg,
        borderColor: colors.ring,
      }}
      aria-hidden="true"
    >
      {hasErrors ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <polyline points="8 12 11 15 16 9" />
        </svg>
      )}
    </span>
  );
}

function CommitHealth({
  hasErrors,
  summary,
  colors,
  status,
}: Readonly<{
  hasErrors: boolean;
  summary: FailureSummary;
  colors: StatusColors;
  status: RunGroup["overallStatus"];
}>) {
  if (hasErrors)
    return (
      <span className="runs-commit-health runs-commit-health--error">
        <strong>
          {summary.errorCount || summary.failedStageCount}{" "}
          {summary.errorCount === 1 ? "error" : "errors"}
        </strong>
        <span>{summary.firstError ?? "A workflow stage failed"}</span>
      </span>
    );
  return (
    <span className="runs-commit-health">
      <strong>{colors.label}</strong>
      <span>
        {status === "running"
          ? "Workflow is still running"
          : "No errors reported"}
      </span>
    </span>
  );
}

function WorkflowDetails({
  id,
  run,
  reduced,
  visibleCommit,
}: Readonly<{
  id: string;
  run: RunGroup;
  reduced: boolean;
  visibleCommit: string;
}>) {
  return (
    <motion.div
      id={id}
      className="runs-workflow-details"
      initial={reduced ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={reduced ? undefined : { opacity: 0, height: 0 }}
      transition={{ duration: 0.24, ease: [0.25, 0, 0, 1] }}
    >
      <div className="runs-workflow-details-header">
        <div>
          <span>Workflow for commit</span>
          <strong>{visibleCommit}</strong>
        </div>
      </div>
      <RunPipeline run={run} reduced={reduced} />
    </motion.div>
  );
}
