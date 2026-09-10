"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import {
  getProjectJobLog,
  getProjectRunJobs,
  type JobLogResponse,
  type RunJob,
  type WorkflowRunSummary,
} from "@/features/projects";

import {
  StatusPill,
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceLoading,
} from "./workspace-states";
import { diagnoseRunWithoutJobs } from "../../model/run-diagnosis";
import type { BranchRunSection } from "../../model/runs-by-branch";
import {
  commitHeadline,
  commitStageProblems,
  stagePillTone,
  type CommitRunGroup,
} from "../../model/runs-by-commit";
import {
  ALL_BRANCHES,
  RUNS_POLL_MS,
  usePipelineRunsViewModel,
} from "../../view-models/use-pipeline-runs-view-model";

/**
 * Live GitHub Actions runs for this project: branch → run → jobs → steps → log.
 *
 * Runs are read PER BRANCH, because that is the unit a pipeline is actually
 * asked about: what is on dev, what reached uat, what shipped. A flat list
 * interleaved all three with nothing but a label to separate them.
 *
 * Every declared branch keeps its section even with no runs. An empty `uat`
 * means nothing has been promoted yet, and that is worth saying out loud — a
 * section that disappears cannot.
 *
 * THE FETCHING RULE, which is why the row components are shaped the way they
 * are: only the run list polls, and it now polls in the view-model. A run's
 * jobs load when someone expands that run, and a job's log when someone opens
 * that job — neither is ever fetched on the tick. The GitHub rate limit is
 * shared by the entire organisation, so pulling jobs for ten runs every fifteen
 * seconds would drain it and take every other GitHub call in the product down
 * with it.
 *
 * This replaces the old "Runs" tab, which showed only what our own workflow had
 * reported back to us. That record is still the truth about grading; this is the
 * truth about EXECUTION. When a run is green here but never reported, the gap
 * between the two is the diagnosis — which is why the report badge sits on the
 * run row rather than in a separate tab.
 */
export function PipelineRunsTab({
  projectId,
  actionsUrl,
}: {
  projectId: string;
  actionsUrl?: string | null;
}) {
  const runsView = usePipelineRunsViewModel({ projectId, actionsUrl });

  if (runsView.status === "loading") return <WorkspaceLoading rows={5} />;
  if (runsView.status === "error")
    return (
      <WorkspaceError
        message={runsView.error ?? "The run list could not be read."}
        onRetry={runsView.reload}
      />
    );

  if (runsView.isEmpty) {
    return (
      <WorkspaceEmpty
        title="No runs yet"
        message="Push a commit, or open a pull request, and the run will appear here."
        action={
          runsView.actionsUrl ? (
            <a
              className="ws-link"
              href={runsView.actionsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Actions on GitHub ↗
            </a>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="ws-panel">
      <div className="ws-toolbar ws-toolbar--between">
        <label className="ws-branchpick">
          <span className="ws-branchpick__label">Branch</span>
          <select
            className="ws-select"
            value={runsView.selectedBranch}
            onChange={(event) => runsView.selectBranch(event.target.value)}
          >
            {runsView.visibleSections.map((section) => (
              <option key={section.branch} value={section.branch}>
                {section.branch}
                {section.commits.length > 0
                  ? ` (${String(section.commits.length)})`
                  : " — no runs"}
              </option>
            ))}
            <option value={ALL_BRANCHES}>All branches</option>
          </select>
        </label>
        <span className="ws-hint">
          Refreshes every {RUNS_POLL_MS / 1000} seconds
        </span>
        <span className="ws-toolbar__links">
          {/*
            The cross-project view. This tab answers "what happened to THIS
            project"; /runs answers "what is red anywhere", which no per-project
            tab can. Since Pipeline runs replaced the rail bar that used to lead
            there, this is the link that keeps it reachable from a project.
          */}
          <Link
            className="ws-link"
            href={
              runsView.repoFullName
                ? `/runs?repoFullName=${encodeURIComponent(runsView.repoFullName)}`
                : "/runs"
            }
          >
            Runs across all projects →
          </Link>
          {runsView.actionsUrl && (
            <a
              className="ws-link"
              href={runsView.actionsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Actions on GitHub ↗
            </a>
          )}
        </span>
      </div>

      {runsView.reportsUnavailable && (
        <p className="ws-hint">
          Showing what GitHub executed. Our own stage grading could not be read,
          so the per-stage diagnosis is missing from these commits.
        </p>
      )}

      {runsView.visibleSections.map((section) => (
        <BranchSection
          key={section.branch}
          projectId={projectId}
          section={section}
        />
      ))}
    </div>
  );
}

/**
 * One branch's history, under a heading that names the branch.
 *
 * A branch outside the declared flow is marked rather than hidden: a repository
 * connected with its own conventions still has real runs, and silently dropping
 * them would make the tab lie about what executed.
 */
function BranchSection({
  projectId,
  section,
}: {
  projectId: string;
  section: BranchRunSection<WorkflowRunSummary>;
}) {
  return (
    <section className="ws-runsection">
      <div className="ws-runsection__head">
        <h3 className="ws-runsection__branch">{section.branch}</h3>
        {!section.isPipelineBranch && (
          <span className="ws-runsection__foreign">outside the flow</span>
        )}
        <span className="ws-runsection__count">
          {section.commits.length === 1
            ? "1 commit"
            : `${section.commits.length} commits`}
        </span>
      </div>

      {section.commits.length === 0 ? (
        <p className="ws-runsection__empty">
          Nothing has run on this branch yet.
        </p>
      ) : (
        <ul className="ws-runs">
          {section.commits.map((commit) => (
            <CommitRow
              key={commit.commitSha}
              projectId={projectId}
              commit={commit}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * One commit, and what its pipeline did.
 *
 * The stage problems show WITHOUT expanding. They are the reason someone opened
 * this tab — a stage that never started, or one that will never run because an
 * earlier one failed — and putting the diagnosis behind a click means the tab
 * still answers "something is wrong" without answering "what".
 *
 * The workflow runs themselves are behind the caret, because a commit produces
 * one per chained workflow and the list of three is detail, not headline.
 */
function CommitRow({
  projectId,
  commit,
}: {
  projectId: string;
  commit: CommitRunGroup<WorkflowRunSummary>;
}) {
  const [open, setOpen] = useState(false);
  const problems = commitStageProblems(commit.report);
  const headline = commitHeadline(commit);
  const { latest } = commit;

  return (
    <li className="ws-run">
      <button
        type="button"
        className="ws-run__head"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="ws-run__caret" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
        {/*
          From the REPORT when we have one. Showing the newest run's conclusion
          put `SUCCESS` above a red `QUALITY failure`: the package workflow had
          gone green while the pipeline had not. Erring green is the dangerous
          direction for a headline.
        */}
        <span className={`ws-pill ws-pill--${headline.tone}`}>
          {headline.label.replace(/_/g, " ")}
        </span>
        <code className="ws-commit__sha">{commit.commitSha.slice(0, 7)}</code>
        <span className="ws-run__title">
          {latest.displayTitle || latest.name || `Run #${latest.runNumber}`}
        </span>
        <span className="ws-run__meta">
          {commit.runs.length === 1
            ? "1 workflow"
            : `${commit.runs.length} workflows`}
          {latest.actor ? ` · ${latest.actor}` : ""}
        </span>
      </button>

      {commit.report && (
        <ul className="ws-stages" aria-label="Pipeline stages">
          {commit.report.stages.map((stage) => (
            <li key={stage.stage} className="ws-stages__item">
              <span className={`ws-pill ws-pill--${stagePillTone(stage.status)}`}>
                {stage.stage}
              </span>
              <span className="ws-stages__status">
                {stage.status.replace(/_/g, " ")}
              </span>
            </li>
          ))}
        </ul>
      )}

      {problems.length > 0 && (
        <div className="ws-diagnosis">
          {problems.map((stage) =>
            stage.friendlyMessages.length > 0 ? (
              stage.friendlyMessages.map((message, index) => (
                <div
                  key={`${stage.stage}-${index}`}
                  className={`ws-diagnosis__item ws-diagnosis__item--${message.severity}`}
                >
                  <p className="ws-diagnosis__title">
                    {stage.stage}: {message.title}
                  </p>
                  <p className="ws-diagnosis__detail">{message.detail}</p>
                  {message.hint && (
                    <p className="ws-diagnosis__hint">{message.hint}</p>
                  )}
                  {message.items && message.items.length > 0 && (
                    <ul className="ws-diagnosis__items">
                      {message.items.map((item, itemIndex) => (
                        <li key={itemIndex} className="ws-diagnosis__item-row">
                          <code className="ws-diagnosis__item-label">
                            {item.label}
                          </code>
                          {item.sub && (
                            <span className="ws-diagnosis__item-sub">
                              {item.sub}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            ) : (
              /*
                A stage that failed and captured no explanation. Saying nothing
                here is the behaviour this whole tab exists to remove — a red
                pill with no words is what sent people to GitHub. Naming the
                gap is at least true, and points somewhere.
              */
              <div
                key={`${stage.stage}-nodetail`}
                className="ws-diagnosis__item ws-diagnosis__item--error"
              >
                <p className="ws-diagnosis__title">
                  {stage.stage}: {stage.status}
                </p>
                <p className="ws-diagnosis__detail">
                  No detail was captured for this failure.
                </p>
                <p className="ws-diagnosis__hint">
                  <a
                    className="ws-link"
                    href={stage.githubRunUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open this stage on GitHub ↗
                  </a>
                </p>
              </div>
            ),
          )}
        </div>
      )}

      {open && (
        <div className="ws-run__body">
          <ul className="ws-jobs">
            {commit.runs.map((run) => (
              <RunRow
                key={`${run.id}-${run.runAttempt}`}
                projectId={projectId}
                run={run}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function RunRow({
  projectId,
  run,
}: {
  projectId: string;
  run: WorkflowRunSummary;
}) {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<RunJob[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Why this run has no jobs, for the empty state below. Derived from the run
  // itself, which the row already holds — no extra request.
  const diagnosis = diagnoseRunWithoutJobs({
    status: run.status,
    conclusion: run.conclusion,
  });

  // Jobs load ON EXPAND, and are never fetched by the parent's list poll.
  //
  // `showSpinner` is false for refreshes: a run that is still executing
  // re-reads its jobs below, and blanking the panel every fifteen seconds
  // while someone is reading a step would be worse than showing nothing.
  const loadJobs = useCallback(
    (showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      setError(null);
      return getProjectRunJobs(projectId, run.id)
        .then(setJobs)
        .catch(() => setError("The jobs for this run could not be read."))
        .finally(() => setLoading(false));
    },
    [projectId, run.id],
  );

  /*
   * An EXPANDED, still-running run refreshes its own jobs.
   *
   * This is the one narrow exception to "jobs are never polled", and it is
   * bounded on three sides: only the run someone has open, only while it has
   * not completed, and it stops the moment either changes. Without it a run
   * expanded mid-flight sat frozen on "in progress" forever — the list above
   * kept moving while the steps under it did not, which is precisely the
   * moment someone is watching.
   *
   * What is still forbidden is what the limit cannot survive: fetching jobs
   * for every run in the list on every tick.
   */
  const isRunning = run.status !== "completed";
  useEffect(() => {
    if (!open || !isRunning) return;
    const handle = window.setInterval(() => void loadJobs(false), RUNS_POLL_MS);
    return () => window.clearInterval(handle);
  }, [open, isRunning, loadJobs]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && jobs === null && !loading) void loadJobs(true);
  }

  return (
    <li className="ws-run">
      <button
        type="button"
        className="ws-run__head"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="ws-run__caret" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
        <StatusPill status={run.status} conclusion={run.conclusion} />
        <span className="ws-run__title">
          {run.displayTitle || run.name || `Run #${run.runNumber}`}
        </span>
        <span className="ws-run__meta">
          {run.headBranch} · {run.headSha.slice(0, 7)}
          {run.actor ? ` · ${run.actor}` : ""}
        </span>
      </button>

      {open && (
        <div className="ws-run__body">
          <div className="ws-run__links">
            <a
              className="ws-link"
              href={run.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open run on GitHub ↗
            </a>
          </div>

          {loading ? (
            <WorkspaceLoading rows={3} />
          ) : error ? (
            <WorkspaceError message={error} onRetry={() => void loadJobs(true)} />
          ) : jobs && jobs.length > 0 ? (
            <ul className="ws-jobs">
              {jobs.map((job) => (
                <JobRow key={job.id} projectId={projectId} job={job} />
              ))}
            </ul>
          ) : (
            // A run with no jobs is not one thing. A workflow rejected before
            // any job ran is a real failure with a nameable cause, and saying
            // "may have been cancelled" sent people looking in the wrong place.
            <WorkspaceEmpty
              title={diagnosis.title}
              message={diagnosis.message}
            />
          )}
        </div>
      )}
    </li>
  );
}

function JobRow({ projectId, job }: { projectId: string; job: RunJob }) {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<JobLogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The log is the largest response in the product. On demand only, once.
  const loadLog = useCallback(() => {
    setLoading(true);
    setError(null);
    getProjectJobLog(projectId, job.id)
      .then(setLog)
      .catch(() => setError("The log for this job could not be read."))
      .finally(() => setLoading(false));
  }, [projectId, job.id]);

  return (
    <li className="ws-job">
      <div className="ws-job__head">
        <StatusPill status={job.status} conclusion={job.conclusion} />
        <span className="ws-job__name">{job.name}</span>
        <button
          type="button"
          className="ghost-button ws-job__logbtn"
          aria-expanded={open}
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next && log === null && !loading) loadLog();
          }}
        >
          {open ? "Hide log" : "View log"}
        </button>
      </div>

      {job.steps.length > 0 && (
        <ol className="ws-steps">
          {job.steps.map((step) => (
            <li key={`${step.number}-${step.name}`} className="ws-step">
              <StatusPill status={step.status} conclusion={step.conclusion} />
              <span className="ws-step__name">{step.name}</span>
            </li>
          ))}
        </ol>
      )}

      {open && (
        <div className="ws-job__log">
          {loading ? (
            <WorkspaceLoading rows={4} />
          ) : error ? (
            <WorkspaceError message={error} onRetry={loadLog} />
          ) : log && log.available ? (
            <>
              {log.truncated && (
                <p className="ws-hint">
                  Showing the end of the log — the earlier output was too long
                  to send.
                </p>
              )}
              <pre className="ws-console">
                <code>{log.content}</code>
              </pre>
            </>
          ) : (
            <WorkspaceEmpty
              title="No log available"
              message="GitHub keeps logs for a limited time, and this one has expired."
            />
          )}
        </div>
      )}
    </li>
  );
}
