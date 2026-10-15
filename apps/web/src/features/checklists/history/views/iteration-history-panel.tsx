"use client";

import "./history.css";

import { IterationStatusPill } from "../../iteration";
import { StatusPill, VerdictPill } from "../../items";
import {
  HISTORY_EMPTY_TEXT,
  HISTORY_INTRO,
  historyMetaLabel,
  historyNoReportText,
  historySignoffLabel,
} from "../../model/iteration-history-rules";
import { iterationTitle } from "../../model/iteration-rules";
import type { HistoryIteration } from "../../model/iteration-types";
import { groupPassLabel, groupRunItems, headLabel } from "../../model/project-run-rules";
import type { ProjectQaRun, ProjectRunGroup } from "../../model/project-run-types";
import { blockersLabel, openDefectsLabel, passedLabel } from "../../model/qa-run-rules";
import { kindCopy, progressLabel } from "../../model/requirement-rules";
import {
  useIterationHistoryViewModel,
  type HistoryReport,
  type IterationHistoryViewModel,
} from "../view-models/use-iteration-history-view-model";

/** A chevron, decorative: the card's toggle says open or closed in words (aria-expanded). */
function Chevron() {
  return (
    <svg
      aria-hidden="true"
      className="history-card__chevron"
      fill="none"
      focusable="false"
      height="13"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 16 16"
      width="13"
    >
      <path d="m4.25 6.25 3.75 3.75 3.75-3.75" />
    </svg>
  );
}

/** One requirement and its items, as QA left them. */
function HistoryGroup({ group }: Readonly<{ group: ProjectRunGroup }>) {
  return (
    <li className="history-group">
      <p className="history-group__head">
        <span className="history-group__kind" data-kind={group.kind}>
          {kindCopy(group.kind).singular}
        </span>
        <span className="history-group__name">{group.requirementName}</span>
        <span className="history-group__count">{groupPassLabel(group)}</span>
      </p>
      <ul className="history-items" aria-label={`${kindCopy(group.kind).items} of ${group.requirementName}`}>
        {group.items.map((item) => (
          <li key={item.id} className="history-item">
            <span className="history-item__title">{item.title}</span>
            <span className="history-item__facts">
              {item.progress ? <span className="history-item__progress">{progressLabel(item.progress)}</span> : null}
              <StatusPill status={item.status} />
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** The frozen report: who signed it off, the score, the heads it verified, every item. */
function FrozenReport({ run }: Readonly<{ run: ProjectQaRun }>) {
  const signoff = run.signoff;
  return (
    <div className="history-report">
      {signoff ? (
        <div className="history-signoff">
          <VerdictPill verdict={signoff.verdict} />
          <span className="history-signoff__by">{historySignoffLabel(signoff)}</span>
          {signoff.summary ? <p className="history-signoff__summary">{signoff.summary}</p> : null}
        </div>
      ) : null}
      <p className="history-score">
        {passedLabel(run)} · {openDefectsLabel(run.summary.openDefects)} · {blockersLabel(run.summary.blockers)}
      </p>
      {run.repositories.length > 0 ? (
        <ul className="history-heads" aria-label="What QA verified">
          {run.repositories.map((head) => (
            <li key={head.projectId} className="history-heads__item">
              <code>{headLabel(head.repoFullName, head.runSha)}</code>
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="history-groups">
        {groupRunItems(run.items).map((group) => (
          <HistoryGroup key={group.key} group={group} />
        ))}
      </ul>
    </div>
  );
}

function ReportBody({
  report,
  onRetry,
}: Readonly<{ report: HistoryReport | undefined; onRetry: () => void }>) {
  if (!report || report.status === "loading") {
    return <div className="hier-skeleton history-skeleton" aria-hidden="true" />;
  }
  if (report.status === "error") {
    return (
      <div className="history-note" role="alert">
        <p>{report.message}</p>
        <button type="button" className="ghost-button" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  return <FrozenReport run={report.run} />;
}

/** One iteration: its title as the toggle, and — opened — its frozen checklist. */
function HistoryCard({ iteration, vm }: Readonly<{ iteration: HistoryIteration; vm: IterationHistoryViewModel }>) {
  const open = vm.open[iteration.id] === true;
  const bodyId = `history-${iteration.id}`;
  const note = historyNoReportText(iteration);
  return (
    <li className="history-card" data-status={iteration.status} data-open={String(open)}>
      <div className="history-card__head">
        <h4 className="history-card__title">
          <button
            type="button"
            className="history-card__toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => vm.toggle(iteration)}
          >
            <span>{iterationTitle(iteration)}</span>
            <Chevron />
          </button>
        </h4>
        <IterationStatusPill iteration={iteration} />
      </div>
      <p className="history-card__meta">{historyMetaLabel(iteration)}</p>
      <div id={bodyId} className="history-card__body" hidden={!open}>
        {open ? (
          note ? (
            <p className="history-note">{note}</p>
          ) : (
            <ReportBody
              report={iteration.signoffRunId ? vm.reports[iteration.signoffRunId] : undefined}
              onRetry={() => vm.retryReport(iteration)}
            />
          )
        ) : null}
      </div>
    </li>
  );
}

function HistoryBody({ vm }: Readonly<{ vm: IterationHistoryViewModel }>) {
  if (vm.status === "loading" || vm.status === "idle") {
    return <div className="hier-skeleton history-skeleton" aria-hidden="true" />;
  }
  if (vm.status === "unavailable") {
    return <p className="history-note">This server does not keep iterations yet.</p>;
  }
  if (vm.status === "error") {
    return (
      <div className="history-note" role="alert">
        <p>{vm.error}</p>
        <button type="button" className="ghost-button" onClick={vm.reload}>
          Try again
        </button>
      </div>
    );
  }
  if (vm.iterations.length === 0) return <p className="history-note">{HISTORY_EMPTY_TEXT}</p>;
  return (
    <ul className="history-list" aria-label="Iterations, newest first">
      {vm.iterations.map((iteration) => (
        <HistoryCard key={iteration.id} iteration={iteration} vm={vm} />
      ))}
    </ul>
  );
}

/**
 * The Project's History: every iteration, newest first. A delivered one opens
 * like a dropdown onto its checklist and QA results exactly as QA signed them
 * off; the active one points to the Checklists tab, where it is worked in.
 * Read-only for every role.
 */
export function IterationHistoryPanel({
  deliveryProjectId,
  projectName,
  enabled,
}: Readonly<{ deliveryProjectId: string; projectName: string; enabled: boolean }>) {
  const vm = useIterationHistoryViewModel({ deliveryProjectId, enabled });
  return (
    <section className="history" aria-labelledby="history-title">
      <div className="history__head">
        <h3 className="history__title" id="history-title">
          {projectName} history
        </h3>
        <p className="history__intro">{HISTORY_INTRO}</p>
      </div>
      <HistoryBody vm={vm} />
    </section>
  );
}
