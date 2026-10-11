"use client";

import { useId, useState } from "react";

import { checkLabel, checkTone, relativeTime } from "@/features/runs";
import { normalizeTestCases, SonarPanel, TestCaseList } from "@/features/runs/test-report";
import type { FriendlyMessage, StageId } from "@/shared/api/contracts";

import {
  failureEntries,
  logUnavailableMessage,
  omittedFailuresLabel,
  type FailureEntry,
} from "../../model/failure-log-rules";
import type { RunsViewMode } from "../../model/runs-view-mode";
import { failedTests, stageResultFigures } from "../../model/stage-result-figures";
import {
  checkProgress,
  loadsFailureLog,
  showsVerdictReason,
  stageCoverage,
  stageName,
  type CheckProgress,
  type StageEntry,
  type VerdictTone,
} from "../../model/pipeline-run-card-rules";
import {
  useStageFailureLogViewModel,
  type RunFailureLogResponse,
  type StageFailureLogViewModel,
} from "../../view-models/use-stage-failure-log-view-model";
import { useJobLogViewModel } from "../../view-models/use-run-jobs-view-model";
import type { VisualChecksViewModel } from "../../view-models/use-visual-checks-view-model";
import { JobLogPanel } from "./job-log-view";
import { ChevronIcon, VerdictIcon } from "./pipeline-glyphs";
import { VisualChecksPanel, VisualChip } from "./pipeline-visual-checks";

/* ── The stepper ────────────────────────────────────────────────────────── */

/**
 * Access → Quality → Package → Verify, left to right, one step per stage.
 *
 * Replaces a vertical rail of pills beside a panel that floated away from it.
 * A pipeline is a sequence, and a row of steps joined by a line says so before
 * anyone reads a word: where it stopped is where the line changes colour.
 *
 * Each step is a disclosure button for the one detail card beneath the row —
 * not a tab. A clean commit opens nothing, and a tablist must always have a
 * selected tab; pressing the open step again closes it.
 *
 * `visualChip` ("Visual: 2 changed") sits under the Verify step once that
 * stage's visual checks have been read, so a changed screenshot stays in
 * sight after the stage is closed. It is never fetched for the stepper alone.
 */
export function StageStepper({
  entries,
  openStage,
  panelId,
  onSelect,
  visualChip = null,
}: Readonly<{
  entries: readonly StageEntry[];
  openStage: StageId | null;
  panelId: string;
  onSelect: (stage: StageId) => void;
  visualChip?: string | null;
}>) {
  return (
    <ol className="pipe-steps" aria-label="Pipeline stages">
      {entries.map(({ stage, verdict }) => {
        const open = openStage === stage.stage;
        return (
          <li
            key={stage.stage}
            className={`pipe-step pipe-step--${verdict.tone}`}
            data-open={open ? "true" : "false"}
          >
            <button
              type="button"
              className="pipe-step__button"
              aria-expanded={open}
              aria-controls={open ? panelId : undefined}
              onClick={() => onSelect(stage.stage)}
            >
              <span className="pipe-step__icon">
                <VerdictIcon tone={verdict.tone} />
              </span>
              <span className="pipe-step__text">
                <span className="pipe-step__name">{stageName(stage.stage)}</span>
                <span className="pipe-step__state">{verdict.label}</span>
                {stage.stage === "verify" && visualChip && (
                  <span className="pipe-step__visual">{visualChip}</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ── One stage, opened ──────────────────────────────────────────────────── */

export function StatusChip({
  tone,
  label,
}: Readonly<{ tone: VerdictTone; label: string }>) {
  return (
    <span className={`pipe-chip pipe-chip--${tone}`}>
      <span className="pipe-chip__dot" aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * The opened stage, in the same card language as QA Studio's automation
 * stages: a tone rule on the left, name and coverage, a status chip, one line
 * of check counts, one line of the stage's own figures (tests, coverage,
 * lint...) — and, for a stage that failed, the error itself.
 *
 * The failure output loads only for a stage with a failed run to read (see
 * `loadsFailureLog`), which now includes a stage that passed and whose run
 * failed afterwards: that error is in no report, only in the log.
 *
 * The Verify stage on uat and main also carries its visual checks (`visual`,
 * owned by the commit card so a result read once outlives the stage being
 * closed), below everything else: the screenshots are the longest part.
 */
export function StageDetail({
  projectId,
  entry,
  panelId,
  viewMode = "deep",
  branch = "",
  visual,
  visualChip = null,
  visualCaptureOn,
}: Readonly<{
  projectId: string;
  entry: StageEntry;
  panelId: string;
  /** `summary` keeps the tool log behind a "Show logs" disclosure. */
  viewMode?: RunsViewMode;
  branch?: string;
  /** The commit's visual checks; absent for every stage but Verify on uat/main. */
  visual?: VisualChecksViewModel;
  /** "Visual: 2 changed", once `visual` has been read. */
  visualChip?: string | null;
  /** False when the repository's workflow takes no screenshots on this branch; null when unknown. */
  visualCaptureOn?: boolean | null;
}>) {
  const { stage, verdict } = entry;
  const headingId = useId();

  return (
    <section
      id={panelId}
      className={`pipe-stage pipe-stage--${verdict.tone}`}
      aria-labelledby={headingId}
    >
      <div className="pipe-stage__row">
        <h5 id={headingId} className="pipe-stage__title">
          {stageName(stage.stage)}
          <span className="pipe-stage__coverage">
            <span className="pipe-stage__dash"> — </span>
            {stageCoverage(stage.stage)}
          </span>
        </h5>
        <span className="pipe-stage__chips">
          <VisualChip label={visual ? visualChip : null} />
          <StatusChip tone={verdict.tone} label={verdict.label} />
        </span>
      </div>

      <StageFigures stage={stage} />
      <ResultFigures results={stage.results} />

      {showsVerdictReason(entry) && <p className="pipe-stage__reason">{verdict.reason}</p>}

      {stage.friendlyMessages.map((message, index) => (
        <Finding key={index} message={message} stageStatus={stage.status} />
      ))}

      {stage.status === "failure" && stage.friendlyMessages.length === 0 && (
        <p className="pipe-stage__reason">
          No summary was captured for this failure. The output below is what the failing job printed.
        </p>
      )}

      {loadsFailureLog(entry) && (
        <StageLogs projectId={projectId} runId={stage.runId} viewMode={viewMode} />
      )}

      {visual && <VisualChecksPanel view={visual} branch={branch} captureOn={visualCaptureOn} />}
    </section>
  );
}

/**
 * The failure output of a stage that ran. Deep debug shows it as it loads; the
 * summary keeps it behind a "Show logs" disclosure and does not spend a GitHub
 * call on a log nobody opened.
 */
function StageLogs({
  projectId,
  runId,
  viewMode,
}: Readonly<{ projectId: string; runId: number; viewMode: RunsViewMode }>) {
  const logsId = useId();
  const [logsOpen, setLogsOpen] = useState(false);
  const shown = viewMode === "deep" || logsOpen;
  const failureLog = useStageFailureLogViewModel({
    projectId,
    runId,
    enabled: shown,
  });

  if (viewMode === "deep") return <FailureOutput projectId={projectId} view={failureLog} />;

  return (
    <>
      <button
        type="button"
        className="pipe-text-button pipe-logs-toggle"
        aria-expanded={logsOpen}
        aria-controls={logsId}
        onClick={() => setLogsOpen(!logsOpen)}
      >
        <ChevronIcon />
        {logsOpen ? "Hide logs" : "Show logs"}
      </button>
      <div id={logsId} hidden={!logsOpen}>
        {logsOpen && <FailureOutput projectId={projectId} view={failureLog} />}
      </div>
    </>
  );
}

/**
 * "4 / 5 passed ▬▬ · 1 still running · 1 failed ▾ · 9m ago", then the check
 * list when asked for. Nothing for a stage that never executed and reported no
 * checks: there is nothing to count.
 */
function StageFigures({ stage }: Readonly<{ stage: StageEntry["stage"] }>) {
  const rosterId = useId();
  const [rosterOpen, setRosterOpen] = useState(false);
  const progress = checkProgress(stage.checks);
  const executed =
    stage.status !== "blocked" && stage.status !== "stalled" && stage.status !== "pending";
  if (!progress && !executed) return null;

  return (
    <>
      <div className="pipe-stage__meta">
        {progress ? (
          <>
            <CheckFigures progress={progress} />
            <RosterToggle
              progress={progress}
              open={rosterOpen}
              controls={rosterId}
              onToggle={() => setRosterOpen(!rosterOpen)}
            />
          </>
        ) : (
          <span className="pipe-stage__none">No per-check results reported</span>
        )}
        <StageWhen stage={stage} />
      </div>
      {progress && <CheckRoster id={rosterId} checks={stage.checks ?? []} hidden={!rosterOpen} />}
    </>
  );
}

/** When the stage last reported. */
function StageWhen({ stage }: Readonly<{ stage: StageEntry["stage"] }>) {
  return (
    <>
      {stage.updatedAt && (
        <time dateTime={stage.updatedAt} title={new Date(stage.updatedAt).toLocaleString()}>
          {relativeTime(stage.updatedAt)}
        </time>
      )}
    </>
  );
}

/** "4 / 5 passed ▬▬ · 1 still running · 4 skipped". */
function CheckFigures({ progress }: Readonly<{ progress: CheckProgress }>) {
  return (
    <span className="pipe-figures">
      <span className="pipe-figures__count">{progress.label}</span>
      {progress.share !== null && (
        <span className="pipe-figures__bar" aria-hidden="true">
          <span className="pipe-figures__fill" style={{ width: `${progress.share}%` }} />
        </span>
      )}
      {progress.notes.map((note) => (
        <span key={note} className="pipe-figures__note">
          {note}
        </span>
      ))}
    </span>
  );
}

/**
 * The failed count doubles as the disclosure for the check list, as it does on
 * the QA cards; a clean stage offers the list under its size instead.
 */
function RosterToggle({
  progress,
  open,
  controls,
  onToggle,
}: Readonly<{
  progress: CheckProgress;
  open: boolean;
  controls: string;
  onToggle: () => void;
}>) {
  const failed = progress.failed > 0;
  const total = progress.counted + progress.skipped;
  return (
    <button
      type="button"
      className={`pipe-toggle${failed ? " pipe-toggle--danger" : ""}`}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
    >
      {failed ? `${progress.failed} failed` : `${total} ${total === 1 ? "check" : "checks"}`}
      <span className="sr-only">{open ? " — hide the check list" : " — show the check list"}</span>
      <ChevronIcon />
    </button>
  );
}

function CheckRoster({
  id,
  checks,
  hidden,
}: Readonly<{ id: string; checks: readonly { name: string; conclusion: string }[]; hidden: boolean }>) {
  return (
    <ul id={id} className="pipe-roster" hidden={hidden}>
      {checks.map((check) => {
        const tone = checkTone(check.conclusion);
        return (
          <li key={check.name} className={`pipe-roster__row pipe-roster__row--${tone}`}>
            <VerdictIcon
              tone={
                tone === "passed"
                  ? "success"
                  : tone === "failed"
                    ? "danger"
                    : tone === "running"
                      ? "running"
                      : "muted"
              }
            />
            <span className="pipe-roster__name">{checkLabel(check.name)}</span>
            <span className="pipe-roster__outcome">{check.conclusion.replace(/_/g, " ")}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The stage's own figures in one row: "Tests 48 / 48 passed · Coverage 87%
 * (min 80%) · Lint 0 errors · 3 warnings". Shown for passes as much as for
 * failures — a green stage's numbers are the evidence that it is green — with
 * a failed figure toned, and the failing tests named under it.
 */
function ResultFigures({ results }: Readonly<{ results: StageEntry["stage"]["results"] }>) {
  const figures = stageResultFigures(results);
  if (figures.length === 0 && !results?.tests?.cases && !results?.sonar) return null;
  return (
    <>
      {figures.length > 0 ? (
        <dl className="pipe-results" aria-label="Stage figures">
          {figures.map((figure) => (
            <div key={figure.id} className={`pipe-result pipe-result--${figure.tone}`}>
              <dt className="pipe-result__label">{figure.label}</dt>
              <dd className="pipe-result__value">{figure.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <TestDetail results={results} />
      <SonarPanel sonar={results?.sonar} />
    </>
  );
}

/**
 * Every browser test with what it checks, its steps and its error, when the
 * pipeline reports them; otherwise the failing names, as before.
 */
function TestDetail({ results }: Readonly<{ results: StageEntry["stage"]["results"] }>) {
  const cases = normalizeTestCases(results?.tests?.cases);
  if (cases && cases.length > 0) return <TestCaseList cases={cases} total={results?.tests?.total} />;
  return <FailedTestList results={results} />;
}

function FailedTestList({ results }: Readonly<{ results: StageEntry["stage"]["results"] }>) {
  const { failures, more } = failedTests(results);
  if (failures.length === 0) return null;
  return (
    <ul className="pipe-results__failures" aria-label="Failing tests">
      {failures.map((failure, index) => (
        <li key={`${failure.name}-${String(index)}`} className="pipe-results__failure">
          <code className="pipe-results__test">{failure.name}</code>
          {failure.message && <span className="pipe-results__message">{failure.message}</span>}
        </li>
      ))}
      {more > 0 && <li className="pipe-results__more">+{more} more failing</li>}
    </ul>
  );
}

/**
 * What our grading said: the title and one line, the concrete items, and the
 * generic advice folded away. The advice is the same paragraph on every commit
 * with the same failure, so leaving it open buried the one line that differed.
 */
function Finding({
  message,
  stageStatus,
}: Readonly<{ message: FriendlyMessage; stageStatus: string }>) {
  const askWhy =
    stageStatus === "failure" || stageStatus === "stalled" || stageStatus === "cancelled";
  return (
    <div className={`pipe-finding pipe-finding--${message.severity}`}>
      <p className="pipe-finding__title">{message.title}</p>
      {message.detail && <p className="pipe-finding__detail">{message.detail}</p>}
      {message.items && message.items.length > 0 && (
        <ul className="pipe-finding__items">
          {message.items.map((item, index) => (
            <li key={index} className="pipe-finding__item">
              <code className="pipe-finding__label">{item.label}</code>
              {item.sub && <span className="pipe-finding__sub">{item.sub}</span>}
            </li>
          ))}
        </ul>
      )}
      {message.hint && (
        <details className="pipe-why">
          <summary className="pipe-why__summary">
            <ChevronIcon />
            {askWhy ? "Why might this happen?" : "What to do"}
          </summary>
          <p className="pipe-why__body">{message.hint}</p>
        </details>
      )}
    </div>
  );
}

/* ── The error output ───────────────────────────────────────────────────── */

/**
 * The backend's plain-English reading of a failure ("The token is missing the
 * read:org scope"), set apart from the log so it is read first. The log is the
 * evidence; this is the sentence someone acts on.
 */
export function FailureHint({ hint }: Readonly<{ hint: string }>) {
  return (
    <div className="pipe-hint" role="note">
      <p className="pipe-hint__label">What happened</p>
      <p className="pipe-hint__text">{hint}</p>
    </div>
  );
}

function FailureOutput({
  projectId,
  view,
}: Readonly<{ projectId: string; view: StageFailureLogViewModel }>) {
  if (view.status === "loading") {
    return (
      <p className="pipe-stage__reason" role="status">
        Reading the error output…
      </p>
    );
  }

  if (view.status === "error") {
    return (
      <p className="pipe-stage__reason" role="alert">
        {view.error}{" "}
        <button type="button" className="pipe-text-button" onClick={view.reload}>
          Retry
        </button>
      </p>
    );
  }

  if (!view.log) return null;
  return <FailedJobs projectId={projectId} log={view.log} />;
}

/**
 * Every job that failed in the run, one block each — not only the first. The
 * promotion job and the production gate run outside the stage's own jobs, and
 * showing one failure out of two left the second to be found somewhere else.
 */
function FailedJobs({ projectId, log }: Readonly<{ projectId: string; log: RunFailureLogResponse }>) {
  const entries = failureEntries(log);
  if (entries.length === 0) {
    return log.available ? null : <p className="pipe-stage__reason">{logUnavailableMessage(log.reason)}</p>;
  }
  const omitted = omittedFailuresLabel(log);
  return (
    <div className="pipe-failures">
      {entries.map((entry, index) => (
        <FailedJob key={entry.jobId ?? `${entry.jobName}-${String(index)}`} projectId={projectId} entry={entry} />
      ))}
      {omitted && <p className="pipe-failures__more">{omitted}</p>}
    </div>
  );
}

/** One failed job: where it failed, what it means, what it printed, and the whole log on request. */
function FailedJob({ projectId, entry }: Readonly<{ projectId: string; entry: FailureEntry }>) {
  return (
    <div className="pipe-log">
      <div className="pipe-log__head">
        <p className="pipe-log__source">
          {entry.jobName}
          {entry.stepName ? <span className="pipe-log__step"> › {entry.stepName}</span> : null}
          {entry.truncated ? <span className="pipe-log__step"> · earlier output omitted</span> : null}
        </p>
      </div>
      {entry.hint && <FailureHint hint={entry.hint} />}
      {entry.reason ? (
        <p className="pipe-stage__reason">{logUnavailableMessage(entry.reason)}</p>
      ) : (
        <FailureLogLines lines={entry.lines} />
      )}
      {/* An unreadable log stays unreadable in full; offer it only when there is one. */}
      {entry.jobId != null && !entry.reason && <FullJobLog projectId={projectId} jobId={entry.jobId} />}
    </div>
  );
}

/**
 * The job's whole log, read in the product. Loaded on the first open and never
 * again: it is the largest response there is.
 */
function FullJobLog({ projectId, jobId }: Readonly<{ projectId: string; jobId: number }>) {
  const view = useJobLogViewModel({ projectId, jobId });
  const logId = useId();
  return (
    <>
      <button
        type="button"
        className="pipe-text-button pipe-log__more"
        aria-expanded={view.open}
        aria-controls={view.open ? logId : undefined}
        onClick={view.toggle}
      >
        {view.open ? "Hide full log" : "View full log"}
      </button>
      {view.open && (
        <div id={logId} className="pipe-job__log">
          <JobLogPanel view={view} />
        </div>
      )}
    </>
  );
}

/**
 * How many lines of the excerpt show before someone asks for more.
 *
 * The excerpt ENDS at the error, so its tail is the part worth reading: a tool
 * prints why it is unhappy and then exits.
 */
const VISIBLE_TAIL_LINES = 12;

/**
 * The log excerpt, opening on the error rather than ending with it. Rendering
 * all of it put the failure at the bottom of a scrolling box, below forty lines
 * of provisioning output.
 */
function FailureLogLines({ lines }: Readonly<{ lines: readonly string[] }>) {
  const [showAll, setShowAll] = useState(false);
  if (lines.length === 0) return null;
  const hidden = Math.max(0, lines.length - VISIBLE_TAIL_LINES);
  const shown = showAll || hidden === 0 ? lines : lines.slice(-VISIBLE_TAIL_LINES);

  return (
    <>
      {hidden > 0 && (
        <button
          type="button"
          className="pipe-text-button pipe-log__more"
          aria-expanded={showAll}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? `Hide the earlier ${String(hidden)} lines` : `Show ${String(hidden)} earlier lines`}
        </button>
      )}
      <pre className="ws-console pipe-log__console">
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
    </>
  );
}
