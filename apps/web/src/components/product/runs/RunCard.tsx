"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties } from "react";
import { useId, useMemo, useState } from "react";
import type { RunGroup } from "@/lib/api/contracts";
import { runStatusColors, relativeTime, shortSha } from "@/lib/runs/utils";
import { RunPipeline } from "./RunPipeline";

interface RunCardProps {
  run: RunGroup;
  index: number;
  reduced: boolean;
}

export function RunCard({ run, index, reduced }: RunCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsId = useId();
  const colors = runStatusColors(run.overallStatus);
  const delay = index * 0.06;
  const visibleCommit = shortSha(run.commitSha);
  const failureSummary = useMemo(() => {
    const failedStages = run.stages.filter((stage) => stage.status === "failure");
    const errors = failedStages.flatMap((stage) =>
      stage.friendlyMessages.filter((message) => message.severity === "error"),
    );

    return {
      failedStageCount: failedStages.length,
      errorCount: errors.length,
      firstError: errors[0]?.title ?? null,
      workflowUrl:
        failedStages.find((stage) => stage.githubRunUrl)?.githubRunUrl ??
        run.stages.find((stage) => stage.githubRunUrl)?.githubRunUrl,
    };
  }, [run.stages]);

  const hasErrors = failureSummary.failedStageCount > 0;

  return (
    <motion.article
      className={`runs-run-card runs-run-card--commit${isExpanded ? " runs-run-card--expanded" : ""}`}
      aria-label={`Commit ${visibleCommit}: ${run.overallStatus}`}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.25, 0, 0, 1], delay }}
      style={{
        "--run-accent": colors.ring,
        "--run-glow": colors.glow,
      } as CSSProperties}
    >
      <div className="runs-card-accent" aria-hidden="true" />

      <button
        type="button"
        className="runs-commit-row"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
        aria-controls={detailsId}
      >
        <span className="runs-commit-status" style={{ color: colors.text, background: colors.bg, borderColor: colors.ring }} aria-hidden="true">
          {hasErrors ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="8 12 11 15 16 9" /></svg>
          )}
        </span>

        <span className="runs-commit-primary">
          <span className="runs-commit-sha">{visibleCommit}</span>
          <span className="runs-commit-meta">
            <span>{run.branch}</span>
            <span>{relativeTime(run.startedAt)}</span>
            <span>Run #{run.runId}</span>
          </span>
        </span>

        <span className={`runs-commit-health${hasErrors ? " runs-commit-health--error" : ""}`}>
          {hasErrors ? (
            <>
              <strong>{failureSummary.errorCount || failureSummary.failedStageCount} {failureSummary.errorCount === 1 ? "error" : "errors"}</strong>
              <span>{failureSummary.firstError ?? "A workflow stage failed"}</span>
            </>
          ) : (
            <>
              <strong>{colors.label}</strong>
              <span>{run.overallStatus === "running" ? "Workflow is still running" : "No errors reported"}</span>
            </>
          )}
        </span>

        <span className="runs-commit-open" aria-hidden="true">
          <span>{isExpanded ? "Hide workflow" : "View workflow"}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.div
            id={detailsId}
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
              {failureSummary.workflowUrl ? (
                <a href={failureSummary.workflowUrl} target="_blank" rel="noreferrer" className="runs-workflow-github-link" onClick={(event) => event.stopPropagation()}>
                  Open in GitHub
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3h7v7" /><path d="M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></svg>
                </a>
              ) : null}
            </div>
            <RunPipeline run={run} reduced={reduced} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}
