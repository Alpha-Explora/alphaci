"use client";

import { useId, useState } from "react";

import "./pull-request-checks.css";

import {
  annotationLocation,
  annotationTone,
  checkHasDetail,
  checkStartsOpen,
  checksStartExpanded,
  groupPullRequestChecks,
  stagePills,
  summarizePullRequestChecks,
  type CheckGroup,
  type CheckRow,
  type ChecksSummary,
  type CheckTone,
  type StagePill,
} from "../../model/pull-request-check-rules";
import type { PullRequestCheck } from "../../view-models/use-pull-request-review-view-model";
import { useJobLogViewModel } from "../../view-models/use-run-jobs-view-model";
import { JobLogPanel } from "./job-log-view";

type Annotation = NonNullable<PullRequestCheck["annotations"]>[number];

const MARK: Record<CheckTone, string> = {
  success: "✓",
  failure: "✗",
  running: "•",
  neutral: "–",
};

/**
 * What the checks say about a pull request, which is the first half of the
 * decision to merge it.
 *
 * One count line first, because "is it green" is the question every reader
 * has. Our own four stages next, as pills — they are the pipeline, not four
 * more rows. Then GitHub's checks grouped by the workflow they belong to,
 * failures first, each failure opened on its own error: its title, its
 * summary, the lines GitHub annotated, and the job's log, all here.
 *
 * A clean pull request folds down to the count and the pills. Nothing in this
 * panel leads out of the product.
 */
export function PullRequestChecks({
  projectId,
  checks,
}: Readonly<{ projectId: string; checks: readonly PullRequestCheck[] }>) {
  const listId = useId();
  const summary = summarizePullRequestChecks(checks);
  const groups = groupPullRequestChecks(checks);
  // Derived until someone clicks: a check that turns red after a reload opens
  // the list without a second click.
  const [chosen, setChosen] = useState<boolean | undefined>(undefined);
  const expanded = chosen ?? checksStartExpanded(summary);

  if (checks.length === 0) {
    return <p className="ws-hint">No checks have reported for this commit.</p>;
  }

  return (
    <section className="ws-checks" aria-label="Checks">
      <ChecksHeader summary={summary} />
      <StagePills pills={stagePills(checks)} />
      {groups.length > 0 && (
        <button
          type="button"
          className="ws-checks__toggle"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          onClick={() => setChosen(!expanded)}
        >
          {expanded ? "Hide checks" : `Show all ${String(summary.total)} checks`}
        </button>
      )}
      {expanded && groups.length > 0 && (
        <div id={listId} className="ws-checks__groups">
          {groups.map((group) => (
            <CheckGroupList key={group.name} projectId={projectId} group={group} />
          ))}
        </div>
      )}
    </section>
  );
}

/** "6 checks · 4 passed · 1 failed · 1 running", over a bar split the same way. */
function ChecksHeader({ summary }: Readonly<{ summary: ChecksSummary }>) {
  const share = (count: number) => `${String((count / Math.max(1, summary.total)) * 100)}%`;
  return (
    <div className="ws-checks__head">
      <p className="ws-checks__summary">{summary.label}</p>
      <span className="ws-checks__bar" aria-hidden="true">
        <span className="ws-checks__seg ws-checks__seg--success" style={{ width: share(summary.passed) }} />
        <span className="ws-checks__seg ws-checks__seg--failure" style={{ width: share(summary.failed) }} />
        <span className="ws-checks__seg ws-checks__seg--running" style={{ width: share(summary.running) }} />
      </span>
    </div>
  );
}

const TONE_WORD: Record<CheckTone, string> = {
  success: "passed",
  failure: "failed",
  running: "running",
  neutral: "skipped",
};

/** ALPHACI's stages, Access → Verify, as the pipeline posted them. */
function StagePills({ pills }: Readonly<{ pills: readonly StagePill[] }>) {
  if (pills.length === 0) return null;
  return (
    <ul className="ws-checks__stages" aria-label="ALPHACI stages">
      {pills.map((pill) => (
        <li key={pill.stage} className={`ws-stagepill ws-stagepill--${pill.tone}`}>
          <span aria-hidden="true" className="ws-stagepill__mark">
            {pill.mark}
          </span>
          {pill.label}
          <span className="sr-only"> {TONE_WORD[pill.tone]}</span>
        </li>
      ))}
    </ul>
  );
}

function CheckGroupList({
  projectId,
  group,
}: Readonly<{ projectId: string; group: CheckGroup<PullRequestCheck> }>) {
  return (
    <div className="ws-checkgroup">
      <p className="ws-checkgroup__title">
        {group.name}
        <span className="ws-checkgroup__count">{group.rows.length}</span>
      </p>
      <ul className="ws-checkgroup__rows">
        {group.rows.map((row) => (
          <CheckItem key={row.key} projectId={projectId} row={row} />
        ))}
      </ul>
    </div>
  );
}

/** The row's one line: outcome mark, name, which-is-which, and the outcome word. */
function CheckLine({ row }: Readonly<{ row: CheckRow<PullRequestCheck> }>) {
  const outcome = row.check.conclusion ?? row.check.status;
  return (
    <>
      <span aria-hidden="true" className="ws-check__mark">
        {MARK[row.tone]}
      </span>
      <span className="ws-check__name">{row.check.name}</span>
      {row.qualifier && <span className="ws-check__qualifier">{row.qualifier}</span>}
      <span className="ws-check__outcome">{outcome.replace(/_/g, " ")}</span>
    </>
  );
}

/**
 * One check. With nothing to say beyond its outcome (every check from an
 * older backend) it is a plain row; with detail it is a disclosure, opened
 * from the start when it failed.
 */
function CheckItem({
  projectId,
  row,
}: Readonly<{ projectId: string; row: CheckRow<PullRequestCheck> }>) {
  if (!checkHasDetail(row.check)) {
    return (
      <li className={`ws-check ws-check--${row.tone}`}>
        <div className="ws-check__line">
          <CheckLine row={row} />
        </div>
      </li>
    );
  }
  return (
    <li className={`ws-check ws-check--${row.tone}`}>
      <details className="ws-check__details" open={checkStartsOpen(row)}>
        <summary className="ws-check__line ws-check__line--toggle">
          <CheckLine row={row} />
        </summary>
        <CheckDetail projectId={projectId} check={row.check} />
      </details>
    </li>
  );
}

/**
 * What the check itself reported. The summary is often markdown; it is shown
 * as text with its line breaks kept, never parsed into HTML — it comes from
 * whatever app posted the check.
 */
function CheckDetail({
  projectId,
  check,
}: Readonly<{ projectId: string; check: PullRequestCheck }>) {
  return (
    <div className="ws-check__detail">
      {check.title && <p className="ws-check__title">{check.title}</p>}
      {check.summary && <p className="ws-check__text">{check.summary}</p>}
      {check.description && <p className="ws-check__text">{check.description}</p>}
      <Annotations annotations={check.annotations ?? []} />
      {check.jobId != null && <CheckJobLog projectId={projectId} jobId={check.jobId} />}
    </div>
  );
}

/** "src/app.ts:12 — 'x' is defined but never used", one per line GitHub flagged. */
function Annotations({ annotations }: Readonly<{ annotations: readonly Annotation[] }>) {
  if (annotations.length === 0) return null;
  return (
    <ul className="ws-annotations" aria-label="Annotations">
      {annotations.map((annotation, index) => (
        <li
          key={`${annotation.path}-${String(annotation.line)}-${String(index)}`}
          className={`ws-annotation ws-annotation--${annotationTone(annotation.level)}`}
        >
          <code className="ws-annotation__where">{annotationLocation(annotation)}</code>
          <span className="ws-annotation__message">
            {" — "}
            {annotation.title ? `${annotation.title}: ` : ""}
            {annotation.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The job's log, read here rather than on GitHub; loaded on the first open only. */
function CheckJobLog({ projectId, jobId }: Readonly<{ projectId: string; jobId: number }>) {
  const view = useJobLogViewModel({ projectId, jobId });
  const logId = useId();
  return (
    <>
      <button
        type="button"
        className="ws-checks__toggle"
        aria-expanded={view.open}
        aria-controls={view.open ? logId : undefined}
        onClick={view.toggle}
      >
        {view.open ? "Hide log" : "View log"}
      </button>
      {view.open && (
        <div id={logId} className="ws-check__log">
          <JobLogPanel view={view} />
        </div>
      )}
    </>
  );
}
