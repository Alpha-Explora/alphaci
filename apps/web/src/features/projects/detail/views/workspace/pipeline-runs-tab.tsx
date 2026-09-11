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

import { checkLabel, checkTone, summarizeChecks } from "@/features/runs";

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
import {
  useStageFailureLogViewModel,
  type RunFailureLogResponse,
  type StageFailureLogViewModel,
} from "../../view-models/use-stage-failure-log-view-model";
import type { StageReport } from "@/shared/api/contracts";

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
            {/* EVERY branch. visibleSections is the FILTERED list, and using it
                here collapses the picker to the branch already selected. */}
            {runsView.sections.map((section) => (
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
              <span className="ws-stages__head">
                <span
                  className={`ws-pill ws-pill--${stagePillTone(stage.status)}`}
                >
                  {stage.stage}
                </span>
                <span className="ws-stages__status">
                  {stage.status.replace(/_/g, " ")}
                </span>
              </span>
              <StageChecks stage={stage} />
            </li>
          ))}
        </ul>
      )}

      {problems.length > 0 && (
        <div className="ws-diagnosis">
          {problems.map((stage) => (
            <StageDiagnosis
              key={stage.stage}
              projectId={projectId}
              stage={stage}
            />
          ))}
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
            <WorkspaceError
              message={error}
              onRetry={() => void loadJobs(true)}
            />
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

/**
 * One failing stage: what we know, and the error output itself.
 *
 * The hint used to read "Open the workflow logs, fix the first failed job
 * listed below, then re-run the workflow" — an instruction to go and do the
 * diagnosis somewhere else. Knowing a stage failed and making someone leave to
 * find out why is announcing a failure, not reporting one. The output now
 * loads here, unasked.
 *
 * Stages that never executed are excluded from fetching: `blocked` and
 * `stalled` have no log, and asking for one would be a wasted call.
 */
function StageDiagnosis({
  projectId,
  stage,
}: {
  projectId: string;
  stage: StageReport;
}) {
  const ran = stage.status === "failure" || stage.status === "cancelled";
  const failureLog = useStageFailureLogViewModel({
    projectId,
    runId: stage.runId,
    enabled: ran,
  });

  return (
    <div
      className={`ws-diagnosis__item ws-diagnosis__item--${
        stage.friendlyMessages[0]?.severity ?? "error"
      }`}
    >
      <p className="ws-diagnosis__title">
        {stage.stage}:{" "}
        {stage.friendlyMessages[0]?.title ?? String(stage.status)}
      </p>

      {/*
        The hint gives way to real output, and only then. "Open the workflow
        logs, fix the first failed job" is worthless beside the log itself —
        but "Fix the quality stage and the rest of the pipeline will run" is
        the most useful thing we can say about a blocked stage, which has no
        log of its own to show.
      */}
      <StageSummary stage={stage} showHint={!failureLog.log?.available} />
      {ran && <StageFailureOutput view={failureLog} />}
    </div>
  );
}

/**
 * Which tools ran inside a stage, folded away until asked for.
 *
 * A count first, the roster on demand. Listing seven ticks under every stage
 * of every clean run is a panel people stop opening, and a stage that says
 * nothing about the tools underneath it is how "green" stopped being worth
 * anything here — this platform stored twenty-four consecutive package
 * successes that built nothing. "7 of 7 checks passed" is the short answer to
 * the question those rows taught people to ask.
 *
 * Renders nothing at all when the stage carries no checks: a pipeline
 * generated before per-tool reporting is "not known", which is a different
 * claim from "no tools ran" and must not be dressed up as 0 of 0.
 */
function StageChecks({ stage }: { stage: StageReport }) {
  const checks = stage.checks ?? [];
  const summary = summarizeChecks(stage.checks);
  if (summary === null) {
    return null;
  }

  return (
    <details className="ws-checks">
      <summary className="ws-checks__summary">
        {summary.passed} of {summary.total} checks passed
      </summary>
      <ul className="ws-checks__list">
        {checks.map((check) => {
          const tone = checkTone(check.conclusion);
          return (
            <li
              key={check.name}
              className={`ws-checks__row ws-checks__row--${tone}`}
            >
              <span aria-hidden="true" className="ws-checks__mark">
                {tone === "passed"
                  ? "✓"
                  : tone === "failed"
                    ? "✗"
                    : tone === "running"
                      ? "●"
                      : "–"}
              </span>
              <span className="ws-checks__name">{checkLabel(check.name)}</span>
              <span className="ws-checks__outcome">{check.conclusion}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** What our own grading said about the stage, before any log is read. */
function StageSummary({
  stage,
  showHint,
}: {
  stage: StageReport;
  showHint: boolean;
}) {
  if (stage.friendlyMessages.length === 0) {
    return (
      <p className="ws-diagnosis__detail">
        {stage.status === "blocked"
          ? "This stage was never triggered."
          : "No summary was captured for this failure."}
      </p>
    );
  }

  return (
    <>
      {stage.friendlyMessages.map((message, index) => (
        <div key={index}>
          <p className="ws-diagnosis__detail">{message.detail}</p>
          {showHint && message.hint && (
            <p className="ws-diagnosis__hint">{message.hint}</p>
          )}
          {message.items && message.items.length > 0 && (
            <ul className="ws-diagnosis__items">
              {message.items.map((item, itemIndex) => (
                <li key={itemIndex} className="ws-diagnosis__item-row">
                  <code className="ws-diagnosis__item-label">{item.label}</code>
                  {item.sub && (
                    <span className="ws-diagnosis__item-sub">{item.sub}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </>
  );
}

/**
 * Why there is no output, said plainly.
 *
 * Both cases are normal rather than errors: GitHub expires logs on a retention
 * window, and a run rejected before any job started genuinely has no failed job
 * to read.
 */
function LogUnavailable({
  reason,
}: {
  reason?: "no-failed-job" | "log-expired";
}) {
  return (
    <p className="ws-diagnosis__hint">
      {reason === "log-expired"
        ? "GitHub has expired the log for this run, so the output is no longer available."
        : "No job in this run reported a failure, which usually means the workflow was rejected before any job started."}
    </p>
  );
}

/** The error output itself, or an honest account of why there is none. */
function StageFailureOutput({ view }: { view: StageFailureLogViewModel }) {
  if (view.status === "loading") {
    return <p className="ws-diagnosis__hint">Reading the error output…</p>;
  }

  if (view.status === "error") {
    return (
      <p className="ws-diagnosis__hint">
        {view.error}{" "}
        <button type="button" className="ghost-button" onClick={view.reload}>
          Retry
        </button>
      </p>
    );
  }

  const log = view.log;
  if (!log) return null;

  if (!log.available) return <LogUnavailable reason={log.reason} />;

  if (!log.lines || log.lines.length === 0) return null;

  return <FailureLogLines log={log} />;
}

/**
 * How many lines of the excerpt to show before someone asks for more.
 *
 * The excerpt ENDS at the error, so its tail is the part worth reading: a tool
 * prints why it is unhappy and then exits. Twelve lines reaches back past the
 * message into whatever printed it, and stops well short of the analyzer
 * provisioning that fills the rest.
 */
const VISIBLE_TAIL_LINES = 12;

/**
 * The log excerpt, opening on the error rather than ending with it.
 *
 * Rendering all of it put the failure at the BOTTOM of a scrolling box, so the
 * panel opened on "Provisioning analyzer assemblies" and "Processing plugin"
 * lines while the reason sat below the fold. Showing forty lines of context and
 * hiding the conclusion is the same failure as saying nothing — it just looks
 * more thorough.
 */
function FailureLogLines({ log }: { log: RunFailureLogResponse }) {
  const [showAll, setShowAll] = useState(false);
  const all = log.lines ?? [];
  const hidden = Math.max(0, all.length - VISIBLE_TAIL_LINES);
  const shown = showAll || hidden === 0 ? all : all.slice(-VISIBLE_TAIL_LINES);

  return (
    <div className="ws-diagnosis__log">
      <p className="ws-diagnosis__logmeta">
        {log.jobName}
        {log.stepName ? ` › ${log.stepName}` : ""}
        {log.truncated ? " · earlier output omitted" : ""}
      </p>
      {hidden > 0 && (
        <button
          type="button"
          className="ghost-button ws-diagnosis__more"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll
            ? `Hide the earlier ${String(hidden)} lines`
            : `Show ${String(hidden)} earlier lines`}
        </button>
      )}
      <pre className="ws-console">
        <code>
          {shown.map((line, index) => (
            <span
              key={index}
              className={
                line.includes("##[error]")
                  ? "ws-console__line ws-console__line--error"
                  : "ws-console__line"
              }
            >
              {line || " "}
            </span>
          ))}
        </code>
      </pre>
      {log.jobUrl && (
        <a
          className="ws-link"
          href={log.jobUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open the full log on GitHub ↗
        </a>
      )}
    </div>
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
