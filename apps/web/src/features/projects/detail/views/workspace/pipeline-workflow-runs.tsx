"use client";

import { relativeTime } from "@/features/runs";
import type { StageReport } from "@/shared/api/contracts";

import {
  failureForJob,
  failurePreview,
  logUnavailableMessage,
  type FailureEntry,
} from "../../model/failure-log-rules";
import { diagnoseRunWithoutJobs } from "../../model/run-diagnosis";
import {
  githubStatusChip,
  runDuration,
  runEventLabel,
  workflowRunLabel,
} from "../../model/pipeline-run-card-rules";
import type { WorkflowRunSummary } from "../../view-models/use-pipeline-runs-view-model";
import {
  useJobLogViewModel,
  useRunJobsViewModel,
  type RunJob,
  type RunJobsViewModel,
} from "../../view-models/use-run-jobs-view-model";
import { useStageFailureLogViewModel } from "../../view-models/use-stage-failure-log-view-model";
import { JobLogPanel } from "./job-log-view";
import { ChevronIcon } from "./pipeline-glyphs";
import { FailureHint, StatusChip } from "./pipeline-stage-detail";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceLoading,
  statusTone,
} from "./workspace-states";

/**
 * The GitHub runs one commit produced, one row each: which workflow, how it
 * was started, when, and how long it took.
 *
 * The rows used to repeat the run-name, which every chained workflow inherits,
 * so four rows read identically. Our report names the stage each run executed
 * (see `workflowRunLabel`); the rest of the row is what GitHub recorded.
 */
export function WorkflowRunList({
  id,
  projectId,
  branch,
  runs,
  stages,
}: Readonly<{
  id: string;
  projectId: string;
  branch: string;
  runs: readonly WorkflowRunSummary[];
  stages: readonly StageReport[];
}>) {
  return (
    <ul id={id} className="pipe-runs" aria-label="Workflow runs for this commit">
      {runs.map((run) => (
        <RunRow
          key={`${run.id}-${run.runAttempt}`}
          projectId={projectId}
          branch={branch}
          run={run}
          label={workflowRunLabel(run, stages)}
        />
      ))}
    </ul>
  );
}

function RunRow({
  projectId,
  branch,
  run,
  label,
}: Readonly<{
  projectId: string;
  branch: string;
  run: WorkflowRunSummary;
  label: string;
}>) {
  const view = useRunJobsViewModel({
    projectId,
    runId: run.id,
    isRunning: run.status !== "completed",
  });
  const bodyId = `run-body-${String(run.id)}-${String(run.runAttempt)}`;

  return (
    <li className={`pipe-run pipe-run--${statusTone(run.status, run.conclusion)}`}>
      <button
        type="button"
        className="pipe-run__head"
        data-run-head
        aria-expanded={view.open}
        aria-controls={view.open ? bodyId : undefined}
        onClick={view.toggle}
      >
        <span className="pipe-run__caret">
          <ChevronIcon />
        </span>
        <span className="pipe-run__label">{label}</span>
        <RunMeta branch={branch} run={run} />
        <StatusChip {...githubStatusChip(run.status, run.conclusion)} />
      </button>

      {view.open && (
        <div id={bodyId} className="pipe-run__body">
          <RunJobs projectId={projectId} run={run} view={view} />
        </div>
      )}
    </li>
  );
}

/** "#90 · chained · dev 1d65fe4 · 2h ago · 2m 0s". */
function RunMeta({ branch, run }: Readonly<{ branch: string; run: WorkflowRunSummary }>) {
  const duration = runDuration(run);
  return (
    <span className="pipe-run__meta">
      <span>#{run.runNumber}</span>
      <span>{runEventLabel(run.event)}</span>
      <span>
        <span className="pipe-run__branch">{branch}</span>
        <code className="pipe-sha">{run.headSha.slice(0, 7)}</code>
      </span>
      {run.runAttempt > 1 && <span>attempt {run.runAttempt}</span>}
      {run.createdAt && <time dateTime={run.createdAt}>{relativeTime(run.createdAt)}</time>}
      {duration && <span>{duration}</span>}
    </span>
  );
}

function isFailed(conclusion: string | null): boolean {
  return conclusion === "failure" || conclusion === "timed_out";
}

/**
 * An expanded run's jobs. A failed run also reads its failure log ONCE, here,
 * so every failed job row can show its error without opening its log: one
 * call per expanded run, never one per job, and never for a green run.
 */
function RunJobs({
  projectId,
  run,
  view,
}: Readonly<{ projectId: string; run: WorkflowRunSummary; view: RunJobsViewModel }>) {
  const failureLog = useStageFailureLogViewModel({
    projectId,
    runId: run.id,
    enabled: isFailed(run.conclusion),
  });

  if (view.status === "loading") return <WorkspaceLoading rows={3} />;
  if (view.status === "error") {
    return (
      <WorkspaceError
        message={view.error ?? "The jobs for this run could not be read."}
        onRetry={view.retry}
      />
    );
  }
  if (!view.jobs) return null;
  if (view.jobs.length === 0) {
    // A run with no jobs is not one thing: a workflow rejected before any job
    // ran is a real failure with a nameable cause. From the row's own data.
    const diagnosis = diagnoseRunWithoutJobs({ status: run.status, conclusion: run.conclusion });
    return <WorkspaceEmpty title={diagnosis.title} message={diagnosis.message} />;
  }
  return (
    <ul className="pipe-jobs">
      {view.jobs.map((job) => (
        <JobRow
          key={job.id}
          projectId={projectId}
          job={job}
          failure={isFailed(job.conclusion) ? failureForJob(failureLog.log, job.id) : null}
        />
      ))}
    </ul>
  );
}

function JobRow({
  projectId,
  job,
  failure,
}: Readonly<{ projectId: string; job: RunJob; failure: FailureEntry | null }>) {
  const view = useJobLogViewModel({ projectId, jobId: job.id });
  const logId = `job-log-${String(job.id)}`;

  return (
    <li className="pipe-job">
      <div className="pipe-job__head">
        <StatusChip {...githubStatusChip(job.status, job.conclusion)} />
        <span className="pipe-job__name">{job.name}</span>
        <button
          type="button"
          className="pipe-text-button"
          aria-expanded={view.open}
          aria-controls={view.open ? logId : undefined}
          onClick={view.toggle}
        >
          {view.open ? "Hide log" : "View log"}
        </button>
      </div>

      {failure && <JobErrorPreview failure={failure} />}

      {job.steps.length > 0 && (
        <ol className="pipe-job__steps">
          {job.steps.map((step) => (
            <li
              key={`${step.number}-${step.name}`}
              className={`pipe-job__step pipe-job__step--${statusTone(step.status, step.conclusion)}`}
            >
              <span className="pipe-job__step-dot" aria-hidden="true" />
              <span className="pipe-job__step-name">{step.name}</span>
              <span className="pipe-job__step-outcome">
                {githubStatusChip(step.status, step.conclusion).label}
              </span>
            </li>
          ))}
        </ol>
      )}

      {view.open && (
        <div id={logId} className="pipe-job__log">
          <JobLogPanel view={view} />
        </div>
      )}
    </li>
  );
}

/**
 * What a failed job printed, in one to three lines, and the backend's
 * plain-English reading of it — above the steps, so the row answers "why"
 * before anyone opens a four-hundred-line log.
 */
function JobErrorPreview({ failure }: Readonly<{ failure: FailureEntry }>) {
  return (
    <div className="pipe-job__error">
      {failure.reason ? (
        <p className="pipe-stage__reason">{logUnavailableMessage(failure.reason)}</p>
      ) : (
        <PreviewLines lines={failurePreview(failure.lines)} />
      )}
      {failure.hint && <FailureHint hint={failure.hint} />}
    </div>
  );
}

function PreviewLines({ lines }: Readonly<{ lines: readonly string[] }>) {
  if (lines.length === 0) return null;
  return (
    <pre className="pipe-job__preview">
      <code>
        {lines.map((line, index) => (
          <span key={index} className="pipe-job__preview-line">
            {line}
          </span>
        ))}
      </code>
    </pre>
  );
}
