"use client";

import "./automation.css";

import { useId } from "react";

import { TonePill } from "../../items";
import {
  automationStages,
  failuresToggleLabel,
  listedFailures,
  noAutomationText,
  stageCoverage,
  stageName,
  stagePassShare,
  stageRunLabel,
  stageRunTone,
  stageTestsLabel,
  unlistedFailuresNote,
} from "../../model/qa-automation-rules";
import type { QaAutomationStage, QaStageResult, QaStageTests } from "../../model/qa-automation-types";
import { formatReportDate } from "../../model/qa-report-rules";
import { agoLabel, shortSha } from "../../model/qa-run-rules";
import type { QaRun } from "../../model/qa-run-types";
import type { QaAutomationViewModel } from "../view-models/use-qa-automation-view-model";
import { useDisclosure, useRememberedFlag } from "../view-models/use-remembered-flag";
import { ViewRunLink } from "./run-item-automation";
import { ChevronDownIcon, CrossIcon, FlaskIcon, PlayIcon, WarningIcon } from "./studio-icons";

/** Per viewer, per browser: whether they folded the panel away. */
export const AUTOMATION_PANEL_COLLAPSED_KEY = "alphaci.qa-studio.automation-panel.collapsed";

/* ── One stage ───────────────────────────────────────────────────────────── */

/** "22 / 24 passed" and a slim bar of the passed share. */
function StageFigures({ tests }: Readonly<{ tests: QaStageTests | null }>) {
  const label = stageTestsLabel(tests);
  const share = stagePassShare(tests);
  if (!label) return <span className="qa-auto-stage__none">No test counts reported</span>;
  return (
    <span className="qa-auto-stage__figures">
      <span className="qa-auto-stage__count">{label}</span>
      {share === null ? null : (
        <span className="qa-auto-stage__bar" aria-hidden="true">
          <span className="qa-auto-stage__fill" style={{ width: `${share}%` }} />
        </span>
      )}
    </span>
  );
}

function FailureList({
  id,
  stage,
  tests,
  hidden,
}: Readonly<{ id: string; stage: QaAutomationStage; tests: QaStageTests | null; hidden: boolean }>) {
  const failures = listedFailures(tests);
  const note = unlistedFailuresNote(tests);
  if (failures.length === 0 && !note) return null;
  return (
    <div id={id} className="qa-auto-failures" hidden={failures.length > 0 && hidden}>
      {failures.length > 0 ? (
        <ol className="qa-auto-failures__list" aria-label={`${stageName(stage)} failures`}>
          {failures.map((failure, index) => (
            <li key={`${index}-${failure.name}`} className="qa-auto-failure">
              <CrossIcon />
              <div className="qa-auto-failure__body">
                <code className="qa-auto-failure__name">{failure.name}</code>
                {failure.message ? (
                  <p className="qa-auto-failure__message" title={failure.message}>
                    {failure.message}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {note ? <p className="qa-auto-failures__note">{note}</p> : null}
    </div>
  );
}

interface FailuresDisclosure {
  id: string;
  open: boolean;
  onToggle: () => void;
}

/**
 * "2 failed ▾": the failed count doubles as the disclosure for the failures
 * list, so the stage stays one line of facts. A plain count when CI listed
 * none.
 */
function FailedToggle({ tests, disclosure }: Readonly<{ tests: QaStageTests | null; disclosure: FailuresDisclosure }>) {
  const failed = tests?.failed ?? 0;
  const toggleLabel = failuresToggleLabel(tests, disclosure.open);
  if (!toggleLabel) return failed > 0 ? <span className="qa-auto-stage__failed">{failed} failed</span> : null;
  const listed = listedFailures(tests).length;
  return (
    <button
      type="button"
      className="qa-auto-stage__failed qa-auto-stage__toggle"
      aria-expanded={disclosure.open}
      aria-controls={disclosure.id}
      title={toggleLabel}
      onClick={disclosure.onToggle}
    >
      {failed > 0 ? `${failed} failed` : `${listed} ${listed === 1 ? "failure" : "failures"}`}
      <span className="sr-only">{` — ${toggleLabel.toLowerCase()}`}</span>
      <ChevronDownIcon />
    </button>
  );
}

/** "22 / 24 passed ▬▬ · 2 failed ▾ · 3m ago · View run". */
function StageMeta({ result, disclosure }: Readonly<{ result: QaStageResult; disclosure: FailuresDisclosure }>) {
  const ago = agoLabel(result.reportedAt);
  return (
    <p className="qa-auto-stage__meta">
      <StageFigures tests={result.tests} />
      <FailedToggle tests={result.tests} disclosure={disclosure} />
      {ago ? (
        <span>
          <span className="sr-only">Reported </span>
          <time dateTime={result.reportedAt ?? undefined} title={`Reported ${formatReportDate(result.reportedAt)}`}>
            {ago}
          </time>
        </span>
      ) : null}
      {result.runUrl ? <ViewRunLink href={result.runUrl} /> : null}
    </p>
  );
}

/**
 * One CI stage in two lines: its name and verdict; then the counts, when it
 * reported, a link to the run and its failures. The failures list folds away so the panel
 * never crowds out the items — each item already shows its own failure.
 */
function StageCard({ result }: Readonly<{ result: QaStageResult }>) {
  const headingId = useId();
  const failuresId = useId();
  const [open, toggle] = useDisclosure();
  const tone = stageRunTone(result.status);
  return (
    <article className={`qa-auto-stage qa-auto-stage--${tone}`} aria-labelledby={headingId}>
      <div className="qa-auto-stage__row">
        <h4 id={headingId} className="qa-auto-stage__title">
          {stageName(result.stage)}
          <span className="qa-auto-stage__coverage"> — {stageCoverage(result.stage)}</span>
        </h4>
        <TonePill tone={tone} label={stageRunLabel(result.status)} />
      </div>
      <StageMeta result={result} disclosure={{ id: failuresId, open, onToggle: toggle }} />
      <FailureList id={failuresId} stage={result.stage} tests={result.tests} hidden={!open} />
    </article>
  );
}

/** A stage that has not reported while the other has: say so, compactly. */
function StageMissing({ stage, commitSha }: Readonly<{ stage: QaAutomationStage; commitSha: string | null }>) {
  const short = shortSha(commitSha);
  return (
    <p className="qa-auto-stage qa-auto-stage--missing">
      <span className="qa-auto-stage__title">
        {stageName(stage)}
        <span className="qa-auto-stage__coverage"> — {stageCoverage(stage)}</span>
      </span>
      <span className="qa-auto-stage__none">{short ? `Not reported for ${short} yet` : "Not reported yet"}</span>
    </p>
  );
}

/* ── Header, feedback and body ───────────────────────────────────────────── */

/** Collapsed, the header still says how each stage went. */
function StageChips({ vm }: Readonly<{ vm: QaAutomationViewModel }>) {
  if (!vm.hasResults) return <span className="qa-auto__chip qa-auto__chip--none">No results yet</span>;
  return (
    <span className="qa-auto__chips">
      {automationStages(vm.automation).map(({ stage, result }) =>
        result ? (
          <span key={stage} className={`qa-auto__chip qa-auto__chip--${stageRunTone(result.status)}`}>
            {stageName(stage)}: {stageRunLabel(result.status)}
          </span>
        ) : null,
      )}
    </span>
  );
}

function runButtonLabel(vm: QaAutomationViewModel): string {
  if (vm.status === "dispatching") return "Starting…";
  return vm.status === "watching" || vm.status === "dispatched" ? "Run Playwright again" : "Run Playwright";
}

function RunPlaywrightButton({ vm, reasonId }: Readonly<{ vm: QaAutomationViewModel; reasonId: string }>) {
  if (!vm.canDispatch) return null;
  return (
    <button
      type="button"
      className="qa-auto__run"
      disabled={vm.status === "dispatching" || vm.blockedReason !== null}
      aria-describedby={vm.blockedReason ? reasonId : undefined}
      onClick={() => void vm.dispatch()}
    >
      <PlayIcon />
      {runButtonLabel(vm)}
    </button>
  );
}

/** Always mounted, so the confirmation is announced when it appears. */
function DispatchFeedback({ vm }: Readonly<{ vm: QaAutomationViewModel }>) {
  return (
    <>
      <div className="qa-auto__live" role="status" aria-live="polite">
        {vm.confirmation ? (
          <p className="qa-auto__confirm">
            <span className="qa-auto__pulse" data-watching={vm.status === "watching" ? "true" : "false"} aria-hidden="true" />
            <span>
              {vm.confirmation}
              {vm.status === "watching" ? <span className="qa-auto__watching"> Checking every 20 seconds.</span> : null}
            </span>
          </p>
        ) : null}
        {vm.warning ? (
          <p className="qa-auto__warning">
            <WarningIcon />
            <span>{vm.warning}</span>
          </p>
        ) : null}
      </div>
      {vm.error ? (
        <div className="qa-inline-alert qa-auto__error" role="alert">
          <p>{vm.error.message}</p>
          {vm.error.signIn ? (
            <a className="ghost-button qa-auto__signin" href={vm.signInHref}>
              Sign in again
            </a>
          ) : null}
          <button type="button" className="qa-text-button" onClick={vm.dismiss}>
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  );
}

function AutomationEmpty({ vm, run }: Readonly<{ vm: QaAutomationViewModel; run: QaRun }>) {
  return (
    <div className="qa-auto__empty">
      <span className="qa-auto__empty-icon" aria-hidden="true">
        <FlaskIcon size={18} />
      </span>
      <div>
        <p className="qa-auto__empty-title">{noAutomationText(run.branch, run.commitSha)}</p>
        <p className="qa-auto__empty-text">
          Results appear here when the verify or quality stage reports for this exact commit.
          {vm.canDispatch && !vm.blockedReason ? " Run Playwright to start the verify stage now." : ""}
        </p>
      </div>
    </div>
  );
}

function AutomationBody({ vm, run }: Readonly<{ vm: QaAutomationViewModel; run: QaRun }>) {
  if (!vm.hasResults) return <AutomationEmpty vm={vm} run={run} />;
  return (
    <div className="qa-auto__stages">
      {automationStages(vm.automation).map(({ stage, result }) =>
        result ? (
          <StageCard key={stage} result={result} />
        ) : (
          <StageMissing key={stage} stage={stage} commitSha={run.commitSha} />
        ),
      )}
    </div>
  );
}

/**
 * The run's automated tests, above its items: how the verify (browser & API)
 * and quality (unit) stages went on this exact commit, and — for QA Team, Team
 * leads and Admins — "Run Playwright". Collapsible; the choice is remembered
 * in this browser. Information only: sign-off stays manual.
 */
export function AutomationPanel({ vm, run }: Readonly<{ vm: QaAutomationViewModel; run: QaRun }>) {
  const [collapsed, toggle] = useRememberedFlag(AUTOMATION_PANEL_COLLAPSED_KEY, false);
  const bodyId = useId();
  const reasonId = useId();
  return (
    <section className="qa-auto" aria-label="Automated tests" data-collapsed={collapsed ? "true" : "false"}>
      <div className="qa-auto__head">
        <button
          type="button"
          className="qa-auto__toggle"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={toggle}
        >
          <ChevronDownIcon />
          <span className="qa-auto__title">Automated tests</span>
          {collapsed ? <StageChips vm={vm} /> : null}
        </button>
        <RunPlaywrightButton vm={vm} reasonId={reasonId} />
      </div>
      {vm.canDispatch && vm.blockedReason ? (
        <p id={reasonId} className="qa-auto__reason">
          {vm.blockedReason}
        </p>
      ) : null}
      <DispatchFeedback vm={vm} />
      <div id={bodyId} className="qa-auto__body" hidden={collapsed}>
        <AutomationBody vm={vm} run={run} />
      </div>
    </section>
  );
}
