"use client";

import { useId, useState } from "react";

import { checkLabel, checkTone, relativeTime } from "@/features/runs";
import type { FriendlyMessage, StageId } from "@/shared/api/contracts";

import type { RunsViewMode } from "../../model/runs-view-mode";
import {
  checkProgress,
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
import { ChevronIcon, ExternalIcon, VerdictIcon } from "./pipeline-glyphs";

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
 */
export function StageStepper({
  entries,
  openStage,
  panelId,
  onSelect,
}: Readonly<{
  entries: readonly StageEntry[];
  openStage: StageId | null;
  panelId: string;
  onSelect: (stage: StageId) => void;
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
 * stages: a tone rule on the left, name and coverage, a status chip, then one
 * line of figures — and, for a stage that failed, the error itself.
 *
 * The failure output loads only for a stage that actually RAN (`failure` or
 * `cancelled`). `blocked` and `stalled` have no log, and asking for one would
 * be a wasted GitHub call.
 */
export function StageDetail({
  projectId,
  entry,
  panelId,
  viewMode = "deep",
}: Readonly<{
  projectId: string;
  entry: StageEntry;
  panelId: string;
  /** `summary` keeps the tool log behind a "Show logs" disclosure. */
  viewMode?: RunsViewMode;
}>) {
  const { stage, verdict } = entry;
  const headingId = useId();
  const ran = stage.status === "failure" || stage.status === "cancelled";

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
        <StatusChip tone={verdict.tone} label={verdict.label} />
      </div>

      <StageFigures stage={stage} />

      {showsVerdictReason(entry) && <p className="pipe-stage__reason">{verdict.reason}</p>}

      {stage.friendlyMessages.map((message, index) => (
        <Finding key={index} message={message} stageStatus={stage.status} />
      ))}

      {stage.status === "failure" && stage.friendlyMessages.length === 0 && (
        <p className="pipe-stage__reason">
          No summary was captured for this failure. The output below is what the failing job printed.
        </p>
      )}

      {ran && (
        <StageLogs projectId={projectId} runId={stage.runId} viewMode={viewMode} />
      )}
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

  if (viewMode === "deep") return <FailureOutput view={failureLog} />;

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
        {logsOpen && <FailureOutput view={failureLog} />}
      </div>
    </>
  );
}

/**
 * "4 / 5 passed ▬▬ · 1 still running · 1 failed ▾ · 9m ago · View run", then
 * the check list when asked for. Nothing for a stage that never executed and
 * reported no checks: there is nothing to count and no run to link.
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
        <StageWhenAndWhere stage={stage} executed={executed} />
      </div>
      {progress && <CheckRoster id={rosterId} checks={stage.checks ?? []} hidden={!rosterOpen} />}
    </>
  );
}

/** When the stage last reported, and its run on GitHub when it had one. */
function StageWhenAndWhere({
  stage,
  executed,
}: Readonly<{ stage: StageEntry["stage"]; executed: boolean }>) {
  return (
    <>
      {stage.updatedAt && (
        <time dateTime={stage.updatedAt} title={new Date(stage.updatedAt).toLocaleString()}>
          {relativeTime(stage.updatedAt)}
        </time>
      )}
      {executed && stage.githubRunUrl && (
        <a className="pipe-link" href={stage.githubRunUrl} target="_blank" rel="noopener noreferrer">
          View run
          <ExternalIcon />
          <span className="sr-only"> (opens GitHub in a new tab)</span>
        </a>
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
 * Why there is no output, said plainly. Both cases are normal rather than
 * errors: GitHub expires logs, and a run rejected before any job started has
 * no failed job to read.
 */
function LogUnavailable({ reason }: Readonly<{ reason?: "no-failed-job" | "log-expired" }>) {
  return (
    <p className="pipe-stage__reason">
      {reason === "log-expired"
        ? "GitHub has expired the log for this run, so the output is no longer available."
        : "No job in this run reported a failure, which usually means the workflow was rejected before any job started."}
    </p>
  );
}

function FailureOutput({ view }: Readonly<{ view: StageFailureLogViewModel }>) {
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

  const log = view.log;
  if (!log) return null;
  if (!log.available) return <LogUnavailable reason={log.reason} />;
  if (!log.lines || log.lines.length === 0) return null;
  return <FailureLogLines log={log} />;
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
function FailureLogLines({ log }: Readonly<{ log: RunFailureLogResponse }>) {
  const [showAll, setShowAll] = useState(false);
  const all = log.lines ?? [];
  const hidden = Math.max(0, all.length - VISIBLE_TAIL_LINES);
  const shown = showAll || hidden === 0 ? all : all.slice(-VISIBLE_TAIL_LINES);

  return (
    <div className="pipe-log">
      <div className="pipe-log__head">
        <p className="pipe-log__source">
          {log.jobName}
          {log.stepName ? <span className="pipe-log__step"> › {log.stepName}</span> : null}
          {log.truncated ? <span className="pipe-log__step"> · earlier output omitted</span> : null}
        </p>
        {log.jobUrl && (
          <a className="pipe-link" href={log.jobUrl} target="_blank" rel="noopener noreferrer">
            Full log
            <ExternalIcon />
            <span className="sr-only"> (opens GitHub in a new tab)</span>
          </a>
        )}
      </div>
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
    </div>
  );
}
