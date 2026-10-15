"use client";

import "./history.css";

import type { AppRole } from "@/shared/api/contracts";

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
import { showsRepositories } from "../../model/studio-role-rules";
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
      className="ihist-card__chevron"
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

/**
 * "Delivered" or "Active", in the iteration pill's tones. The card title
 * already names the iteration, so the pill says only its state.
 */
function StateTag({ status }: Readonly<{ status: HistoryIteration["status"] }>) {
  return (
    <span className="iteration-status" data-status={status}>
      <span className="iteration-status__dot" aria-hidden="true" />
      <span className="iteration-status__label">{status === "delivered" ? "Delivered" : "Active"}</span>
    </span>
  );
}

/** One requirement and its items, as QA left them. */
function HistoryGroup({ group }: Readonly<{ group: ProjectRunGroup }>) {
  return (
    <li className="ihist-group">
      <p className="ihist-group__head">
        <span className="ihist-group__kind" data-kind={group.kind}>
          {kindCopy(group.kind).singular}
        </span>
        <span className="ihist-group__name">{group.requirementName}</span>
        <span className="ihist-group__count">{groupPassLabel(group)}</span>
      </p>
      <ul className="ihist-items" aria-label={`${kindCopy(group.kind).items} of ${group.requirementName}`}>
        {group.items.map((item) => (
          <li key={item.id} className="ihist-item">
            <span className="ihist-item__title">{item.title}</span>
            <span className="ihist-item__facts">
              {item.progress ? <span className="ihist-item__progress">{progressLabel(item.progress)}</span> : null}
              <StatusPill status={item.status} />
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** The frozen report: who signed it off, the score, the heads it verified, every item. */
function FrozenReport({ run, showRepositories }: Readonly<{ run: ProjectQaRun; showRepositories: boolean }>) {
  const signoff = run.signoff;
  return (
    <div className="ihist-report">
      {signoff ? (
        <div className="ihist-signoff">
          <VerdictPill verdict={signoff.verdict} />
          <span className="ihist-signoff__by">{historySignoffLabel(signoff)}</span>
          {signoff.summary ? <p className="ihist-signoff__summary">{signoff.summary}</p> : null}
        </div>
      ) : null}
      <p className="ihist-score">
        {passedLabel(run)} · {openDefectsLabel(run.summary.openDefects)} · {blockersLabel(run.summary.blockers)}
      </p>
      {showRepositories && run.repositories.length > 0 ? (
        <ul className="ihist-heads" aria-label="What QA verified">
          {run.repositories.map((head) => (
            <li key={head.projectId} className="ihist-heads__item">
              <code>{headLabel(head.repoFullName, head.runSha)}</code>
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="ihist-groups">
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
  showRepositories,
}: Readonly<{ report: HistoryReport | undefined; onRetry: () => void; showRepositories: boolean }>) {
  if (!report || report.status === "loading") {
    return <div className="hier-skeleton ihist-skeleton" aria-hidden="true" />;
  }
  if (report.status === "error") {
    return (
      <div className="ihist-note" role="alert">
        <p>{report.message}</p>
        <button type="button" className="ghost-button" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  return <FrozenReport run={report.run} showRepositories={showRepositories} />;
}

/** One iteration: its title as the toggle, and — opened — its frozen checklist. */
function HistoryCard({
  iteration,
  vm,
  showRepositories,
}: Readonly<{ iteration: HistoryIteration; vm: IterationHistoryViewModel; showRepositories: boolean }>) {
  const open = vm.open[iteration.id] === true;
  const bodyId = `history-${iteration.id}`;
  const note = historyNoReportText(iteration);
  return (
    <li className="ihist-card" data-status={iteration.status} data-open={String(open)}>
      <div className="ihist-card__head">
        <h4 className="ihist-card__title">
          <button
            type="button"
            className="ihist-card__toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => vm.toggle(iteration)}
          >
            <span>{iterationTitle(iteration)}</span>
            <Chevron />
          </button>
        </h4>
        <StateTag status={iteration.status} />
      </div>
      <p className="ihist-card__meta">{historyMetaLabel(iteration)}</p>
      <div id={bodyId} className="ihist-card__body" hidden={!open}>
        {open ? (
          note ? (
            <p className="ihist-note">{note}</p>
          ) : (
            <ReportBody
              report={iteration.signoffRunId ? vm.reports[iteration.signoffRunId] : undefined}
              onRetry={() => vm.retryReport(iteration)}
              showRepositories={showRepositories}
            />
          )
        ) : null}
      </div>
    </li>
  );
}

function HistoryBody({ vm, showRepositories }: Readonly<{ vm: IterationHistoryViewModel; showRepositories: boolean }>) {
  if (vm.status === "loading" || vm.status === "idle") {
    return <div className="hier-skeleton ihist-skeleton" aria-hidden="true" />;
  }
  if (vm.status === "unavailable") {
    return <p className="ihist-note">This server does not keep iterations yet.</p>;
  }
  if (vm.status === "error") {
    return (
      <div className="ihist-note" role="alert">
        <p>{vm.error}</p>
        <button type="button" className="ghost-button" onClick={vm.reload}>
          Try again
        </button>
      </div>
    );
  }
  if (vm.iterations.length === 0) return <p className="ihist-note">{HISTORY_EMPTY_TEXT}</p>;
  return (
    <ul className="ihist-list" aria-label="Iterations, newest first">
      {vm.iterations.map((iteration) => (
        <HistoryCard key={iteration.id} iteration={iteration} vm={vm} showRepositories={showRepositories} />
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
  appRole,
}: Readonly<{
  deliveryProjectId: string;
  projectName: string;
  enabled: boolean;
  /** Product owners and the QA Team see the Project only: no commits per repository. */
  appRole?: AppRole | null;
}>) {
  const vm = useIterationHistoryViewModel({ deliveryProjectId, enabled });
  return (
    <section className="ihist" aria-labelledby="history-title">
      <div className="ihist__head">
        <h3 className="ihist__title" id="history-title">
          {projectName} history
        </h3>
        <p className="ihist__intro">{HISTORY_INTRO}</p>
      </div>
      <HistoryBody vm={vm} showRepositories={showsRepositories(appRole)} />
    </section>
  );
}
